import * as ont from 'ontology-ts-sdk'
import * as loglevel from 'loglevel'

const log = loglevel.getLogger('utils')


export function contractHashToAddr(hash): ont.Crypto.Address {
	return new ont.Crypto.Address(ont.utils.reverseHex(hash))
}

export function base58ToAddr(base58): ont.Crypto.Address {
	return new ont.Crypto.Address(base58)
}

export function base58ToContractHash(base58) {
	return new ont.Crypto.Address(base58).toHexString()
}

export function base58ToAb(base58) {
	return ont.utils.hexstring2ab(ont.utils.reverseHex(base58ToAddr(base58).toHexString()))
}

export function base58ToContractAb(base58) {
	return ont.utils.hexstring2ab(ont.utils.reverseHex(base58ToContractHash(base58)))
}

export function contractHashToAb(hash) {
	return ont.utils.hexstring2ab(ont.utils.reverseHex(hash))
}
