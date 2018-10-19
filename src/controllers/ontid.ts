import * as express from 'express'
import * as db from '../database'
import * as filters from './internal/filters'
import * as err from '../errors'

const router = express.Router()

router.post('/createAndSave', filters.ensureRootAccount, async (req, res) => {

	const result = await db.models.OntID.createAndSave(
		req.body.label, req.body.password, req.body.role
	)
	if (result.error !== err.SUCCESS) {
		res.send({error: result.error})
		return
	}

	if (result.ontID) {
		res.send({
			error: err.SUCCESS,
			result: {
				ontID: result.ontID.ontID()
			}
		})
	} else {
		res.send({
			error: err.INTERNAL_ERROR
		})
	}
})

router.post('/importAndSave', filters.ensureAccount, async (req, res) => {
	return await db.models.OntID.importAndSave(
		req.body.decryptedAccount,
		req.body.keyStore, req.body.password, req.body.role)
})

router.get('/list', async (req, res) => {
	const ontIDs = await db.models.OntID.find({})
	const addrs = new Array<{
		label: string,
		ontid: string,
		roles: string[]
	}>()
	ontIDs.forEach((x) => {
		addrs.push({
			label: x.ontid.label,
			ontid: x.ontID(),
			roles: x.roles
		})
	})
	res.send({
		error: err.SUCCESS,
		result: addrs
	})
})

export const OntIDController: express.Router = router
