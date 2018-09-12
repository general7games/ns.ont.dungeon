import * as db from '../database'
import * as contract from '../database/models/contract'
import * as uuid from 'uuid'
import * as fs from 'fs'
import { BigNumber } from 'bignumber.js'
import { config, getConfig } from '../config'
import * as ont from 'ontology-ts-sdk'
import * as err from '../errors'
import * as ontid from '../database/models/ontid'
import * as account from '../database/models/account'
import {getMainAccountOfTestNode, ensureAssetsOfAccount, readAVMHexAndChangeHash} from './utils'
import { getClient } from '../ow'

jest.setTimeout(900 * 1000)

beforeAll(async () => {
	config('test')
	await db.connect()

	try {
		await db.ontid().drop()
	} catch (e) {
		// empty
	}

	try {
		await db.contract().drop()
	} catch (e) {
		// empty
	}

})

afterAll(async () => {
	await getClient().close()
	await db.close()
})

describe('contract authority test', () => {

	const mainAccountPair = getMainAccountOfTestNode()
	expect(mainAccountPair).not.toBeNull()
	if (!mainAccountPair) {
		return
	}

	it('init admin and assign role to func', async() => {

		const conf = getConfig()
		const gasPrice = new BigNumber(conf.ontology.gasPrice)
		const gasLimit = new BigNumber(conf.ontology.gasLimit)
		const gasRequired = gasPrice.multipliedBy(gasLimit).multipliedBy(2)

		const adminAccountPassword = uuid.v1()
		const adminAccount = account.Account.create('test admin', adminAccountPassword, 'admin')
		const adminAccountPair = adminAccount.decryptedPair(adminAccountPassword)
		expect(adminAccountPair).not.toBeNull()
		if (!adminAccountPair) {
			return
		}

		let beSure = await ensureAssetsOfAccount(adminAccount.address().toBase58(), { ong: gasRequired.toString() })
		expect(beSure).toBeTruthy()

		const adminOntIDPassword = uuid.v1()
		const adminOntID = await ontid.OntID.create(adminAccountPair, 'admin', 'Test Admin OntID', adminOntIDPassword)
		expect(adminOntID).not.toBeNull()
		if (!adminOntID) {
			return
		}
		const adminOntIDControllerPair = adminOntID.decryptedController(adminOntIDPassword, 1)
		expect(adminOntIDControllerPair).not.toBeNull()
		if (!adminOntIDControllerPair) {
			return
		}

		// deploy by mainAccount
		const content = readAVMHexAndChangeHash('public/contracts/test/Test.Contract.Ont.Dungeon.avm.hex', 'utf8')
		const newContract = new contract.Contract({
			name: 'auth test',
			version: '1',
			script: content,
			storage: true,
			author: 'test admin',
			email: 'test@test.com',
			description: 'test auth',
		})
		const deployed = await newContract.deployAndSave(mainAccountPair)
		expect(deployed).toEqual(err.SUCCESS)

		const inited = await newContract.initAdmin(adminOntID.ontID(), adminOntIDControllerPair, 1)
		expect(inited).toEqual(err.SUCCESS)

		// create op account
		const opAccountPassword = uuid.v1()
		const opAccount = account.Account.create('test op', opAccountPassword, 'user')
		const opAccountPair = opAccount.decryptedPair(opAccountPassword)
		expect(opAccountPair).not.toBeNull()
		if (!opAccountPair) {
			return
		}

		beSure = await ensureAssetsOfAccount(opAccount.address().toBase58(), { ong: gasRequired.toString() })
		expect(beSure).toBeTruthy()

		// create op ontid
		const opOntIDPassword = uuid.v1()
		const opOntID = await ontid.OntID.create(opAccountPair, 'op', 'test operator', opOntIDPassword)
		expect(opOntID).not.toBeNull()
		if (!opOntID) {
			return
		}

		const opOntIDControllerPair = opOntID.decryptedController(opOntIDPassword, 1)
		expect(opOntIDControllerPair).not.toBeNull()
		if (!opOntIDControllerPair) {
			return
		}

		let r = await newContract.assignOntIDsToRole(adminOntID.ontID(), adminOntIDControllerPair, 1, [opOntID.ontID()], opOntID.role)
		expect(r).toEqual(err.SUCCESS)

		r = await newContract.assignFuncsToRole(adminOntID.ontID(), adminOntIDControllerPair, 1, ['Set'], 'op')
		expect(r).toEqual(err.SUCCESS)

		// invoke and success
		const p1 = new ont.Parameter('name', ont.ParameterType.String, 'abc')
		const p2 = new ont.Parameter('value', ont.ParameterType.Integer, 13)
		let invokeResult = await newContract.invoke('Set', [p1, p2], opOntIDControllerPair, { ontID: opOntID.ontID(), keyNo: 1 })
		expect(invokeResult.error).toEqual(err.SUCCESS)

		// storage changed
		invokeResult = await newContract.invoke('Get', [p1], mainAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)
		expect(invokeResult.result[0]).toEqual('0d') // changed

	})


})