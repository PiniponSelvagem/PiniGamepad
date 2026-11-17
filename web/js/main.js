const Handlebars = require('handlebars')
const language = require('./constants/PGP_LANGUAGE.json')
const settingValues = require('../backend/constants/PGS_SETTINGS.json')
const createTetrisGame = require('./games/tetris/tetris')

const SMALL_LAYOUT_MAX_WIDTH = 600
const CONTROLLER_SIDE_INSET = 24
const CONTROLLER_FULL_SIZE_WIDTH = 610 // controller is scaled down below this window width
const STATUS_INTERVAL = 100
const BATTERY_INTERVAL = 10000
const LOW_BATTERY_PERCENTAGE = 20
const DEFAULT_PAGE = 'gamepad'

Handlebars.registerPartial('nav', require('../templates/nav.hbs'))
// The page name is also its route: '#/settings' renders 'settings'; unknown routes render the default page.
const templates = {
    gamepad: Handlebars.compile(require('../templates/gamepad.hbs')),
    settings: Handlebars.compile(require('../templates/settings.hbs')),
    tetris: Handlebars.compile(require('../templates/tetris.hbs'))
}

const app = document.querySelector('#app')
let page = DEFAULT_PAGE
let inputs = []
let battery = null
let statusTimer = null
let tetrisGame = null

/**
 * @brief   Fetch JSON from the server without caching.
 * @param   url Address to request.
 * @return  The parsed JSON, or null if the request or the response failed.
 */
const getJson = url => fetch(url, { cache: 'no-store' })
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null)

/**
 * @brief   Run a loader now and then repeatedly.
 * @param   load Function to call.
 * @param   interval Time between calls in milliseconds.
 * @return  The interval id, for clearInterval.
 */
function poll(load, interval) {
    load()
    return setInterval(load, interval)
}

/**
 * @brief   Show the LED color's hexadecimal value next to its picker.
 * @param   input The LED color input.
 */
function showLedColor(input) {
    app.querySelector('.led-color-value').textContent = input.value.toUpperCase()
}

/**
 * @brief   Fill the settings page with the settings stored on the server.
 * @note    The debug setting only lives in the browser, so the server does not return it.
 */
async function loadSettings() {
    const settings = await getJson('/api/settings')
    if (!settings) return

    app.querySelectorAll('[data-setting-key]').forEach(control => {
        const value = settings[control.dataset.settingKey]
        if (value === undefined) return
        if (control.classList.contains('toggle')) control.dataset.pressed = value
        else control.value = value
    })
    const ledColor = app.querySelector('[data-setting-key="ledColor"]')
    if (ledColor) showLedColor(ledColor)
}

/**
 * @brief   Send changed settings to the server.
 * @param   updates Object with the settings to change, by setting key.
 * @note    Failures are ignored.
 */
function saveSettings(updates) {
    fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    }).catch(() => {})
}

/**
 * @brief   Switch a toggle and apply it: debug mode is a body class, other toggles are saved on the server.
 * @param   toggle The toggle button.
 */
function flipToggle(toggle) {
    const pressed = toggle.dataset.pressed !== 'true'
    toggle.dataset.pressed = pressed
    const key = toggle.dataset.settingKey
    if (key === 'debugMode') document.body.classList.toggle('debug-mode', pressed)
    else saveSettings({ [key]: pressed })
}

/**
 * @brief   Handle clicks anywhere in the app: settings toggles and the navigation menu.
 * @param   event Click event.
 * @note    Listening on the app element covers pages rendered later.
 */
function onClick(event) {
    const toggle = event.target.closest('.toggle')
    if (toggle) flipToggle(toggle)
    else if (event.target.closest('.nav-toggle')) app.querySelector('.nav-menu').classList.toggle('open')
    else if (event.target.closest('.nav-link')) app.querySelector('.nav-menu').classList.remove('open')
}

/**
 * @brief   Save a settings control when the user finishes changing it.
 * @param   event Change event.
 */
function onChange({ target }) {
    const key = target.dataset.settingKey
    if (key) saveSettings({ [key]: target.value })
}

/**
 * @brief   Keep the LED color's hexadecimal value up to date while the picker is used.
 * @param   event Input event.
 */
function onInput({ target }) {
    if (target.dataset.settingKey === 'ledColor') showLedColor(target)
}

/**
 * @brief   Show the page selected by the URL hash and start or stop what that page needs.
 * @note    Leaving Tetris pauses its game; controller input is only polled on the controller page.
 */
