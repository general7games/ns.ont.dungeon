import * as ont from 'ontology-ts-sdk'
import { getConfig } from '../config'

let currentClient

export function getClient(): ont.RestClient {
	if (!currentClient) {
		const conf = getConfig()
		if (conf.ontology.uri !== '') {
			currentClient = new ont.RestClient(conf.ontology.uri)
		} else {
			currentClient = new ont.RestClient()
		}
	}
	return currentClient
}
