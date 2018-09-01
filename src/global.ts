import * as ont from 'ontology-ts-sdk'
// import { getConfig } from './config'

let currentClient

export function getClient() {
	if (!currentClient) {
		// const conf = getConfig()
		currentClient = new ont.RestClient() // conf.ontology.host + ':' + conf.ontology.port)
	}
	return currentClient
}
