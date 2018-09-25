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
		asset: string,	// assert type
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
