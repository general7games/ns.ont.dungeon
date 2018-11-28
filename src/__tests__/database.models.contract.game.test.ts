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

const MAX_LINE = 10
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
	const minorAccountPair0 = testUtils.getMinorAccountOfTestNode(0)
	expect(minorAccountPair0).not.toBeNull()
	const minorAccountPair1 = testUtils.getMinorAccountOfTestNode(1)
	expect(minorAccountPair1).not.toBeNull()

	it('test game contract', async() => {

		const conf = getConfig()
		const gasPrice = new BigNumber(conf.ontology.gasPrice)
		const gasLimit = new BigNumber(conf.ontology.gasLimit)
		const gasRequired = gasPrice.multipliedBy(gasLimit).multipliedBy(2)

		const adminAccountPassword = uuid.v1()
		const deployResult = await testUtils.deployContractAndInitRandomAdmin('../contract.ont.dungeon/src/Game.Contract.Ont.Dungeon/bin/Debug/Game.Contract.Ont.Dungeon.online.avm', adminAccountPassword)
		expect(deployResult).not.toBeNull()

		const adminOntID = deployResult.ontID
		const adminOntIDControllerPair = deployResult.decryptedAccountPair
		const newContract = deployResult.contract

		// create op account
		/* const opOntIDPassword = uuid.v1()
		const opOntID = await testUtils.createRandomOntID(opOntIDPassword)
		const opOntIDControllerPair = opOntID.decryptedController(opOntIDPassword, 1)
		expect(opOntIDControllerPair).not.toBeNull()
		if (!opOntIDControllerPair) {
			return
		}

		let beSure = await ensureAssetsOfAccount(opOntIDControllerPair.address.toBase58(), { ong: gasRequired.toString() })
		expect(beSure).toBeTruthy() */

		await newContract.getAdminAccount(mainAccountPair)

		let error = await newContract.initAdminAccount(mainAccountPair)
		expect(error).toEqual(err.SUCCESS)

		let adminAddress = await newContract.getAdminAccount(mainAccountPair)
		expect(adminAddress).not.toBeNull()
		expect(utils.addrToBase58(adminAddress)).toEqual(utils.addrToBase58(mainAccountPair.address))

		const minorAccountBase580 = utils.addrToBase58(minorAccountPair0.address)
		error = await newContract.capturePoints([2], [3], [0xFFFFFF], [129], minorAccountPair0)
		expect(error).toEqual(err.CONTRACT_NOT_ENOUGH_PRICE)

		let points = await newContract.getPoints([1], [1], mainAccountPair)
		expect(points).not.toBeNull()
		expect(points).toHaveLength(1)
		expect(points[0].owner).toEqual('')
		expect(points[0].color).toEqual(0xFFFFFF)

		error = await newContract.capturePoints([1, 2], [1, 3], [0x001122, 0x334455], [130, 131], minorAccountPair0)
		expect(error).toEqual(err.SUCCESS)

		points = await newContract.getPoints([1, 2], [1, 3], mainAccountPair)
		expect(points).not.toBeNull()
		expect(points).toHaveLength(2)
		let point = points[0]
		expect(point.owner).toEqual(minorAccountBase580)
		expect(point.color).toEqual(0x001122)
		expect(point.price).toEqual(130)
		point = points[1]
		expect(point.owner).toEqual(minorAccountBase580)
		expect(point.color).toEqual(0x334455)
		expect(point.price).toEqual(131)

		error = await newContract.capturePoints([1, 2], [1, 3], [0x987654, 0x654321], [168, 169], minorAccountPair1)
		expect(error).toEqual(err.CONTRACT_NOT_ENOUGH_PRICE)

		error = await newContract.capturePoints([1, 2], [1, 3], [0x987654, 0x654321], [169, 170], minorAccountPair1)
		expect(error).toEqual(err.SUCCESS)

		const minorAccountBase581 = utils.addrToBase58(minorAccountPair1.address)
		points = await newContract.getPoints([1, 2], [1, 3], mainAccountPair)
		expect(points).not.toBeNull()
		expect(points).toHaveLength(2)
		point = points[0]
		expect(point.owner).toEqual(minorAccountBase581)
		expect(point.color).toEqual(0x987654)
		expect(point.price).toEqual(169)
		point = points[1]
		expect(point.owner).toEqual(minorAccountBase581)
		expect(point.color).toEqual(0x654321)
		expect(point.price).toEqual(170)

		let allPoints = await newContract.getAllPoints(mainAccountPair)
		expect(allPoints.maxLine).not.toEqual(0)
		expect(allPoints.points).toHaveLength(MAX_LINE * MAX_LINE)
		point = allPoints.points[2 * MAX_LINE + 1]
		expect(point.owner).toEqual(minorAccountBase581)
		expect(point.color).toEqual(0x654321)
		expect(point.price).toEqual(170)
	})
})
