// From https://github.com/jlongster/electron-with-server-example/blob/master/find-open-socket.js
const ipc = require('node-ipc')

ipc.config.silent = true

/**
 * Check if a socket is already in use
 *
 * @param {string} socketName
 * @returns {Promise<boolean>}
 */
function isSocketTaken (socketName) {
  return new Promise((resolve, reject) => {
    ipc.connectTo(socketName, () => {
      ipc.of[socketName].on('error', () => {
        ipc.disconnect(socketName)
        resolve(false)
      })

      ipc.of[socketName].on('connect', () => {
        ipc.disconnect(socketName)
        resolve(true)
      })
    })
  })
}

/**
 * Find an open socket within a namespace
 *
 * @param {string} namespace
 * @returns {Promise<string>} available socket name
 */
async function findOpenSocket (namespace) {
  let currentSocket = 1
  while (await isSocketTaken(namespace + currentSocket)) {
    currentSocket++
  }
  return namespace + currentSocket
}

module.exports = findOpenSocket
