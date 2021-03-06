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
import * as utils from '../utils'
import * as testUtils from './utils'

jest.setTimeout(900 * 1000)

beforeAll(async () => {
	config('test')
	await db.connect()
})

beforeEach(async () => {
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

describe('contract test', () => {

	const mainAccountPair = getMainAccountOfTestNode()
	expect(mainAccountPair).not.toBeNull()
	if (!mainAccountPair) {
		return
	}

	it('init admin and assign role to func, and then invoke', async() => {

		const conf = getConfig()
		const gasPrice = new BigNumber(conf.ontology.gasPrice)
		const gasLimit = new BigNumber(conf.ontology.gasLimit)
		const gasRequired = gasPrice.multipliedBy(gasLimit).multipliedBy(2)

		const adminAccountPassword = uuid.v1()
		const deployResult = await testUtils.deployContractAndInitRandomAdmin('_workspace/t1.avm', adminAccountPassword)
		expect(deployResult).not.toBeNull()

		const adminOntID = deployResult.ontID
		const adminOntIDControllerPair = deployResult.decryptedAccountPair
		const newContract = deployResult.contract

		// create op account
		const opOntIDPassword = uuid.v1()
		const opOntID = await testUtils.createRandomOntID(opOntIDPassword)
		const opOntIDControllerPair = opOntID.decryptedController(opOntIDPassword, 1)
		expect(opOntIDControllerPair).not.toBeNull()
		if (!opOntIDControllerPair) {
			return
		}

		let beSure = await ensureAssetsOfAccount(opOntIDControllerPair.address.toBase58(), { ong: gasRequired.toString() })
		expect(beSure).toBeTruthy()

		/*const role = 'op'
		let r = await newContract.assignOntIDsToRole(adminOntID.ontIDPair(1), adminOntIDControllerPair,[opOntID.ontID()], role)
		expect(r).toEqual(err.SUCCESS)

		r = await newContract.assignFuncsToRole(adminOntID.ontIDPair(1), adminOntIDControllerPair, ['Set'], role)
		expect(r).toEqual(err.SUCCESS)*/

		const params = [
			new ont.Parameter('from', ont.ParameterType.ByteArray, ont.utils.reverseHex(mainAccountPair.address.toHexString())),
			new ont.Parameter('to', ont.ParameterType.ByteArray, ont.utils.reverseHex(utils.base58ToAddr('AGwzyQy7ujL5rNpYHTkXEYphHveK6uTmX8').toHexString())),
			new ont.Parameter('ontAmount', ont.ParameterType.Integer, 1)
		]
		let invokeResult = await newContract.invoke('TransferONT', params, mainAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)

		// invoke and success
		const p1 = new ont.Parameter('name', ont.ParameterType.String, 'abc')
		let p2 = new ont.Parameter('value', ont.ParameterType.Integer, 13)
		invokeResult = await newContract.invoke('Set', [p1, p2], opOntIDControllerPair, { ontID: opOntID.ontID(), keyNo: 1 })
		expect(invokeResult.error).toEqual(err.SUCCESS)

		// storage changed
		invokeResult = await newContract.invoke('Get', [p1], mainAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)
		expect(invokeResult.result[0]).toEqual('0d') // changed

		// invoke with random ontid, will fail
		const randomPassword = uuid.v1()
		const randomOntID = await testUtils.createRandomOntID(randomPassword)
		expect(randomOntID).not.toBeNull()
		if (!randomOntID) {
			return
		}
		const randomOntIDControllerPair = randomOntID.decryptedController(randomPassword, 1)

		// try call set without authority
		p2 = new ont.Parameter('value', ont.ParameterType.Integer, 25)
		invokeResult = await newContract.invoke('Set', [p1, p2], randomOntIDControllerPair, {ontID: randomOntID.ontID(), keyNo: 1})
		expect(invokeResult.error).toEqual(err.CONTRACT_UNAUTHORIZED)

		p2 = new ont.Parameter('value', ont.ParameterType.Integer, 25)
		invokeResult = await newContract.invoke('Set', [p1, p2], randomOntIDControllerPair)
		expect(invokeResult.error).toEqual(err.TRANSACTION_FAILED)

		// storage changed
		invokeResult = await newContract.invoke('Get', [p1], mainAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)
		expect(invokeResult.result[0]).toEqual('0d') // not changed

	})

	/*it('migrate contract', async () => {

		const adminAccountPassword = uuid.v1()
		const deployResult = await testUtils.deployContractAndInitRandomAdmin('public/contracts/test/Add.Test.Contract.Ont.Dungeon.avm.hex', adminAccountPassword)
		expect(deployResult).not.toBeNull()

		// migrate by some random account without ontID
		const randomPassword = uuid.v1()
		const randomOntID = await testUtils.createRandomOntID(randomPassword)
		const randomOntIDControllerPair = randomOntID.decryptedController(randomPassword, 1)

		const content = testUtils.readAVMHexAndChangeHash('public/contracts/test/Mul.Test.Contract.Ont.Dungeon.avm.hex', 'utf8')
		let r = await deployResult.contract.migrate({
			script: content,
			version: '2'
		}, randomOntIDControllerPair)
		expect(r).toEqual(err.TRANSACTION_FAILED)

		r = await deployResult.contract.migrate({
			script: content,
			version: '2'
		}, randomOntIDControllerPair, randomOntID.ontIDPair(1))
		expect(r).toEqual(err.CONTRACT_UNAUTHORIZED)

		// migrate by admin

		// admin assign itself a role
		r = await deployResult.contract.assignOntIDsToRole(
			deployResult.ontID.ontIDPair(1), deployResult.decryptedAccountPair, [deployResult.ontID.ontID()], 'admin'
		)
		expect(r).toEqual(err.SUCCESS)
		r = await deployResult.contract.assignFuncsToRole(
			deployResult.ontID.ontIDPair(1), deployResult.decryptedAccountPair, ['Migrate'], 'admin'
		)
		expect(r).toEqual(err.SUCCESS)

		r = await deployResult.contract.migrate(
			{
				script: content,
				version: '2'
			},
			deployResult.decryptedAccountPair,
			deployResult.ontID.ontIDPair(1)
		)
		expect(r).toEqual(err.SUCCESS)

		// test if really migrated
		const p1 = new ont.Parameter('a', ont.ParameterType.Integer, 1)
		const p2 = new ont.Parameter('b', ont.ParameterType.Integer, 2)
		const invokeResult = await deployResult.contract.invoke('Cal', [p1, p2], randomOntIDControllerPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)
		expect(invokeResult.result[0]).toEqual('02')
	})*/
})
