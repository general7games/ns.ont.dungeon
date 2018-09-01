import * as express from 'express'
import * as ont from 'ontology-ts-sdk'

const router = express.Router()

router.post('/contracthash2addr', (req, res) => {
	res.send({
		result: new Buffer(ont.utils.reverseHex(req.body.value), 'hex').toString('base64'),
	})
})

export const UtilsController: express.Router = router

