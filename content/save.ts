// tslint:disable: no-console

function log(msg) {
  try {
    Zotero.debug(msg)
  } catch (err) {
    console.log(msg)
  }
}

window.onmessage = function(e) { // tslint:disable-line:only-arrow-functions
  log('backend: got ' + e.data)
  const xhr = new XMLHttpRequest()
  xhr.open('POST', backend)
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
  xhr.setRequestHeader('Zotero-Allowed-Request', '1')
  xhr.onreadystatechange = function() {
    if (this.readyState !== 4) return // tslint:disable-line:no-magic-numbers

    log('backend: sending ' + (this.status === 200 ? 'saved' : 'error')) // tslint:disable-line:no-magic-numbers
    window.parent.postMessage(this.status === 200 ? 'saved' : 'error', '*') // tslint:disable-line:no-magic-numbers
  }

  try {
    xhr.send(e.data)
  } catch (err) {
    log(err)
    window.parent.postMessage('error', '*')
    log('backend: sending error')
  }
}

log('backend: ready')
