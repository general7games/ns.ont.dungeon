import * as db from '../database'
import * as utils from '../../utils'
import * as ont from 'ontology-ts-sdk'
import * as loglevel from 'loglevel'
import { getConfig } from '../../config'
import * as err from '../../errors'
import { DecryptedAccountPair, OntIDPair } from '../../types'
import * as auth from '../../ow/auth'
import { getClient } from '../../ow'
import { Address } from 'ontology-ts-sdk/lib/types/crypto';

const log = loglevel.getLogger('contract')

export interface ContractMethodInfo {
	name: string
	roles: string[]
}

export interface ContractRoleInfo {
	role: string
	ontids: string[]
}

export interface ContractAdminOntID {
	ontid: string
	keyNo: number
}

export interface Point {
	owner: string
	color: number
	price: number
}

export interface ContractInfo {
	buildDate: number
	gitCommit: string
	adminAddress: string
	maxLine: number
	initialPrice: number
	priceMultiplier: number // PRICE_MULTIPLIER / PRICE_DIVISOR
	priceSpreadToOldOwner: number // PRICE_SPREAD_TO_OLD_OWNER_MULTIPLIER / PRICE_SPREAD_TO_OLD_OWNER_DIVISOR
}

export class Contract {

	static async findOne(filter: {}): Promise<Contract | null> {
		const cContract = db.contract()
		const r = await cContract.findOne(filter)
		if (r) {
			return new Contract(r)
		}
		return null
	}

	static async find(filter: {}): Promise<Contract[]> {
		const contracts = new Array<Contract>()
		const cContract = db.contract()
		const r = await cContract.find(filter).toArray()
		if (r) {
			r.forEach((c) => {
				contracts.push(new Contract(c))
			})
		}
		return contracts
	}

	private static pushOntIDPubKeyPair(params: ont.Parameter[], ontID?: OntIDPair) {
		if (ontID) {
			params.push(
				new ont.Parameter('ontID', ont.ParameterType.String, ontID.ontID),
				new ont.Parameter('keyNo', ont.ParameterType.Integer, ontID.keyNo)
			)
		}
	}

	name: string
	script: string
	version: string
	storage: boolean
	author: string
	email: string
	description: string
	contractAddress: string
	abi: any
	contractInfo?: ContractInfo
	methods: ContractMethodInfo[]
	roles: ContractRoleInfo[]
	adminOntID?: ContractAdminOntID

	constructor(content: {
		name: string,
		script: string,
		version: string,
		storage: boolean,
		author: string,
		email: string,
		description: string,
		abi: any,
		contractInfo?: ContractInfo,
		methods?: ContractMethodInfo[],
		adminOntID?: ContractAdminOntID,
		roles?: ContractRoleInfo[]
	}) {
		this.name = content.name
		this.script = content.script
		this.version = content.version
		this.storage = content.storage
		this.author = content.author
		this.email = content.email
		this.description = content.description
		this.contractAddress = ont.Crypto.Address.fromVmCode(this.script).toBase58()
		this.abi = content.abi
		this.contractInfo = content.contractInfo
		if (content.methods) {
			this.methods = content.methods
		} else {
			this.methods = new Array<ContractMethodInfo>()
		}
		this.adminOntID = content.adminOntID
		if (content.roles) {
			this.roles = content.roles
		} else {
			this.roles = new Array<ContractRoleInfo>()
		}
	}

	addMethod(name: string, roles?: string[]) {
		this.methods.push({ name, roles: roles ? roles : new Array<string>() })
	}

	async addRoleAndUpdate(role: string): Promise<number> {
		if (this.roles.findIndex((info) => info.role === role) !== -1) {
			return err.DUPLICATED
		}
		this.roles.push({ role, ontids: [] })

		const cContract = db.contract()
		const updated = await cContract.findOneAndUpdate({ name: this.name }, { $set: { roles: this.roles } })
		if (updated.ok !== 1) {
			return err.DB_ERROR
		}
		return err.SUCCESS
	}

	async addOntIDToRoleAndUpdate(ontID: string, role: string, decryptedOntID: any): Promise<number> {
		const roleInfo = this.roles.find((ri) => ri.role === role)
		if (!roleInfo) {
			return err.NOT_FOUND
		}
		if (roleInfo.ontids.findIndex((ontid) => ontid === ontID) !== -1) {
			return err.DUPLICATED
		}

		const r = await this.assignOntIDsToRole(
			decryptedOntID.ontID.ontIDPair(decryptedOntID.keyNo),
			decryptedOntID.decryptedControllerPair,
			[ontID], role)
		if (r !== err.SUCCESS) {
			return r
		}
		roleInfo.ontids.push(ontID)
		const cContract = db.contract()
		const updated = await cContract.findOneAndUpdate({ name: this.name }, { $set: { roles: this.roles } })
		if (updated.ok !== 1) {
			return err.DB_ERROR
		}

		return err.SUCCESS
	}

