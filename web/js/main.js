const Handlebars = require('handlebars')

Handlebars.registerPartial('nav', require('../templates/nav.hbs'))

const routes = {
    '#/': { page: 'gamepad', template: Handlebars.compile(require('../templates/gamepad.hbs')) },
    '#/settings': { page: 'settings', template: Handlebars.compile(require('../templates/settings.hbs')) }
}
const defaultHash = '#/'

const app = document.querySelector('#app')
const statusInterval = 100
const status = {
    inputs: []
}
let currentRoute = routes[defaultHash]
let statusTimer = null

function render() {
    app.innerHTML = currentRoute.template({ ...status, active: { [currentRoute.page]: true } })
    attachNavigationHandlers()
    if (currentRoute.page === 'gamepad') updateInputView()
    if (currentRoute.page === 'settings') attachSettingsHandlers()
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
    const button = document.querySelector('#send-message')
    const input = document.querySelector('#message-input')
    button.addEventListener('click', () => {
        fetch('/api/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value })
        }).catch(() => {})
    })
}

function startStatusPolling() {
    if (statusTimer !== null) return
    loadStatus()
    statusTimer = window.setInterval(loadStatus, statusInterval)
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

window.addEventListener('DOMContentLoaded', () => {
    handleRouteChange()
    updateControllerScale()
    window.addEventListener('resize', updateControllerScale)
    window.addEventListener('hashchange', handleRouteChange)
})