function message(request, response) {
    const text = (request.body && request.body.text) || ''
    console.log(`Message from client: ${text}`)
    response.json({ ok: true })
}

module.exports = { message }
