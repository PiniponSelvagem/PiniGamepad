const Handlebars = require('handlebars')

Handlebars.registerPartial('nav', require('../templates/nav.hbs'))

const routes = {
    '#/': { page: 'gamepad', template: Handlebars.compile(require('../templates/gamepad.hbs')) },
    '#/settings': { page: 'settings', template: Handlebars.compile(require('../templates/settings.hbs')) }
}
const defaultHash = '#/'

const app = document.querySelector('#app')
const statusInterval = 100
const batteryInterval = 1000
const status = {
    inputs: []
}
const settingsState = {
    controllerModel: 'xbox-series-x',
    sleepTimeout: '30',
    inputReportAlways: false,
    ledColor: '#ff9f1c',
    debugMode: false
}
let currentRoute = routes[defaultHash]
let statusTimer = null
let batteryTimer = null
let batteryState = null

function applySettingsState() {
    const controllerModel = document.querySelector('[data-setting-key="controllerModel"]')
    if (controllerModel) {
        controllerModel.value = settingsState.controllerModel
    }

    const sleepTimeout = document.querySelector('[data-setting-key="sleepTimeout"]')
    if (sleepTimeout) {
        sleepTimeout.value = settingsState.sleepTimeout
    }

    const ledColor = document.querySelector('[data-setting-key="ledColor"]')
    if (ledColor) {
        ledColor.value = settingsState.ledColor
        document.querySelector('.led-color-value').textContent = settingsState.ledColor.toUpperCase()
    }

    document.querySelectorAll('.toggle').forEach(toggle => {
        const key = toggle.dataset.settingKey
        if (!key) return

        const pressed = Boolean(settingsState[key])
        toggle.setAttribute('aria-pressed', String(pressed))

        const cssClass = toggle.dataset.toggleClass
        if (cssClass) {
            document.body.classList.toggle(cssClass, pressed)
        }
    })
}

function render() {
    app.innerHTML = currentRoute.template({ ...status, active: { [currentRoute.page]: true } })
    attachNavigationHandlers()
    updateBatteryIndicator(batteryState)
    if (currentRoute.page === 'gamepad') updateInputView()
    if (currentRoute.page === 'settings') {
        applySettingsState()
        attachSettingsHandlers()
    }
}

function attachNavigationHandlers() {
    const toggle = document.querySelector('.nav-toggle')
    const menu = document.querySelector('.nav-menu')
    toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true'
        toggle.setAttribute('aria-expanded', String(!expanded))
        menu.classList.toggle('open', !expanded)
    })
    menu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            toggle.setAttribute('aria-expanded', 'false')
            menu.classList.remove('open')
        })
    })
}

function handleRouteChange() {
    currentRoute = routes[window.location.hash] || routes[defaultHash]
    render()
    if (currentRoute.page === 'gamepad') {
        startStatusPolling()
    } else {
        stopStatusPolling()
    }
}

