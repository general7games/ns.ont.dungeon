import * as ont from 'ontology-ts-sdk'

export interface DecryptedAccountPair {
	address: ont.Crypto.Address
	privateKey: ont.Crypto.PrivateKey
}

export interface OntIDPair {
	ontID: string,
	keyNo: number
}
