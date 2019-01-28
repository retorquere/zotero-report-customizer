// tslint:disable:no-console

declare const config: { remove: string[] }

let backend: Window = null
let state: { editing: boolean, dirty: boolean, remove: string[] } = {
  editing: false,
  dirty: false,
  remove: config.remove,
}

window.onload = () => {
  update()

  document.getElementById('backend').addEventListener('load', () => {
    backend = this.contentWindow
  })
}

window.onbeforeunload = () => state.dirty

function toggleEdit() {
  state.editing = !state.editing

  for (const x of document.getElementsByClassName('delete-field')) {
    (x as HTMLElement).style.display = state.editing ? 'inline-block' : 'none'
  }

  return false
}

function deleteField(field) {
  state.dirty = true

  if (state.remove.indexOf(field.dataset.type) < 0) state.remove.push(field.dataset.type)
  update()

  return false
}

function reset() {
  state = {...state, ...config, dirty: false }

  update(true)

  return false
}

function save() {
  if (state.dirty && backend) backend.postMessage(JSON.stringify({ remove: state.remove }), '*')
  return false
}
window.onmessage = e => {
  // e.data can be 'saved' or 'error'
  // this will reload the report and thereby get the latest saved state
  location.reload(true)
}

function update(restore = false) {
  document.getElementById('dirty').style.display = state.dirty ? 'inline-block' : 'none'

  const show: {[key: string]: string} = {}

  if (restore) {
    for (const field of document.querySelectorAll('[data-type]')) {
      const type = (field as HTMLElement).dataset.type
      show[type] = ''
    }
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
