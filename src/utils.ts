import * as ont from 'ontology-ts-sdk'

export function base58ToAddr(base58): ont.Crypto.Address {
	ensureBase58(base58)
	return new ont.Crypto.Address(base58)
}

export function base58ToContractHex(base58) {
	ensureBase58(base58)
	return ont.utils.reverseHex(base58ToAddr(base58).toHexString())
}

function ensureBase58(base58) {
	if (typeof base58 !== 'string' || base58.length != 34) {
		throw new Error('ensureBase58 wrong param format, ' + base58)
	}
}

export function contractHexToAddr(hex): ont.Crypto.Address {
	ensureHex(hex)
	return new ont.Crypto.Address(hex)
}

export function contractHexToBase58(hex) {
	ensureHex(hex)
	return contractHexToAddr(hex).toBase58()
}

export function contractHexToNumber(hex) {
	return parseInt(ont.utils.reverseHex(hex), 16)
}

function ensureHex(hex) {
	if (typeof hex !== 'string' || hex.length != 40) {
		throw new Error('ensureHex wrong param format, ' + hex)
	}
}

export function addrToContractHex(addr: ont.Crypto.Address) {
	return ont.utils.reverseHex(addr.toHexString())
}

export function addrToBase58(addr: ont.Crypto.Address) {
	return addr.toBase58()
}