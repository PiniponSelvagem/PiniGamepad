const settingOptions = require('../constants/PGS_SETTINGS.json')

const settings = {
    controllerModel: 'xbox-series-x',
    sleepTimeout: '30',
    inputReportAlways: false,
    ledColor: '#ff9f1c'
}

function getSettings(_request, response) {
    response.json(settings)
}

function updateSettings(request, response) {
    const updates = request.body
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return response.status(400).json({ error: 'Settings must be an object' })
    }

    for (const [key, value] of Object.entries(updates)) {
        const isValid = key in settingOptions
            ? settingOptions[key].includes(value)
            : key === 'inputReportAlways'
                ? typeof value === 'boolean'
                : key === 'ledColor'
                    ? typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
                    : false

        if (!isValid) {
            return response.status(400).json({ error: `Invalid setting: ${key}` })
        }
    }

    Object.assign(settings, updates)
    return response.json(settings)
}

module.exports = { getSettings, updateSettings }