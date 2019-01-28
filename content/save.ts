// tslint:disable: no-console

declare const backend: string

function log(msg) {
  return
  const pre = document.getElementById('log')
  pre.textContent += `${msg}\n`
}

window.onmessage = function(e) { // tslint:disable-line:only-arrow-functions
  log('backend: got ' + e.data)
  const xhr = new XMLHttpRequest()
  xhr.open('POST', backend)
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
  xhr.onreadystatechange = function() {
    if (this.readyState !== 4) return // tslint:disable-line:no-magic-numbers

    log('backend: sending ' + (this.status === 200 ? 'saved' : 'error')) // tslint:disable-line:no-magic-numbers
    window.parent.postMessage(this.status === 200 ? 'saved' : 'error', '*') // tslint:disable-line:no-magic-numbers
  }

  try {
    const payload = JSON.parse(e.data)
    xhr.send(JSON.stringify({ remove: payload.remove || [] }))
  } catch (err) {
    log(err)
    window.parent.postMessage('error', '*')
    log('backend: sending error')
  }
}

log('backend: ready')
