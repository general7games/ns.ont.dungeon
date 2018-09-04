import * as express from 'express'
import * as utils from '../utils'
import * as err from '../errors'
import * as db from '../database'

const router = express.Router()

router.post('/create', async (req, res) => {
	const account = await db.models.Account.create(req.body.label, req.body.password, 'user')
	if (!await account.save()) {
		res.send({
			error: err.INTERNAL_ERROR
		})
		return
	}
	res.send({
		error: err.SUCCESS,
		result: {
			address: account.account.address
		}
	})
})

router.post('/decrypt_mnemonic', async (req, res) => {

	const accountInDB = await db.models.Account.findByAddress(req.body.address)
	if (accountInDB == null) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}
	const mnemonic = accountInDB.decryptMnemonic(req.body.password)
	res.send({
		error: err.SUCCESS,
		result: mnemonic
	})
})

router.post('/decryptPrivateKey', utils.decryptAccount, async (req, res) => {
	if (req.body.decryptedAccount) {
		res.send({
			error: err.SUCCESS,
			result: JSON.stringify(req.body.decryptedAccount.privateKey)
		})
	} else {
		res.send({
			error: err.UNAUTHORIZED
		})
	}
})

router.post('/login', utils.decryptAccount, (req, res) => {
	if (req.body.decryptedAccount) {
		// check if there is account on chain
		res.send({error: err.SUCCESS})
	} else {
		res.send({error: err.UNAUTHORIZED})
	}
})

export const AccountController: express.Router = router
