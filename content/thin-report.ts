import * as nunjucks from 'nunjucks'
nunjucks.configure({ autoescape: true })

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

const supportedVars = new Set([
  'customer_name',
  'item.url',
])

const sublists = ['header', 'detail', 'footer', 'page-footer']
const ignoreBlocks = new Set([ 'page-number', 'image-block' ])

export class ThinReport {
  private template: string
  private list: boolean
  private page: { w: number, h: number }
  private margin: { top: number, left: number, bottom: number, right: number }

  constructor(layout) {
    layout = {...JSON.parse(JSON.stringify(layout)), type: 'layout', display: true }

    this.page = papersizes[layout.report['paper-type'].toLowerCase()]
    this.margin = {
      top: layout.report.margin[0],
      bottom: layout.report.margin[1],
      left: layout.report.margin[2],
      right: layout.report.margin[3], // tslint:disable-line:no-magic-numbers
    }
    if (layout.report.orientation !== 'portrait') throw new Error('only portrait orientation is supported right now')

    this.normalize(layout, { left: layout.left, top: layout.top })

    this.template = ''
    this.add(layout, '')
  }

  public render(items) {
    return nunjucks.renderString(this.template, { items })
  }

  private normalize(item, context) {
    if (item.id) item.field = (context.varscope || '') + item.id.replace(/_+$/, '')

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

  private add(item, indent) {
    if (!item.display) return

    let extra_indent = ''
    if (item.field) {
      this.template += `${indent}{% if ${item.field} %}\n`
      extra_indent = '  '
    }

    switch (item.type) {
      case 'list':
        this.add_list(item, indent + extra_indent)
        break
      case 'line':
        this.add_line(item, indent + extra_indent)
        break
      case 'text':
      case 'text-block':
        this.add_text(item, indent + extra_indent)
        break
      case 'rect':
      case 'ellipse':
        this.add_rect(item, indent + extra_indent)
        break
      case 'image':
        this.add_image(item, indent + extra_indent)
        break
      case 'layout':
        this.add_layout(item, indent + extra_indent)
        break
      case 'row':
        this.add_row(item, indent + extra_indent)
        break
      default: throw new Error(`Unsupported item type ${item.type}`)
    }

    if (item.field) {
      this.template += `${indent}{% endif %}\n`
    }
  }

  private add_layout(item, indent) {
    this.template += `
      <html>
        <head>
          <style>
            @page { size: ${item.report['paper-type']}; margin: ${item.report.margin.map(px => px + 'px').join(' ')}; }
            @media print {
              footer { position: fixed; bottom: 0;}
              table { page-break-after:auto }
              tr    { page-break-inside:avoid; page-break-after:auto }
              td    { page-break-inside:avoid; page-break-after:auto }
              thead { display:table-header-group }
              tfoot { display:table-footer-group }
              html  { width: ${this.page.w}px; height: ${this.page.h}px; }
              body  { width: ${this.page.w}px; height: ${this.page.h}px; padding: ${item.report.margin.map(m => `${m}px`).join(' ')}; }
              .line { border: 0; position: absolute }
              table, .text, .text-block, img, .rect, .ellipse { position: absolute }
            }
          </style>
        <body>
          <div style="position: relative;">
    `

    for (const child of item.items) {
      this.add(child, '      ')
    }

    this.template += '</div>\n</body>\n'
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

  private add_row(item, indent) {
    this.template += `${indent}<div style="position: relative">\n`
    for (const child of item.items) {
      this.add(child, indent + '  ')
    }
    this.template += `${indent}</div>\n`
  }

  private add_line(item, indent) {
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
    this.template += `${indent}<div class="line" style="${style}"/>\n`
  }

  private add_text(item, indent) {
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

    let div = `${indent}<div class="${item.type}" style="${style}">`

    const format = item.type === 'text-block' && item.format ? item.format.base : null
    if (format === '{url}') {
      div += `\n${indent}  <a href="{{ ${item.field} }})">{{ ${item.field} }}</a>`
    } else if (format) {
      div += ' ' + format.replace('{value}', `{{ ${item.field} }}`)
    } else if (item.type === 'text-block') {
      div += `{{ ${item.field} }}`
    } else {
      div += `{{ ${JSON.stringify(item.texts.join(' '))} }}`
    }
    this.template += div + '</div>\n'
  }

  private add_rect(item, indent) {
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

    this.template += `${indent}<div class="rect" style="${style}"/>\n`
  }

  private add_list(item, indent) {
    if (this.list && item.type === 'list') throw new Error('Only one list allowed')
    this.list = item

    const style = this.dimensions(item)
    this.template += `${indent}<table style="${style}">\n`

    this._add_list_table_part('header', indent, 'thead')

    this._add_list_table_part('detail', indent + '  ', 'tbody')

    this._add_list_table_part('footer', indent, 'tfoot')

    if (item['page-footer'] && item['page-footer'].enabled) {
      this.template += `${indent}footer\n`
      for (const child of item['page-footer'].items) {
        this.add(child, indent + '  ')
      }
    }
    this.template += `${indent}</table>\n`
  }

  private _add_list_table_part(part, indent, elt) {
    const item = this.list[part]
    if (typeof item.enabled === 'boolean' && !item.enabled) return

    const td = elt === 'thead' ? 'th' : 'td'

    this.template += `${indent}  <${elt}>\n`

    let extra_indent = ''
    if (elt === 'tbody') {
      this.template += `${indent + extra_indent}    {% for item in items %}\n`
      extra_indent = '  '
    }

    this.template += `${indent + extra_indent}    <tr>\n`
    this.template += `${indent + extra_indent}      <${td}>\n`

    for (const child of item.items) {
      this.add(child, `        ${indent + extra_indent}`)
    }

    this.template += `${indent + extra_indent}      </${td}>\n`
    this.template += `${indent + extra_indent}    </tr>\n`

    if (elt === 'tbody') {
      this.template += `${indent + extra_indent}    {% endfor %}\n`
    }
    this.template += `${indent}  </${elt}>\n`
  }

  private add_image(item, indent) {
    const src = `data:${item.data['mime-type']};base64,${item.data.base64}`
    const style = this.dimensions(item)
    this.template += `${indent}<img src="${src}" style="${style}"></img>\n`
  }
}

// htmlEncode(str) {
  // return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// }

// const template = new ThinReport(tlf)
// fs.writeFileSync('estimate.pug', template.template)
