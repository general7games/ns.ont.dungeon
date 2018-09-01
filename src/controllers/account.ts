import * as express from 'express'
import * as ont from 'ontology-ts-sdk'
import * as utils from '../utils'
import * as err from '../errors'

const router = express.Router()

router.post('/create', (req, res) => {
	const result = ont.SDK.createAccount(req.body.label, req.body.password)
	if (result.error === 0) {
		result.result = JSON.parse(result.result)
	}
	res.send(result)
})

router.post('/decrypt_mnemonic', (req, res) => {
	const result = ont.SDK.decryptMnemonicEnc(
		req.body.encryptedMnemonic,
		req.body.address,
		req.body.salt,
		req.body.password)
	res.send(result)
})

router.post('/decrypt_encrypted_private_key', utils.decryptAccount, (req, res) => {
	if (req.body.decryptedAccount) {
		res.send({
			error: err.SUCCESS,
			account: req.body.decryptedAccount
		})
	} else {
		res.send({
			error: err.INCORRECT_ACCOUNT
		})
	}
})

router.post('/login', utils.decryptAccount, (req, res) => {
	if (req.body.decryptedAccount) {
		// check if there is account on chain
		res.send({error: err.SUCCESS})
	} else {
		res.send({error: err.INCORRECT_ACCOUNT})
	}
})

export const AccountController: express.Router = router
