import * as ont from 'ontology-ts-sdk'
import { getConfig } from '../../config'
import { getClient } from '../../ow'
import * as konst from '../../const'
import * as loglevel from 'loglevel'
import * as db from '../database'
import * as account from '../models/account'
import { DecryptedAccountPair, OntIDPair } from '../../types'
import * as err from '../../errors'

const log = loglevel.getLogger('ontid')

export interface OntIDResult {
	error: number,
	ontID?: OntID
}

export class OntID {

	static async createAndSave(
		label: string, password: string,
		role: string,
		scrypt?: ont.scrypt.ScryptParams
	): Promise<OntIDResult> {

		const conf = getConfig()

		if (!scrypt) {
			scrypt = konst.DEFAULT_SCRYPT
		}
		const newAccount = account.Account.create(label, password, scrypt)
		const newAccountPair = newAccount.decryptedPair(password)
		if (!newAccountPair) {
			return {
				error: err.INTERNAL_ERROR
			}
		}
		const identity = ont.Identity.create(newAccountPair.privateKey, password, label, scrypt)
		const publicKey = newAccountPair.privateKey.getPublicKey()

		let tx
		try {
			tx = ont.OntidContract.buildRegisterOntidTx(
				identity.ontid, publicKey,
				conf.ontology.gasPrice, conf.ontology.gasLimit)
			tx.payer = newAccountPair.address
			await ont.TransactionBuilder.signTransactionAsync(tx, newAccountPair.privateKey)
		} catch (e) {
			log.error(e)
			return {
				error: err.BAD_REQUEST
			}
		}
		try {
			const r = await getClient().sendRawTransaction(tx.serialize(), false, true)
			if (r.Error !== 0) {
				log.error(r)
				return {
					error: err.TRANSACTION_FAILED
				}
			}
			if (!r.Result || r.Result.State !== 1) {
				log.error(r)
				return {
					error: err.CONTRACT_FAILED
				}
			}
			const ontID = new OntID(identity, scrypt, [role])
			const dbResult = await ontID.save()
			if (dbResult != err.SUCCESS) {
				return {
					error: dbResult
				}
			}
			return {
				error: err.SUCCESS,
				ontID
			}
		} catch (e) {
			log.error(e)
			return {
				error: err.TRANSACTION_ERROR
			}
		}
	}

	static async importAndSave(
		byAccount: DecryptedAccountPair,
		keyStore: any, password: string,
		role: string
	): Promise<OntIDResult> {
		return {
			error: err.INTERNAL_ERROR
		}
	}

	static async find(filters: any): Promise<OntID[]> {
		const ontIDs = new Array<OntID>()

		const cOntID = db.ontid()
		const dbOntIDs = await cOntID.find(filters).toArray()
		dbOntIDs.forEach((dbOntID) => {
			ontIDs.push(new OntID(ont.Identity.parseJsonObj(dbOntID.ontid), dbOntID.scryptParams, dbOntID.roles))
		})

		return ontIDs
	}

	static async findByID(ontID: string): Promise<OntID | null> {
		const cOntID = db.ontid()
		const r = await cOntID.findOne({'ontid.ontid': ontID})
		if (r) {
			return new OntID(ont.Identity.parseJsonObj(r.ontid), r.scryptParams, r.roles)
		}
		return null
	}

	ontid: ont.Identity
	scryptParams: ont.scrypt.ScryptParams
	roles: string[]

	private constructor(ontid: ont.Identity, scrypt: ont.scrypt.ScryptParams, roles: string[]) {
		this.ontid = ontid
		this.scryptParams = scrypt
		this.roles = roles
	}

	addRole(role: string) {
		this.roles.push(role)
	}

	async save(): Promise<number> {
		const cOntID = db.ontid()
		try {

			const inserted = await cOntID.insertOne({
				ontid: this.ontid.toJsonObj(),
				scryptParams: this.scryptParams,
				roles: this.roles
			})
			if (inserted.insertedCount !== 1) {
				return err.DB_INSERT_FAILED
			}
			return err.SUCCESS
		} catch (e) {
			log.error(e)
			return err.DB_ERROR
		}
	}

	ontID(): string {
		return this.ontid.ontid
	}

	ontIDPair(keyNo: number): OntIDPair {
		return {
			ontID: this.ontID(),
			keyNo
		}
	}

	decryptedController(password: string, keyNo: number): DecryptedAccountPair | null {

		ont.utils.varifyPositiveInt(keyNo)

		const data = this.ontid.controls[keyNo - 1]
		const privateKey = account.decryptPrivateKey({
			key: data.encryptedKey,
			address: data.address,
			salt: data.salt,
			password,
			scrypt: this.scryptParams
		})
		if (!privateKey) {
			return null
		}
		return { address: data.address, privateKey }
	}

}
