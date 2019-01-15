declare const Zotero: any

import * as nunjucks from 'nunjucks'
nunjucks.configure({ autoescape: true })

import indent = require('indent-string')

const papersizes = {
  letter:       { w: 612, h: 792 },
  lettersmall:  { w: 612, h: 792 },
  tabloid:      { w: 792, h: 1224 },
  ledger:       { w: 1224, h: 792 },
  legal:        { w: 612, h: 1008 },
  statement:    { w: 396, h: 612 },
  executive:    { w: 540, h: 720 },
  a0:           { w: 2384, h: 3371 },
  a1:           { w: 1685, h: 2384 },
  a2:           { w: 1190, h: 1684 },
  a3:           { w: 842, h: 1190 },
  a4:           { w: 595, h: 842 },
  a4small:      { w: 595, h: 842 },
  a5:           { w: 420, h: 595 },
  b4:           { w: 729, h: 1032 },
  b5:           { w: 516, h: 729 },
  folio:        { w: 612, h: 936 },
  quarto:       { w: 610, h: 780 },
  '10x14':      { w: 720, h: 1008 },
}

const sublists = ['header', 'detail', 'footer', 'page-footer']
const ignoreBlocks = new Set([ 'page-number', 'image-block' ])

export class ThinReport {
  public template: string

  private list: boolean
  private page: { w: number, h: number }
  private margin: { top: number, left: number, bottom: number, right: number }
  private fields: Set<string>

  constructor(validFields) {
    this.fields = validFields
  }

  public load(layout) {
    layout = {...JSON.parse(JSON.stringify(layout)), type: 'layout', display: true }

    const paperType = layout.report['paper-type'].toLowerCase()
    if (paperType === 'user') {
      this.page = { w: layout.report.width, h: layout.report.height }
    } else {
      this.page = papersizes[paperType]
    }

    this.margin = {
      top: layout.report.margin[0],
      bottom: layout.report.margin[1],
      left: layout.report.margin[2],
      right: layout.report.margin[3], // tslint:disable-line:no-magic-numbers
    }
    if (layout.report.orientation !== 'portrait') throw new Error('only portrait orientation is supported right now')

    this.normalize(layout, { left: layout.left, top: layout.top })

    this.template = this.add(layout)
    Zotero.debug('ThinReport: ' + this.template)
  }

  public render(items) {
    return nunjucks.renderString(this.template, { items })
  }

  public defaultReport() {
    const fields = [...this.fields].filter(field => field.startsWith('item.')).map(field => field.replace('item.', ''))

    const template = JSON.parse(Zotero.File.getContentsFromURL('resource://zotero-report-customizer/report.tlf'))

    const list = template.items.find(item => item.type === 'list')
    const detail = list.detail.items
    const height = list.detail.height

    list.detail.items = []

    let firstrow = true
    for (const field of fields) {
      if (!firstrow) {
        list.detail.height += height
        list.height += height
      }

      for (const item of detail) {
        list.detail.items.push(this.defaultReportField(item, firstrow ? 0 : height, field))
      }
      firstrow = false
    }

    return template
  }

  private defaultReportField(item, offset, field) {
    // shift orig item
    if (typeof item.y !== 'undefined') item.y += offset
    if (typeof item.y1 !== 'undefined') item.y1 += offset
    if (typeof item.y2 !== 'undefined') item.y2 += offset
    if (typeof item.cy !== 'undefined') item.cy += offset

    item = JSON.parse(JSON.stringify(item))

    item.description = field

    let label
    if (item.type === 'text' && (item.texts || [''])[0].indexOf('{field}') >= 0) {
      if (field === field.toUpperCase()) {
        label = field
      } else {
        label = field[0].toUpperCase() + field.slice(1)
        label = label.split(/([A-Z][a-z]*)/)
        label = label.join(' ').toLowerCase()
      }
      item.texts = [ (item.texts || [''])[0].replace('{field}', label) ]
    }

    if (item.type === 'text-block' && item.id === 'field') item.id = field

    return item
  }

