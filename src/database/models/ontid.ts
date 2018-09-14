import * as ont from 'ontology-ts-sdk'
import { getConfig } from '../../config'
import { getClient } from '../../ow'
import * as konst from '../../const'
import * as loglevel from 'loglevel'
import * as db from '../database'
import * as account from '../models/account'
import { DecryptedAccountPair, OntIDPair } from '../../types'

const log = loglevel.getLogger('ontid')

export class OntID {

	static async create(
		byAccount: DecryptedAccountPair,
		label: string, password: string, scrypt?: ont.scrypt.ScryptParams): Promise<OntID | null> {

		const conf = getConfig()

		if (!scrypt) {
			scrypt = konst.DEFAULT_SCRYPT
		}
		const identity = ont.Identity.create(byAccount.privateKey, password, label, scrypt)
		const publicKey = byAccount.privateKey.getPublicKey()

		let tx
		try {
			tx = ont.OntidContract.buildRegisterOntidTx(
				identity.ontid, publicKey,
				conf.ontology.gasPrice, conf.ontology.gasLimit)
			tx.payer = byAccount.address
			await ont.TransactionBuilder.signTransactionAsync(tx, byAccount.privateKey)
		} catch (e) {
			log.error(e)
			return null
		}
		try {
			const r = await getClient().sendRawTransaction(tx.serialize(), false, true)
			if (r.Error !== 0) {
				log.error(r)
				return null
			}
			if (!r.Result || r.Result.State !== 1) {
				log.error(r)
				return null
			}
			return new OntID(identity, scrypt, new Array<string>())
		} catch (e) {
			log.error(e)
			return null
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

	async save(): Promise<boolean> {
		const cOntID = db.ontid()
		const inserted = await cOntID.insertOne({
			ontid: this.ontid.toJsonObj(),
			scryptParams: this.scryptParams,
			roles: this.roles
		})
		if (inserted.insertedCount !== 1) {
			return false
		}
		return true
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
