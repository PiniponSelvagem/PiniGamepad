const COLUMNS = 10
const ROWS = 20
const MAX_LEVEL = 20
const POINTS_PER_CLEARED_SQUARE = 1

const PIECES = [
    { color: 'i', shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    { color: 'j', shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    { color: 'l', shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
    { color: 'o', shape: [[1, 1], [1, 1]] },
    { color: 's', shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    { color: 't', shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    { color: 'z', shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] }
]

const emptyRow = () => Array(COLUMNS).fill(null)
const randomPiece = () => PIECES[Math.floor(Math.random() * PIECES.length)]

/**
 * @brief   Create a new game with an empty board and its first piece in play.
 * @return  The game state: board (cells hold a piece color or null), active piece, queued nextPiece,
 *          score, streak, lines, level, clearingRows (rows waiting for finishLineClear) and gameOver.
 */
function createGameState() {
    const state = {
        board: Array.from({ length: ROWS }, emptyRow),
        gameOver: false,
        piece: null,
        score: 0,
        streak: 0,
        lines: 0,
        level: 1,
        nextPiece: randomPiece(),
        clearingRows: null
    }
    spawnPiece(state)
    return state
}

/**
 * @brief   Put the queued piece at the top of the board and queue a new one.
 * @param   state Game state to update.
 * @note    Sets gameOver if the new piece already collides with the board.
 */
function spawnPiece(state) {
    const { color, shape } = state.nextPiece
    state.nextPiece = randomPiece()
    state.piece = {
        color,
        shape: shape.map(row => [...row]),
        x: Math.floor((COLUMNS - shape[0].length) / 2),
        y: 0
    }
    state.gameOver = collides(state.board, state.piece)
}

/**
 * @brief   Check whether a piece, optionally moved or reshaped, hits a wall, the floor or locked cells.
 * @param   board Matrix of locked cells.
 * @param   piece Piece to test.
 * @param   dx Optional horizontal offset in cells.
 * @param   dy Optional vertical offset in cells.
 * @param   shape Optional shape matrix to test instead of the piece's own.
 * @return  True if the tested position collides.
 */
function collides(board, piece, dx = 0, dy = 0, shape = piece.shape) {
    return shape.some((cells, row) => cells.some((filled, column) => {
        const x = piece.x + column + dx
        const y = piece.y + row + dy
        return filled && (x < 0 || x >= COLUMNS || y >= ROWS || board[y][x])
    }))
}

/**
 * @brief   Find the row where the active piece would land, without moving it.
 * @param   state Game state with an active piece.
 * @return  The landing row of the piece's origin.
 */
function getGhostY(state) {
    let dy = 0
    while (!collides(state.board, state.piece, 0, dy + 1)) dy += 1
    return state.piece.y + dy
}

/**
 * @brief   Write the active piece into the board, score completed rows and spawn the next piece.
 * @param   state Game state to update.
 * @note    Completed rows stay on the board in clearingRows until finishLineClear is called.
 */
function lockPiece(state) {
    const { piece, board } = state
    piece.shape.forEach((cells, row) => cells.forEach((filled, column) => {
        if (filled) board[piece.y + row][piece.x + column] = piece.color
    }))

    const fullRows = board.flatMap((row, y) => (row.every(Boolean) ? [y] : []))
    state.lines += fullRows.length
    state.level = Math.min(MAX_LEVEL, Math.floor(state.lines / 10) + 1)
    if (!fullRows.length) {
        state.streak = 0
        spawnPiece(state)
        return
    }

    // Each consecutive row is worth more: the streak multiplier grows by one per row.
    fullRows.forEach(() => {
        state.streak += 1
        state.score += COLUMNS * POINTS_PER_CLEARED_SQUARE * state.streak
    })
    state.clearingRows = fullRows
    state.piece = null
}

/**
 * @brief   Remove the rows waiting in clearingRows, drop the rows above them and spawn the next piece.
 * @param   state Game state to update.
 * @note    Does nothing when no line clear is pending.
 */
function finishLineClear(state) {
    if (!state.clearingRows) return

    const remaining = state.board.filter((_, y) => !state.clearingRows.includes(y))
    state.board = [...Array.from({ length: ROWS - remaining.length }, emptyRow), ...remaining]
    state.clearingRows = null
    spawnPiece(state)
}

/**
 * @brief   Move the active piece by the given offsets.
 * @param   state Game state to update.
 * @param   dx Horizontal offset in cells.
 * @param   dy Vertical offset in cells.
 * @return  True if the piece moved.
 * @note    A blocked downward move locks the piece; a blocked sideways move does nothing.
 */
function movePiece(state, dx, dy) {
    if (state.gameOver || state.clearingRows || !state.piece) return false
    if (collides(state.board, state.piece, dx, dy)) {
        if (dy > 0) lockPiece(state)
        return false
    }
    state.piece.x += dx
    state.piece.y += dy
    return true
}

/**
 * @brief   Drop the active piece straight down until it locks.
 * @param   state Game state to update.
 */
function hardDrop(state) {
    while (movePiece(state, 0, 1)) continue
}

/**
 * @brief   Rotate the active piece clockwise, shifting it sideways by up to two cells if needed.
 * @param   state Game state to update.
 * @note    Does nothing if no shifted position fits.
 */
function rotatePiece(state) {
    const { piece } = state
    if (state.gameOver || state.clearingRows || !piece) return

    const shape = piece.shape[0].map((_, x) => piece.shape.map(row => row[x]).reverse())
    const dx = [0, -1, 1, -2, 2].find(offset => !collides(state.board, piece, offset, 0, shape)) // try each offset until a non-colliding position is found
    if (dx !== undefined) Object.assign(piece, { shape, x: piece.x + dx })
}

module.exports = { createGameState, finishLineClear, getGhostY, hardDrop, movePiece, rotatePiece }
