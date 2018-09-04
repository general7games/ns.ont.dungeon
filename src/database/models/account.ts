import * as db from '../database'
import * as ont from 'ontology-ts-sdk'
import * as loglevel from 'loglevel'

const DEFAULT_SCRYPT = {
	cost: 4096,
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

	// algorithm
	let keyType: ont.Crypto.KeyType | undefined
	if (account.algorithm) {
		keyType = ont.Crypto.KeyType.fromLabel(account.algorithm)
		log.warn(keyType)
	}
	let keyParameters: ont.Crypto.KeyParameters | undefined
	if (account.parameters) {
		keyParameters = ont.Crypto.KeyParameters.deserializeJson(account.parameters)
		log.warn(keyParameters)
	}
	const encryptedPrivateKey = new ont.Crypto.PrivateKey(account.key, keyType, keyParameters)

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

export class Account {

	static async findAdmin(): Promise<Account | null> {
		const cAccount = db.account()
		const adminAccount = await cAccount.findOne({role: 'admin'})
		if (adminAccount) {
			const account = new Account('admin', adminAccount.account, adminAccount.mnemonicEnc)
			return account
		}
		return null
	}

	static async findByAddress(address: string): Promise<Account | null> {
		const cAccount = db.account()
		const r = await cAccount.findOne({'account.address': address})
		if (r) {
			return new Account(r.role, r.account, r.mnemonicEnc)
		}
		return null
	}

	static create(label: string, password: string, role: AccountRole): Account {
		const r = createAccount(label, password, DEFAULT_SCRYPT)
		return new Account(role, r.account, r.mnemonicEnc, DEFAULT_SCRYPT)
	}

	static importFromMnemonic(
		label: string, address: string,
		password: string, mnemonic: string,
		scrypt?: ont.scrypt.ScryptParams): Account | null {

		return null
	}

	account: any
	mnemonicEnc: string
	role: AccountRole
	scryptParam?: ont.scrypt.ScryptParams

	private constructor(role: AccountRole, account: any, mnemonicEnc: string, scrypt?: ont.scrypt.ScryptParams) {
		this.role = role
		this.account = account
		this.mnemonicEnc = mnemonicEnc
		this.scryptParam = scrypt
	}

	async save(): Promise<boolean> {

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
		return decryptMnemonic({
			mnemonicEnc: this.mnemonicEnc,
			address: this.address(),
			salt: this.account.salt,
			password,
			scrypt: this.scrypt()
		})
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
