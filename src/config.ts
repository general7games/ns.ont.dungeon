import * as loglevel from 'loglevel'

const log = loglevel.getLogger('config')

let currentConfig

export function getConfig() {
	return currentConfig
}

export function config(name) {
	log.info('load config ' + name)
	const conf = require('./config/config.' + name + '.json')
	currentConfig = conf
}
