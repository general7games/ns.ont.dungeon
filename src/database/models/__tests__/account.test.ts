import * as db from '../../database'
import * as account from '../account'
import * as uuid from 'uuid'
import { config } from '../../../config'

beforeAll(async () => {
	config('test')
	await db.connect()
})

afterAll(async () => {
	await db.close()
})

beforeEach((done) => {
	db.account().drop()
	.then(() => {
		done()
	})
	.catch(() => {
		done()
	})
})

describe('account test', () => {

	it('create account and decrypt it', () => {
		const password = uuid.v1()
		const a = account.Account.create('testAccount', password, 'user')
		expect(a.decryptPrivateKey(password)).toBeDefined()
		expect(a.decryptMnemonic(password)).toBeDefined()
	})

	it('create account and store in database', async () => {
		const password = uuid.v1()
		const a = account.Account.create('testAccount', password, 'user')
		const saved = await a.save()
		expect(saved).toBeTruthy()

		const mnemonicA = a.decryptMnemonic(password)

		const b = await account.Account.findByAddress(a.address().toBase58())
		expect(b).toBeDefined()
		if (b) {
			expect(b.address().toBase58()).toEqual(a.address().toBase58())
			expect(b.account.label).toEqual('testAccount')

			const mnemonicB = b.decryptMnemonic(password)

			expect(mnemonicA).toEqual(mnemonicB)
		}

	})

	it('init admin', async () => {
		const password = uuid.v1()
		const a = account.Account.create('testAdmin', password, 'admin')
		const saved = a.save()
		expect(saved).toBeTruthy()

		const b = await account.Account.findAdmin()
		expect(b).toBeDefined()
		if (b) {
			expect(b.address().toBase58()).toEqual(a.address().toBase58())
			expect(b.role).toEqual('admin')
			expect(b.account.label).toEqual('testAdmin')
		}
	})

	it('init admin twice and failed', async () => {
		const password = uuid.v1()
		const a = account.Account.create('testAdmin', password, 'admin')
		await a.save()

		const b = account.Account.create('anotherAdmin', uuid.v1(), 'admin')
		const saved = await b.save()
		expect(saved).toEqual('duplicated')
	})

})
