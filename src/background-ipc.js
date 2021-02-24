const ipc = require('node-ipc')

/**
 * Create an IPC server, listening on the specified socketName. Returns a
 * promise that will resolve when the IPC server is listening
 *
 * @param {string} socketName Unique name for the socket. Any existing socket with this name will be deleted.
 * @param {{ [handlerName]: (...args: any[]) => Promise<any> }} handlers Object of String -> Handler. Handler should be an asyncronous function that returns a Promise.
 * @returns Promise
 */
function init (socketName, handlers) {
  return new Promise(resolve => {
    ipc.config.id = socketName
    ipc.config.logger = console.log

    ipc.serve()
    ipc.server.on('message', handleMessage)
    ipc.server.on('start', resolve)
    ipc.server.start()

    function handleMessage (data, socket) {
      const msg = JSON.parse(data)
      const { id, name, args } = msg

      var onError = (error) => {
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

      if (handlers[name]) {
        let promise
        try {
          promise = handlers[name](args)
        } catch (err) {
          onError(err)
        }

        promise.then(result => {
          ipc.server.emit(
            socket,
            'message',
            JSON.stringify({ type: 'reply', id, result })
          )
        }).catch(onError)
      } else {
        console.warn('Unknown method: ' + name)
        ipc.server.emit(
          socket,
          'message',
          JSON.stringify({ type: 'reply', id, result: null })
        )
      }
    }
  })
}

module.exports = init
