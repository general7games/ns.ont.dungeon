import * as db from '../database'
import * as ont from 'ontology-ts-sdk'
import * as loglevel from 'loglevel'
import * as utils from '../../utils'

const DEFAULT_SCRYPT = {
	cost: 16384,
	blockSize: 8,
	parallel: 8,
	size: 64
}

const log = loglevel.getLogger('ow.account')

function createAccount(label: string, password: string, scrypt: ont.scrypt.ScryptParams): {
	account: any,
	mnemonicEnc: string
} {
	const mnemonic = ont.utils.generateMnemonic()
	const mnemonicHex = ont.utils.str2hexstr(mnemonic)
	const privateKey = ont.Crypto.PrivateKey.generateFromMnemonic(mnemonic)
	const account = ont.Account.create(privateKey, password, label, scrypt)
	const addr = account.address
	const salt = Buffer.from(account.salt, 'base64').toString('hex')
	const mnemonicEnc = ont.scrypt.encryptWithGcm(mnemonicHex, addr, salt, password, scrypt)
	return {
		account: account.toJsonObj(),
		mnemonicEnc
	}
}

function decryptMnemonic(account: {
	mnemonicEnc: string,
	address: ont.Crypto.Address,
	salt: string,
	password: string,
	scrypt?: ont.scrypt.ScryptParams
}): string | null {

	const saltHex = Buffer.from(account.salt, 'base64').toString('hex')
	let scrypt: ont.scrypt.ScryptParams
	if (!account.scrypt) {
		scrypt = DEFAULT_SCRYPT
	} else {
		scrypt = account.scrypt
	}
	const decMneHex = ont.scrypt.decryptWithGcm(account.mnemonicEnc, account.address, saltHex, account.password, scrypt)
	const decMne = ont.utils.hexstr2str(decMneHex)
	return decMne
}

function createEncryptedPrivateKey(info: {
	key: string,
	algorithm?: string,
	parameters?: {
		curve: string
	}
}) {
	// algorithm
	let keyType: ont.Crypto.KeyType | undefined
	if (info.algorithm) {
		keyType = ont.Crypto.KeyType.fromLabel(info.algorithm)
	}
	let keyParameters: ont.Crypto.KeyParameters | undefined
	if (info.parameters) {
		keyParameters = ont.Crypto.KeyParameters.deserializeJson(info.parameters)
	}
	return new ont.Crypto.PrivateKey(info.key, keyType, keyParameters)
}

function decryptPrivateKey(account: {
	key: string,
	address: ont.Crypto.Address,
	salt: string,
	password: string,
	parameters?: ont.Crypto.JsonKeyParameters,
	algorithm?: string,
	scrypt?: ont.scrypt.ScryptParams
}): ont.Crypto.PrivateKey | null {

	const address = account.address
	const salt = Buffer.from(account.salt, 'base64').toString('hex')

	const encryptedPrivateKey = createEncryptedPrivateKey(account)

	// scrypt
	let scryptParams: ont.scrypt.ScryptParams
	if (account.scrypt) {
		scryptParams = account.scrypt
	} else {
		scryptParams = DEFAULT_SCRYPT
	}

	try {
		return encryptedPrivateKey.decrypt(account.password, address, salt, scryptParams)
	} catch (e) {
		// nothing here
		log.warn('decrypt account failed')
	}
	return null
}

export type AccountRole = 'admin' | 'user'
export type AccountResult = true | false | 'duplicated'
export type AccountInfo = {
	label: string, address: string,
	key: string, salt: string,
	algorithm?: string,
	parameters?: {
		curve: string
	},
	scrypt?: {
		p: number,
		n: number,
		r: number,
		dkLen: number
	}
}

export class Account {

	static async findAdmin(): Promise<Account | null> {
		const cAccount = db.account()
		const adminAccount = await cAccount.findOne({ role: 'admin' })
		if (adminAccount) {
			const account = new Account('admin', adminAccount.account, adminAccount.mnemonicEnc)
			return account
		}
		return null
	}

	static async findByAddress(address: string): Promise<Account | null> {
		const cAccount = db.account()
		const r = await cAccount.findOne({ 'account.address': address })
		if (r) {
			return new Account(r.role, r.account, r.mnemonicEnc)
		}
		return null
	}

	static create(label: string, password: string, role: AccountRole): Account {
		const r = createAccount(label, password, DEFAULT_SCRYPT)
		return new Account(role, r.account, r.mnemonicEnc, DEFAULT_SCRYPT)
	}

	static import(info: AccountInfo, password: string, role: AccountRole): Account | null {

		const encryptedPrivateKey = createEncryptedPrivateKey(info)
		let scrypt: ont.scrypt.ScryptParams | undefined
		if (info.scrypt) {
			scrypt = {
				cost: info.scrypt.n,
				blockSize: info.scrypt.r,
				parallel: info.scrypt.p,
				size: info.scrypt.dkLen
			}
		} else {
			scrypt = DEFAULT_SCRYPT
		}

		const ontAccount = ont.Account.importAccount(
			info.label, encryptedPrivateKey, password, utils.base58ToAddr(info.address), info.salt, scrypt)

		const mnemonicEnc = ''

		return new Account(role, ontAccount.toJsonObj(), mnemonicEnc, scrypt)

	}

	static createFromMnemonic(
		label: string, address: string,
		password: string, mnemonic: string,
		scrypt?: ont.scrypt.ScryptParams): Account | null {

		return null
	}

	account: any
	role: AccountRole
	mnemonicEnc?: string
	scryptParam?: ont.scrypt.ScryptParams

	private constructor(role: AccountRole, account: any, mnemonicEnc?: string, scrypt?: ont.scrypt.ScryptParams) {
		this.role = role
		this.account = account
		this.mnemonicEnc = mnemonicEnc
		this.scryptParam = scrypt
	}

	async save(): Promise<AccountResult> {

		if (this.role === 'admin') {
			const a = await Account.findAdmin()
			if (a) {
				return 'duplicated'
			}
		}

		const cAccount = db.account()
		const r = await cAccount.insertOne(this.toJsonObj())
		if (r.insertedCount !== 1) {
			return false
		}
		return true
	}

	address(): ont.Crypto.Address {
		return new ont.Crypto.Address(this.account.address)
	}

	scrypt(): ont.scrypt.ScryptParams {
		if (this.scryptParam) {
			return this.scryptParam
		}
		return DEFAULT_SCRYPT
	}

	decryptMnemonic(password: string): string | null {
		if (this.mnemonicEnc) {
			return decryptMnemonic({
				mnemonicEnc: this.mnemonicEnc,
				address: this.address(),
				salt: this.account.salt,
				password,
				scrypt: this.scrypt()
			})
		}
		return null
	}

	decryptPrivateKey(password: string): ont.Crypto.PrivateKey | null {
		return decryptPrivateKey({
			key: this.account.key,
			address: this.address(),
			salt: this.account.salt,
			password,
			parameters: this.account.parameters,
			algorithm: this.account.algorithm,
			scrypt: this.scrypt()
		})
	}

	toJsonObj() {
		return {
			account: this.account,
			scrypt: this.scrypt(),
			mnemonicEnc: this.mnemonicEnc,
			role: this.role
		}
	}

}
