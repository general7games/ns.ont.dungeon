import * as db from '../database'
import * as ont from 'ontology-ts-sdk'
import * as loglevel from 'loglevel'
import * as utils from '../../utils'
import * as konst from '../../const'
import { DecryptedAccountPair } from '../../types'
import * as err from '../../errors'

const log = loglevel.getLogger('account')

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
		scrypt = konst.DEFAULT_SCRYPT
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
}): ont.Crypto.PrivateKey | null {
	try {
		let keyType: ont.Crypto.KeyType | undefined
		if (info.algorithm) {
			keyType = ont.Crypto.KeyType.fromLabel(info.algorithm)
		}
		let keyParameters: ont.Crypto.KeyParameters | undefined
		if (info.parameters) {
			keyParameters = ont.Crypto.KeyParameters.deserializeJson(info.parameters)
		}
		return new ont.Crypto.PrivateKey(info.key, keyType, keyParameters)
	} catch (e) {
		return null
	}
}

export function decryptPrivateKey(account: {
	key: string | ont.Crypto.PrivateKey,
	address: ont.Crypto.Address,
	salt: string,
	password: string,
	parameters?: ont.Crypto.JsonKeyParameters,
	algorithm?: string,
	scrypt?: ont.scrypt.ScryptParams
}): ont.Crypto.PrivateKey | null {

	const address = account.address
	const salt = Buffer.from(account.salt, 'base64').toString('hex')

	let encryptedPrivateKey: ont.Crypto.PrivateKey | null
	if (typeof account.key === 'string' ) {
		encryptedPrivateKey = createEncryptedPrivateKey({
			key: account.key,
			algorithm: account.algorithm,
			parameters: account.parameters
		})
		if (!encryptedPrivateKey) {
			return null
		}
	} else {
		encryptedPrivateKey = account.key
	}

	// scrypt
	let scryptParams: ont.scrypt.ScryptParams
	if (account.scrypt) {
		scryptParams = account.scrypt
	} else {
		scryptParams = konst.DEFAULT_SCRYPT
	}

	try {
		return encryptedPrivateKey.decrypt(account.password, address, salt, scryptParams)
	} catch (e) {
		log.error(e)
		return null
	}
}

export interface AccountInfo {
	label: string,
	address: string
	key: string,
	salt: string
	algorithm?: string
	parameters?: {
		curve: string
	}
	scrypt?: {
		p: number,
		n: number,
		r: number,
		dkLen: number
	}
}

export interface ListAccountResult {
	error: number,
	accounts?: Account[]
}

export class Account {

	static async findByAddress(address: string): Promise<Account | null> {
		const cAccount = db.account()
		const r = await cAccount.findOne({ 'account.address': address })
		if (r) {
			return new Account(r.account, r.mnemonicEnc, r.scryptParams, r.createdAt, r.role)
		}
		return null
	}

	static async search(content: string, role?: string, type?: string): Promise<ListAccountResult> {
		const accounts = new Array<Account>()
		const cAccount = db.account()
		try {
			let r: any[]
			if (type === 'address') {
				r = await cAccount
					.find({'account.address': content, role})
					.sort({'account.address': 1})
					.limit(konst.PAGING_SIZE)
					.toArray()
			} else if (type === 'label') {
				const re = new RegExp(content)
				r = await cAccount
					.find({'account.label': re, role})
					.sort({'account.address': 1})
					.limit(konst.PAGING_SIZE)
					.toArray()
			} else {
				const re = new RegExp(content)
				r = await cAccount
					.aggregate([
						{$match:
							{$or: [
								{'account.address': re, role},
								{'account.label': re, role}
							]}
						}
					])
					.limit(konst.PAGING_SIZE)
					.toArray()
			}
			r.forEach((a) => {
				accounts.push(new Account(a.account, a.mnemonicEnc, a.scryptParams, a.role))
			})
			return {
				error: err.SUCCESS,
				accounts
			}
		} catch (e) {
			log.error(e)
			return {
				error: err.DB_ERROR
			}
		}
	}

