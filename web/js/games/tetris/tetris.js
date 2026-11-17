const engine = require('./engine')

const CELL_SIZE = 30
const PREVIEW_CELL_SIZE = 24
const BASE_GRAVITY_INTERVAL = 600
const LEVEL_SPEED_STEP = 0.125
const MIN_GRAVITY_INTERVAL = 60
const LINE_CLEAR_DURATION = 400
const LINE_CLEAR_BLINKS = 3

// Keys that act on the active piece.
const MOVES = {
    ArrowLeft: state => engine.movePiece(state, -1, 0),
    ArrowRight: state => engine.movePiece(state, 1, 0),
    ArrowDown: state => engine.movePiece(state, 0, 1),
    ArrowUp: engine.rotatePiece,
    Space: engine.hardDrop
}
// Keys the game uses; their default browser action (such as scrolling) is cancelled.
const HANDLED_KEYS = [...Object.keys(MOVES), 'KeyR', 'KeyY', 'KeyN']

/**
 * @brief   Call a function for every non-empty cell of a matrix.
 * @param   matrix Rows of cells; empty cells are 0 or null.
 * @param   callback Called with the cell's column, row and value.
 */
function eachCell(matrix, callback) {
    matrix.forEach((cells, y) => cells.forEach((value, x) => value && callback(x, y, value)))
}

/**
 * @brief   Fill one cell of a canvas grid, leaving a one pixel gap around it.
 * @param   ctx Canvas context to draw on.
 * @param   size Cell size in canvas pixels.
 * @param   x Column; may be fractional.
 * @param   y Row; may be fractional.
 * @param   color Fill color.
 */
function fillCell(ctx, size, x, y, color) {
    ctx.fillStyle = color
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2)
}

/**
 * @brief   Create a Tetris game with its own state, rendering and keyboard handling.
 * @param   language Tetris texts from the frontend language file.
 * @return  An object with mount(container) and pause() for the page lifecycle.
 * @note    The game keeps its state between visits; leaving the page pauses it.
 *          Colors and opacities are read from the page's --tetris-* CSS variables.
 */
