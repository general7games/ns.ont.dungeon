import * as db from '../database'
import * as ont from 'ontology-ts-sdk'
import * as ow from '../../ow'
import * as loglevel from 'loglevel'
import { getConfig } from '../../config'
import * as err from '../../errors'
import * as utils from '../../utils'

const log = loglevel.getLogger('contract')

export class Contract {

	static async find(filter: {}): Promise<Contract | null> {
		const cContract = db.contract()
		const r = await cContract.findOne(filter)
		if (r) {
			return new Contract(r)
		}
		return null
	}

	name: string
	script: string
	version: string
	storage: boolean
	author: string
	email: string
	description: string
	abi: any

	constructor(options: {
		name: string,
		script: string,
		version: string,
		storage: boolean,
		author: string,
		email: string,
		description: string,
		abi: any
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

	async deployAndSave(
		account: {
			address: ont.Crypto.Address,
			privateKey: ont.Crypto.PrivateKey
		},
		preExec?: boolean
	): Promise<number> {

		const contract = await Contract.find({ name: this.name })
		if (contract) {
			return err.DUPLICATED
		}

		const conf = getConfig()
		let tx: ont.Transaction
		try {
			tx = ont.TransactionBuilder.makeDeployCodeTransaction(
				this.script,
				this.name, this.version,
				this.author, this.email, this.description,
				this.storage,
				conf.ontology.gasPrice, conf.ontology.gasLimit,
				account.address)
			await ont.TransactionBuilder.signTransactionAsync(tx, account.privateKey)
			const ret = await ow.getClient().sendRawTransaction(tx.serialize(), preExec, true)
			if (ret.Error !== 0) {
				return err.FAILED
			}
		} catch (e) {
			log.error(e.stack)
			return err.INTERNAL_ERROR
		}

		// all is ok
		const cContract = db.contract()
		const insertResult = await cContract.insertOne(this)
		if (insertResult.insertedCount === 0) {
			log.error('contract insertOne failed')
			return err.INTERNAL_ERROR
		}

		return err.SUCCESS
	}

	hash(): string {
		return this.abi.hash.replace('0x', '')
	}

	address(): ont.Crypto.Address {
		return utils.contractHashToAddr(this.hash())
	}

	abiInfo(): ont.AbiInfo {
		return ont.AbiInfo.parseJson(JSON.stringify(this.abi))
	}

	async invoke(
		funcName: string,
		params: ont.Parameter[],
		account: {
			address: ont.Crypto.Address,
			privateKey: ont.Crypto.PrivateKey
		},
		preExec?: boolean
	): Promise<{
		error: number,
		result?: any
	}> {
		const conf = getConfig()
		try {
			const tx = ont.TransactionBuilder.makeInvokeTransaction(
				funcName, params, this.address(), conf.ontology.gasPrice, conf.ontology.gasLimit, account.address)
			await ont.TransactionBuilder.signTransactionAsync(tx, account.privateKey)

			const r = await ow.getClient().sendRawTransaction(tx.serialize(), preExec, true)

			if (r.Error !== 0) {
				log.error(r)
				return {
					error: err.FAILED
				}
			}

			// check state
			if (r.Result) {
				if (r.Result.State !== 1) {
					log.error({
						method: funcName,
						result: r
					})
					return {
						error: err.FAILED
					}
				}
			} else {
				return {
					error: err.INTERNAL_ERROR
				}
			}
			// get result from Runtime.Notify in contract
			if (r.Result.Notify) {
				// find notify from Notify
				let result
				const hash = this.hash()
				r.Result.Notify.forEach((x) => {
					if (x.ContractAddress === hash) {
						result = x.States
					}
				})
				return {
					error: err.SUCCESS,
					result
				}
			} else {
				return {
					error: err.SUCCESS
				}
			}
		} catch (e) {
			log.error(e)
			return {
				error: err.FAILED
			}
		}
	}

	async migrate(
		content: {
			script: string,
			version: string,
			abi: any,
			storage?: boolean,
			author?: string,
			email?: string,
			description?: string
		},
		account: {
			address: ont.Crypto.Address,
			privateKey: ont.Crypto.PrivateKey
		},
		preExec?: boolean
	): Promise<number> {

		if (this.version === content.version) {
			return err.BAD_REQUEST
		}

		let storage = this.storage
		if (content.storage !== undefined) {
			storage = content.storage
		}
		let author = this.author
		if (content.author) {
			author = content.author
		}
		let email = this.email
		if (content.email) {
			email = content.email
		}
		let description = this.description
		if (content.description) {
			description = content.description
		}

		try {
			const r = await this.invoke(
				'Migrate',
				[
					new ont.Parameter('script', ont.ParameterType.ByteArray, content.script),
					new ont.Parameter('needStorage', ont.ParameterType.Boolean, storage),
					new ont.Parameter('name', ont.ParameterType.String, this.name),
					new ont.Parameter('version', ont.ParameterType.String, content.version),
					new ont.Parameter('author', ont.ParameterType.String, author),
					new ont.Parameter('email', ont.ParameterType.String, email),
					new ont.Parameter('description', ont.ParameterType.String, description)
				],
				account,
				preExec
			)
			if (r.error !== err.SUCCESS) {
				return r.error
			}

			this.script = content.script
			this.storage = storage
			this.version = content.version
			this.author = author
			this.email = email
			this.description = description
			this.abi = content.abi

			const cContract = db.contract()
			const updated = await cContract.findOneAndUpdate({name: this.name}, { $set: this })
			if (updated.ok !== 1) {
				return err.FAILED
			}
			return err.SUCCESS
		} catch (e) {
			log.error(e)
			return err.BAD_REQUEST
		}
	}

	async destroy(account: {address: ont.Crypto.Address, privateKey: ont.Crypto.PrivateKey}, preExec?: boolean) {

		const r = await this.invoke('Destroy', [], account, preExec)
		if (r.error !== err.SUCCESS) {
			return r.error
		}

		const cContract = db.contract()
		const deleted = await cContract.deleteOne({name: this.name})
		if (deleted.deletedCount !== 1) {
			return err.INTERNAL_ERROR
		}
		return err.SUCCESS
	}

}
