import * as fs from 'fs'
import * as account from '../database/models/account'
import * as contract from '../database/models/contract'
import * as ontid from '../database/models/ontid'
import * as ow from '../ow'
import * as utils from '../utils'
import * as assets from '../assets'
import * as err from '../errors'
import { BigNumber } from 'bignumber.js'
import { DecryptedAccountPair } from '../types';
import { getConfig } from '../config'

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
		const mainAccount = account.Account.import(accountInfo, mainAccountPassword)
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

export function createRandomAccount(password: string): DecryptedAccountPair {
	const acc = account.Account.create('test random', password)
	return acc.decryptedPair(password)
}

export async function createRandomOntID(password: string): Promise<ontid.OntID> {
	const pair = createRandomAccount(password)
	return ontid.OntID.create(pair, 'random ontid', password)
}

export async function deployContractAndInitRandomAdmin(
	pathToContract: string, adminOntIDPassword: string
): Promise<{
	ontID: ontid.OntID,
	decryptedAccountPair: DecryptedAccountPair,
	contract: contract.Contract
}> {

	const conf = getConfig()
	const gasPrice = new BigNumber(conf.ontology.gasPrice)
	const gasLimit = new BigNumber(conf.ontology.gasLimit)
	const gasRequired = gasPrice.multipliedBy(gasLimit).multipliedBy(2)

	const adminOntID = await createRandomOntID(adminOntIDPassword)
	const adminOntIDControllerPair = adminOntID.decryptedController(adminOntIDPassword, 1)
	expect(adminOntIDControllerPair).not.toBeNull()
	if (!adminOntIDControllerPair) {
		return null
	}

	// deploy by mainAccount
	const content = readAVMHexAndChangeHash(pathToContract, 'utf8')
	const newContract = new contract.Contract({
		name: 'auth test',
		version: '1',
		script: content,
		storage: true,
		author: 'test admin',
		email: 'test@test.com',
		description: 'test auth',
	})
	const deployed = await newContract.deployAndSave(adminOntIDControllerPair)
	expect(deployed).toEqual(err.SUCCESS)

	const inited = await newContract.initAdmin(adminOntID.ontID(), adminOntIDControllerPair, 1)
	expect(inited).toEqual(err.SUCCESS)
	if (inited === err.SUCCESS) {
		return {
			ontID: adminOntID,
			decryptedAccountPair: adminOntIDControllerPair,
			contract: newContract
		}
	}
	return null
}
