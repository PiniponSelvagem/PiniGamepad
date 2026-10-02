const path = require('path')
const express = require('express')
const statusApi = require('./api/status')
const settingsApi = require('./api/settings')

const app = express()
const port = process.env.PORT || 8080
const publicDir = path.join(__dirname, '..', 'build')

app.use(express.json())
app.get('/api/status', statusApi.status)
app.get('/api/battery', statusApi.batteryStatus)
app.get('/api/settings', settingsApi.getSettings)
app.patch('/api/settings', settingsApi.updateSettings)
app.use(express.static(publicDir))

app.listen(port, () => {
    console.log(`PiniGamepad server listening on port ${port}`)
})
