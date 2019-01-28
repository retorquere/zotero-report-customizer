// tslint:disable:no-console

declare const config: { remove: string[] }

const state: { editing: boolean, remove: string[] } = {
  editing: false,

  remove: config.remove.slice(),
}

function _log(msg) {
  return
  const pre = document.getElementById('log')
  pre.textContent += `${msg}\n`
}

function isDirty() {
  const _config_remove = Array.from(new Set(config.remove)).sort().join(':')
  const _state_remove = Array.from(new Set(state.remove)).sort().join(':')
  _log(`loaded: ${JSON.stringify(_config_remove)}, current: ${JSON.stringify(_state_remove)}, dirty: ${_config_remove !== _state_remove}`)
  return _config_remove !== _state_remove
}

window.onbeforeunload = function(e) { // tslint:disable-line:only-arrow-functions
  return isDirty() ? true : undefined
}

function toggleEdit() {
  _log('toggleEdit')
  state.editing = !state.editing

  for (const x of document.getElementsByClassName('delete-field')) {
    (x as HTMLElement).style.display = state.editing ? 'inline-block' : 'none'
  }

  return false
}

function deleteField(field) {
  _log('deleteField')
  if (state.remove.indexOf(field.dataset.type) < 0) state.remove.push(field.dataset.type)
  update()
  return false
}

function restore() {
  _log('restore')
  state.remove = config.remove.slice()
  update()
  return false
}

function reset() {
  _log('reset')
  state.remove = []
  update()
  return false
}

function save() {
  const backend = (document.getElementById('backend') as HTMLIFrameElement).contentWindow
  _log('save: dirty=' + isDirty() + ', backend=' + !!backend) // tslint:disable-line:prefer-template
  if (isDirty()) {
    if (backend) {
      backend.postMessage(JSON.stringify({ remove: state.remove }), '*')
    } else {
      alert(`backend not available: ${!!document.getElementById('backend')}`)
    }
  }
  return false
}
window.onmessage = function(e) { // tslint:disable-line:only-arrow-functions
  // e.data can be 'saved' or 'error'
  _log('message: got ' + e.data)

  // this will prevent the onbeforeunload complaining
  restore()

  // this will reload the report and thereby get the latest saved state
  location.reload(true)
}

function update() {
  _log('update; dirty=' + isDirty())
  document.getElementById('dirty').style.display = isDirty() ? 'inline-block' : 'none'

  const show: {[key: string]: string} = {}

  for (const field of document.querySelectorAll('[data-type]')) {
    const type = (field as HTMLElement).dataset.type
    show[type] = ''
  }

  for (const type of state.remove) {
    show[type] = 'none'
  }

  for (const [type, display] of Object.entries(show)) {
    for (const field of document.getElementsByClassName(type)) {
      (field as HTMLElement).style.display = display
    }
  }
}

// onload does not seem to fire within Zotero
_log('report loaded')
update()
