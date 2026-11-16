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
app.get('/favicon.ico',
    /** @brief Serve the SVG favicon. @param _request Incoming request; unused. @param response HTTP response. */
    (_request, response) => {
    response.type('image/svg+xml').sendFile(path.join(__dirname, '..', 'assets', 'favicon.svg'))
})
app.use(express.static(publicDir))

app.listen(port,
    /** @brief Log the server address after it starts listening. */
    () => {
    console.log(`PiniGamepad server listening on port ${port}`)
})
