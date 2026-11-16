let currentInputs = []
let currentBattery = null

/**
 * @brief   Send the latest controller inputs as JSON.
 * @param   _request Incoming request; unused.
 * @param   response Response receiving the input list.
 */
function status(_request, response) {
    response.json({ inputs: currentInputs })
}

/**
 * @brief   Send the latest battery state as JSON.
 * @param   _request Incoming request; unused.
 * @param   response Response receiving the battery state.
 * @note    The response is null until a battery reading is provided.
 */
function batteryStatus(_request, response) {
    response.json(currentBattery)
}

/**
 * @brief   Update the inputs returned by the status endpoint.
 * @param   inputs Array of current controller input entries.
 */
function setInputs(inputs) {
    currentInputs = inputs
}

/**
 * @brief   Update the battery state returned by the battery endpoint.
 * @param   battery Object with percentage and charging fields, or null when unavailable.
 */
function setBatteryStatus(battery) {
    currentBattery = battery
}

module.exports = { status, batteryStatus, setInputs, setBatteryStatus }