const Handlebars = require('handlebars')
const language = require('./constants/PGP_LANGUAGE.json')
const settingOptionValues = require('../backend/constants/PGS_SETTINGS.json')
const createTetrisGame = require('./games/tetris/tetris')

const settingsOptions = {
    controllerModel: settingOptionValues.controllerModel.map(
        /**
         * @brief Pair a controller-model value with its localized label.
         * @param value Valid controller model.
         * @return Option value and label.
         */
        value => ({
            value,
            label: language.settings.modelEmulation.option[value]
        })
    ),
    sleepTimeout: settingOptionValues.sleepTimeout.map(
        /**
         * @brief Pair a timeout value with its localized label.
         * @param value Valid timeout in seconds.
         * @return Option value and label.
         */
        value => ({
            value,
            label: language.settings.sleepTimeout.option[value]
        })
    )
}

Handlebars.registerPartial('nav', require('../templates/nav.hbs'))

const routes = {
    '#/': { page: 'gamepad', template: Handlebars.compile(require('../templates/gamepad.hbs')) },
    '#/settings': { page: 'settings', template: Handlebars.compile(require('../templates/settings.hbs')) },
    '#/tetris': { page: 'tetris', template: Handlebars.compile(require('../templates/tetris.hbs')) }
}
const defaultHash = '#/'

const app = document.querySelector('#app')
const SMALL_LAYOUT_MAX_WIDTH = 600
const statusInterval = 100
const batteryInterval = 10000
const status = {
    inputs: []
}
let debugMode = false
let currentRoute = routes[defaultHash]
let statusTimer = null
let batteryTimer = null
let batteryState = null
let tetrisGame = null

/**
 * @brief   Apply the client-side debug state to the page and its settings toggle.
 */
function applyDebugState() {
    const toggle = document.querySelector('[data-setting-key="debugMode"]')
    document.body.classList.toggle('debug-mode', debugMode)
    if (toggle) {
        toggle.dataset.pressed = String(debugMode)
    }
}

/**
 * @brief   Load server settings and populate the currently rendered settings page.
 * @return  A promise that resolves after the page is updated or the request fails.
 * @note    The debug setting remains client-side; a page removed during the request is ignored.
 */
async function loadSettings() {
    const settingsPage = document.querySelector('.settings-page')
    if (!settingsPage) return

    try {
        const response = await fetch('/api/settings', { cache: 'no-store' })
        if (!response.ok) {
            throw new Error()
        }
        const settings = await response.json()
        if (!settingsPage.isConnected) return

        settingsPage.querySelectorAll('[data-setting-key]').forEach(
            /**
             * @brief Apply one returned setting to its control.
             * @param control Rendered settings control.
             */
            control => {
            const key = control.dataset.settingKey
            if (key === 'debugMode' || !(key in settings)) return

            if (control.classList.contains('toggle')) {
                control.dataset.pressed = String(settings[key])
            } else {
                control.value = settings[key]
            }
        })

        const colorValue = settingsPage.querySelector('.led-color-value')
        if (colorValue && settings.ledColor) {
            colorValue.textContent = settings.ledColor.toUpperCase()
        }
    } catch (_error) {
        return
    }
}

/**
 * @brief   Send a partial settings update to the server.
 * @param   updates Object containing the settings to change.
 * @return  A promise that resolves after the request completes or fails.
 * @note    Request errors are currently ignored and server responses are not checked.
 */
async function saveSettings(updates) {
    try {
        await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        })
    } catch (_error) {
        return
    }
}

/**
 * @brief   Render the current route and attach handlers for its page.
 * @note    Replaces the app's HTML before restoring debug and battery display state.
 */
function render() {
    app.innerHTML = currentRoute.template({
        ...status,
        active: { [currentRoute.page]: true },
        language,
        settingsOptions
    })
    attachNavigationHandlers()
    applyDebugState()
    updateBatteryIndicator(batteryState)
    if (currentRoute.page === 'gamepad') updateInputView()
    if (currentRoute.page === 'settings') {
        attachSettingsHandlers()
        loadSettings()
    }
}

/**
 * @brief   Attach handlers that open and close the navigation menu.
 */
function attachNavigationHandlers() {
    const toggle = document.querySelector('.nav-toggle')
    const menu = document.querySelector('.nav-menu')
    toggle.addEventListener('click',
        /**
         * @brief Open or close the navigation menu when its toggle is clicked. */
        () => {
            const expanded = toggle.dataset.expanded === 'true'
            toggle.dataset.expanded = String(!expanded)
            menu.classList.toggle('open', !expanded)
        }
    )
    menu.querySelectorAll('.nav-link').forEach(
        /**
         * @brief Attach a menu-close handler to a navigation link.
         * @param link Navigation link element.
         */
        link => {
        link.addEventListener('click',
            /**
             * @brief Close the navigation menu after selecting a link.
             */
            () => {
                toggle.dataset.expanded = 'false'
                menu.classList.remove('open')
        })
    })
}

