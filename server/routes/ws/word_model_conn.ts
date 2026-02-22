// Word model WebSocket endpoint — not yet implemented.
// Will follow the same structure as letter_model_conn.ts once the word model is trained.

export default defineWebSocketHandler({
  open(peer) {
    peer.send(JSON.stringify({ error: 'Word model not yet implemented', status: 501 }))
    peer.close()
  },

  message(_peer, _message) {},
  close(_peer) {},
  error(_peer, _error) {},
})
