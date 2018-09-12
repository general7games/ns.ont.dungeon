import * as db from '../database'
import * as account from '../database/models/account'
import * as contract from '../database/models/contract'
import * as uuid from 'uuid'
import * as fs from 'fs'
import { BigNumber } from 'bignumber.js'
import { config, getConfig } from '../config'
import { ensureAssetsOfAccount, readAVMHex } from './utils'
import * as ont from 'ontology-ts-sdk'
import * as err from '../errors'
import * as ow from '../ow'
import { DecryptedAccountPair } from '../types'

jest.setTimeout(30000)
beforeAll(async () => {
	config('test')
	await db.connect()

	try {
		await db.account().drop()
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
	await ow.getClient().close()
	await db.close()
})

describe('contract test', () => {

	const password = uuid.v1()
	const testAdminAccount = account.Account.create('testAdmin', password, 'admin')
	const privateKey = testAdminAccount.decryptPrivateKey(password)
	if (!privateKey) {
		fail('testAdmin decrypted error')
		return
	}
	const testAdminAccountPair: DecryptedAccountPair = {address: testAdminAccount.address(), privateKey}

	it('deploy contract and invoke', async () => {

		const conf = getConfig()
		const gasPrice = new BigNumber(conf.ontology.gasPrice)
		const gasLimit = new BigNumber(conf.ontology.gasLimit)
		const gasRequired = gasPrice.multipliedBy(gasLimit).multipliedBy(2)

		const beSure = await ensureAssetsOfAccount(testAdminAccount.address().toBase58(), { ong: gasRequired.toString() })
		expect(beSure).toBeTruthy()

		const content = readAVMHex('public/contracts/test/Add.Test.Contract.Ont.Dungeon.avm.hex', 'utf8')

		const newContract = new contract.Contract({
			name: 'test',
			script: content,
			version: '0',
			storage: true,
			author: 'test author',
			email: 'test@email.com',
			description: 'test contract: Add',
		})

		const r = await newContract.deployAndSave(testAdminAccountPair)
		expect(r).toEqual(err.SUCCESS)

		// start invoke
		let p1 = new ont.Parameter('a', ont.ParameterType.Integer, 1)
		let p2 = new ont.Parameter('b', ont.ParameterType.Integer, 2)
		let invokeResult = await newContract.invoke('Cal', [p1, p2], testAdminAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)
		expect(invokeResult.result[0] === '03')

		p1 = new ont.Parameter('name', ont.ParameterType.String, 'abc')
		p2 = new ont.Parameter('value', ont.ParameterType.Integer, 10)
		invokeResult = await newContract.invoke('Set', [p1, p2], testAdminAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)

		invokeResult = await newContract.invoke('Get', [p1], testAdminAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)
		expect(invokeResult.result[0]).toEqual('0a')

	})

	it('migrate contract and invoke', async () => {

		const conf = getConfig()
		const gasPrice = new BigNumber(conf.ontology.gasPrice)
		const gasLimit = new BigNumber(conf.ontology.gasLimit)
		const gasRequired = gasPrice.multipliedBy(gasLimit).multipliedBy(2)

		const beSure = await ensureAssetsOfAccount(testAdminAccount.address().toBase58(), { ong: gasRequired.toString() })
		expect(beSure).toBeTruthy()

		const toMigrate = await contract.Contract.find({name: 'test'})
		expect(toMigrate).not.toBeNull()
		if (!toMigrate) {
			return
		}

		const content = readAVMHex('public/contracts/test/Mul.Test.Contract.Ont.Dungeon.avm.hex', 'utf8')

		const r = await toMigrate.migrate(
			{
				script: content,
				version: '1',
				description: 'test contract: Mul'
			},
			testAdminAccountPair,
			false
		)
		expect(r).toEqual(err.SUCCESS)

		// start invoke
		let p1 = new ont.Parameter('a', ont.ParameterType.Integer, 1)
		const p2 = new ont.Parameter('b', ont.ParameterType.Integer, 2)
		let invokeResult = await toMigrate.invoke('Cal', [p1, p2], testAdminAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)
		expect(invokeResult.result[0] === '02')

		p1 = new ont.Parameter('name', ont.ParameterType.String, 'abc')
		invokeResult = await toMigrate.invoke('Get', [p1], testAdminAccountPair)
		expect(invokeResult.error).toEqual(err.SUCCESS)
		expect(invokeResult.result[0] === '0a')

	})

	it('destroy contract', async () => {
		const toDestroy = await contract.Contract.find({name: 'test'})
		expect(toDestroy).not.toBeNull()
		if (!toDestroy) {
			return
		}

		const r = await toDestroy.destroy(testAdminAccountPair)
		expect(r).toEqual(err.SUCCESS)

		const c = await contract.Contract.find({name: 'test'})
		expect(c).toBeNull()

	})

})
