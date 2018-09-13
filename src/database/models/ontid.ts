import * as ont from 'ontology-ts-sdk'
import { getConfig } from '../../config'
import { getClient } from '../../ow'
import * as konst from '../../const'
import * as loglevel from 'loglevel'
import * as db from '../database'
import * as account from '../models/account'
import * as err from '../../errors'
import { DecryptedAccountPair } from '../../types'

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

		const tx = ont.OntidContract.buildRegisterOntidTx(
			identity.ontid, publicKey,
			conf.ontology.gasPrice, conf.ontology.gasLimit)
		tx.payer = byAccount.address
		await ont.TransactionBuilder.signTransactionAsync(tx, byAccount.privateKey)
		const r = await getClient().sendRawTransaction(tx.serialize(), false, true)
		if (r.Error !== 0) {
			log.error(r)
			return null
		}
		if (!r.Result || r.Result.State !== 1) {
			log.error(r)
			return null
		}
		return new OntID(identity, scrypt)
	}

	static async findByID(ontID: string): Promise<OntID | null> {
		const cOntID = db.ontid()
		const r = await cOntID.findOne({'ontid.ontid': ontID})
		if (r) {
			return new OntID(ont.Identity.parseJsonObj(r.ontid), r.scryptParams)
		}
		return null
	}

	ontid: ont.Identity
	scryptParams: ont.scrypt.ScryptParams

	private constructor(ontid: ont.Identity, scrypt: ont.scrypt.ScryptParams) {
		this.ontid = ontid
		this.scryptParams = scrypt
	}

	async save(): Promise<number> {
		const cOntID = db.ontid()
		const inserted = await cOntID.insertOne({
			ontid: this.ontid.toJsonObj(),
			scryptParams: this.scryptParams
		})
		if (inserted.insertedCount !== 1) {
			return err.INTERNAL_ERROR
		}
		return err.SUCCESS
	}

	ontID(): string {
		return this.ontid.ontid
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
