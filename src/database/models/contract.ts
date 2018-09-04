import * as db from '../database'
import * as ont from 'ontology-ts-sdk'
import * as ow from '../../ow'
import * as loglevel from 'loglevel'
import { getConfig } from '../../config'

const log = loglevel.getLogger('database.models.contract')

export class Contract {

	static async find(filter: {}): Promise<Contract | null> {
		return null
	}

	name: string
	script: string
	version: string
	storage: boolean
	author: string
	email: string
	description: string
	abi: {}
	hash?: string

	constructor(options: {
		name: string,
		script: string,
		version: string,
		storage: boolean,
		author: string,
		email: string,
		description: string,
		abi: {}
	}) {
		this.name = options.name
		this.script = options.script
		this.version = options.version
		this.storage = options.storage
		this.author = options.author
		this.email = options.email
		this.description = options.description
		this.abi = options.abi
	}

	async deploy(options: {
		account: {
			address: ont.Crypto.Address,
			privateKey: ont.Crypto.PrivateKey
		},
		preExec?: boolean
	}): Promise<boolean> {

		const conf = getConfig()
		let tx: ont.Transaction
		try {
			tx = ont.TransactionBuilder.makeDeployCodeTransaction(
				this.script,
				this.name, this.version,
				this.author, this.email, this.description,
				this.storage,
				conf.ontology.gasPrice, conf.ontology.gasLimit,
				options.account.address)
			await ont.TransactionBuilder.signTransactionAsync(tx, options.account.privateKey)
		} catch (e) {
			log.error(e.stack)
			return false
		}

		const ret = await ow.getClient().sendRawTransaction(tx.serialize(), options.preExec)
		if (ret.error !== 0) {
			return false
		}
		return true
	}

	async migrate(options: {
		script: string,
		version: string,
		storage?: boolean,
		author?: string,
		email?: string,
		description?: string
	}): Promise<boolean> {

		if (this.version === options.version) {
			log.warn('version not changed')
			return false
		}

		return false
	}

	async remove(): Promise<boolean> {
		throw new Error('not implemented')
	}

	async save(): Promise<boolean> {
		const cContract = db.contract()
		const r = await cContract.insertOne(this)
		if (r.insertedCount === 0) {
			return false
		}
		return true
	}
}
