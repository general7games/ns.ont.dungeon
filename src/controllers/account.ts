import * as express from 'express'
import * as filters from './internal/filters'
import * as err from '../errors'
import * as db from '../database'

const router = express.Router()

/*
	request,
	{
		label: string,
		password: string
	}
	response,
	{
		error: number,
		result?: {
			address: string // account address
		}
	}
*/
router.post('/create', async (req, res) => {
	const account = await db.models.Account.create(req.body.label, req.body.password)
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

router.post('/decryptMnemonic', async (req, res) => {

	const accountInDB = await db.models.Account.findByAddress(req.body.address)
	if (accountInDB == null) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}
	const mnemonic = accountInDB.decryptMnemonic(req.body.password)
	if (!mnemonic) {
		return res.send({
			error: err.NOT_FOUND
		})
	}
	res.send({
		error: err.SUCCESS,
		result: mnemonic
	})
})

router.post('/login', filters.decryptAccount, (req, res) => {
	if (req.body.decryptedAccount) {
		// check if there is account on chain
		res.send({error: err.SUCCESS})
	} else {
		res.send({error: err.UNAUTHORIZED})
	}
})

export const AccountController: express.Router = router
