const engine = require('./engine')

const CELL_SIZE = 30
const BASE_GRAVITY_INTERVAL = 600
const LEVEL_SPEED_STEP = 0.125
const MIN_GRAVITY_INTERVAL = 60
const LINE_CLEAR_DURATION = 400
const LINE_CLEAR_BLINKS = 3
const PREVIEW_CELL_SIZE = 24

function createTetrisGame(language) {
    let state = engine.createGameState()
    let root = null
    let canvas = null
    let context = null
    let nextCanvas = null
    let nextContext = null
    let scoreElement = null
    let levelElement = null
    let linesElement = null
    let gravityTimer = null
    let lineClearFrame = null
    let lineClearElapsed = 0
    let lineClearStartedAt = null
    let lineClearAnimationStarted = false
    let active = false
    let paused = false
    let restartConfirmation = false
    let keyHandlerAttached = false

    function getCssValue(name) {
        return window.getComputedStyle(root).getPropertyValue(`--tetris-${name}`).trim()
    }

    function updateHud() {
        if (scoreElement) scoreElement.textContent = String(state.score)
        if (levelElement) levelElement.textContent = String(state.level)
        if (linesElement) linesElement.textContent = String(state.lines)
    }

    function drawOverlay(title, subtitle = '', titleSize = 27) {
        context.fillStyle = getCssValue('overlay')
        context.globalAlpha = Number(getCssValue('overlay-opacity'))
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.globalAlpha = 1
        context.fillStyle = getCssValue('text')
        context.textAlign = 'center'
        context.font = `700 ${titleSize}px system-ui, sans-serif`
        context.fillText(title, canvas.width / 2, canvas.height / 2 - 12)
        if (subtitle) {
            context.font = '16px system-ui, sans-serif'
            context.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20)
        }
    }

    function drawNextPiece() {
        if (!nextContext || !nextCanvas) return

        nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height)
        const piece = engine.getNextPiece(state)
        const width = piece.shape[0].length * PREVIEW_CELL_SIZE
        const height = piece.shape.length * PREVIEW_CELL_SIZE
        const left = (nextCanvas.width - width) / 2
        const top = (nextCanvas.height - height) / 2
        nextContext.fillStyle = getCssValue(`piece-${piece.color}`)

        piece.shape.forEach((row, y) => {
            row.forEach((filled, x) => {
                if (!filled) return
                nextContext.fillRect(
                    left + x * PREVIEW_CELL_SIZE + 1,
                    top + y * PREVIEW_CELL_SIZE + 1,
                    PREVIEW_CELL_SIZE - 2,
                    PREVIEW_CELL_SIZE - 2
                )
            })
        })
    }

    function drawCell(column, row, color) {
        if (row < 0) return
        context.fillStyle = color
        context.fillRect(
            column * CELL_SIZE + 1,
            row * CELL_SIZE + 1,
            CELL_SIZE - 2,
            CELL_SIZE - 2
        )
    }

    function draw(lineClearProgress = lineClearElapsed / LINE_CLEAR_DURATION) {
        if (!context) return
        updateHud()
        drawNextPiece()

        context.fillStyle = getCssValue('background')
        context.fillRect(0, 0, canvas.width, canvas.height)

        state.board.forEach((row, y) => {
            row.forEach((color, x) => {
                if (color) drawCell(x, y, getCssValue(`piece-${color}`))
            })
        })

        if (!state.gameOver && state.piece) {
            const ghostY = engine.getGhostY(state)
            context.globalAlpha = Number(getCssValue('ghost-opacity'))
            state.piece.shape.forEach((row, y) => {
                row.forEach((filled, x) => {
                    if (filled) drawCell(state.piece.x + x, ghostY + y, getCssValue('ghost'))
                })
            })
            context.globalAlpha = 1

            state.piece.shape.forEach((row, y) => {
                row.forEach((filled, x) => {
                    if (filled) {
                        drawCell(
                            state.piece.x + x,
                            state.piece.y + y,
                            getCssValue(`piece-${state.piece.color}`)
                        )
                    }
                })
            })
        }

        if (state.clearingRows) {
            const blinkPhase = Math.min(
                Math.floor(lineClearProgress * LINE_CLEAR_BLINKS * 2),
                LINE_CLEAR_BLINKS * 2 - 1
            )
            if (blinkPhase % 2 === 0) {
                context.fillStyle = getCssValue('clear')
                state.clearingRows.forEach(row => {
                    context.fillRect(0, row * CELL_SIZE, canvas.width, CELL_SIZE)
                })
            }
        }

        if (restartConfirmation) {
            drawOverlay(language.restartConfirmation.prompt, language.restartConfirmation.options, 17)
        } else if (paused && !state.gameOver) {
            drawOverlay(language.paused)
        } else if (state.gameOver) {
            drawOverlay(language.gameOver.title, language.gameOver.restart)
        }
    }

    function stopGravity() {
        if (gravityTimer === null) return
        window.clearInterval(gravityTimer)
        gravityTimer = null
    }

    function stopLineClearAnimation() {
        if (lineClearFrame !== null) {
            window.cancelAnimationFrame(lineClearFrame)
            lineClearFrame = null
        }
        lineClearStartedAt = null
    }

    function animateLineClear(timestamp) {
        lineClearFrame = null
        if (!active || paused || !state.clearingRows) return

        if (lineClearStartedAt === null) {
            lineClearStartedAt = timestamp - lineClearElapsed
        }
        lineClearElapsed = Math.min(timestamp - lineClearStartedAt, LINE_CLEAR_DURATION)
        const progress = lineClearElapsed / LINE_CLEAR_DURATION
        draw(progress)

        if (progress >= 1) {
            lineClearElapsed = 0
            lineClearStartedAt = null
            lineClearAnimationStarted = false
            engine.finishLineClear(state)
            draw()
            startGravity()
            return
        }

        lineClearFrame = window.requestAnimationFrame(animateLineClear)
    }

    function startLineClearAnimation() {
        if (!active || paused || !state.clearingRows || lineClearFrame !== null) return
        lineClearAnimationStarted = true
        lineClearFrame = window.requestAnimationFrame(animateLineClear)
    }

    function handlePieceUpdate() {
        if (state.clearingRows) {
            stopGravity()
            if (!lineClearAnimationStarted) {
                lineClearElapsed = 0
                lineClearStartedAt = null
                draw(0)
                startLineClearAnimation()
            }
            return
        }
        lineClearAnimationStarted = false
        draw()
    }

    function startGravity() {
        if (!active || paused || state.gameOver || state.clearingRows || gravityTimer !== null) return
        const gravityInterval = Math.max(
            MIN_GRAVITY_INTERVAL,
            BASE_GRAVITY_INTERVAL / (1 + LEVEL_SPEED_STEP * (state.level - 1))
        )
        gravityTimer = window.setInterval(() => {
            engine.tick(state)
            handlePieceUpdate()
            if (state.gameOver) stopGravity()
        }, gravityInterval)
    }

    function restartGame() {
        stopGravity()
        stopLineClearAnimation()
        state = engine.createGameState()
        paused = false
        restartConfirmation = false
        lineClearElapsed = 0
        lineClearStartedAt = null
        lineClearAnimationStarted = false
        draw()
        startGravity()
    }

    function handleKeyDown(event) {
        if (!active) return
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyR', 'KeyY', 'KeyN'].includes(event.code)) {
            event.preventDefault()
        }

        if (restartConfirmation) {
            if (event.code === 'KeyY') {
                restartGame()
            } else if (event.code === 'KeyN') {
                restartConfirmation = false
                draw()
                if (!paused) {
                    startGravity()
                    startLineClearAnimation()
                }
            }
            return
        }

        if (event.code === 'KeyR') {
            restartConfirmation = true
            stopGravity()
            stopLineClearAnimation()
            draw()
            return
        }

        if (state.gameOver) {
            if (event.code === 'Space') {
                restartGame()
            }
            return
        }

        if (event.code === 'KeyP') {
            paused = !paused
            if (paused) {
                stopGravity()
                stopLineClearAnimation()
            } else {
                startGravity()
                startLineClearAnimation()
            }
            draw()
            return
        }
        if (paused) return

        if (event.code === 'ArrowLeft') engine.movePiece(state, -1, 0)
        else if (event.code === 'ArrowRight') engine.movePiece(state, 1, 0)
        else if (event.code === 'ArrowDown') engine.movePiece(state, 0, 1)
        else if (event.code === 'ArrowUp') engine.rotatePiece(state)
        else if (event.code === 'Space') engine.hardDrop(state)
        else return

        handlePieceUpdate()
    }

    function mount(container) {
        root = container
        canvas = root.querySelector('.tetris-board')
        context = canvas.getContext('2d')
        nextCanvas = root.querySelector('.tetris-next-piece')
        nextContext = nextCanvas.getContext('2d')
        scoreElement = root.querySelector('.tetris-score')
        levelElement = root.querySelector('.tetris-level')
        linesElement = root.querySelector('.tetris-lines')
        active = true
        window.addEventListener('keydown', handleKeyDown)
        keyHandlerAttached = true
        draw()
        startGravity()
        startLineClearAnimation()
    }

    function pause() {
        active = false
        paused = true
        stopGravity()
        stopLineClearAnimation()
        if (keyHandlerAttached) {
            window.removeEventListener('keydown', handleKeyDown)
            keyHandlerAttached = false
        }
        root = null
        canvas = null
        context = null
        nextCanvas = null
        nextContext = null
        scoreElement = null
        levelElement = null
        linesElement = null
    }

    return { mount, pause }
}

module.exports = createTetrisGame
