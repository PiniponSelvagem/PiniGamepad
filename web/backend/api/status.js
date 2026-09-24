let currentInput = null

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function status(_request, response) {
    response.json({
        connected: true,
        message: currentInput ? formatInput(currentInput) : 'Waiting for input',
        input: currentInput
    })
}

function setInput(input) {
    currentInput = input
    console.log(input ? `Emulating ${formatInput(input)}` : 'Emulating release')
}

function formatInput(input) {
    if (input.type === 'button') return `button ${input.name.toUpperCase()}`
    if (input.type === 'trigger') return `${input.name.toUpperCase()} ${input.value}%`
    return `${input.name} stick (${input.x}, ${input.y})`
}

async function emulateButtons() {
    const buttons = ['lb', 'rb', 'up', 'right', 'down', 'left', 'y', 'b', 'a', 'x', 'l3', 'r3', 'macro', 'select', 'home', 'start']
    for (const name of buttons) {
        setInput({ type: 'button', name })
        await wait(1000)
        setInput(null)
        await wait(1000)
    }
}

async function emulateStick(name, direction) {
    const steps = 36
    for (let step = 0; step < steps; step += 1) {
        const angle = Math.PI / 2 + direction * (step / steps) * Math.PI * 2
        setInput({
            type: 'stick',
            name,
            x: Math.round(Math.cos(angle) * 100),
            y: Math.round(Math.sin(angle) * 100)
        })
        await wait(100)
    }
    setInput(null)
    await wait(1000)
}

async function emulateTrigger(name) {
    for (let value = 0; value <= 100; value += 10) {
        setInput({ type: 'trigger', name, value })
        await wait(100)
    }
    for (let value = 90; value >= 0; value -= 10) {
        setInput({ type: 'trigger', name, value })
        await wait(100)
    }
    setInput(null)
    await wait(1000)
}

async function emulateInputs() {
    while (true) {
        await emulateButtons()
        await emulateStick('left', -1)
        await emulateStick('right', 1)
        await emulateTrigger('lt')
        await emulateTrigger('rt')
    }
}

emulateInputs().catch(error => console.error('Input emulator stopped:', error))

module.exports = { status }