/**
 * @brief   Render the selected hash route and manage page-specific polling and Tetris lifecycle.
 * @note    Leaving Tetris pauses its game; controller input polling runs only on the controller page.
 */
function handleRouteChange() {
    const nextRoute = routes[window.location.hash] || routes[defaultHash]
    if (currentRoute.page === 'tetris' && nextRoute.page !== 'tetris') {
        tetrisGame?.pause()
    }
    currentRoute = nextRoute
    render()
    if (currentRoute.page === 'gamepad') {
        startStatusPolling()
    } else {
        stopStatusPolling()
    }

    if (currentRoute.page === 'tetris') {
        if (!tetrisGame) tetrisGame = createTetrisGame(language.tetris)
        tetrisGame.mount(document.querySelector('.tetris-page'))
    }
}

/**
 * @brief   Update controller buttons, triggers, and joystick positions from the latest input status.
 * @note    Joystick positions are scaled to the visible distance between the knob and its base.
 */
function updateInputView() {
    const inputs = status.inputs || []
    const activeButtons = new Set(
        inputs.filter(
            /**
             * @brief Identify button inputs.
             * @param input Input status entry.
             * @return True for a button.
             */
            input => input.type === 'button').map(
            /**
             * @brief Extract a button name.
             * @param input Button status entry.
             * @return Button name.
             */
            input => input.name)
    )
    document.querySelectorAll('[data-input]').forEach(
        /**
         * @brief Highlight a button when its input is active.
         * @param button Controller button element.
         */
        button => {
        button.classList.toggle('input-active', activeButtons.has(button.dataset.input))
    })
    document.querySelectorAll('[data-analog]').forEach(
        /**
         * @brief Update one analog trigger's fill and active state.
         * @param trigger Trigger element.
         */
        trigger => {
        const input = inputs.find(
            /**
             * @brief Match this analog trigger.
             * @param activeInput Input status entry.
             * @return True for the matching trigger.
             */
            activeInput => (
                activeInput.type === 'axis' &&
                activeInput.value !== undefined &&
                activeInput.name === trigger.dataset.analog
            )
        )
        const active = Boolean(input)
        const value = active ? input.value : 0
        trigger.style.setProperty('--trigger-fill', `${value}%`)
        trigger.classList.toggle('input-active', active)
    })
    document.querySelectorAll('[data-axis]').forEach(
        /**
         * @brief Position and highlight one joystick from input status.
         * @param axis Joystick element.
         */
        axis => {
        const knob = axis.querySelector('.joystick-knob')
        const input = inputs.find(
            /**
             * @brief Match this joystick axis.
             * @param activeInput Input status entry.
             * @return True for the matching joystick.
             */
            activeInput => (
                activeInput.type === 'axis' &&
                activeInput.value === undefined &&
                activeInput.name === axis.dataset.axis
            )
        )
        const active = Boolean(input)
        const maximum = (axis.clientWidth - knob.offsetWidth) / 2
        const x = active ? input.x / 100 * maximum : 0
        const y = active ? -input.y / 100 * maximum : 0
        knob.style.transform = `translate(${x}px, ${y}px)`
        axis.classList.toggle('input-active', active)
    })
}

const controllerSideInset = 24
const scaleBreakpoint = 610

/**
 * @brief   Set the controller's scale according to available window width.
 */
function updateControllerScale() {
    const availableWidth = window.innerWidth - controllerSideInset
    const scale = Math.min(1, availableWidth / scaleBreakpoint)
    document.documentElement.style.setProperty('--controller-scale', scale)
}

/**
 * @brief   Toggle the small-layout class based on the configured viewport breakpoint.
 */
function updateLayoutBreakpoint() {
    const smallLayout = window.matchMedia(`(max-width: ${SMALL_LAYOUT_MAX_WIDTH}px)`).matches
    document.documentElement.classList.toggle('layout-small', smallLayout)
}

/**
 * @brief   Attach handlers for settings selectors, color input, and toggles.
 * @note    Device settings are sent to the server; debug mode stays in the client.
 */
