import * as ont from 'ontology-ts-sdk'
import * as err from './errors'
import * as db from './database'
import * as loglevel from 'loglevel'

const log = loglevel.getLogger('utils')

async function decryptAccountInternal(req) {
	if (req.body.account && req.body.account.address && req.body.account.password) {

		const accountInDB = await db.models.Account.findByAddress(req.body.account.address)
		if (accountInDB == null) {
			log.warn('account ' + req.body.account.address + ' not found')
			return
		}

		const privateKey = accountInDB.decryptPrivateKey(req.body.account.password)
		if (privateKey != null) {
			req.body.decryptedAccount = {
				address: accountInDB.address(),
				privateKey
			}
		} else {
			log.warn('account ' + req.body.account.address + ' decrypt failed')
		}
	}
}

export async function decryptAccount(req, res, next) {
	await decryptAccountInternal(req)
	next()
}

export async function ensureAccount(req, res, next) {
	await decryptAccountInternal(req)
	if (req.body.decryptedAccount) {
		next()
	} else {
		res.send({
			error: err.UNAUTHORIZED
		})
	}
}

export function checkSession(req, res, next) {
	next()
}

export function contractHashToAddr(hash): ont.Crypto.Address {
	return new ont.Crypto.Address(ont.utils.reverseHex(hash))
}

export function base58ToAddr(base58): ont.Crypto.Address {
	return new ont.Crypto.Address(base58)
}

export function base58ToContractHash(base58) {
	return new ont.Crypto.Address(base58).toHexString()
}

export function base58ToAb(base58) {
	return ont.utils.hexstring2ab(ont.utils.reverseHex(base58ToAddr(base58).toHexString()))
}

export function base58ToContractAb(base58) {
	return ont.utils.hexstring2ab(ont.utils.reverseHex(base58ToContractHash(base58)))
}

export function contractHashToAb(hash) {
	return ont.utils.hexstring2ab(ont.utils.reverseHex(hash))
}
