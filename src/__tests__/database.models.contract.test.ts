import * as db from '../database'
import * as account from '../database/models/account'
import * as contract from '../database/models/contract'
import * as uuid from 'uuid'
import * as fs from 'fs'
import * as testUtils from './utils'
import { BigNumber } from 'bignumber.js'
import { config, getConfig } from '../config'
import { ensureAssetsOfAccount } from './utils';
import * as ont from 'ontology-ts-sdk'
import * as err from '../errors'
import * as ow from '../ow'
import { exec } from 'child_process';
import { Result } from 'range-parser';

jest.setTimeout(20000)

beforeAll(async () => {
	config('test')
	await db.connect()
})

afterAll(async () => {
	await db.close()
})

beforeEach(async () => {
	try {
		await db.account().drop()
	} catch (e) {
	}

	try {
		await db.contract().drop()
	} catch (e) {
	}
})

describe('contract test', () => {
	it('deploy contract and invoke', async () => {

		const password = uuid.v1()
		const a = account.Account.create('testAdmin', password, 'admin')
		const saved = await a.save()
		expect(saved).toBeTruthy()

		const conf = getConfig()
		const gasPrice = new BigNumber(conf.ontology.gasPrice)
		const gasLimit = new BigNumber(conf.ontology.gasLimit)
		const gasRequired = gasPrice.multipliedBy(gasLimit).multipliedBy(2)


		const beSure = await ensureAssetsOfAccount(a.address().toBase58(), { ong: gasRequired.toString() })
		expect(beSure).toBeTruthy()

		await testUtils.wait(5000)

		const content = fs.readFileSync('public/contracts/test/Add.Test.Contract.Ont.Dungeon.hex', 'utf8')
		const abi = JSON.parse(fs.readFileSync('public/contracts/test/Add.Test.Contract.Ont.Dungeon.abi.json', 'utf8'))
		const newContract = new contract.Contract({
			name: 'test',
			script: content,
			version: '0',
			storage: true,
			author: 'test author',
			email: 'test@email.com',
			description: 'test contract: Add',
			abi: abi
		})
		const privateKey = a.decryptPrivateKey(password)
		expect(privateKey).toBeDefined()

		if (!privateKey) {
			return
		}

		const r = await newContract.deployAndSave({
			account: {
				address: a.address(),
				privateKey: privateKey
			},
			preExec: false
		})
		expect(r).toEqual(err.SUCCESS)


		// start invoke
		const p1 = new ont.Parameter('a', ont.ParameterType.Integer, 2)
		const p2 = new ont.Parameter('b', ont.ParameterType.Integer, 2)
		const invokeResult = await newContract.invoke('Cal', [p1, p2], {address: a.address(), privateKey: privateKey}, false)
		expect(invokeResult.error).toEqual(err.SUCCESS)

		await testUtils.wait(5000)

		const notifyResult = await ow.getClient().getSmartCodeEvent(invokeResult.result)
		expect(notifyResult.Error).toEqual(0)
		expect(notifyResult.Result.State).toEqual(1)
	})

})
