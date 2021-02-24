const ipc = require('node-ipc')

module.exports = {
  Client: require('./src/client-ipc'),
  findOpenSocket: require('./src/find-open-socket'),
  init: require('./src/background-ipc'),
  send: function (/** @type {string} */ name, /** @type {any} */ args) {
    // @ts-ignore This method is missing from node-ipc types, but it exists!
    ipc.server.broadcast('message', JSON.stringify({ type: 'push', name, args }))
  }
}
