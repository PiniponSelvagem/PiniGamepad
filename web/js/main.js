const Handlebars = require('handlebars')
const pageTemplate = Handlebars.compile(require('../templates/gamepad.hbs'))

const app = document.querySelector('#app')
const statusInterval = 100
const status = {
    connected: false,
    message: 'Waiting for input',
    input: null
}

function render() {
    app.innerHTML = pageTemplate(status)
    updateStatusView()
}

function updateStatusView() {
    const messageElement = document.querySelector('#status-message')
    messageElement.textContent = status.message
    updateInputView()
}

function updateInputView() {
    const input = status.input || {}
    const activeButton = input.type === 'button' ? input.name : ''
    document.querySelectorAll('[data-input]').forEach(button => {
        button.classList.toggle('input-active', button.dataset.input === activeButton)
    })
    document.querySelectorAll('[data-analog]').forEach(trigger => {
        const active = input.type === 'trigger' && input.name === trigger.dataset.analog
        const value = active ? input.value : 0
        trigger.style.setProperty('--trigger-fill', `${value}%`)
        trigger.classList.toggle('input-active', active)
    })
    document.querySelectorAll('[data-stick]').forEach(stick => {
        const knob = stick.querySelector('.joystick-knob')
        const active = input.type === 'stick' && input.name === stick.dataset.stick
        const maximum = (stick.clientWidth - knob.offsetWidth) / 2
        const x = active ? input.x / 100 * maximum : 0
        const y = active ? -input.y / 100 * maximum : 0
        knob.style.transform = `translate(${x}px, ${y}px)`
        stick.classList.toggle('input-active', active)
    })
}

async function loadStatus() {
    try {
        const response = await fetch(`/api/status?t=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) throw new Error(`Status request failed: ${response.status}`)
        const data = await response.json()
        status.connected = data.connected
        status.message = data.message
        status.input = data.input
    } catch (_error) {
        status.connected = false
        status.message = 'Controller is offline'
        status.input = null
    }
    updateStatusView()
}

window.addEventListener('DOMContentLoaded', () => {
    render()
    loadStatus()
    window.setInterval(loadStatus, statusInterval)
})