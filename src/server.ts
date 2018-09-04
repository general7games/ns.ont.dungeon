import * as express from 'express'
import * as controllers from './controllers'
import * as session from 'express-session'
import * as uuid from 'uuid/v1'
import * as redisStore from 'connect-redis'
import { config, getConfig } from './config'
import * as program from 'commander'
import * as utils from './utils'
import * as db from './database'
import * as loglevel from 'loglevel'

program.version('1.0.0')
	.option('--production', 'production mode')
	.parse(process.argv)
if (program.production) {
	config('production')
} else {
	config('development')
}

const conf = getConfig()

loglevel.setDefaultLevel(conf.logLevel)

const log = loglevel.getLogger('server')

if (program.production) {
	log.info('production mode')
} else {
	log.info('development mode')
}

const SessionRedisStore = redisStore(session)

const app: express.Application = express()

app.use(session({
	genid: (req) => uuid(),
	store: new SessionRedisStore({
		url: conf.redis.url
	}),
	secret: conf.express.sessionSecret,
	resave: false,
	saveUninitialized: true
}))

app.use(utils.checkSession)

app.use(express.json())

// controllers
app.use('/account', controllers.AccountController)
app.use('/utils', controllers.UtilsController)
app.use('/admin', controllers.AdminController)

db.connect().then(() => {
	app.listen(conf.express.port, conf.express.host)
})
