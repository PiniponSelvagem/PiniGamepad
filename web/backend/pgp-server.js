const path = require('path')
const express = require('express')
const statusApi = require('./api/status')

const app = express()
const port = process.env.PORT || 8080
const publicDir = path.join(__dirname, '..', 'build')

app.get('/api/status', statusApi.status)
app.get('/api/battery', statusApi.batteryStatus)
app.use(express.static(publicDir))

app.listen(port, () => {
    console.log(`PiniGamepad server listening on port ${port}`)
})
