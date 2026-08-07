'use strict'

let installed = false
const EVENT_NAME = 'unhandledRejection'

module.exports = log => {
  // if installed & have  ignore
  if (installed && process.listenerCount(EVENT_NAME) > 0) return

  log = log || console.error
  installed = true

  process.on(EVENT_NAME, (err) => {
    log(err.stack || err)
  })
}