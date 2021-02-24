const ipc = require('node-ipc')
const pIsPromise = require('p-is-promise')

/**
 * Create an IPC server, listening on the specified socketName. Returns a
 * promise that will resolve when the IPC server is listening
 *
 * @param {string} socketName Unique name for the socket. Any existing socket with this name will be deleted.
 * @param {{ [handlerName: string]: (...args: any[]) => Promise<unknown> }} handlers Object of String -> Handler. Handler should be an asyncronous function that returns a Promise.
 * @returns {Promise<void>}
 */
function init (socketName, handlers) {
  return new Promise(resolve => {
    ipc.config.id = socketName
    ipc.config.logger = console.log

    ipc.serve()
    ipc.server.on('message', handleMessage)
    ipc.server.on('start', resolve)
    ipc.server.start()

    /**
     * @param {string} data
     * @param {import('net').Socket} socket
     */
    function handleMessage (data, socket) {
      let msg
      try {
        msg = JSON.parse(data)
      } catch (e) {
        return onError(new Error('Could not parse IPC message: ' + data))
      }
      const { id, name, args } = msg

      if (typeof id !== 'string') {
        console.error('IPC message is missing an id')
        // Can't send a reply without an id, so need to fail silently
        // TODO: Generic error handler channel?
        return
      }
      if (typeof name !== 'string') {
        return onError(new Error('IPC message is missing a name'))
      }

      const handler = handlers[name]

      if (typeof handler !== 'function') {
        console.warn('Unknown method: ' + msg.name)
        ipc.server.emit(
          socket,
          'message',
          JSON.stringify({ type: 'reply', id, result: null })
        )
      }

      let promise
      try {
        promise = handlers[name](args)
      } catch (err) {
        return onError(err)
      }

      if (!pIsPromise(promise)) {
        return onError(new Error(`Handler '${name}' did not return a promise`))
      }

      promise.then(result => {
        ipc.server.emit(
          socket,
          'message',
          JSON.stringify({ type: 'reply', id, result })
        )
      }).catch(onError)

      /** @param {Error} error */
      function onError (error) {
        console.warn('Error', name, args)
        console.error(error)
        // Up to you how to handle errors, if you want to forward
        // them, etc
        ipc.server.emit(
          socket,
          'message',
          JSON.stringify({ type: 'error', id, result: error.message })
        )
      }
    }
  })
}

module.exports = init
