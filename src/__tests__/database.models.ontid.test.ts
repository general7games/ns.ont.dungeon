import * as ontid from '../database/models/ontid'
import * as account from '../database/models/account'
import * as uuid from 'uuid'
import { config, getConfig } from '../config'
import * as db from '../database'
import * as ow from '../ow'
import * as testUtils from './utils'
import { BigNumber } from 'bignumber.js'
import * as err from '../errors'

jest.setTimeout(30 * 1000)

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
})

afterAll(async () => {
	await ow.getClient().close()
	await db.close()
})


describe('ontid test', () => {

	const password = uuid.v1()
	const testAdminAccount = account.Account.create('testAdmin', password)
	const testAdminPrivateKey = testAdminAccount.decryptPrivateKey(password)
	if (!testAdminPrivateKey) {
		fail('testAdmin decrypted error')
		return
	}
	const testAdminAccountPair = { address: testAdminAccount.address(), privateKey: testAdminPrivateKey}

	it('create an ontid', async () => {

		const conf = getConfig()
		const gasPrice = new BigNumber(conf.ontology.gasPrice)
		const gasLimit = new BigNumber(conf.ontology.gasLimit)
		const gasRequired = gasPrice.multipliedBy(gasLimit).multipliedBy(2)

		const beSure = await testUtils.ensureAssetsOfAccount(testAdminAccount.address().toBase58(), { ong: gasRequired.toString() })
		expect(beSure).toEqual(err.SUCCESS)

		const password = uuid.v1()
		const newOntID = await ontid.OntID.create(
			testAdminAccountPair,
			'Admin Label', password)
		expect(newOntID).not.toBeNull()

		if (!newOntID) {
			return
		}

		const saved = await newOntID.save()
		expect(saved).toEqual(err.SUCCESS)

		const id = await ontid.OntID.findByID(newOntID.ontID())
		expect(id).not.toBeNull()

		if (id) {
			const pair = id.decryptedController(password, 1)
			expect(pair).not.toBeNull()
		}

	})

})