	static async all(): Promise<ListAccountResult> {
		try {
			const cAccount = db.account()
			const allAccounts = await cAccount.find().sort({'role': -1}).toArray()
			const accounts = new Array<Account>()
			allAccounts.forEach((a) => accounts.push(new Account(a.account, a.mnemonicEnc, a.scryptParams, a.createdAt, a.role)))
			return {
				error: err.SUCCESS,
				accounts
			}
		} catch (e) {
			log.error(e)
			return {
				error: err.DB_ERROR
			}
		}
	}

	static create(label: string, password: string, scrypt?: ont.scrypt.ScryptParams): Account {
		const mnemonic = ont.utils.generateMnemonic()
		const mnemonicHex = ont.utils.str2hexstr(mnemonic)
		const privateKey = ont.Crypto.PrivateKey.generateFromMnemonic(mnemonic)
		if (!scrypt) {
			scrypt = konst.DEFAULT_SCRYPT
		}
		const account = ont.Account.create(privateKey, password, label, scrypt)
		const addr = account.address
		const salt = Buffer.from(account.salt, 'base64').toString('hex')
		const mnemonicEnc = ont.scrypt.encryptWithGcm(mnemonicHex, addr, salt, password, scrypt)
		return new Account(account.toJsonObj(), mnemonicEnc, scrypt)
	}

	static import(info: AccountInfo, password: string): Account | null {

		try {
			const encryptedPrivateKey = createEncryptedPrivateKey(info)
			if (!encryptedPrivateKey) {
				return null
			}
			let scrypt: ont.scrypt.ScryptParams | undefined
			if (info.scrypt) {
				scrypt = {
					cost: info.scrypt.n,
					blockSize: info.scrypt.r,
					parallel: info.scrypt.p,
					size: info.scrypt.dkLen
				}
			} else {
				scrypt = konst.DEFAULT_SCRYPT
			}

			const ontAccount = ont.Account.importAccount(
				info.label, encryptedPrivateKey, password, utils.base58ToAddr(info.address), info.salt, scrypt)
			if (ontAccount.address.toBase58() !== info.address) {
				return null
			}

			const mnemonicEnc = ''

			return new Account(ontAccount.toJsonObj(), mnemonicEnc, scrypt)
		} catch (e) {
			return null
		}
	}

	static createFromMnemonic(
		label: string, address: string,
		password: string, mnemonic: string,
		scrypt?: ont.scrypt.ScryptParams): Account | null {

		return null
	}

	account: any
	mnemonicEnc: string
	scryptParam: ont.scrypt.ScryptParams
	createdAt: string
	role?: string

	private constructor(account: any, mnemonicEnc: string, scrypt: ont.scrypt.ScryptParams, createdAt?: string, role?: string) {
		this.account = account
		this.mnemonicEnc = mnemonicEnc
		this.scryptParam = scrypt
		if (createdAt) {
			this.createdAt = createdAt
		} else {
			this.createdAt = new Date().toISOString()
		}
		this.role = role
	}

	async save(): Promise<number> {
		const cAccount = db.account()
		try {
			const r = await cAccount.updateOne({'account.address': this.address().toBase58()}, {$set: this.toJsonObj()}, {upsert: true})
			if (!r.result.ok) {
				return err.DB_INSERT_FAILED
			}
			return err.SUCCESS
		} catch (e) {
			log.error(e)
			return err.DB_ERROR
		}
	}

	label(): string {
		return this.account.label
	}

	address(): ont.Crypto.Address {
		return new ont.Crypto.Address(this.account.address)
	}

	scrypt(): ont.scrypt.ScryptParams {
		if (this.scryptParam) {
			return this.scryptParam
		}
		return konst.DEFAULT_SCRYPT
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

	decryptedPair(password: string): DecryptedAccountPair | null {
		const privateKey = this.decryptPrivateKey(password)
		if (!privateKey) {
			return null
		}
		return {
			address: this.address(),
			privateKey
		}
	}

	toJsonObj() {
		return {
			account: this.account,
			scrypt: this.scrypt(),
			mnemonicEnc: this.mnemonicEnc,
			createdAt: this.createdAt,
			role: this.role
		}
	}

}
