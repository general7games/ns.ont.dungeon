import * as express from 'express'
import * as err from '../errors'
import * as filters from './internal/filters'
import * as asset from '../asset'

const router = express.Router()

/*
	request,
	{
		account: {		// from account
			address: string,
			password: string
		},
		to: string,		// address
		asset: string,	// asset type or token
		amount?: number	// amount of asset
	}
	response,
	{
		error: number,
		result?: {

		}
	}
*/
router.post('/transfer', filters.ensureAccount, async (req, res) => {
	// parameter validating
	if (!req.body.to || !req.body.asset) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}
	if (req.body.asset === 'ONT'
		|| req.body.asset === 'ONG'
		|| req.body.asset === 'GEM'
	) {
		if (!req.body.amount) {
			res.send({
				error: err.BAD_REQUEST
			})
			return
		}
		if (!Number.isInteger(req.body.amount) || req.body.amount <= 0) {
			res.send({
				error: err.BAD_REQUEST
			})
			return
		}
	}

	// transfer
	if (req.body.asset === 'ONT' || req.body.asset === 'ONG') {
		const r = await asset.transfer(req.body.asset, req.body.amount.toString(), req.body.decryptedAccount, req.body.to)
		res.send({
			error: r
		})
		return
	} else if (req.body.asset === 'GEM') {
		// contract, not implemented
		res.send({
			error: err.INTERNAL_ERROR
		})
		return
	}
	// others not implemented
	res.send({
		error: err.INTERNAL_ERROR
	})
})

/*
	request,
	{
		address: string
	}
	response,
	{
		error: number,
		result?: {
			ONT: string,
			ONG: string
		}
	}
*/
router.get('/balance', async (req, res) => {
	if (!req.query.address) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}
	const r = await asset.balance(req.query.address)
	res.send(r)
})

export const AssetController: express.Router = router