  private normalize(item, context) {
    if (item.type !== 'list' && item.id) { // lists must have an ID in thinreports
      item.field = (context.varscope || '') + item.id
      if (!this.fields.has(item.field)) throw new Error(`Unsupported field "${item.field}"`)
    }

    if (item.type !== 'list' && item.description) { // lists always shown
      item.condition = (context.varscope || '') + item.description
      if (!this.fields.has(item.condition)) throw new Error(`Unsupported field "${item.condition}"`)
    }

    switch (item.type) {
      case 'layout':
        item.left = this.margin.left
        item.top = this.margin.top

        item.items = item.items.filter(child => child.display && !ignoreBlocks.has(child.type))
        for (const child of item.items) {
          this.normalize(child, { top: item.top, left: item.left })
        }
        const list = item.items.find(child => child.type === 'list')
        item.items = this.splitToRows(item.items.filter(child => child.type !== 'list'))
        if (list) item.items.push(list)
        break

      case 'rect':
      case 'image':
      case 'text':
      case 'text-block':
      case 'list':
        item.top = item.y
        item.left = item.x
        // width & height already set

        if (item.type === 'list') {
          for (const sublist of sublists) {
            item[sublist].items = item[sublist].items.filter(child => !child.display || !ignoreBlocks.has(child.type))
            for (const child of item[sublist].items) {
              this.normalize(child, { top: item.top - item[sublist].translate.y, left: item.left - item[sublist].translate.x, varscope: sublist === 'detail' ? 'item.' : '' })
            }
            item[sublist].items = this.splitToRows(item[sublist].items)
          }
        }

        break

      case 'ellipse':
        item.top = item.cy - item.ry
        item.left = item.cx - item.rx
        item.height = item.cy * 2
        item.width = item.cx * 2
        break

      case 'line':
        if (item.y1 === item.y2) {
          // horizontal
          item.top = item.y1 - (item.style['border-width'] / 2)
          item.left = item.x1
          item.width = item.x2 - item.x1
          item.height = item.style['border-width']

        } else if (item.x1 === item.x2) {
          // vertical
          item.top = item.y1
          item.left = item.x1 - (item.style['border-width'] / 2)
          item.width = item.style['border-width']
          item.height = item.y2 - item.y1

        } else {
          // oops
          throw new Error('only horizontal or vertical lines are supported')
        }
        break

      default:
        throw new Error(`Unsupported block type '${item.type}'`)
    }

    item.left -= context.left
    item.top -= context.top

    return item
  }

  private splitToRows(items) {
    const rows = []
    let bottom
    for (const item of items.slice().sort((a, b) => a.top - b.top)) {
      const item_bottom = item.top + item.height

      if (!rows.length || item.top >= bottom) { // first row or item in current row
        bottom = !rows.length ? item_bottom : Math.max(bottom, item_bottom)

        rows.push({
          type: 'row',
          display: true,
          top: item.top,
          items: [],
        })

      } else {
        bottom = Math.max(item_bottom, bottom)

      }

      item.row = rows.length - 1
    }

    // do in separate loop to preserve implicit z-index
    for (const item of items) {
      rows[item.row].items.push(item)
      delete item.row
    }

    for (const row of rows) {
      row.left = Math.min(...row.items.map(item => item.left))
    }

    return rows
  }

  private add(item): string {
    if (!item.display) return ''

    let template = ''

    switch (item.type) {
      case 'list':
        template = this.add_list(item)
        break

      case 'line':
        template = this.add_line(item)
        break

      case 'text':
      case 'text-block':
        template = this.add_text(item)
        break

      case 'rect':
      case 'ellipse':
        template = this.add_rect(item)
        break

      case 'image':
        template = this.add_image(item)
        break

      case 'layout':
        template = this.add_layout(item)
        break

      case 'row':
        template = this.add_row(item)
        break

      default: throw new Error(`Unsupported item type ${item.type}`)
    }

    if (template && (item.field || item.condition)) template = this.wrap(`{% if ${item.field || item.condition} %}`, template, '{% endif %}')

    return template
  }

  private add_layout(item): string {
    const padding = item.report.margin.map(m => `${m}px`).join(' ')
    let template = [
      '<html>',
      '  <head>',
      '    <style>',
      `      @page { size: ${item.report['paper-type']}; margin: ${item.report.margin.map(px => px + 'px').join(' ')}; }`,
      '      @media print {',
      '        footer { position: fixed; bottom: 0;}',
      '        table { page-break-after:auto }',
      '        tr    { page-break-inside:avoid; page-break-after:auto }',
      '        td    { page-break-inside:avoid; page-break-after:auto }',
      '        thead { display:table-header-group }',
      '        tfoot { display:table-footer-group }',
      `        html  { width: ${this.page.w}px; height: ${this.page.h}px; }`,
      `        body  { width: ${this.page.w}px; height: ${this.page.h}px; padding: ${padding}; }`,
      '        .line { border: 0; position: absolute }',
      '        table, .text, .text-block, img, .rect, .ellipse { position: absolute }',
      '      }',
      '    </style>',
      '  <body>',
      '',
    ].join('\n')

    for (const child of item.items) {
      template += indent(this.add(child), 4) // tslint:disable-line:no-magic-numbers
    }

    template += '  </body>\n</html>\n'

    return template
  }

  private dimensions(item) {
    let dimensions = ''
    if (typeof item.position !== 'undefined') dimensions += ` position: ${item.position};`
    if (typeof item.left !== 'undefined') dimensions += ` left: ${item.left}px;`
    if (typeof item.top !== 'undefined') dimensions += ` top: ${item.top}px;`
    if (typeof item.width !== 'undefined') dimensions += ` width: ${item.width}px;`
    if (typeof item.height !== 'undefined') dimensions += ` height: ${item.height}px;`

    return dimensions.trim()
  }

