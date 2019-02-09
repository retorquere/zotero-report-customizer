declare const config: ReportConfig
declare const defaults: ReportConfig

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

const report = new class {
  public active: boolean
  public saved: boolean
  public backend: Window

  private config: ReportConfig
  private editing: boolean

  constructor() {
    this.active = location.href.startsWith('zotero://')
    this.editing = false
    this.saved = false

    if (this.active) {
      this.config = JSON.parse(JSON.stringify(config))
      this.log(`loaded: ${JSON.stringify(this.config)}`)

      this.update()
    } else {
      this.removeNode(document.getElementById('edit-header'))
    }
  }

  public dirty() {
    return !equal(config, this.config)
  }

  public toggleEdit() {
    this.log('toggleEdit')
    this.editing = !this.editing

    for (const x of document.getElementsByClassName('edit') as HTMLCollectionOf<HTMLElement>) {
      x.style.display = this.editing ? 'inline-block' : 'none'
    }

    return false
  }

  public deleteField(field) {
    this.log('deleteField')
    if (this.config.fields.remove.indexOf(field.dataset.type) < 0) this.config.fields.remove.push(field.dataset.type)
    this.update()
    return false
  }

  public moveUp(field) {
    this.log(`moveUp: ${this.config.fields.order.join(',')}`)

    if (field.dataset.type && field.dataset.pred && this.config.fields.remove.indexOf(field.dataset.type) < 0) {

      const order = []
      for (const type of this.config.fields.order) {
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
      this.config.fields.order = order

      this.log(`moveUp: ${field.dataset.type} => ${field.dataset.pred} = ${this.config.fields.order.join(',')}`)
    }

    this.update()
    return false
  }

  public moveDown(field) {
    this.log('moveDown')

    if (field.dataset.type && field.dataset.next && this.config.fields.remove.indexOf(field.dataset.type) < 0) {

      const order = []
      for (const type of this.config.fields.order) {
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
      this.config.fields.order = order

      this.log(`moveDown: ${field.dataset.type} => ${field.dataset.next} = ${this.config.fields.order.join(',')}`)
    }

    this.update()
    return false
  }

  public setSort(field) {
    this.log(`setSort = ${this.config.items.sort}`)

    if (this.config.fields.remove.includes(field.dataset.type)) {
      // don't sort on removed field
      this.config.items.sort = ''

    } else if (this.config.items.sort.match(new RegExp(`^-?${field.dataset.type}$`))) {
      // same field, toggle
      switch (`${this.config.items.sort} `[0]) {
        case ' ': // no sort set, set to ascending
          this.config.items.sort = field.dataset.type
          break

        case '-': // currently descending, turn off
          this.config.items.sort = ''
          break

        default: // currently ascneding, set to descending
          this.config.items.sort = `-${field.dataset.type}`
          break
      }

    } else {
      this.config.items.sort = field.dataset.type

    }

    this.log(`setSort => ${this.config.items.sort}`)
    this.update()
    return false
  }

  public restore() {
    this.log('restore')
    this.config = JSON.parse(JSON.stringify(config))
    this.update()
    return false
  }

  public reset() {
    this.log('reset')
    this.config = JSON.parse(JSON.stringify(defaults))
    this.update()
    return false
  }

  public save() {
    if (!this.dirty()) return false

    if (this.backend) {
      this.backend.postMessage(JSON.stringify(this.config), '*')
    } else {
      alert('backend not available')
    }

    return false
  }

  public log(msg) {
    try {
      Zotero.debug(`report-customizer: ${msg}`)
    } catch (err) {
      console.log(`report-customizer: ${msg}`) // tslint:disable-line:no-console
    }
  }

  private removeNode(node) {
    node.parentNode.removeChild(node)
  }

  private update() {
    this.log('update; dirty=' + this.dirty())

    document.getElementById('save').style.display = this.dirty() ? 'inline-block' : 'none'
    document.getElementById('undo').style.display = !equal(this.config, config) ? 'inline-block' : 'none'
    document.getElementById('reset').style.display = !equal(this.config, defaults) && !equal(config, defaults) ? 'inline-block' : 'none'

    const style = document.getElementById('style')
    if (this.config.fields.remove.length) {
      style.textContent = this.config.fields.remove.map(type => `.${type}`).join(', ') + ' { display: none; }'
    } else {
      style.textContent = ''
    }

    const sort = this.config.items.sort.replace(/^-/, '')

    for (const control of document.querySelectorAll('a > span.mdi-sort-ascending, a > span.mdi-sort-descending')) {
      const actions = {
        'mdi-inactive':         control.parentElement.dataset.type !== sort,
        'mdi-24px':             control.parentElement.dataset.type === sort,
        'mdi-sort-ascending':   this.config.items.sort[0] !== '-',
        'mdi-sort-descending':  this.config.items.sort[0] === '-',
      }
      for (const [className, add] of Object.entries(actions)) {
        control.classList[add ? 'add' : 'remove'](className)
      }
    }

    if (sort) {
      // sort items
      const container = document.getElementById('report')
      const items = Array.from(container.children)
      this.log(`sorting ${items.length} items`)

      const order = this.config.items.sort[0] === '-' ? 1 : 0
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
        const ai = this.config.fields.order.indexOf(a.dataset.sort)
        const bi = this.config.fields.order.indexOf(b.dataset.sort)

        if (ai === bi) return parseInt(a.dataset.index) - parseInt(b.dataset.index)
        return ai - bi
      })

      for (const row of rows) {
        tbody.appendChild(row)
      }

      let pred: string = null
      for (const up of tbody.querySelectorAll('span.mdi-chevron-up') as NodeListOf<HTMLElement>) {
        if (this.config.fields.remove.includes(up.parentElement.dataset.type)) continue

        if (pred) {
          up.parentElement.style.display = 'inline-block'
          up.parentElement.dataset.pred = pred
        } else {
          up.parentElement.style.display = 'none'
        }
        pred = up.parentElement.dataset.type
      }

      let next: string = null
      for (const down of Array.from(tbody.querySelectorAll('span.mdi-chevron-down')).reverse() as HTMLElement[]) {
        if (this.config.fields.remove.includes(down.parentElement.dataset.type)) continue

        if (next) {
          down.parentElement.style.display = 'inline-block'
          down.parentElement.dataset.next = next
        } else {
          down.parentElement.style.display = 'none'
        }
        next = down.parentElement.dataset.type
      }
    }
  }
}

if (report.active) {
  report.log('loading report')

  window.onbeforeunload = function(e) { // tslint:disable-line:only-arrow-functions
    return report.dirty() ? true : undefined
  }

  window.onmessage = function(e) { // tslint:disable-line:only-arrow-functions
    // e.data can be 'saved' or 'error'
    report.log('message: got ' + e.data)

    // this will prevent the onbeforeunload complaining
    window.onbeforeunload = undefined

    // this will reload the report and thereby get the latest saved state
    location.reload(true)
  }

  // load dynamically so it isn't saved to disk
  const div = document.getElementById('backend') as HTMLElement
  const iframe = div.ownerDocument.createElement('iframe') as HTMLIFrameElement
  iframe.addEventListener('load', () => {
    report.backend = iframe.contentWindow
  })
  iframe.style.display = 'none'
  iframe.src = backend
  div.appendChild(iframe)

  report.log('report loaded')
}

// onload does not seem to fire within Zotero
