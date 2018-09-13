import * as fs from 'fs'
import * as account from '../database/models/account'
import * as ontid from '../database/models/ontid'
import * as ow from '../ow'
import * as utils from '../utils'
import * as assets from '../assets'
import * as err from '../errors'
import { BigNumber } from 'bignumber.js'
import { DecryptedAccountPair } from '../types';

export const wait = (ms) => new Promise((res) => setTimeout(res, ms))

export function getMainAccountOfTestNode(): DecryptedAccountPair | null {

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
		const mainAccountPassword = '123456789'

		// this proc should be removed and deprecate directly
		const mainAccount = account.Account.import(accountInfo, mainAccountPassword, 'user')
		if (mainAccount) {
			const privateKey = mainAccount.decryptPrivateKey(mainAccountPassword)
			if (privateKey) {
				return { address: mainAccount.address(), privateKey }
			}
		}
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
			const result = await assets.transfer('ONT', shouldTransferOnt.toString(), mainAccount, address)
			if (result !== err.SUCCESS) {
				return false
			}
		}

		if (shouldTransferOng.isGreaterThan(0)) {
			// transfer ong
			const result = await assets.transfer('ONG', shouldTransferOng.toString(), mainAccount, address)
			if (result !== err.SUCCESS) {
				return false
			}
		}
	}

	return true
}

export function readAVMHex(path: string, encoding: string) {
	return fs.readFileSync(path, encoding)
}

export function readAVMHexAndChangeHash(path: string, encoding: string) {
	const content = fs.readFileSync(path, encoding) + '00'
	fs.writeFileSync(path, content, encoding)
	return content
}

export async function createRandomOntID(password: string): Promise<ontid.OntID | null> {
	const acc = account.Account.create('test random', password, 'user')
	const pair = acc.decryptedPair(password)
	return ontid.OntID.create(pair, 'admin', 'random ontid', password)
}
