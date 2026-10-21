const COLUMNS = 10
const ROWS = 20
const MAX_LEVEL = 10
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

function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null))
}

function copyShape(shape) {
    return shape.map(row => [...row])
}

function choosePiece(random) {
    return PIECES[Math.floor(random() * PIECES.length)]
}

function createGameState(random = Math.random) {
    const state = {
        board: createBoard(),
        gameOver: false,
        piece: null,
        score: 0,
        streak: 0,
        lines: 0,
        level: 1,
        nextPiece: choosePiece(random),
        clearingRows: null
    }
    spawnPiece(state, random)
    return state
}

function spawnPiece(state, random = Math.random) {
    const definition = state.nextPiece
    state.nextPiece = choosePiece(random)
    const shape = copyShape(definition.shape)
    state.piece = {
        color: definition.color,
        shape,
        x: Math.floor((COLUMNS - shape[0].length) / 2),
        y: 0
    }

    if (collides(state.board, state.piece)) {
        state.gameOver = true
    }
}

function getNextPiece(state) {
    return {
        color: state.nextPiece.color,
        shape: copyShape(state.nextPiece.shape)
    }
}

function collides(board, piece, offsetX = 0, offsetY = 0, shape = piece.shape) {
    for (let row = 0; row < shape.length; row += 1) {
        for (let column = 0; column < shape[row].length; column += 1) {
            if (!shape[row][column]) continue

            const x = piece.x + column + offsetX
            const y = piece.y + row + offsetY
            if (x < 0 || x >= COLUMNS || y >= ROWS) return true
            if (y >= 0 && board[y][x]) return true
        }
    }
    return false
}

function getGhostY(state) {
    let offsetY = 0
    while (!collides(state.board, state.piece, 0, offsetY + 1)) {
        offsetY += 1
    }
    return state.piece.y + offsetY
}

function lockPiece(state, random) {
    const { piece, board } = state
    for (let row = 0; row < piece.shape.length; row += 1) {
        for (let column = 0; column < piece.shape[row].length; column += 1) {
            if (!piece.shape[row][column]) continue

            const y = piece.y + row
            const x = piece.x + column
            if (y < 0) {
                state.gameOver = true
                return
            }
            board[y][x] = piece.color
        }
    }

    const clearedRows = board
        .map((row, index) => row.every(Boolean) ? index : -1)
        .filter(index => index >= 0)
    state.lines += clearedRows.length
    state.level = Math.min(MAX_LEVEL, Math.floor(state.lines / 10) + 1)
    if (clearedRows.length === 0) {
        state.streak = 0
        spawnPiece(state, random)
    } else {
        for (let line = 0; line < clearedRows.length; line += 1) {
            state.streak += 1
            state.score += COLUMNS * POINTS_PER_CLEARED_SQUARE * state.streak
        }
        state.clearingRows = clearedRows
        state.piece = null
    }
}

function finishLineClear(state, random = Math.random) {
    if (!state.clearingRows) return

    const clearedRows = new Set(state.clearingRows)
    const remainingRows = state.board.filter((_, index) => !clearedRows.has(index))
    state.board = [
        ...Array.from({ length: clearedRows.size }, () => Array(COLUMNS).fill(null)),
        ...remainingRows
    ]
    state.clearingRows = null
    spawnPiece(state, random)
}

function movePiece(state, offsetX, offsetY, random = Math.random) {
    if (state.gameOver || state.clearingRows || !state.piece) return false
    if (!collides(state.board, state.piece, offsetX, offsetY)) {
        state.piece.x += offsetX
        state.piece.y += offsetY
        return true
    }

    if (offsetY > 0) lockPiece(state, random)
    return false
}

function hardDrop(state, random = Math.random) {
    let distance = 0
    while (!state.gameOver && !state.clearingRows && state.piece && movePiece(state, 0, 1, random)) {
        distance += 1
    }
    return distance
}

function rotateShape(shape) {
    const height = shape.length
    const width = shape[0].length
    return Array.from({ length: width }, (_, row) => (
        Array.from({ length: height }, (_, column) => shape[height - 1 - column][row])
    ))
}

function rotatePiece(state) {
    if (state.gameOver || state.clearingRows || !state.piece) return false
    const rotatedShape = rotateShape(state.piece.shape)
    for (const offsetX of [0, -1, 1, -2, 2]) {
        if (!collides(state.board, state.piece, offsetX, 0, rotatedShape)) {
            state.piece.shape = rotatedShape
            state.piece.x += offsetX
            return true
        }
    }
    return false
}

function tick(state, random = Math.random) {
    return movePiece(state, 0, 1, random)
}

module.exports = { COLUMNS, MAX_LEVEL, ROWS, createGameState, finishLineClear, getGhostY, getNextPiece, hardDrop, movePiece, rotatePiece, tick }
