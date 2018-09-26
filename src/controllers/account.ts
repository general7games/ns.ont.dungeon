import * as express from 'express'
import * as filters from './internal/filters'
import * as err from '../errors'
import * as db from '../database'
import { AccountInfo } from '../database/models/account'

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
	if (!req.body.label
		|| !req.body.password
	) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}
	const account = await db.models.Account.create(req.body.label, req.body.password)
	const r = await account.save()
	if (r !== err.SUCCESS) {
		res.send({
			error: r
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

/*
	request, AccountInfo
	{
		label: string,
		address: string,
		key: string,
		salt: string,
		password: string,
		parameters?: {
			curve: string
		},
		scrypt?: {
			p: number,
			n: number,
			r: number,
			dkLen: number
		}
	}
	response,
	{
		error: number,
		result?: {
			address: string // account address
		}
	}
*/
router.post('/importByEncryptedPk', async (req, res) => {
	const account = db.models.Account.import(req.body as AccountInfo, req.body.password)
	if (!account) {
		res.send({
			error: err.UNAUTHORIZED
		})
		return
	}
	const r = await account.save()
	res.send({
		error: r
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

router.get('/list', async (req, res) => {
	// todo: paging algorithm
	const r = await db.models.Account.all()
	if (r.error !== err.SUCCESS) {
		res.send({
			error: r.error
		})
		return
	}
	if (!r.accounts) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}
	const accounts = r.accounts
	const resultAccounts = new Array<any>()
	accounts.forEach((a) => {
		resultAccounts.push({
			address: a.address().toBase58(),
			label: a.label()
		})
	})
	res.send({
		error: err.SUCCESS,
		result: {
			cursor: {},
			accounts: resultAccounts
		}
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
