import * as ont from 'ontology-ts-sdk'
import * as account from './database/models/account'
import * as err from './errors'
import * as loglevel from 'loglevel'
import * as ow from './ow'
import { getConfig } from './config'

const log = loglevel.getLogger('assets')

type AssetType = 'ONT' | 'ONG'


export async function transfer(
	asset: AssetType,
	amount: string,
	from: account.Account, password: string,
	to: string,
	preExec?: boolean
): Promise<number> {

	const privateKey = from.decryptPrivateKey(password)
	if (!privateKey) {
		return err.UNAUTHORIZED
	}

	const conf = getConfig()

	let tx: ont.Transfer
	try {
		tx = ont.OntAssetTxBuilder.makeTransferTx(
			asset, from.address(), new ont.Crypto.Address(to),
			amount, conf.ontology.gasPrice, conf.ontology.gasLimit,
			from.address())
		await ont.TransactionBuilder.signTransaction(tx, privateKey)
	} catch(e) {
		return err.BAD_REQUEST
	}

	const r = await ow.getClient().sendRawTransaction(tx.serialize(), preExec)
	if (r.Error !== 0) {
		return err.FAILED
	}

	return err.SUCCESS
}
