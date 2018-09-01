import * as express from 'express'
import * as controllers from './controllers'
import * as session from 'express-session'
import * as uuid from 'uuid/v1'
import * as redisStore from 'connect-redis'
import { config, getConfig } from './config'
import * as program from 'commander'
import * as utils from './utils'

program.version('1.0.0')
	.option('--production', 'production mode')
	.parse(process.argv)
if (program.production) {
	config('production')
} else {
	config('development')
}

const SessionRedisStore = redisStore(session)

const app: express.Application = express()

const currentConfig = getConfig()

app.use(session({
	genid: (req) => uuid(),
	store: new SessionRedisStore({
		host: currentConfig.redis.host, 
		port: currentConfig.redis.port
	}),
	secret: currentConfig.express.sessionSecret,
	resave: false,
	saveUninitialized: true
}))

app.use(utils.checkSession)

app.use(express.json())

app.use('/account', controllers.AccountController)
app.use('/gacha', controllers.GachaController)
app.use('/utils', controllers.UtilsController)

app.listen(3000)
