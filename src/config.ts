import * as loglevel from 'loglevel'

let currentConfig

export function getConfig() {
	return currentConfig
}

export function config(name) {
	const conf = require('./config/config.' + name + '.json')
	currentConfig = conf

	if (currentConfig.loglevel) {
		for (const key in currentConfig.loglevel) {
			if (key === '<root>') {
				loglevel.setLevel(currentConfig.loglevel[key].level)
			} else {
				loglevel.getLogger(key).setLevel(currentConfig.loglevel[key].level)
			}
		}
	}
}
