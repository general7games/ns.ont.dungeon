export * from './database'

import { Account } from './models/account'
import { Contract } from './models/contract'
import { OntID } from './models/ontid'

export const models = {
	Account,
	Contract,
	OntID
}