	async assignMethodToRoleAndUpdate(method: string, role: string, decryptedOntID: any): Promise<number> {
		const roleInfo = this.roles.find((ri) => ri.role === role)
		if (!roleInfo) {
			return err.NOT_FOUND
		}
		const methodInfo = this.methods.find((mi) => mi.name === method)
		if (!methodInfo) {
			return err.NOT_FOUND
		}
		if (!methodInfo.roles) { // a patch
			methodInfo.roles = new Array<string>()
		}
		if (methodInfo.roles.findIndex((mr) => mr === role) !== -1) {
			return err.DUPLICATED
		}

		const r = await this.assignFuncsToRole(
			decryptedOntID.ontID.ontIDPair(decryptedOntID.keyNo),
			decryptedOntID.decryptedControllerPair,
			[method],
			role
		)
		if (r !== err.SUCCESS) {
			return r
		}

		methodInfo.roles.push(role)

		const cContract = db.contract()
		const updated = await cContract.findOneAndUpdate({name: this.name}, {$set: {methods: this.methods}})
		if (updated.ok !== 1) {
			return err.DB_ERROR
		}

		return err.SUCCESS
	}

	async deployAndSave(account: DecryptedAccountPair): Promise<number> {

		const contract = await Contract.findOne({ name: this.name })
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
			const preExecRet = await getClient().sendRawTransaction(tx.serialize(), true, false)
			if (preExecRet.Error === 0) {
				if (preExecRet.Result.State === 1) {
					if (parseInt(conf.ontology.gasLimit, 10) < preExecRet.Result.Gas) {
						tx = ont.TransactionBuilder.makeDeployCodeTransaction(
							this.script,
							this.name, this.version,
							this.author, this.email, this.description,
							this.storage,
							conf.ontology.gasPrice, `${preExecRet.Result.Gas}`,
							account.address)
						await ont.TransactionBuilder.signTransactionAsync(tx, account.privateKey)
					}
				} else {
					return err.TRANSACTION_FAILED
				}
			} else {
				return err.TRANSACTION_ERROR
			}
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
			log.error(e)
			return {
				error: err.BAD_REQUEST
			}
		}

