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

	it('create an ontid', async () => {

		const password = uuid.v1()
		const result = await ontid.OntID.createAndSave(
			'Admin Label', password, 'admin')
		expect(result.error).toEqual(err.SUCCESS)
		expect(result.ontID).toBeDefined()

		const id = await ontid.OntID.findByID(result.ontID.ontID())
		expect(id).not.toBeNull()

		if (id) {
			const pair = id.decryptedController(password, 1)
			expect(pair).not.toBeNull()
		}

	})

})