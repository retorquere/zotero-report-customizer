declare const saved: ReportConfig
declare const defaults: ReportConfig
declare const backend: string

import type { ReportConfig } from '../typings/report-config'

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
  }
  else {
    if ((a === null) !== (b === null)) return false
    if (Object.keys(a as Record<string, any>).length !== Object.keys(b as Record<string, any>).length) return false
  }

  for (const i in a) {
    if (!equal(a[i], b[i])) return false
  }

  return true
}

export const report = location.href.startsWith('zotero://') && new class Report { // eslint-disable-line @typescript-eslint/no-unused-vars
  public saved = false
  public backend: Window

  private history: ReportConfig[]
  private state = 0
  private editing = false
  private logging = false

  public constructor() {
    this.history = [ saved ]

    window.onbeforeunload = this.onbeforeunload.bind(this)
    window.onmessage = this.onmessage.bind(this)
  }

  public start() {
    // this will load the backend, which will send a message back when it's loaded. 'onload' doesn't fire (anymore?) for the reports
    const iframe = (document.getElementById('backend') as HTMLIFrameElement)
    iframe.src = backend

    for (const button of document.getElementsByClassName('mdi') as HTMLCollectionOf<HTMLElement>) {
      const tooltip = document.createElement('span')
      tooltip.classList.add('tooltip')
      tooltip.innerText = button.getAttribute('title');
      (button.parentNode as HTMLElement).style.position = 'relative'
      button.parentNode.appendChild(tooltip)
    }

    this.log('showing edit header')
    document.getElementById('edit-header').style.display = 'block'
  }

  public onbeforeunload() {
    return this.dirty() ? true : undefined
  }

  public onmessage(e) {
    let iframe: HTMLIFrameElement
    switch (e.data?.kind) {
      case 'loaded':
        iframe = (document.getElementById('backend') as HTMLIFrameElement)
        this.backend = iframe.contentWindow
        this.log('backend loaded')
        this.update()
        break

      default: // same behavior for 'error' and 'saved'
        // this will prevent the onbeforeunload complaining
        window.onbeforeunload = undefined
        if (e.data?.kind === 'error') alert(e.data.message)
        location.reload()
        break
    }
  }

  public dirty() {
    return !equal(this.history[0], this.config())
  }

  public edit() {
    this.editing = !this.editing

    for (const x of document.getElementsByClassName('edit') as HTMLCollectionOf<HTMLElement>) {
      x.style.display = this.editing ? 'inline-block' : 'none'
    }

    this.update()

    return false
  }

  private push(): ReportConfig {
    this.log(`push: ${this.history.length - 1} => ${this.state + 1}`)
    this.history.splice(this.state + 1)
    this.history.push(JSON.parse(JSON.stringify(this.config())) as ReportConfig)
    this.state += 1
    return this.config()
  }

  private config(): ReportConfig {
    return this.history[this.state]
  }

  public deleteField(field: HTMLElement) {
    if (this.config().fields.remove.indexOf(field.dataset.type) < 0) {
      this.push().fields.remove.push(field.dataset.type)
    }
    this.update()
    return false
  }

  public moveUp(field: HTMLElement) {
    if (field.dataset.type && field.dataset.pred && this.config().fields.remove.indexOf(field.dataset.type) < 0) {

      const order = []
      for (const type of this.config().fields.order) {
        switch (type) {
          case field.dataset.type:
            break
          case field.dataset.pred:
            order.push(field.dataset.type)
            order.push(field.dataset.pred)
            break
          default:
            order.push(type)
            break
        }
      }
      this.push().fields.order = order
    }

    this.update()
    return false
  }

  public moveDown(field: HTMLElement) {
    if (field.dataset.type && field.dataset.next && this.config().fields.remove.indexOf(field.dataset.type) < 0) {

      const order = []
      for (const type of this.config().fields.order) {
        switch (type) {
          case field.dataset.type:
            break
          case field.dataset.next:
            order.push(field.dataset.next)
            order.push(field.dataset.type)
            break
          default:
            order.push(type)
            break
        }
      }
      this.push().fields.order = order
    }

    this.update()
    return false
  }

  public setSort(field: HTMLElement) {
    const config = this.config()

    if (config.fields.remove.includes(field.dataset.type)) {
      // don't sort on removed field
      this.push().items.sort = ''
    }
    else if (config.items.sort.match(new RegExp(`^-?${field.dataset.type}$`))) {
      // same field, toggle
      switch (`${config.items.sort} `[0]) {
        case ' ': // no sort set, set to ascending
          this.push().items.sort = field.dataset.type
          break

        case '-': // currently descending, turn off
          this.push().items.sort = ''
          break

        default: // currently ascending, set to descending
          this.push().items.sort = `-${field.dataset.type}`
          break
      }
    }
    else {
      this.push().items.sort = field.dataset.type
    }

    this.update()
    return false
  }

  public canUndo() {
    return this.editing && this.state > 0
  }
  public undo() {
    if (this.canUndo()) {
      this.state -= 1
      this.update()
    }
    return false
  }

  public canRedo() {
    return this.editing && this.state < (this.history.length - 1)
  }
  public redo() {
    if (this.canRedo()) {
      this.state += 1
      this.update()
    }
    return false
  }

  public canNuke() {
    return this.editing && !equal(this.config(), defaults)
  }
  public nuke() {
    if (this.canNuke()) {
      this.push()
      this.history[this.state] = defaults
      this.update()
    }
    return false
  }

  public canReload() {
    return this.editing && this.state > 0 && this.dirty()
  }
  public reload() {
    if (this.canReload()) {
      this.state = 0
      this.update()
    }
    return false
  }

  public save() {
    if (this.dirty()) {
      if (this.backend) {
        this.backend.postMessage(JSON.stringify(this.config()), '*')
      }
      else {
        alert('backend not available')
      }

      this.update()
    }
    return false
  }

  private log(msg) {
    if (!this.logging) return

    document.getElementById('log').style.display = 'block'
    const log = document.getElementById('log') as HTMLInputElement
    log.value += `${msg}\n`
    log.scrollTop = log.scrollHeight
  }

  public update() {
    this.log(`\nupdate: ${this.state} of ${this.history.length - 1}`)

    const state = {
      edit: true,
      undo: this.canUndo(),
      redo: this.canRedo(),
      reload: this.canReload(),
      nuke: this.canNuke(),
      save: this.dirty(),
    }
    for (const [name, on] of Object.entries(state)) {
      const button = document.getElementById(name)
      try {
        if (this.editing) {
          button.classList[on ? 'remove' : 'add']('disabled')
          button.style.display = 'inline-block'
          this.log(`${name} ${on ? 'enabled' : 'disabled'}`)
        }
        else {
          button.style.display = on ? 'inline-block' : 'none'
          this.log(`${name} ${on ? 'shown' : 'hidden'}`)
        }
      }
      catch (err) {
        this.log(`button ${name} not found`)
      }
    }

    const style = document.getElementById('style')
    const config = this.config()
    if (config.fields.remove.length) {
      style.textContent = config.fields.remove.map(type => `.${type}`).join(', ') + ' { display: none; }' // eslint-disable-line prefer-template
    }
    else {
      style.textContent = ''
    }

    const sort = config.items.sort.replace(/^-/, '')

    for (const control of document.querySelectorAll('a > span.mdi-sort-ascending, a > span.mdi-sort-descending')) {
      const actions = {
        'mdi-inactive':         control.parentElement.dataset.type !== sort,
        'mdi-24px':             control.parentElement.dataset.type === sort,
        'mdi-sort-ascending':   config.items.sort[0] !== '-',
        'mdi-sort-descending':  config.items.sort[0] === '-',
      }
      for (const [className, add] of Object.entries(actions)) {
        control.classList[add ? 'add' : 'remove'](className)
      }
    }

    if (sort) {
      // sort items
      const container = document.getElementById('report')
      const items = Array.from(container.children)

      const order = config.items.sort[0] === '-' ? 1 : 0
      const selector = (sort === 'title') ? 'h2' : `tr.${sort} td`
      items.sort((a, b) => {
        const t = [a, b].map((e: HTMLElement) => {
          e = e.querySelector(selector)
          if (!e) return '\u10FFFF' // maximum unicode codepoint, will put this item last in sort
          return e.dataset.sort || e.textContent
        })
        return t[order].localeCompare(t[1 - order])
      })

      for (const item of items) {
        container.appendChild(item)
      }
    }

    // reorder fields and show reorder controls
    for (const tbody of document.querySelectorAll('tbody')) {
      const rows: HTMLElement[] = Array.from(tbody.children).map((row: HTMLElement, i) => {
        row.dataset.index = `${i}`
        return row
      })

      rows.sort((a: HTMLElement, b: HTMLElement) => {
        const ai = config.fields.order.indexOf(a.dataset.sort)
        const bi = config.fields.order.indexOf(b.dataset.sort)

        if (ai === bi) return parseInt(a.dataset.index) - parseInt(b.dataset.index)
        return ai - bi
      })

      for (const row of rows) {
        tbody.appendChild(row)
      }

      let pred: string = null
      for (const up of tbody.querySelectorAll('span.mdi-chevron-up')) {
        if (config.fields.remove.includes(up.parentElement.dataset.type)) continue

        if (pred) {
          up.parentElement.style.display = 'inline-block'
          up.parentElement.dataset.pred = pred
        }
        else {
          up.parentElement.style.display = 'none'
        }
        pred = up.parentElement.dataset.type
      }

      let next: string = null
      for (const down of Array.from(tbody.querySelectorAll('span.mdi-chevron-down')).reverse() as HTMLElement[]) {
        if (config.fields.remove.includes(down.parentElement.dataset.type)) continue

        if (next) {
          down.parentElement.style.display = 'inline-block'
          down.parentElement.dataset.next = next
        }
        else {
          down.parentElement.style.display = 'none'
        }
        next = down.parentElement.dataset.type
      }
    }
  }
}