function updateInputView() {
    const inputs = status.inputs || []
    const activeButtons = new Set(
        inputs.filter(input => input.type === 'button').map(input => input.name)
    )
    document.querySelectorAll('[data-input]').forEach(button => {
        button.classList.toggle('input-active', activeButtons.has(button.dataset.input))
    })
    document.querySelectorAll('[data-analog]').forEach(trigger => {
        const input = inputs.find(activeInput => (
            activeInput.type === 'axis' &&
            activeInput.value !== undefined &&
            activeInput.name === trigger.dataset.analog
        ))
        const active = Boolean(input)
        const value = active ? input.value : 0
        trigger.style.setProperty('--trigger-fill', `${value}%`)
        trigger.classList.toggle('input-active', active)
    })
    document.querySelectorAll('[data-axis]').forEach(axis => {
        const knob = axis.querySelector('.joystick-knob')
        const input = inputs.find(activeInput => (
            activeInput.type === 'axis' &&
            activeInput.value === undefined &&
            activeInput.name === axis.dataset.axis
        ))
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

function updateControllerScale() {
    const availableWidth = window.innerWidth - controllerSideInset
    const scale = Math.min(1, availableWidth / scaleBreakpoint)
    document.documentElement.style.setProperty('--controller-scale', scale)
}

function attachSettingsHandlers() {
    const controllerModel = document.querySelector('[data-setting-key="controllerModel"]')
    const sleepTimeout = document.querySelector('[data-setting-key="sleepTimeout"]')
    const ledColor = document.querySelector('[data-setting-key="ledColor"]')
    const toggles = document.querySelectorAll('.toggle')

    if (controllerModel) {
        controllerModel.addEventListener('change', () => {
            settingsState.controllerModel = controllerModel.value
        })
    }

    if (sleepTimeout) {
        sleepTimeout.addEventListener('change', () => {
            settingsState.sleepTimeout = sleepTimeout.value
        })
    }

    if (ledColor) {
        ledColor.addEventListener('input', () => {
            settingsState.ledColor = ledColor.value
            document.querySelector('.led-color-value').textContent = ledColor.value.toUpperCase()
        })
    }

    toggles.forEach(toggle => {
        const key = toggle.dataset.settingKey
        if (key) {
            toggle.setAttribute('aria-pressed', String(Boolean(settingsState[key])))
        }

        toggle.addEventListener('click', () => {
            const pressed = toggle.getAttribute('aria-pressed') === 'true'
            const nextPressed = !pressed
            toggle.setAttribute('aria-pressed', String(nextPressed))

            if (key) {
                settingsState[key] = nextPressed
            }

            const cssClass = toggle.dataset.toggleClass
            if (cssClass) {
                document.body.classList.toggle(cssClass, nextPressed)
            }
        })
    })
}

function startStatusPolling() {
    if (statusTimer !== null) return
    loadStatus()
    statusTimer = window.setInterval(loadStatus, statusInterval)
}

function startBatteryPolling() {
    if (batteryTimer !== null) return
    loadBatteryStatus()
    batteryTimer = window.setInterval(loadBatteryStatus, batteryInterval)
}

function stopStatusPolling() {
    if (statusTimer === null) return
    window.clearInterval(statusTimer)
    statusTimer = null
}

async function loadStatus() {
    try {
        const response = await fetch('/api/status', { cache: 'no-store' })
        if (!response.ok) throw new Error(`Status request failed: ${response.status}`)
        const data = await response.json()
        status.inputs = Array.isArray(data.inputs) ? data.inputs : []
    } catch (_error) {
        status.inputs = []
    }
    if (currentRoute.page === 'gamepad') updateInputView()
}

async function loadBatteryStatus() {
    try {
        const response = await fetch('/api/battery', { cache: 'no-store' })
        if (!response.ok) throw new Error(`Battery request failed: ${response.status}`)
        batteryState = await response.json()
        updateBatteryIndicator(batteryState)
    } catch (_error) {
        batteryState = null
        updateBatteryIndicator(batteryState)
    }
}

function updateBatteryIndicator(battery) {
    const indicator = document.querySelector('.nav-battery')
    const level = indicator?.querySelector('.nav-battery-level')
    const charging = indicator?.querySelector('.nav-battery-charging')
    if (!indicator || !level || !charging) return

    if (!battery || !Number.isFinite(battery.percentage)) {
        level.textContent = '--%'
        indicator.classList.remove('is-low')
        charging.hidden = true
        return
    }

    const percentage = Math.max(0, Math.min(100, Math.round(battery.percentage)))
    level.textContent = `${percentage} %`
    indicator.classList.toggle('is-low', percentage <= 20)
    charging.hidden = battery.charging !== true
}

window.addEventListener('DOMContentLoaded', () => {
    handleRouteChange()
    startBatteryPolling()
    updateControllerScale()
    window.addEventListener('resize', updateControllerScale)
    window.addEventListener('hashchange', handleRouteChange)
})