function attachSettingsHandlers() {
    const ledColor = document.querySelector('[data-setting-key="ledColor"]')
    const toggles = document.querySelectorAll('.toggle')

    document.querySelectorAll('select[data-setting-key]').forEach(
        /**
         * @brief Attach a save handler to one settings selector.
         * @param control Selector element.
         */
        control => {
        control.addEventListener('change',
            /**
             * @brief Save the selector's currently selected value.
             */
            () => {
                saveSettings({ [control.dataset.settingKey]: control.value })
            }
        )
    }
)

    if (ledColor) {
        ledColor.addEventListener('input',
            /**
             * @brief Update the displayed hexadecimal color while the picker changes.
             */
            () => {
                document.querySelector('.led-color-value').textContent = ledColor.value.toUpperCase()
            }
        )

        ledColor.addEventListener('change',
            /**
             * @brief Save the selected LED color.
             */
            () => {
                saveSettings({ ledColor: ledColor.value })
            }
        )
    }

    toggles.forEach(
        /**
         * @brief Attach the appropriate save or debug handler to a toggle.
         * @param toggle Toggle element.
         */
        toggle => {
        const key = toggle.dataset.settingKey

        toggle.addEventListener('click',
            /**
             * @brief Switch the toggle and apply or save its new state.
             */
            () => {
                const pressed = toggle.dataset.pressed === 'true'
                const nextPressed = !pressed
                toggle.dataset.pressed = String(nextPressed)

                const cssClass = toggle.dataset.toggleClass
                if (cssClass) {
                    document.body.classList.toggle(cssClass, nextPressed)
                }

                if (key === 'debugMode') {
                    debugMode = nextPressed
                } else if (key) {
                    saveSettings({ [key]: nextPressed })
                }
            }
        )
    })
}

/**
 * @brief   Start controller input polling if it is not already running.
 */
function startStatusPolling() {
    if (statusTimer !== null) return
    loadStatus()
    statusTimer = window.setInterval(loadStatus, statusInterval)
}

/**
 * @brief   Start battery polling independently of the current route.
 */
function startBatteryPolling() {
    if (batteryTimer !== null) return
    loadBatteryStatus()
    batteryTimer = window.setInterval(loadBatteryStatus, batteryInterval)
}

/**
 * @brief   Stop controller input polling if it is running.
 */
function stopStatusPolling() {
    if (statusTimer === null) return
    window.clearInterval(statusTimer)
    statusTimer = null
}

/**
 * @brief   Fetch the latest controller inputs and update the controller view when active.
 * @return  A promise that resolves after the status is applied or the request fails.
 * @note    Failed requests clear the current input list.
 */
async function loadStatus() {
    try {
        const response = await fetch('/api/status', { cache: 'no-store' })
        if (!response.ok) {
            throw new Error()
        }
        const data = await response.json()
        status.inputs = Array.isArray(data.inputs) ? data.inputs : []
    } catch (_error) {
        status.inputs = []
    }
    if (currentRoute.page === 'gamepad') updateInputView()
}

/**
 * @brief   Fetch battery state and refresh the navigation indicator.
 * @return  A promise that resolves after the indicator is updated.
 * @note    Failed requests display the unknown-battery placeholder.
 */
async function loadBatteryStatus() {
    try {
        const response = await fetch('/api/battery', { cache: 'no-store' })
        if (!response.ok) {
            throw new Error()
        }
        batteryState = await response.json()
        updateBatteryIndicator(batteryState)
    } catch (_error) {
        batteryState = null
        updateBatteryIndicator(batteryState)
    }
}

/**
 * @brief   Update the navigation battery percentage, low-charge color, and charging symbol.
 * @param   battery Battery object with percentage and charging fields, or null if unavailable.
 * @note    Percentages are rounded and clamped to 0 through 100 for display.
 */
function updateBatteryIndicator(battery) {
    const indicator = document.querySelector('.nav-battery')
    const level = indicator?.querySelector('.nav-battery-level')
    const charging = indicator?.querySelector('.nav-battery-charging')
    if (!indicator || !level || !charging) return

    if (!battery || !Number.isFinite(battery.percentage)) {
        level.textContent = language.shared.battery.unknown
        indicator.classList.remove('is-low')
        charging.hidden = true
        return
    }

    const percentage = Math.max(0, Math.min(100, Math.round(battery.percentage)))
    level.textContent = `${percentage}${language.shared.battery.percentageSuffix}`
    indicator.classList.toggle('is-low', percentage <= 20)
    charging.hidden = battery.charging !== true
}

window.addEventListener('DOMContentLoaded',
    /**
     * @brief Initialize the first route, battery polling, layout, and window event handlers.
     */
    () => {
        handleRouteChange()
        startBatteryPolling()
        updateLayoutBreakpoint()
        updateControllerScale()
        window.addEventListener('resize', updateLayoutBreakpoint)
        window.addEventListener('resize', updateControllerScale)
        window.addEventListener('hashchange', handleRouteChange)
    }
)