const uuid = require('uuid')
const ipc = require('node-ipc')
const once = require('once')

/** @typedef {(...args: unknown[]) => any} Callback */

class IPC {
  /** @param {{ logger?: () => any }} [opts] */
  constructor ({ logger } = {}) {
    if (typeof logger === 'function') {
      ipc.config.logger = logger
    }
    /** @type {Map<string, { cb: Callback}>} */
    this.replyHandlers = new Map()
    /** @type {Map<string, Callback[]>} */
    this.listeners = new Map()
    /** @type {string[]} */
    this.messageQueue = []
    this.socketClient = null
  }

  /**
   * Call a handler `name` on the server
   *
   * @param {string} name Name of socket to send the message
   * @param {any} args Arguments to pass to the handler
   * @param {Callback} cb Callback with reply
   * @memberof IPC
   */
  send (name, args, cb) {
    if (!cb && typeof args === 'function') {
      cb = args
      args = {}
    }
    const id = uuid.v4()
    this.replyHandlers.set(id, { cb })
    if (this.socketClient) {
      this.socketClient.emit('message', JSON.stringify({ id, name, args }))
    } else {
      this.messageQueue.push(JSON.stringify({ id, name, args }))
    }
  }

  /**
   * Listen for IPC event
   *
   * @param {string} name Name of event
   * @param {Callback} cb Callback with reply
   * @memberof IPC
   */
  on (name, cb) {
    const listeners = this.listeners.get(name) || []
    if (!listeners.length) {
      this.listeners.set(name, listeners)
    }
    listeners.push(cb)

    return () => {
      const arr = this.listeners.get(name) || []
      this.listeners.set(name, arr.filter(cb_ => cb_ !== cb))
    }
  }

  /**
   * Remote an event listener
   *
   * @param {string} name
   * @memberof IPC
   */
  removeListener (name) {
    this.listeners.set(name, [])
  }

  /**
   * Connect to a socket name `socketName`. Any messages sent before connection
   * are queued and sent upon connection
   *
   * @param {string} socketName
   * @param {(err?: Error) => any} [cb] Called when socket connects
   * @memberof IPC
   */
  connect (socketName, cb = function noop () {}) {
    cb = once(cb)
    this._connect(socketName, (client) => {
      client.on('message', (/** @type {string} */ data) => {
        let msg
        try {
          msg = JSON.parse(data)
        } catch (err) {
          // cannot got further is cannot parse message
          return ipc.log(err, data)
        }

        if (msg.type === 'error') {
          const { id, result } = msg
          const handler = this.replyHandlers.get(id)
          if (handler) {
            this.replyHandlers.delete(id)
            if (handler.cb) handler.cb(result)
          }
        } else if (msg.type === 'reply') {
          const { id, result } = msg
          const handler = this.replyHandlers.get(id)

          if (handler) {
            this.replyHandlers.delete(id)
            if (handler.cb) handler.cb(null, result)
          }
        } else if (msg.type === 'push') {
          const { name, args } = msg

          const listens = this.listeners.get(name)
          if (listens) {
            listens.forEach(listener => {
              listener(args)
            })
          }
        } else {
          return ipc.log('Unknown message type: ' + JSON.stringify(msg))
        }
      })

      client.on('error', (/** @type {any} */ err) => {
        ipc.disconnect(socketName)
        ipc.log('Error connecting to socket', err)
        cb(err)
      })

      client.on('connect', () => {
        this.socketClient = client
        // Send any messages that were queued while closed
        if (this.messageQueue.length > 0) {
          this.messageQueue.forEach(msg => client.emit('message', msg))
          this.messageQueue = []
        }
        cb()
      })

      client.on('disconnect', () => {
        this.socketClient = null
      })
    })
  }

  /**
   * @private
   *
   * @param {string} socketName
   * @param {(client: any) => any} func
   * @memberof IPC
   */
  _connect (socketName, func) {
    ipc.connectTo(socketName, () => {
      func(ipc.of[socketName])
    })
  }
}

module.exports = IPC
