import * as express from 'express'
import * as db from '../database'
import * as filters from './internal/filters'

const router = express.Router()

router.post('/createAndSave', filters.ensureAccount, async (req, res) => {
	return await db.models.OntID.createAndSave(
		req.body.decryptedAccount,
		req.body.label, req.body.password, req.body.role
	)
})

router.post('/importAndSave', filters.ensureAccount, async (req, res) => {
	return await db.models.OntID.importAndSave(
		req.body.decryptedAccount,
		req.body.keyStore, req.body.password, req.body.role)
})

export const OntIDController: express.Router = router
