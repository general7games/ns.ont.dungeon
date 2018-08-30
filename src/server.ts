import * as express from 'express'
const app: express.Application = express()

function decryptAccount(req: express.Request, res: express.Response, next: express.NextFunction) {
	next()
}

app.use(express.json())
app.use(decryptAccount)

app.post('/create_account', (req: express.Request, res: express.Response) => {
	res.send('hello world')
})

app.listen(3000)
