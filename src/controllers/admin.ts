import * as express from 'express'
import * as filters from './internal/filters'
import * as err from '../errors'
import * as db from '../database'

const router = express.Router()

router.post('/init', async (req, res) => {

	const newAdminAccount = db.models.Account.create('admin', req.body.password, 'admin')
	const result = await newAdminAccount.save()
	if (result === false) {
		res.send({
			error: err.INTERNAL_ERROR
		})
		return
	} else if (result === 'duplicated') {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}
	res.send({
		error: err.SUCCESS,
		result: {
			address: newAdminAccount.account.address
		}
	})
})

async function ensureAdmin(req, res, next) {
	const adminAccount = await db.models.Account.findAdmin()
	if (!adminAccount || !adminAccount.account
		|| adminAccount.account.address !== req.body.decryptedAccount.address.toBase58()) {
		res.send({
			error: err.UNAUTHORIZED
		})
		return
	}
	next()
}

router.post('/deployContract', filters.ensureAccount, ensureAdmin, async (req, res) => {

	if (!req.body.name
		|| !req.body.script
		|| !req.body.version
		|| !req.body.description
		|| !req.body.author
		|| !req.body.email) {

		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.find({name: req.body.name})
	if (contract) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const newContract = new db.models.Contract({
		name: req.body.name,
		script: req.body.script,
		version: req.body.version,
		author: req.body.author,
		email: req.body.email,
		description: req.body.description,
		storage: req.body.storage
	})

	const r = await newContract.deployAndSave(req.body.decryptedAccount)

	res.send({
		error: r
	})
})

router.post('/migrateContract', filters.ensureAccount, ensureAdmin, async (req, res) => {

	if (!req.body.name
		|| !req.body.script
		|| !req.body.version) {

		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.find({name: req.body.name})
	if (!contract) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}
	const r = await contract.migrate(
		{
			script: req.body.script,
			version: req.body.version
		},
		req.body.decryptedAccount,
		req.body.preExec
	)
	if (r !== err.SUCCESS) {
		res.send({
			error: err.FAILED
		})
		return
	}

	res.send({
		error: err.SUCCESS
	})

})

router.post('/destroyContract', filters.ensureAccount, ensureAdmin, async (req, res) => {

	if (!req.body.name) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.find({name: req.body.name})
	if (!contract) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}

	const r = await contract.destroy(req.body.decryptedAccount)
	if (r !== err.SUCCESS) {
		res.send({
			error: err.INTERNAL_ERROR
		})
		return
	}
	res.send({
		error: err.SUCCESS
	})

})

export const AdminController: express.Router = router
