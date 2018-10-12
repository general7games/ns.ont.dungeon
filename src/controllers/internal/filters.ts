import * as db from '../../database'
import * as err from '../../errors'
import * as loglevel from 'loglevel'

const log = loglevel.getLogger('controllers')

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

export async function ensureRootAccount(req, res, next) {
	await decryptAccountInternal(req)
	if (req.body.decryptedAccount) {
		const account = await db.models.Account.findByAddress(req.body.decryptAccount.address)
		if (!account || account.role !== 'root') {
			res.send({error: err.UNAUTHORIZED})
			return
		}
		next()
	} else {
		res.send({
			error: err.UNAUTHORIZED
		})
	}
}

export async function ensureOntID(req, res, next) {
	if (!req.body.ontID
		|| !req.body.ontID.ontid
		|| !req.body.ontID.password
	) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const ontID = await db.models.OntID.findByID(req.body.ontID.ontid)
	if (!ontID) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}
	const decryptedControllerPair = ontID.decryptedController(req.body.ontID.password, 1)
	if (!decryptedControllerPair) {
		res.send({
			error: err.UNAUTHORIZED
		})
		return
	}
	req.body.decryptedOntID = {
		ontID,
		decryptedControllerPair,
		keyNo: 1
	}
	next()
}
