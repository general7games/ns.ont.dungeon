import * as express from 'express'
import * as utils from '../utils'

const router = express.Router()

router.post('/contractHash2Addr', (req, res) => {
	res.send({
		result: utils.contractHashToAddr(req.body.value).toBase58()
	})
})

router.post('/contractAddr2Hash', (req, res) => {
	res.send({
		result: utils.base58ToContractHash(req.body.value)
	})
})

router.post('/addr2Abstr', (req, res) => {
	res.send({
		result: utils.base58ToAb(req.body.value).join(',')
	})
})

router.post('/contractAddr2Abstr', (req, res) => {
	res.send({
		result: utils.base58ToContractAb(req.body.value).join(',')
	})
})

router.post('/contractHash2Abstr', (req, res) => {
	res.send({
		result: utils.contractHashToAb(req.body.value).join(',')
	})
})

export const UtilsController: express.Router = router
