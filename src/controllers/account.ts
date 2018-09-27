import * as express from 'express'
import * as filters from './internal/filters'
import * as err from '../errors'
import * as db from '../database'
import { AccountInfo, Account } from '../database/models/account'

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


/*
	decrypted mnemonic of imported account

	request,
	{
		address: string
	}
	response,
	{
		error: number,
		result: string
	}
*/
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

function convertToResultAccounts(accounts?: Account[]) {
	const result = new Array<any>()
	if (accounts) {
		accounts.forEach((a) => {
			result.push({
				address: a.address().toBase58(),
				label: a.label(),
				role: a.role
			})
		})
	}
	return result
}

/*
	list accounts in database

	request,
	{
		cursor: {
			before?: string
			after?: string
		}
	}
	response,
	{
		error: number,
		result?: {
			cursor: {
				before: string,
				after: string
			},
			accounts: {address: string, label: string }[]
		}
	}
*/
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
	const resultAccounts = convertToResultAccounts(r.accounts)
	res.send({
		error: err.SUCCESS,
		result: {
			cursor: {},
			accounts: resultAccounts
		}
	})

})

/*
	search by label or address

	request,
	{
		content: string,
		role?: string
		type?: string
	}
	response,
	{
		error?: number,
		result?: {
			accounts: { label: string, address: string }[]
		}
	}
*/
router.get('/search', async (req, res) => {
	if (!req.query.content) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}
	const r = await db.models.Account.search(req.query.content, req.query.role, req.query.type)
	if (r.error !== err.SUCCESS) {
		res.send({
			error: r.error
		})
		return
	}
	res.send({
		error: err.SUCCESS,
		result: {
			cursor: {},
			accounts: convertToResultAccounts(r.accounts)
		}
	})
})


/*
*/
router.post('/login', filters.decryptAccount, (req, res) => {
	if (req.body.decryptedAccount) {
		// check if there is account on chain
		res.send({error: err.SUCCESS})
	} else {
		res.send({error: err.UNAUTHORIZED})
	}
})

export const AccountController: express.Router = router
