import * as express from 'express'
import * as filters from './internal/filters'
import * as err from '../errors'
import * as db from '../database'
import { transfer } from '../asset'

const router = express.Router()

/*
	request,
	{
		account: { // root account, will transfer enough ong to admin account
			address: string,
			password: string
		},
		ong: string, // initial ong for admin operation
		password: string // password for both ontID and account associated
	}

	response,
	{
		error: number,
		result?: {
			ontid: string
			mnemonic: string  // mnemonic of account associated to ontID
		}
	}
*/
router.post('/init', filters.ensureAccount, async (req, res) => {
	if (!req.body.password) {
		res.send({
			error: err.BAD_REQUEST
		})
	}

	const ontIDs = await db.models.OntID.find({roles: 'admin'})
	if (ontIDs.length !== 0) {
		res.send({
			error: err.DUPLICATED
		})
		return
	}
	const adminAccount = db.models.Account.create('admin', req.body.password)
	const adminAccountPair = adminAccount.decryptedPair(req.body.password)
	if (!adminAccountPair) {
		res.send({
			error: err.INTERNAL_ERROR
		})
		return
	}
	const mnemonic = adminAccount.decryptMnemonic(req.body.password)
	if (!mnemonic) {
		res.send({
			error: err.INTERNAL_ERROR
		})
		return
	}

	// transfer enough ong to admin for create ontID
	const r = await transfer('ONG', req.body.ong, req.body.decryptedAccount, adminAccountPair.address.toBase58())
	if (r !== err.SUCCESS) {
		res.send({
			error: r
		})
		return
	}

	const adminOntID = await db.models.OntID.create(adminAccountPair, 'admin', req.body.password)
	if (!adminOntID) {
		res.send({
			error: err.INTERNAL_ERROR
		})
		return
	}

	adminOntID.addRole('admin')
	const saved = await adminOntID.save()
	if (!saved) {
		res.send({
			error: err.INTERNAL_ERROR
		})
		return
	}

	res.send({
		error: err.SUCCESS,
		result: {
			ontid: adminOntID.ontID(),
			mnemonic
		}
	})
})

router.post('/deployContract', filters.ensureOntID, async (req, res) => {

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

router.post('/migrateContract', filters.ensureOntID, async (req, res) => {

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
	res.send({
		error: r
	})
})

router.post('/destroyContract', filters.ensureAccount, async (req, res) => {

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

router.get('/listOntID', async (req, res) => {
	const ontIDs = await db.models.OntID.find({})
	const addrs = new Array<{
		ontid: string,
		role: string[]
	}>()
	ontIDs.forEach((x) => {
		addrs.push({
			ontid: x.ontID(),
			role: x.roles
		})
	})
	res.send({
		error: err.SUCCESS,
		result: addrs
	})
})

export const AdminController: express.Router = router
