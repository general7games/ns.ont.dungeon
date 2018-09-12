
import { getConfig } from '../config'
import * as mongodb from 'mongodb'
import * as loglevel from 'loglevel'

const log = loglevel.getLogger('database.database')

let client: mongodb.MongoClient
let db: mongodb.Db

// collection name
const cAccount = 'account'
const cContract = 'contract'
const cOntID = 'ontid'

export async function connect() {
	const conf = getConfig()
	client = await mongodb.MongoClient.connect(conf.mongodb.uri)
	db = client.db(conf.mongodb.name)
	return true
}

export async function close() {
	await client.close()
}

function get(): mongodb.Db {
	if (!db) {
		log.error('db connection is not established')
	}
	return db
}

let colAccount: mongodb.Collection
export function account(): mongodb.Collection {
	if (colAccount == null) {
		colAccount  = get().collection(cAccount)
		colAccount.createIndex({'account.address': 1})
	}
	return colAccount
}

let colContract: mongodb.Collection
export function contract(): mongodb.Collection {
	if (colContract == null) {
		colContract = get().collection(cContract)
		colContract.createIndex({name: 1, hash: 1})
	}
	return colContract
}

let colOntID: mongodb.Collection
export function ontid(): mongodb.Collection {
	if (colOntID == null) {
		colOntID = get().collection(cOntID)
		colOntID.createIndex({'ontid.ontid': 1})
	}
	return colOntID
}