function showPage() {
    const name = window.location.hash.slice(2)
    const next = Object.hasOwn(templates, name) ? name : DEFAULT_PAGE
    if (page === 'tetris' && next !== 'tetris') tetrisGame.pause()
    page = next

    app.innerHTML = templates[page]({
        language,
        settingValues,
        active: { [page]: true },
        debugMode: document.body.classList.contains('debug-mode')
    })
    showBattery()

    if (page === 'gamepad') {
        showInputs()
        statusTimer ??= poll(loadStatus, STATUS_INTERVAL)
    } else {
        clearInterval(statusTimer)
        statusTimer = null
    }
    if (page === 'settings') loadSettings()
    if (page === 'tetris') {
        tetrisGame ??= createTetrisGame(language.tetris)
        tetrisGame.mount(app.querySelector('.tetris-page'))
    }
}

/**
 * @brief   Show the latest controller inputs on the controller page.
 * @note    Joystick knobs move over the free distance between the knob and its base.
 */
function showInputs() {
    const findAxis = (name, hasValue) => inputs.find(input => (
        input.type === 'axis' && input.name === name && (input.value !== undefined) === hasValue
    ))

    app.querySelectorAll('[data-input]').forEach(button => {
        const pressed = inputs.some(input => input.type === 'button' && input.name === button.dataset.input)
        button.classList.toggle('input-active', pressed)
    })
    app.querySelectorAll('[data-analog]').forEach(trigger => {
        const input = findAxis(trigger.dataset.analog, true)
        trigger.style.setProperty('--trigger-fill', `${input ? input.value : 0}%`)
        trigger.classList.toggle('input-active', Boolean(input))
    })
    app.querySelectorAll('[data-axis]').forEach(axis => {
        const stick = findAxis(axis.dataset.axis, false)
        const { x, y } = stick ?? { x: 0, y: 0 }
        const knob = axis.querySelector('.joystick-knob')
        const maximum = (axis.clientWidth - knob.offsetWidth) / 2
        knob.style.transform = `translate(${x / 100 * maximum}px, ${-y / 100 * maximum}px)`
        axis.classList.toggle('input-active', Boolean(stick))
    })
}

/**
 * @brief   Update the small-layout class and the controller scale for the current window width.
 */
function onResize() {
    const root = document.documentElement
    root.classList.toggle('layout-small', window.matchMedia(`(max-width: ${SMALL_LAYOUT_MAX_WIDTH}px)`).matches)
    root.style.setProperty(
        '--controller-scale',
        Math.min(1, (window.innerWidth - CONTROLLER_SIDE_INSET) / CONTROLLER_FULL_SIZE_WIDTH)
    )
}

/**
 * @brief   Fetch the latest controller inputs and show them if the controller page is open.
 * @note    The inputs are cleared if the request fails.
 */
async function loadStatus() {
    const data = await getJson('/api/status')
    inputs = Array.isArray(data?.inputs) ? data.inputs : []
    if (page === 'gamepad') showInputs()
}

/**
 * @brief   Show the battery in the navigation bar: percentage, low-charge color and charging symbol.
 * @note    Without a valid reading the unknown placeholder is shown. Percentages are rounded and kept within 0 to 100.
 */
function showBattery() {
    const percentage = Number.isFinite(battery?.percentage)
        ? Math.max(0, Math.min(100, Math.round(battery.percentage)))
        : null
    const indicator = app.querySelector('.nav-battery')
    const text = language.shared.battery

    indicator.querySelector('.nav-battery-level').textContent =
        percentage === null ? text.unknown : `${percentage}${text.percentageSuffix}`
    indicator.classList.toggle('is-low', percentage !== null && percentage <= LOW_BATTERY_PERCENTAGE)
    indicator.querySelector('.nav-battery-charging').hidden = percentage === null || battery.charging !== true
}

/**
 * @brief   Fetch the battery state and show it.
 * @note    The unknown placeholder is shown if the request fails.
 */
async function loadBattery() {
    battery = await getJson('/api/battery')
    showBattery()
}

app.addEventListener('click', onClick)
app.addEventListener('change', onChange)
app.addEventListener('input', onInput)
window.addEventListener('hashchange', showPage)
window.addEventListener('resize', onResize)
onResize()
showPage()
poll(loadBattery, BATTERY_INTERVAL)