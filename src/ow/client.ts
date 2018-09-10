import * as ont from 'ontology-ts-sdk'
import { getConfig } from '../config'

let currentClient

export function getClient(): ont.WebsocketClient {
	if (!currentClient) {
		const conf = getConfig()
		if (conf.ontology.uri !== '') {
			currentClient = new ont.WebsocketClient(conf.ontology.uri, false, false)
		} else {
			currentClient = new ont.WebsocketClient('', false, false)
		}
	}
	return currentClient
}