		try {
			let r = await getClient().sendRawTransaction(tx.serialize(), true, false)
			if (r.Error !== 0) {
				log.error(r)
				return {
					error: err.TRANSACTION_ERROR
				}
			}
			if (r.Result.State === 1) {
				if (parseInt(conf.ontology.gasLimit, 10) < r.Result.Gas) {
					tx = ont.TransactionBuilder.makeInvokeTransaction(
						funcName, params, this.address(), conf.ontology.gasPrice, `${r.Result.Gas}`, account.address)
					await ont.TransactionBuilder.signTransactionAsync(tx, account.privateKey)
				}
			} else {
				return {
					error: err.TRANSACTION_ERROR
				}
			}

			r = await getClient().sendRawTransaction(tx.serialize(), false, true)
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
					let code = utils.contractHexToNumber(result[0])
					result.shift()

					switch (code) {
						//case err.SUCCESS:
							//if (result[0] != '4f4b'/* OK */) {
							//	code = err.CONTRACT_FAILED
						//		result[0] = 'Not OK'
						//		log.error('Contract ')
						//	}
						//	break;
						case err.CONTRACT_FAILED:
							result[0] = ont.utils.hexstr2str(result[0])
							break;
					}
					return {
						error: code,
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
			return err.DB_ERROR
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

	async initAdmin(decryptedOntID: any): Promise<number> {

		const p = new ont.Parameter('adminOntID', ont.ParameterType.String, decryptedOntID.ontID.ontID())
		const r = await this.invoke('InitAdmin', [p], decryptedOntID.decryptedControllerPair)
		if (r.error !== err.SUCCESS) {
			return r.error
		}
		// update database
		this.adminOntID = decryptedOntID.ontID.ontIDPair(decryptedOntID.keyNo)
		const cContract = db.contract()
		const updated = await cContract.findOneAndUpdate({ name: this.name }, { $set: { adminOntID: this.adminOntID } })
		if (updated.ok !== 1) {
			return err.DB_ERROR
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
			const preExecResult = await getClient().sendRawTransaction(tx.serialize(), true, false)
			if (preExecResult.Error !== 0) {
				log.error(preExecResult)
				return err.TRANSACTION_ERROR
			}
			if (preExecResult.Result.State === 1) {
				if (parseInt(conf.ontology.gasLimit, 10) < preExecResult.Result.Gas) {
					tx = auth.makeAssignOntIdsToRoleTx(
						this.address(), adminOntIDPair.ontID, role, ontIDs, adminOntIDPair.keyNo, adminOntIDControllerPair.address,
						conf.ontology.gasPrice, `${preExecResult.Result.Gas}`)
					await ont.TransactionBuilder.signTransactionAsync(tx, adminOntIDControllerPair.privateKey)
				}
			} else {
				return err.TRANSACTION_FAILED
			}

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
			const preExecResult = await getClient().sendRawTransaction(tx.serialize(), true, false)
			if (preExecResult.Error !== 0) {
				log.error(preExecResult)
				return err.TRANSACTION_ERROR
			}
			if (preExecResult.Result.State === 1) {
				if (parseInt(conf.ontology.gasLimit, 10) < preExecResult.Result.Gas) {
					tx = auth.makeAssignFuncsToRoleTx(
						this.address(), adminOntIDPair.ontID, role, funcNames, adminOntIDPair.keyNo,
						adminControllerPair.address, conf.ontology.gasPrice, `${preExecResult.Result.Gas}`
					)
					await ont.TransactionBuilder.signTransactionAsync(tx, adminControllerPair.privateKey)
				}
			} else {
				return err.TRANSACTION_FAILED
			}
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

	async initContract(account: DecryptedAccountPair): Promise<{
		error: number
		contractInfo?: ContractInfo
	}> {
		const params = [
			new ont.Parameter('address', ont.ParameterType.ByteArray, utils.addrToContractHex(account.address))
		]
		const r = await this.invoke('InitContract', params, account)
		if (r.error != err.SUCCESS) {
			log.error('InitContract error, ' + JSON.stringify(r))
			return {
				error: r.error
			}
		}
		
		this.contractInfo = this.parseContractInfo(r)
		const cContract = db.contract()
		const updated = await cContract.findOneAndUpdate({ name: this.name }, { $set: { contractInfo: this.contractInfo } })
		if (updated.ok !== 1) {
			log.error('initContract update db error, ' + JSON.stringify(updated))
			return {
				error: err.DB_ERROR
			}
		}
		return {
			error: err.SUCCESS,
			contractInfo: this.contractInfo
		}
	}

	getContractInfos(): ContractInfo|undefined {
		return this.contractInfo
	}

	async _getContractInfos(account: DecryptedAccountPair): Promise<{
		error: number
		contractInfo?: ContractInfo
	}> {
		const r = await this.invoke('GetContractInfos', [], account)
		return {
			error: r.error,
			contractInfo: r.error == err.SUCCESS ? this.parseContractInfo(r) : undefined
		}
	}

	parseContractInfo(r): ContractInfo {
		return {
			buildDate: utils.contractHexToNumber(r.result[0]),
			gitCommit: ont.utils.hexstr2str(r.result[1]),
			adminAddress: utils.contractHexToBase58(r.result[2]),
			maxLine: utils.contractHexToNumber(r.result[3]),
			initialPrice: utils.contractHexToNumber(r.result[4]),
			priceMultiplier: utils.contractHexToNumber(r.result[5]) / utils.contractHexToNumber(r.result[6]),
			priceSpreadToOldOwner: utils.contractHexToNumber(r.result[7]) / utils.contractHexToNumber(r.result[8])
		}
	}

	async capturePoints(xPoints: Array<number>, yPoints: Array<number>, colors: Array<number>, prices: Array<number>, account: DecryptedAccountPair): Promise<number> {
		const fromHex = utils.addrToContractHex(account.address)
		log.info('Account ' + utils.addrToBase58(account.address) + '(' + fromHex + ') capture ' + xPoints.length + ' points.')
		const params = [
			new ont.Parameter('from', ont.ParameterType.ByteArray, fromHex),
			new ont.Parameter('xPoints', ont.ParameterType.Array, xPoints),
			new ont.Parameter('yPoints', ont.ParameterType.Array, yPoints),
			new ont.Parameter('colors', ont.ParameterType.Array, colors),
			new ont.Parameter('prices', ont.ParameterType.Array, prices)
		]
		const r = await this.invoke('Capture', params, account)
		if (r.error != err.SUCCESS) {
			log.error('CapturePoints error ' + r.error + ', ' + r)
		}
		return r.error
	}

	async getPoints(xPoints: Array<number>, yPoints: Array<number>, account: DecryptedAccountPair): Promise<Array<Point>|null> {
		const params = [
			new ont.Parameter('x', ont.ParameterType.Array, xPoints),
			new ont.Parameter('y', ont.ParameterType.Array, yPoints)
		]
		const r = await this.invoke('GetPoints', params, account)
		if (r.error != err.SUCCESS) {
			log.error('GetPoints error ' + r.error + ', ' + r)
			return null
		}
		if (!r.result) {
			return null
		}
		let points: Array<Point> = new Array
		for (let result of r.result[0]) {
			points.push({
				owner: result[0] == '00' ? '' : utils.contractHexToBase58(result[0]),
				color: utils.contractHexToNumber(result[1]),
				price: utils.contractHexToNumber(result[2])
			})
		}
		return points
	}

	async getAllPoints(account: DecryptedAccountPair): Promise<{
		maxLine: number,
		points: Array<Point>|null
	}> {
		const r = await this.invoke('GetAllPoints', [], account)
		if (r.error != err.SUCCESS) {
			log.error('GetAllPoints error ' + r.error + ', ' + r)
			return {
				maxLine: 0,
				points: null
			}
		}
		let maxLine = utils.contractHexToNumber(r.result[0])
		let points: Array<Point> = new Array
		for (let result of r.result[1]) {
			points.push({
				owner: result[0] == '00' ? '' : utils.contractHexToBase58(result[0]),
				color: utils.contractHexToNumber(result[1]),
				price: utils.contractHexToNumber(result[2])
			})
		}
		return {
			maxLine: maxLine,
			points: points
		}
	}
}
