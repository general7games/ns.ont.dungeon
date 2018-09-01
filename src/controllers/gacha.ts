import * as express from 'express'
import * as utils from '../utils'
import * as ont from 'ontology-ts-sdk'
import { getConfig } from '../config'
import { getClient } from '../global'

const router = express.Router()

router.post('/gacha', utils.ensureAccount, async (req, res) => {
	const contractAddr = new ont.Crypto.Address(ont.utils.reverseHex(getConfig().contract.gacha))
	const tx = ont.OntAssetTxBuilder.makeTransferTx(
		'ONT', req.body.decryptedAccount.address, contractAddr, 1, 
		'500', '2000000', req.body.decryptedAccount.address)
	await ont.TransactionBuilder.signTransactionAsync(tx, req.body.decryptedAccount.privateKey)
	const client: ont.RestClient = getClient()
	const result = await client.sendRawTransaction(tx.serialize())
	res.send(result)
})


export const GachaController: express.Router = router
