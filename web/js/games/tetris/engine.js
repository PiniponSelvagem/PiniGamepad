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

/**
 * @brief   Create an empty game board.
 * @return  A ROWS-by-COLUMNS array whose cells are initially null.
 */
function createBoard() {
    return Array.from({ length: ROWS },
        /** @brief Create an empty board row. @return Array of empty cells. */
        () => Array(COLUMNS).fill(null))
}

/**
 * @brief   Copy a piece's shape matrix so its rows can be modified independently.
 * @param   shape Two-dimensional matrix describing occupied piece cells.
 * @return  A new matrix with copies of the original rows.
 */
function copyShape(shape) {
    return shape.map(
        /** @brief Copy one shape row. @param row Original shape row. @return Copied row. */
        row => [...row])
}

/**
 * @brief   Select a random piece definition from the available shapes.
 * @param   random Function returning a random number in the range [0, 1).
 * @return  The selected piece definition.
 */
function choosePiece(random) {
    return PIECES[Math.floor(random() * PIECES.length)]
}

/**
 * @brief   Create a new game and spawn its first piece.
 * @param   random Optional random-number function, useful for reproducible games and tests.
 * @return  A new game state with an empty board and a queued next piece.
 */
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

/**
 * @brief   Promote the queued piece and choose the next piece.
 * @param   state Game state to update.
 * @param   random Optional random-number function used to choose the next piece.
 * @note    Sets gameOver if the newly spawned piece collides with the board.
 */
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

/**
 * @brief   Get the queued piece for the preview.
 * @param   state Current game state.
 * @return  The queued piece color identifier and a copy of its shape.
 */
function getNextPiece(state) {
    return {
        color: state.nextPiece.color,
        shape: copyShape(state.nextPiece.shape)
    }
}

/**
 * @brief   Check whether a piece position or shape intersects the board or its boundaries.
 * @param   board Current matrix of locked cells.
 * @param   piece Piece whose position is being tested.
 * @param   offsetX Optional horizontal offset in cells.
 * @param   offsetY Optional vertical offset in cells.
 * @param   shape Optional shape matrix to test instead of the current shape.
 * @return  True if the tested position collides; otherwise false.
 */
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

/**
 * @brief   Find the landing row for the active piece without moving it.
 * @param   state Game state containing an active piece.
 * @return  The piece's projected vertical position in board cells.
 */
function getGhostY(state) {
    let offsetY = 0
    while (!collides(state.board, state.piece, 0, offsetY + 1)) {
        offsetY += 1
    }
    return state.piece.y + offsetY
}

/**
 * @brief   Lock the active piece, update statistics, and detect completed lines.
 * @param   state Game state to update.
 * @param   random Random-number function used when spawning the next piece.
 * @note    Completed rows remain on the board until finishLineClear is called after the animation.
 */
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
        .map(
            /** @brief Mark full rows by index. @param row Board row. @param index Row index. @return Index of a full row, or -1. */
            (row, index) => row.every(Boolean) ? index : -1)
        .filter(
            /** @brief Keep marked row indices. @param index Marked index or -1. @return True for a cleared row. */
            index => index >= 0)
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

/**
 * @brief   Remove pending completed rows, drop the remaining rows, and spawn the next piece.
 * @param   state Game state containing the rows waiting to be cleared.
 * @param   random Optional random-number function used for the next piece.
 * @note    Does nothing when no line clear is pending.
 */
function finishLineClear(state, random = Math.random) {
    if (!state.clearingRows) return

    const clearedRows = new Set(state.clearingRows)
    const remainingRows = state.board.filter(
        /** @brief Retain rows not being cleared. @param _ Board row; unused. @param index Row index. @return True if the row remains. */
        (_, index) => !clearedRows.has(index))
    state.board = [
        ...Array.from({ length: clearedRows.size },
            /** @brief Create an empty replacement row. @return Array of empty cells. */
            () => Array(COLUMNS).fill(null)),
        ...remainingRows
    ]
    state.clearingRows = null
    spawnPiece(state, random)
}

/**
 * @brief   Attempt to move the active piece by the given offsets.
 * @param   state Game state to update.
 * @param   offsetX Horizontal displacement in board cells.
 * @param   offsetY Vertical displacement in board cells.
 * @param   random Optional random-number function used when a piece locks.
 * @return  True if the piece moved; false if movement was blocked or unavailable.
 * @note    A blocked downward move locks the piece; blocked sideways movement does not.
 */
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

/**
 * @brief   Drop the active piece until it locks.
 * @param   state Game state to update.
 * @param   random Optional random-number function used when the piece locks.
 * @return  The number of rows the piece moved before locking.
 */
function hardDrop(state, random = Math.random) {
    let distance = 0
    while (!state.gameOver && !state.clearingRows && state.piece && movePiece(state, 0, 1, random)) {
        distance += 1
    }
    return distance
}

/**
 * @brief   Rotate a shape matrix clockwise.
 * @param   shape Two-dimensional piece shape to rotate.
 * @return  A new rotated shape matrix.
 */
function rotateShape(shape) {
    const height = shape.length
    const width = shape[0].length
    return Array.from({ length: width },
        /** @brief Create one rotated row. @param _ Unused value. @param row Rotated row index. @return The rotated row. */
        (_, row) => (
        Array.from({ length: height },
            /** @brief Select one rotated cell. @param _ Unused value. @param column Rotated column index. @return Original cell value. */
            (_, column) => shape[height - 1 - column][row])
    ))
}

/**
 * @brief   Rotate the active piece clockwise, trying horizontal offsets if necessary.
 * @param   state Game state to update.
 * @return  True if a valid rotation was applied; otherwise false.
 */
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

/**
 * @brief   Advance gravity by attempting to move the active piece down one row.
 * @param   state Game state to update.
 * @param   random Optional random-number function used when the piece locks.
 * @return  True if the piece moved down; otherwise false.
 */
function tick(state, random = Math.random) {
    return movePiece(state, 0, 1, random)
}

module.exports = { COLUMNS, MAX_LEVEL, ROWS, createGameState, finishLineClear, getGhostY, getNextPiece, hardDrop, movePiece, rotatePiece, tick }
