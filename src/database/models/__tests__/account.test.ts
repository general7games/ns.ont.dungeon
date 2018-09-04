import * as db from '../../database'
import * as account from '../account'
import * as uuid from 'uuid'
import { getConfig, config } from '../../../config'


beforeAll(async () => {
	config('test')
	await db.connect()
})

afterAll(async () => {
	await db.close()
})

beforeEach(async () => {
	await db.account().drop()
})

test('create account and decrypt it', () => {
	const password = uuid.v1()
	const a = account.Account.create('testAccount', password, 'user')
	expect(a.decryptPrivateKey(password)).toBeDefined()
	expect(a.decryptMnemonic(password)).toBeDefined()
})
