import * as db from '../database'
import * as ont from 'ontology-ts-sdk'
import * as ow from '../../ow'
import * as loglevel from 'loglevel'
import { getConfig } from '../../config'
import * as err from '../../errors'
import * as utils from '../../utils'
import { Result } from 'range-parser';

const log = loglevel.getLogger('contract')

export class Contract {

	static async find(filter: {}): Promise<Contract | null> {
		const cContract = db.contract()
		return await cContract.findOne(filter)
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

	async deployAndSave(options: {
		account: {
			address: ont.Crypto.Address,
			privateKey: ont.Crypto.PrivateKey
		},
		preExec?: boolean
	}): Promise<number> {

		const contract = await Contract.find({name: this.name})
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
				options.account.address)
			await ont.TransactionBuilder.signTransactionAsync(tx, options.account.privateKey)
		} catch (e) {
			log.error(e.stack)
			return err.INTERNAL_ERROR
		}

		try {
			const ret = await ow.getClient().sendRawTransaction(tx.serialize(), options.preExec)
			if (ret.Error !== 0) {
				return err.FAILED
			}
		} catch (e) {
			log.error(e)
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

	address(): ont.Crypto.Address {
		return utils.contractHashToAddr(this.abi.hash.replace('0x', ''))
	}
	abiInfo(): ont.AbiInfo {
		return ont.AbiInfo.parseJson(JSON.stringify(this.abi))
	}

	async invoke(
		funcName:string,
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
		const abiFunc = this.abiInfo().getFunction(funcName)
		abiFunc.setParamsValue(...params)
		try
		{
			const tx = ont.TransactionBuilder.makeInvokeTransaction(
				abiFunc.name, abiFunc.parameters, this.address(), conf.ontology.gasPrice, conf.ontology.gasLimit, account.address)
			await ont.TransactionBuilder.signTransaction(tx, account.privateKey)

			const r = await ow.getClient().sendRawTransaction(tx.serialize(), preExec)
			if (r.Error !== 0) {
				return {
					error: err.FAILED
				}
			}
			return {
				error: err.SUCCESS,
				result: r.Result
			}
		} catch(e) {
			console.error(e)
			return {
				error: err.FAILED,
				result: e
			}
		}
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

}
