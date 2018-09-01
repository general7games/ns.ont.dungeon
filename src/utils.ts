import * as ont from 'ontology-ts-sdk'
import * as err from './errors'

function decryptAccountInternal(req) {
	if (req.body.address && req.body.password && req.body.encryptedPrivateKey && req.body.salt) {
		const address = new ont.Crypto.Address(req.body.address)
		// const password = ont.SDK.transformPassword(req.body.password)
		const password = req.body.password
		const salt = Buffer.from(req.body.salt, 'base64').toString('hex')

		// algo 
		let keyType: ont.Crypto.KeyType | undefined
		if (req.body.algorithm) {
			keyType = ont.Crypto.KeyType.fromLabel(req.body.algorithm)
		}
		let keyParameters: ont.Crypto.KeyParameters | undefined
		if (req.body.parameters) {
			keyParameters = ont.Crypto.KeyParameters.deserializeJson(req.body.parameters)
		}
		const encryptedPrivateKey = new ont.Crypto.PrivateKey(req.body.encryptedPrivateKey, keyType, keyParameters)

		// scrypt
		let scryptParams: ont.scrypt.ScryptParams | undefined 
		if (req.body.scrypt) {
			scryptParams = {
				cost: req.body.scrypt.n,
				blockSize: req.body.scrypt.r,
				parallel: req.body.scrypt.p,
				size: req.body.scrypt.dkLen
			}
		}		

		try {
			const privateKey = encryptedPrivateKey.decrypt(password, address, salt, scryptParams)
			req.body.decryptedAccount = {address, privateKey}
		} catch (e) {
			// nothing here
			console.warn('decrypt account failed ' + e)
		}
	}
}

export function decryptAccount(req, res, next) {
	decryptAccountInternal(req)	
	next()
}

export function ensureAccount(req, res, next) {
	decryptAccountInternal(req)
	if (req.body.decryptedAccount) {
		next()
	} else {
		res.send({
			error: err.INCORRECT_ACCOUNT
		})
	}
}

export function checkSession(req, res, next) {
	next()
}