function createTetrisGame(language) {
    let state = engine.createGameState()
    let paused = false
    let confirmingRestart = false
    let gravityTimer = null
    let clearFrame = null // pending animation frame of a line clear
    let clearElapsed = 0 // milliseconds of the line-clear animation already played
    let clearStartedAt = null // frame time at which the current run of the animation started
    let active = false // true while the page is mounted
    let canvas, context, nextContext, style, hud // elements of the mounted page

    const css = name => style.getPropertyValue(`--tetris-${name}`).trim()

    /**
     * @brief   Draw a dimmed overlay over the board with centered text.
     * @param   title Main message.
     * @param   subtitle Optional second line.
     * @param   titleSize Optional size of the main message in canvas pixels.
     */
    function drawOverlay(title, subtitle = '', titleSize = 27) {
        context.fillStyle = css('overlay')
        context.globalAlpha = Number(css('overlay-opacity'))
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.globalAlpha = 1
        context.fillStyle = css('text')
        context.textAlign = 'center'
        context.font = `700 ${titleSize}px system-ui, sans-serif`
        context.fillText(title, canvas.width / 2, canvas.height / 2 - 12)
        if (subtitle) {
            context.font = '16px system-ui, sans-serif'
            context.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20)
        }
    }

    /**
     * @brief   Draw the queued piece, centered, in the preview canvas.
     */
    function drawNextPiece() {
        const { color, shape } = state.nextPiece
        const { width, height } = nextContext.canvas
        const cells = width / PREVIEW_CELL_SIZE
        nextContext.clearRect(0, 0, width, height)
        eachCell(shape, (x, y) => fillCell(
            nextContext,
            PREVIEW_CELL_SIZE,
            x + (cells - shape[0].length) / 2,
            y + (cells - shape.length) / 2,
            css(`piece-${color}`)
        ))
    }

    /**
     * @brief   Draw the whole game: statistics, preview, board, ghost and active piece, line-clear flash and overlays.
     * @param   progress Optional progress of the line-clear animation, from 0 to 1.
     * @note    Completed rows flash white while their line-clear animation plays.
     */
    function draw(progress = clearElapsed / LINE_CLEAR_DURATION) {
        hud.forEach(([name, element]) => { element.textContent = state[name] })
        drawNextPiece()

        context.fillStyle = css('background')
        context.fillRect(0, 0, canvas.width, canvas.height)
        eachCell(state.board, (x, y, color) => fillCell(context, CELL_SIZE, x, y, css(`piece-${color}`)))

        const { piece } = state
        if (piece && !state.gameOver) {
            const ghostY = engine.getGhostY(state)
            context.globalAlpha = Number(css('ghost-opacity'))
            eachCell(piece.shape, (x, y) => fillCell(context, CELL_SIZE, piece.x + x, ghostY + y, css('ghost')))
            context.globalAlpha = 1
            eachCell(piece.shape, (x, y) => fillCell(context, CELL_SIZE, piece.x + x, piece.y + y, css(`piece-${piece.color}`)))
        }

        const blink = Math.min(Math.floor(progress * LINE_CLEAR_BLINKS * 2), LINE_CLEAR_BLINKS * 2 - 1)
        if (state.clearingRows && blink % 2 === 0) {
            context.fillStyle = css('clear')
            state.clearingRows.forEach(row => context.fillRect(0, row * CELL_SIZE, canvas.width, CELL_SIZE))
        }

        if (confirmingRestart) {
            drawOverlay(language.restartConfirmation.prompt, language.restartConfirmation.options, 17)
        } else if (state.gameOver) {
            drawOverlay(language.gameOver.title, language.gameOver.restart)
        } else if (paused) {
            drawOverlay(language.paused)
        }
    }

    /**
     * @brief   Stop the gravity timer.
     */
    function stopGravity() {
        clearInterval(gravityTimer)
        gravityTimer = null
    }

    /**
     * @brief   Cancel the pending line-clear frame, keeping the time already played.
     */
    function stopLineClearAnimation() {
        cancelAnimationFrame(clearFrame)
        clearFrame = null
        clearStartedAt = null
    }

    /**
     * @brief   Play one frame of the line-clear animation and finish the clear when its time is up.
     * @param   now Animation-frame time in milliseconds.
     */
    function animateLineClear(now) {
        clearFrame = null
        if (!active || paused || !state.clearingRows) return

        clearStartedAt ??= now - clearElapsed
        clearElapsed = Math.min(now - clearStartedAt, LINE_CLEAR_DURATION)
        if (clearElapsed < LINE_CLEAR_DURATION) {
            draw()
            clearFrame = requestAnimationFrame(animateLineClear)
            return
        }

        clearElapsed = 0
        clearStartedAt = null
        engine.finishLineClear(state)
        draw()
        startGravity()
    }

    /**
     * @brief   Start, or continue, the line-clear animation if one is pending and the game is running.
     * @note    Does nothing if the animation is already running, so input cannot restart it.
     */
    function startLineClearAnimation() {
        if (active && !paused && state.clearingRows && clearFrame === null) {
            clearFrame = requestAnimationFrame(animateLineClear)
        }
    }

    /**
     * @brief   Start the gravity timer; each level makes it faster.
     * @note    Does nothing while paused, over, clearing lines or already running.
     */
    function startGravity() {
        if (!active || paused || state.gameOver || state.clearingRows || gravityTimer !== null) return

        const interval = Math.max(MIN_GRAVITY_INTERVAL, BASE_GRAVITY_INTERVAL / (1 + LEVEL_SPEED_STEP * (state.level - 1)))
        gravityTimer = setInterval(() => {
            engine.movePiece(state, 0, 1)
            update()
            if (state.gameOver) stopGravity()
        }, interval)
    }

    /**
     * @brief   Stop everything that advances the game over time.
     */
    function suspend() {
        stopGravity()
        stopLineClearAnimation()
    }

    /**
     * @brief   Continue whatever advances the game over time, as far as the game state allows.
     */
    function resume() {
        startGravity()
        startLineClearAnimation()
    }

    /**
     * @brief   Redraw after the game changed and start the line-clear animation if rows were completed.
     */
    function update() {
        if (state.clearingRows) {
            stopGravity()
            startLineClearAnimation()
        }
        draw()
    }

    /**
     * @brief   Start a new game.
     */
    function restartGame() {
        suspend()
        state = engine.createGameState()
        paused = false
        confirmingRestart = false
        clearElapsed = 0
        draw()
        startGravity()
    }

    /**
     * @brief   Handle the game keys: arrows, space, P (pause), R (restart) and Y / N (confirm restart).
     * @param   event Keyboard event.
     * @note    While confirming a restart, only Y and N are used; after game over, only Space (new game).
     */
    function onKeyDown(event) {
        const { code } = event
        if (HANDLED_KEYS.includes(code)) event.preventDefault()

        if (confirmingRestart) {
            if (code === 'KeyY') {
                restartGame()
            } else if (code === 'KeyN') {
                confirmingRestart = false
                draw()
                if (!paused) resume()
            }
        } else if (code === 'KeyR') {
            confirmingRestart = true
            suspend()
            draw()
        } else if (state.gameOver) {
            if (code === 'Space') restartGame()
        } else if (code === 'KeyP') {
            paused = !paused
            if (paused) suspend()
            else resume()
            draw()
        } else if (!paused && code in MOVES) {
            MOVES[code](state)
            update()
        }
    }

    /**
     * @brief   Attach the game to a rendered Tetris page, draw it and let it run.
     * @param   container Page element holding the board, preview and statistics.
     * @note    A game paused when its page was left stays paused until P is pressed.
     */
    function mount(container) {
        canvas = container.querySelector('.tetris-board')
        context = canvas.getContext('2d')
        nextContext = container.querySelector('.tetris-next-piece').getContext('2d')
        style = getComputedStyle(container)
        hud = ['score', 'level', 'lines'].map(name => [name, container.querySelector(`.tetris-${name}`)])
        active = true
        window.addEventListener('keydown', onKeyDown)
        draw()
        resume()
    }

    /**
     * @brief   Pause the game and stop listening to the keyboard.
     */
    function pause() {
        active = false
        paused = true
        suspend()
        window.removeEventListener('keydown', onKeyDown)
    }

    return { mount, pause }
}

module.exports = createTetrisGame
