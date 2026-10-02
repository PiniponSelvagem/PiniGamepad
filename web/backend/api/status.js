const inputConstants = require('../constants/PGP_INPUTS.json')
const [buttonType, axisType] = inputConstants.types
const batteryInterval = 1000

let currentInputs = []
const currentBattery = {
    percentage: 100,
    charging: false
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function status(_request, response) {
    response.json({
        inputs: currentInputs
    })
}

function batteryStatus(_request, response) {
    response.json(currentBattery)
}

function setInputs(inputs) {
    currentInputs = inputs
}

async function emulateButtons() {
    for (const name of inputConstants.button) {
        setInputs([{ type: buttonType, name }])
        await wait(1000)
        setInputs([])
        await wait(1000)
    }
}

async function emulateAxis(name) {
    const steps = 36
    for (let step = 0; step < steps; step += 1) {
        const angle = Math.PI / 2 + (step / steps) * Math.PI * 2
        setInputs([
            {
                type: axisType,
                name,
                x: Math.round(Math.cos(angle) * 100),
                y: Math.round(Math.sin(angle) * 100)
            },
            { type: buttonType, name: 'A' }
        ])
        await wait(100)
    }
    setInputs([])
    await wait(1000)
}

async function emulateTrigger(name) {
    for (let value = 0; value <= 100; value += 10) {
        setInputs([
            { type: axisType, name, value },
            { type: buttonType, name: 'LB' }
        ])
        await wait(100)
    }
    for (let value = 90; value >= 0; value -= 10) {
        setInputs([
            { type: axisType, name, value },
            { type: buttonType, name: 'LB' }
        ])
        await wait(100)
    }
    setInputs([])
    await wait(1000)
}

async function emulateInputs() {
    while (true) {
        await emulateButtons()
        for (const axis of inputConstants.axis) {
            if (axis.axisCount === 1) {
                await emulateTrigger(axis.name)
            } else {
                await emulateAxis(axis.name)
            }
        }
    }
}

async function emulateBattery() {
    while (true) {
        await wait(batteryInterval)

        if (currentBattery.charging) {
            currentBattery.percentage += 1
            if (currentBattery.percentage >= 100) {
                currentBattery.percentage = 100
                currentBattery.charging = false
            }
        } else {
            currentBattery.percentage -= 1
            if (currentBattery.percentage <= 0) {
                currentBattery.percentage = 0
                currentBattery.charging = true
            }
        }
    }
}

emulateInputs().catch(error => console.error('Input emulator stopped:', error))
emulateBattery().catch(error => console.error('Battery emulator stopped:', error))

module.exports = { status, batteryStatus }
