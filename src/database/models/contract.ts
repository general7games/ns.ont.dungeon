import * as db from '../database'
import * as ont from 'ontology-ts-sdk'
import * as loglevel from 'loglevel'
import { getConfig } from '../../config'
import * as err from '../../errors'
import { DecryptedAccountPair, OntIDPair } from '../../types'
import * as auth from '../../ow/auth'
import { getClient } from '../../ow'
import * as konst from '../../const'
import { sendRawTxRestfulUrl } from 'ontology-ts-sdk/lib/types/transaction/transactionBuilder';

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
	contractAddress: string

	adminOntID?: {
		ontID: string,
		keyNo: number
	}

	constructor(content: {
		name: string,
		script: string,
		version: string,
		storage: boolean,
		author: string,
		email: string,
		description: string
	}) {
		this.name = content.name
		this.script = content.script
		this.version = content.version
		this.storage = content.storage
		this.author = content.author
		this.email = content.email
		this.description = content.description
		this.contractAddress = ont.Crypto.Address.fromVmCode(this.script).toBase58()
	}

	async deployAndSave(account: DecryptedAccountPair): Promise<number> {

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
			const ret = await getClient().sendRawTransaction(tx.serialize(), false, true)
			if (ret.Error !== 0) {
				return err.TRANSACTION_ERROR
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

	address(): ont.Crypto.Address {
		return new ont.Crypto.Address(this.contractAddress)
	}

	async invoke(
		funcName: string,
		params: ont.Parameter[],
		account: DecryptedAccountPair,
		ontID?: OntIDPair
	): Promise<{
		error: number,
		result?: any
	}> {

		Contract.pushOntIDPubKeyPair(params, ontID)

		const conf = getConfig()
		let tx
		try {
			tx = ont.TransactionBuilder.makeInvokeTransaction(
				funcName, params, this.address(), conf.ontology.gasPrice, conf.ontology.gasLimit, account.address)
			await ont.TransactionBuilder.signTransactionAsync(tx, account.privateKey)
		} catch (e) {
			return {
				error: err.BAD_REQUEST
			}
		}

		try {
			const r = await getClient().sendRawTransaction(tx.serialize(), false, true)
			if (r.Error !== 0) {
				log.error(r)
				return {
					error: err.TRANSACTION_ERROR
				}
			}

			// check state
			if (r.Result) {
				if (r.Result.State !== 1) {
					log.error(r)
					return {
						error: err.TRANSACTION_FAILED
					}
				}
			} else {
				log.error(r)
				return {
					error: err.INTERNAL_ERROR
				}
			}

			// get result from Runtime.Notify in contract
			if (r.Result.Notify) {

				// find notify from Notify
				const hash = this.address().toHexString()
				const thisContractNotify = r.Result.Notify.find((x) => x.ContractAddress === hash)
				if (thisContractNotify) {
					const result = thisContractNotify.States

					// check ret code from contract
					const code = result[0]
					if (code === '9101') { // 401
						return {
							error: err.CONTRACT_UNAUTHORIZED
						}
					} else if (code == '01') {
						return {
							error: err.CONTRACT_FAILED
						}
					}
					result.shift()
					return {
						error: err.SUCCESS,
						result
					}
				}
			}
			// without notify
			return {
				error: err.SUCCESS
			}
		} catch (e) {
			log.error(e)
			return {
				error: err.INTERNAL_ERROR
			}
		}
	}

	private static pushOntIDPubKeyPair(params: ont.Parameter[], ontID?: OntIDPair) {
		if (ontID) {
			params.push(
				new ont.Parameter('ontID', ont.ParameterType.String, ontID.ontID),
				new ont.Parameter('keyNo', ont.ParameterType.Integer, ontID.keyNo)
			)
		}
	}

	async migrate(
		content: {
			script: string,
			version: string,
			storage?: boolean,
			author?: string,
			email?: string,
			description?: string
		},
		account: DecryptedAccountPair,
		ontID?: OntIDPair
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

		const params = [
			new ont.Parameter('script', ont.ParameterType.ByteArray, content.script),
			new ont.Parameter('needStorage', ont.ParameterType.Boolean, storage),
			new ont.Parameter('name', ont.ParameterType.String, this.name),
			new ont.Parameter('version', ont.ParameterType.String, content.version),
			new ont.Parameter('author', ont.ParameterType.String, author),
			new ont.Parameter('email', ont.ParameterType.String, email),
			new ont.Parameter('description', ont.ParameterType.String, description)
		]
		Contract.pushOntIDPubKeyPair(params, ontID)

		const r = await this.invoke(
			'Migrate', params, account, ontID
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
		this.contractAddress = ont.Crypto.Address.fromVmCode(content.script).toBase58()

		const cContract = db.contract()
		const updated = await cContract.findOneAndUpdate({ name: this.name }, { $set: this })
		if (updated.ok !== 1) {
			return err.INTERNAL_ERROR
		}
		return err.SUCCESS
	}

	async destroy(account: DecryptedAccountPair, ontID?: OntIDPair): Promise<number> {

		const params = []
		Contract.pushOntIDPubKeyPair(params, ontID)

		const r = await this.invoke('Destroy', params, account)
		if (r.error !== err.SUCCESS) {
			return r.error
		}

		const cContract = db.contract()
		const deleted = await cContract.deleteOne({ name: this.name })
		if (deleted.deletedCount !== 1) {
			return err.INTERNAL_ERROR
		}
		return err.SUCCESS
	}

	async initAdmin(adminOntID: string, adminOntIDControllerPair: DecryptedAccountPair, keyNo: number): Promise<number> {

		const p = new ont.Parameter('adminOntID', ont.ParameterType.String, adminOntID)
		const r = await this.invoke('InitAdmin', [p], adminOntIDControllerPair)
		if (r.error !== err.SUCCESS) {
			return r.error
		}
		// update database
		const cContract = db.contract()
		const updated = await cContract.findOneAndUpdate({ name: this.name }, { $set: { adminOntID: this.adminOntID } })
		if (!updated.ok) {
			return err.INTERNAL_ERROR
		}

		return err.SUCCESS
	}

	async assignOntIDsToRole(
		adminOntIDPair: OntIDPair,
		adminOntIDControllerPair: DecryptedAccountPair,
		ontIDs: string[], role: string
	): Promise<number> {

		const conf = getConfig()
		let tx
		try {
			tx = auth.makeAssignOntIdsToRoleTx(
				this.address(), adminOntIDPair.ontID, role, ontIDs, adminOntIDPair.keyNo, adminOntIDControllerPair.address,
				conf.ontology.gasPrice, conf.ontology.gasLimit)
			await ont.TransactionBuilder.signTransactionAsync(tx, adminOntIDControllerPair.privateKey)
		} catch (e) {
			log.error(e)
			return err.BAD_REQUEST
		}

		try {
			const r = await getClient().sendRawTransaction(tx.serialize(), false, true)
			if (r.Error !== 0) {
				log.error(r)
				return err.TRANSACTION_ERROR
			}
			if (!r.Result || r.Result.State !== 1) {
				log.error(r)
				return err.TRANSACTION_FAILED
			}
			return err.SUCCESS
		} catch (e) {
			log.error(e)
			return err.INTERNAL_ERROR
		}
	}

	async assignFuncsToRole(
		adminOntIDPair: OntIDPair,
		adminControllerPair: DecryptedAccountPair,
		funcNames: string[],
		role: string
	) {
		const conf = getConfig()
		let tx
		try {
			tx = auth.makeAssignFuncsToRoleTx(
				this.address(), adminOntIDPair.ontID, role, funcNames, adminOntIDPair.keyNo,
				adminControllerPair.address, conf.ontology.gasPrice, conf.ontology.gasLimit
			)
			await ont.TransactionBuilder.signTransactionAsync(tx, adminControllerPair.privateKey)
		} catch (e) {
			log.error(e)
			return err.BAD_REQUEST
		}

		try {
			const r = await getClient().sendRawTransaction(tx.serialize(), false, true)
			if (r.Error !== 0) {
				log.error(r)
				return err.TRANSACTION_ERROR
			}
			if (!r.Result || r.Result.State !== 1) {
				log.error(r)
				return err.TRANSACTION_FAILED
			}
			return err.SUCCESS

		} catch (e) {
			log.error(e)
			return err.INTERNAL_ERROR
		}
	}

}
