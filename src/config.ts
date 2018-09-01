let currentConfig

export function getConfig() {
	return currentConfig
}

export function config(name) {
	console.log('load config ' + name)
	const conf = require('./config/config.' + name + '.json')
	currentConfig = conf
}
