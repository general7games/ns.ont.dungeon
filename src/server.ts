import express from 'express'
const app = express()

function decryptAccount(req, res, next) {
	next()
}

app.use(express.json())
app.use(decryptAccount)

app.post('/create_account', (req, res) => {
	res.send(req.body)
})

app.listen(3000)
