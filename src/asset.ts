import * as ont from 'ontology-ts-sdk'
import * as err from './errors'
import * as loglevel from 'loglevel'
import * as ow from './ow'
import { getConfig } from './config'
import { DecryptedAccountPair } from './types'
import { getClient } from './ow';

const log = loglevel.getLogger('assets')

type AssetType = 'ONT' | 'ONG'

export async function transfer(
	asset: AssetType,
	amount: string,
	from: DecryptedAccountPair,
	to: string
): Promise<number> {

	const conf = getConfig()

	const logMessage = 'transfer ' + asset + ' ' + amount + ' ' + from .address.toBase58() + ' -> ' + to

	let tx: ont.Transfer
	try {
		tx = ont.OntAssetTxBuilder.makeTransferTx(
			asset, from.address, new ont.Crypto.Address(to),
			amount, conf.ontology.gasPrice, conf.ontology.gasLimit,
			from.address)
		await ont.TransactionBuilder.signTransactionAsync(tx, from.privateKey)
		const r = await ow.getClient().sendRawTransaction(tx.serialize(), false, true)
		if (r.Error !== 0) {
			log.error(logMessage + ' failed')
			return err.TRANSACTION_ERROR
		}
		log.info(logMessage)
		return err.SUCCESS
	} catch (e) {
		log.error(e)
		return err.INTERNAL_ERROR
	}
}


export async function balance(address: string) {
	try {
		const r = await getClient().getBalance(new ont.Crypto.Address(address))
		if (r.Error !== 0) {
			log.error(`get balance of ${address} failed`)
			return {
				error: err.TRANSACTION_ERROR
			}
		}
		return {
			error: err.SUCCESS,
			result: {
				ONT: r.Result.ont,
				ONG: r.Result.ong
			}
		}
	} catch (e) {
		log.error(e)
		return {
			error: err.INTERNAL_ERROR
		}
	}
}
