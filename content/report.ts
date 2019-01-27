// tslint:disable:no-console

declare const config: { remove: string[] }

let backend = null
window.onload = () => {
  document.getElementById('backend').addEventListener('load', () => {
    backend = this.contentWindow
  })
}

let state: { editing: boolean, dirty: boolean, remove: string[] } = {
  editing: false,
  dirty: false,
  remove: [],
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
  update(state.remove, 'none')

  return false
}

function reset() {
  state = {...state, ...config, dirty: false }

  const restore = []
  for (const field of document.querySelectorAll('[data-type]')) {
    const type = (field as HTMLElement).dataset.type
    if (restore.indexOf(type) < 0) restore.push(type)
  }
  update(restore, '')

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

function update(classes, display) {
  document.getElementById('dirty').style.display = state.dirty ? 'inline-block' : 'none'

  for (const cls of classes) {
    for (const field of document.getElementsByClassName(cls)) {
      (field as HTMLElement).style.display = display
    }
  }
}
