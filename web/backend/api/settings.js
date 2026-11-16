const settingOptions = require('../constants/PGS_SETTINGS.json')
const language = require('../constants/PGP_LANGUAGE.json')

const settings = {
    controllerModel: 'xbox-series-x',
    sleepTimeout: '30',
    inputReportAlways: false,
    ledColor: '#ff9f1c'
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
 * @param   response Response receiving the updated settings or a validation error.
 * @return  The Express response containing the updated settings or an HTTP 400 error.
 * @note    The entire update is rejected if any entry is invalid; settings reset on server restart.
 */
function updateSettings(request, response) {
    const updates = request.body
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return response.status(400).json({ error: language.settings.errors.invalidRequestBody })
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
            const error = language.settings.errors.invalidSetting.replace('{setting}', key)
            return response.status(400).json({ error })
        }
    }

    Object.assign(settings, updates)
    return response.json(settings)
}

module.exports = { getSettings, updateSettings }