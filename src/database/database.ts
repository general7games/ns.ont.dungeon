
import { getConfig } from '../config'
import * as mongodb from 'mongodb'
import * as loglevel from 'loglevel'

const log = loglevel.getLogger('database.database')

let db: mongodb.Db

// collection name
const cAccount = 'account'
const cContract = 'contract'

export function connect(complete: (success: boolean) => void) {
	const conf = getConfig()
	mongodb.MongoClient.connect(
		conf.mongodb.uri, (err, client) => {
			if (err) {
				log.error(err)
				complete(false)
				return
			}
			db = client.db(conf.mongodb.name)
			complete(true)
		}
	)
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
