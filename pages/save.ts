// tslint:disable: no-console

declare let backend: string

window.onmessage = e => {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', backend)
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
  xhr.onreadystatechange = function() {
    if (this.readyState !== 4) return // tslint:disable-line:no-magic-numbers

    window.parent.postMessage(this.status === 200 ? 'saved' : 'error', '*') // tslint:disable-line:no-magic-numbers
  }

  try {
    const payload = JSON.parse(e.data)
    xhr.send(JSON.stringify({ remove: payload.remove || [] }))
  } catch (err) {
    console.log(err)
    window.parent.postMessage('error', '*')
  }
}
