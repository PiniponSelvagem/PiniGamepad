const options = require('../constants/PGS_SETTINGS.json')
const language = require('../constants/PGP_LANGUAGE.json')

const settings = {
    controllerModel: 'xbox-series-x',
    sleepTimeout: '30',
    inputReportAlways: false,
    ledColor: '#ff9f1c'
}

/**
 * Maps each setting name to a function that returns true when a value is valid for it.
 * Settings with a list of options in PGS_SETTINGS.json get theirs generated; a setting missing here is rejected.
 */
const validators = {
    ...Object.fromEntries(Object.entries(options).map(([key, values]) => [key, value => values.includes(value)])),
    inputReportAlways: value => typeof value === 'boolean',
    ledColor: value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
}

/**
 * @brief   Send the current in-memory device settings.
 * @param   _request Incoming request; unused.
 * @param   response Response receiving the settings as JSON.
 */
function getSettings(_request, response) {
    response.json(settings)
}

/**
 * @brief   Validate and apply a partial update to the in-memory settings.
 * @param   request Incoming request containing the proposed settings in its body.
 * @param   response Response receiving the updated settings or an HTTP 400 error.
 * @note    The whole update is rejected if any entry is invalid; settings reset on server restart.
 */
function updateSettings(request, response) {
    const updates = request.body
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return response.status(400).json({ error: language.settings.errors.invalidRequestBody })
    }

    for (const [key, value] of Object.entries(updates)) {
        if (!Object.hasOwn(validators, key) || !validators[key](value)) {
            const error = language.settings.errors.invalidSetting.replace('{setting}', key)
            return response.status(400).json({ error })
        }
    }

    Object.assign(settings, updates)
    response.json(settings)
}

module.exports = { getSettings, updateSettings }