  private add_row(item): string {
    let template = ''
    for (const child of item.items) {
      template += this.add(child)
    }

    return this.wrap('<div style="position: relative">', template, '</div>')
  }

  private add_line(item): string {
    let style = `border: 0px; ${this.dimensions(item)}`

    for (const [k, v] of Object.entries(item.style)) {
      if (!v || (Array.isArray(v) && !v.length)) continue

      switch (k) {
        case 'border-color':
          style += ` background-color: ${v}; border: none;`
          break
        case 'border-width':
            break
        case 'border-style':
          // style += ` border-style: ${v};`
          break

        default:
          throw new Error(`Unknown style attribute ${k}`)
      }
    }

    return `<div class="line" style="${style}"/>\n`
  }

  private add_text(item): string {
    let style = this.dimensions(item)

    for (const [k, v] of Object.entries(item.style)) {
      if (!v || (Array.isArray(v) && !v.length)) continue

      switch (k) {
        case 'font-family':
        case 'line-height':
        case 'line-height-ratio':
        case 'letter-spacing':
          break

        case 'font-size':
          style += ` ${k}: ${v}px;`
          break

        case 'overflow':
          switch (v) {
            case 'fit': // not supported -- what does this mean?
              break
            case 'truncate':
              style += ' overflow: hidden;'
              break
            default:
              throw new Error(`Unknown overflow attribute ${v}`)
          }
          break

        case 'word-wrap':
        case 'color':
        case 'text-align':
        case 'vertical-align':
          style += ` ${k}: ${v};`
          break

        case 'font-style':
          style += ` ${k}: ${v[0]};`
          break

        default:
          throw new Error(`Unknown style attribute ${k}`)
      }
    }

    let div = `<div class="${item.type}" style="${style}">`

    const format = item.type === 'text-block' && item.format ? item.format.base : null
    if (format === '{url}') {
      div += `<a href="{{ ${item.field} }})">{{ ${item.field} }}</a>`
    } else if (format) {
      div += format.split('{value}').map(s => `{{ ${JSON.stringify(s)} }}`).join(`{{ ${item.field} }}`)
    } else if (item.type === 'text-block') {
      div += `{{ ${item.field} }}`
    } else {
      div += `{{ ${JSON.stringify(item.texts.join(' '))} }}`
    }
    div += '</div>\n'

    return div
  }

  private add_rect(item): string {
    let style = this.dimensions(item)

    for (const [k, v] of Object.entries(item.style)) {
      if (!v || (Array.isArray(v) && !v.length)) continue

      switch (k) {
        case 'border-color':
        case 'border-style':
          style += ` ${k}: ${v};`
          break

        case 'fill-color':
          style += ` background-color: ${v};`
          break

        case 'border-width':
          style += ` ${k}: ${v}px;`
          break

        default:
          throw new Error(`Unknown style attribute ${item.type}.${k}`)
      }
    }

    return `<div class="rect" style="${style}"/>\n`
  }

  private add_list(item): string {
    if (this.list && item.type === 'list') throw new Error('Only one list allowed')
    this.list = item

    let table = ''

    table += this._add_list_table_part('header', 'thead')

    table += this._add_list_table_part('detail', 'tbody')

    table += this._add_list_table_part('footer', 'tfoot')

    if (item['page-footer'] && item['page-footer'].enabled) {
      let footer = ''
      for (const child of item['page-footer'].items) {
        footer += this.add(child)
      }
      table += this.wrap('footer', footer)
    }

    return this.wrap(`<table style="${this.dimensions(item)}">`, table, '</table>')
  }

  private _add_list_table_part(part, elt): string {
    const item = this.list[part]
    if (typeof item.enabled === 'boolean' && !item.enabled) return ''

    let template = ''
    for (const child of item.items) {
      template += this.add(child)
    }
    template = this.wrap(elt === 'thead' ? 'th' : 'td', template)
    template = this.wrap('tr', template)

    if (elt === 'tbody') template = this.wrap('{% for item in items %}', template, '{% endfor %}')
    template = this.wrap(elt, template)

    return template
  }

  private add_image(item): string {
    const src = `data:${item.data['mime-type']};base64,${item.data.base64}`
    const style = this.dimensions(item)
    return `<img src="${src}" style="${style}"></img>\n`
  }

  private wrap(prefix, body, postfix = null) {
    if (!postfix) {
      postfix = `</${prefix}>`
      prefix = `<${prefix}>`
    }
    return `${prefix}\n${indent(body, 2)}${postfix}\n`
  }
}

// htmlEncode(str) {
  // return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// }
