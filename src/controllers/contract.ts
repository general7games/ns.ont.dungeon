import * as express from 'express'
import * as filters from './internal/filters'
import * as err from '../errors'
import * as db from '../database'
import * as utils from '../utils'

const router = express.Router()

router.post('/deploy', filters.ensureAccount, async (req, res) => {

	if (!req.body.name
		|| !req.body.script
		|| !req.body.version
		|| !req.body.description
		|| !req.body.author
		|| !req.body.email
		|| !req.body.abi) {

		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.findOne({name: req.body.name})
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
		storage: req.body.storage,
		abi: req.body.abi
	})

	if (req.body.abi.functions) {
		req.body.abi.functions.forEach((func) => {
			if (func.name !== req.body.abi.entrypoint) {
				newContract.addMethod(func.name)
			}
		})
	}

	const r = await newContract.deployAndSave(req.body.decryptedAccount)
	if (r !== err.SUCCESS) {
		res.send({error: r})
		return
	}

	res.send({
		error: err.SUCCESS
	})
})

router.post('/initAdmin', filters.ensureOntID, async (req, res) => {

	if (!req.body.name) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.findOne({name: req.body.name})
	if (!contract) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}

	const r = await contract.initAdmin(req.body.decryptedOntID)
	res.send({
		error: r
	})

})

router.post('/migrate', filters.ensureOntID, async (req, res) => {

	if (!req.body.name
		|| !req.body.script
		|| !req.body.version) {

		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.findOne({name: req.body.name})
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

router.post('/destroy', filters.ensureAccount, async (req, res) => {

	if (!req.body.name) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.findOne({name: req.body.name})
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

router.get('/list', async (req, res) => {

	const contracts = await db.models.Contract.find({})
	res.send({
		error: err.SUCCESS,
		result: {
			contracts
		}
	})

})

router.post('/addRole', filters.ensureOntID, async (req, res) => {

	if (!req.body.name
		|| !req.body.roleName
	) {
		res.send({
			error: err.SUCCESS
		})
		return
	}

	const contract = await db.models.Contract.findOne({name: req.body.name})
	if (!contract) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}

	const r = await contract.addRoleAndUpdate(req.body.roleName)
	res.send({
		error: r
	})
})

router.post('/addOntIDToRole', filters.ensureOntID, async (req, res) => {

	if (!req.body.name
		|| !req.body.ontIDToAdd
		|| !req.body.roleName
	) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.findOne({name: req.body.name})
	if (!contract) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}
	const r = await contract.addOntIDToRoleAndUpdate(
		req.body.ontIDToAdd, req.body.roleName,
		req.body.decryptedOntID
	)
	res.send({
		error: r
	})
})

router.post('/assignMethodToRole', filters.ensureOntID, async (req, res) => {

	if (!req.body.name
		|| !req.body.methodName
		|| !req.body.roleName
	) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.findOne({name: req.body.name})
	if (!contract) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}
	const r = await contract.assignMethodToRoleAndUpdate(
		req.body.methodName, req.body.roleName,
		req.body.decryptedOntID
	)
	res.send({error: r})
})

router.post('/initContract', filters.ensureRootAccount, ensureContract, async (req, res) => {
	const r = await req.body.contract.initContract(req.body.decryptedAccount)
	res.send(r)
})

router.get('/getContractInfos', ensureContract, async (req, res) => {
	const contractInfo = req.body.contract.getContractInfos()
	res.send({
		error: contractInfo ? err.SUCCESS : err.INTERNAL_ERROR,
		contractInfo: contractInfo
	})
})

router.get('/_getContractInfos', filters.ensureAccount, ensureContract, async (req, res) => {
	const r = await req.body.contract._getContractInfos(req.body.decryptedAccount)
	res.send(r)
})

router.post('/capturePoints', filters.ensureAccount, ensureContract, async (req, res) => {
	if (!req.body.points) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	let xPoints = new Array<number>()
	let yPoints = new Array<number>()
	let colors = new Array<number>()
	let prices = new Array<number>()
	for (let point of req.body.points) {
		xPoints.push(point.x)
		yPoints.push(point.y)
		colors.push(point.color)
		prices.push(point.price)
	}
	
	const error = await req.body.contract.capturePoints(xPoints, yPoints, colors, prices, req.body.decryptedAccount)
	res.send({
		error: error
	})
})

router.post('/getAllPoints', filters.ensureAccount, ensureContract, async (req, res) => {
	const points = await req.body.contract.getAllPoints(req.body.decryptedAccount)
	points.priceMultiplier = 1.3
	points.contractHash = utils.addrToContractHex(req.body.contract.address())
	res.send({
		error: points.maxLine == 0 ? err.CONTRACT_FAILED : err.SUCCESS,
		points: points
	})
})

async function ensureContract(req, res, next) {
	if (!req.body.name) {
		res.send({
			error: err.BAD_REQUEST
		})
		return
	}

	const contract = await db.models.Contract.findOne({name: req.body.name})
	if (!contract) {
		res.send({
			error: err.NOT_FOUND
		})
		return
	}
	req.body.contract = contract
	next()
}

export const ContractController: express.Router = router
