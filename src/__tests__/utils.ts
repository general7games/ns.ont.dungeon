import * as fs from 'fs'
import * as account from '../database/models/account'
import * as ow from '../ow'
import * as utils from '../utils'
import * as assets from '../assets'
import * as err from '../errors'
import { BigNumber } from 'bignumber.js'

export const wait = (ms) => new Promise((res) => setTimeout(res, ms))

export function getMainAccountOfTestNode(): account.Account | null {

	const content = fs.readFileSync('_workspace/wallet.dat', 'utf8')
	const wallet = JSON.parse(content)
	let accountInfo: account.AccountInfo | undefined

	wallet.accounts.forEach((x) => {
		if (x.isDefault) {
			accountInfo = x
		}
	})

	if (accountInfo) {
		accountInfo.scrypt = wallet.scrypt
		return account.Account.import(accountInfo, '123456789', 'user')
	}

	return null
}

export async function ensureAssetsOfAccount(
	address: string,
	asset: {
		ont?: string,
		ong?: string
	}
): Promise<boolean> {
	const r = await ow.getClient().getBalance(utils.base58ToAddr(address))
	if (r.Error !== 0) {
		return false
	}

	let shouldTransferOnt: BigNumber = new BigNumber(0)
	let shouldTransferOng: BigNumber = new BigNumber(0)

	if (asset.ont) {
		const curOnt = new BigNumber(r.Result.ont)
		const expectedOnt = new BigNumber(asset.ont)
		shouldTransferOnt = expectedOnt.minus(curOnt)
	}

	if (asset.ong) {
		const curOng = new BigNumber(r.Result.ong)
		const expectedOng = new BigNumber(asset.ong)
		shouldTransferOng = expectedOng.minus(curOng)
	}

	if (shouldTransferOnt.isGreaterThan(0) || shouldTransferOng.isGreaterThan(0)) {

		const mainAccount = getMainAccountOfTestNode()
		if (!mainAccount) {
			return false
		}

		if (shouldTransferOnt.isGreaterThan(0)) {
			// transfer ont
			const result = await assets.transfer('ONT', shouldTransferOnt.toString(), mainAccount, '123456789', address)
			if (result !== err.SUCCESS) {
				return false
			}
		}

		if (shouldTransferOng.isGreaterThan(0)) {
			// transfer ong
			const result = await assets.transfer('ONG', shouldTransferOng.toString(), mainAccount, '123456789', address)
			if (result !== err.SUCCESS) {
				return false
			}
		}
	}

	return true
}
