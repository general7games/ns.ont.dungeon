import * as ont from 'ontology-ts-sdk'
import opcode from './opcode'

const varifyPositiveInt = ont.utils.varifyPositiveInt
const str2hexstr = ont.utils.str2hexstr
const pushHexString = ont.ScriptBuilder.pushHexString
const pushInt = ont.ScriptBuilder.pushInt
const pushBool = ont.ScriptBuilder.pushBool
const num2hexstring = ont.utils.num2hexstring

const AUTH_CONTRACT = '0000000000000000000000000000000000000006'
const contractAddress = new ont.Crypto.Address(AUTH_CONTRACT)

function createCodeParamScript(obj: any): string {
	let result = ''
	// Consider string as hexstr
	if (typeof obj === 'string') {
		result += pushHexString(obj)
	} else if (typeof obj === 'boolean') {
		result += pushBool(obj)
	} else if (typeof obj === 'number') {
		result += pushInt(obj)
	} else if (obj instanceof ont.Crypto.Address) {
		result += pushHexString(obj.serialize())
	} else if (obj instanceof ont.Struct) {
		for (const v of obj.list) {
			result += createCodeParamScript(v)
			result += num2hexstring(opcode.DUPFROMALTSTACK)
			result += num2hexstring(opcode.SWAP)
			result += num2hexstring(opcode.APPEND)
		}
	}
	return result
}

function buildNativeCodeScript(list: any[]) {
	let result = ''
	for (let i = list.length - 1; i >= 0; i--) {
		const val = list[i]
		// Consider string as hexstr
		if (typeof val === 'string') {
			result += pushHexString(val)
		} else if (typeof val === 'boolean') {
			result += pushBool(val)
		} else if (typeof val === 'number') {
			result += pushInt(val)
		} else if (val instanceof ont.Crypto.Address) {
			result += pushHexString(val.serialize())
		} else if (val instanceof ont.Struct) {
			result += pushInt(0)
			result += num2hexstring(opcode.NEWSTRUCT)
			result += num2hexstring(opcode.TOALTSTACK)
			for (const v of val.list) {
				result += createCodeParamScript(v)
				result += num2hexstring(opcode.DUPFROMALTSTACK)
				result += num2hexstring(opcode.SWAP)
				result += num2hexstring(opcode.APPEND)
			}
			result += num2hexstring(opcode.FROMALTSTACK)
		} else if (Array.isArray(val) && isTypedArray(val, ont.Struct)) {
			result += pushInt(0)
			result += num2hexstring(opcode.NEWSTRUCT)
			result += num2hexstring(opcode.TOALTSTACK)
			for (const s of val) {
				result += createCodeParamScript(s)
			}
			result += num2hexstring(opcode.FROMALTSTACK)
			result += pushInt(val.length)
			result += num2hexstring(opcode.PACK)
		} else if (Array.isArray(val)) {
			result += buildNativeCodeScript(val)
			result += pushInt(val.length)
			result += num2hexstring(opcode.PACK)
		}
	}
	return result
}

function isTypedArray(arr: any[], type: any) {
	let result = true
	for (const a of arr) {
		if (!(a instanceof type)) {
			result = false
			break
		}
	}
	return result
}

export function makeAssignFuncsToRoleTx(
	contractAddr: ont.Crypto.Address,
	adminOntId: string,
	role: string,
	funcNames: string[],
	keyNo: number,
	payer: ont.Crypto.Address,
	gasPrice: string,
	gasLimit: string
): ont.Transaction {
	varifyPositiveInt(keyNo)
	if (adminOntId.substr(0, 3) === 'did') {
		adminOntId = str2hexstr(adminOntId)
	}
	const struct = new ont.Struct()
	struct.add(contractAddr.serialize(), adminOntId, str2hexstr(role), funcNames.length)
	for (const f of funcNames) {
		struct.add(str2hexstr(f))
	}
	struct.add(keyNo)
	const params = buildNativeCodeScript([struct])
	const tx = ont.TransactionBuilder.makeNativeContractTx('assignFuncsToRole', params,
		contractAddress, gasPrice, gasLimit, payer)
	return tx
}

export function makeAssignOntIdsToRoleTx(
	contractAddr: ont.Crypto.Address,
	adminOntId: string,
	role: string,
	ontIds: string[],
	keyNo: number,
	payer: ont.Crypto.Address,
	gasPrice: string,
	gasLimit: string
): ont.Transaction {
	// varifyPositiveInt(keyNo)
	if (adminOntId.substr(0, 3) === 'did') {
		adminOntId = str2hexstr(adminOntId)
	}
	const struct = new ont.Struct()
	struct.add(contractAddr.serialize(), adminOntId, str2hexstr(role), ontIds.length)
	for (const i of ontIds) {
		if (i.substr(0, 3) === 'did') {
			struct.add(str2hexstr(i))
		} else {
			struct.add(i)
		}
	}
	struct.add(keyNo)
	const params = buildNativeCodeScript([struct])
	const tx = ont.TransactionBuilder.makeNativeContractTx('assignOntIDsToRole', params,
		contractAddress, gasPrice, gasLimit, payer)
	return tx
}

export function makeTransferAuthTx(
	contractAddr: ont.Crypto.Address,
	newAdminOntid: string,
	keyNo: number,
	payer: ont.Crypto.Address,
	gasPrice: string,
	gasLimit: string
): ont.Transaction {
	varifyPositiveInt(keyNo)
	if (newAdminOntid.substr(0, 3) === 'did') {
		newAdminOntid = str2hexstr(newAdminOntid)
	}
	const struct = new ont.Struct()
	struct.add(contractAddress.serialize(), newAdminOntid, keyNo)
	const list = [struct]
	const params = buildNativeCodeScript(list)

	const tx = ont.TransactionBuilder.makeNativeContractTx('transfer', params, contractAddress, gasPrice, gasLimit, payer)
	return tx
}
