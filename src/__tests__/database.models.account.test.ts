import * as db from '../database'
import * as account from '../database/models/account'
import * as uuid from 'uuid'
import * as err from '../errors'
import { config } from '../config'

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
		// empty
	}
})

describe('account test', () => {

	it('create account and decrypt it', () => {
		const password = uuid.v1()
		const a = account.Account.create('testAccount', password)
		expect(a.decryptPrivateKey(password)).toBeDefined()
		expect(a.decryptMnemonic(password)).toBeDefined()
	})

	it('create account and store in database', async () => {
		const password = uuid.v1()
		const a = account.Account.create('testAccount', password)
		const saved = await a.save()
		expect(saved).toEqual(err.SUCCESS)

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

	it('import account from account info', () => {
		const testAccountInfo: account.AccountInfo = {
			label: 'testAccount',
			address: 'ALmX48UbcsMEi1Mm4r5GmZsHkUEw97vn3B',
			key: 'D0CPEWfws0ET4V2Pyihn9OqcKCcF+AxK/9HhNMzI+bFl5HY/JFjHXf4JSSKa1EzI',
			algorithm: 'ECDSA',
			salt: '3a4Pxk1Qka3z+REJpn76FA==',
			parameters: {
				curve: 'P-256'
			},
			scrypt: {
				p: 8,
				n: 16384,
				r: 8,
				dkLen: 64
			}
		}
		const a = account.Account.import(testAccountInfo, '123456789')
		expect(a).toBeDefined()
		if (a) {
			expect(a.decryptMnemonic('123456789')).toBeNull()
			expect(a.decryptPrivateKey('123456789')).not.toBeNull()
		}
	})

})
