// tslint:disable:no-console

const state = {
  editing: false,
  remove: [],
}

function toggleEdit() {
  state.editing = !state.editing

  for (const x of document.getElementsByClassName('delete-field')) {
    (x as HTMLElement).style.display = state.editing ? 'inline-block' : 'none'
  }

  return false
}

function deleteField(type) {
  if (state.remove.indexOf(type) < 0) state.remove.push(type)
  update()
  return false
}

function update() {
  for (const cls of state.remove) {
    for (const field of document.getElementsByClassName(cls)) {
      (field as HTMLElement).style.display = 'none'
    }
  }
}
