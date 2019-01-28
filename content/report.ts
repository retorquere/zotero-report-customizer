declare const config: ReportConfig
declare const defaults: ReportConfig

const state: { editing: boolean, saved: boolean, config: ReportConfig } = {
  editing: false,
  saved: false,

  config: JSON.parse(JSON.stringify(config)),
}

function _log(msg) {
  return
  const pre = document.getElementById('log')
  pre.textContent += `${msg}\n`
}

function equal(a, b) {
  const ta = typeof a
  const tb = typeof b

  if (ta !== tb) return false

  switch (ta) {
    case 'undefined':
      return true
    case 'number':
    case 'string':
    case 'boolean':
      return a === b
  }

  // both are either array or object here

  const aa = Array.isArray(a)
  const ab = Array.isArray(b)
  if (aa !== ab) return false // must be both arrays or objects

  if (aa) {
    if (a.length !== b.length) return false

  } else {
    if ((a === null) !== (b === null)) return false
    if (Object.keys(a).length !== Object.keys(b).length) return false

  }

  for (const i in a) {
    if (!equal(a[i], b[i])) return false
  }

  return true
}

function isDirty() {
  return !equal(config, state.config)
}

window.onbeforeunload = function(e) { // tslint:disable-line:only-arrow-functions
  return !state.saved && isDirty() ? true : undefined
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
  if (state.config.fields.remove.indexOf(field.dataset.type) < 0) state.config.fields.remove.push(field.dataset.type)
  update()
  return false
}

function restore() {
  _log('restore')
  state.config = JSON.parse(JSON.stringify(config))
  update()
  return false
}

function reset() {
  _log('reset')
  state.config = JSON.parse(JSON.stringify(defaults))
  update()
  return false
}

function save() {
  const backend = (document.getElementById('backend') as HTMLIFrameElement).contentWindow
  _log('save: dirty=' + isDirty() + ', backend=' + !!backend) // tslint:disable-line:prefer-template
  if (isDirty()) {
    if (backend) {
      backend.postMessage(JSON.stringify(state.config), '*')
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
  state.saved = true

  // this will reload the report and thereby get the latest saved state
  location.reload(true)
}

function update() {
  _log('update; dirty=' + isDirty())

  document.getElementById('save').style.display = isDirty() ? 'inline-block' : 'none'
  document.getElementById('undo').style.display = !equal(state.config, config) ? 'inline-block' : 'none'
  document.getElementById('reset').style.display = !equal(state.config, defaults) ? 'inline-block' : 'none'

  const show: {[key: string]: string} = {}

  for (const field of document.querySelectorAll('[data-type]')) {
    const type = (field as HTMLElement).dataset.type
    show[type] = ''
  }

  for (const type of state.config.fields.remove) {
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
