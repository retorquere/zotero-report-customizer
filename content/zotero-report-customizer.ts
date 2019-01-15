declare const Zotero: any
declare const Components: any

Components.utils.import('resource://gre/modules/osfile.jsm')
declare const OS: any

const marker = 'ReportCustomizerMonkeyPatched'

// import TR here
import { ThinReport } from './thin-report'

function patch(object, method, patcher) {
  if (object[method][marker]) return
  object[method] = patcher(object[method])
  object[method][marker] = true
}

function save(path, contents) {
  const file = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile)
  file.initWithPath(path)
  Zotero.File.putContents(file, contents)
}

const seconds = 1000

function flash(title, body = null, timeout = 8) {
  try {
    const pw = new Zotero.ProgressWindow()
    pw.changeHeadline(`Report Customizer: ${title}`)
    if (!body) body = title
    if (Array.isArray(body)) body = body.join('\n')
    pw.addDescription(body)
    pw.show()
    pw.startCloseTimer(timeout * seconds)

  } catch (err) {
    Zotero.logError(err)

  }
}

export let ReportCustomizer = Zotero.ReportCustomizer || new class { // tslint:disable-line:variable-name
  private initialized: boolean = false

  private report: ThinReport

  private fields: {
    valid: Set<string>
    aliasOf: { [key: string]: string }
  }

  constructor() {
    window.addEventListener('load', event => {
      this.init().catch(err => Zotero.logError(err))
    }, false)
  }

  public async load(template) {
    try {
      const path = OS.Path.join(Zotero.DataDirectory.dir, 'report-customizer', template)
      if (!await OS.File.exists(path)) throw new Error(`"${path}" does not exist`)
      this.report.load(JSON.parse(await OS.File.read(path, { encoding: 'utf-8' })))
    } catch (err) {
      Zotero.logError(err)
      flash(err.message)

    }
  }

  public render(items) {
    return this.report.render(items.map(item => this.simplify(item)))
  }

  private simplify(item) {
    for (const [alias, field] of Object.entries(this.fields.aliasOf)) {
      if (!item[alias]) continue
      item[field] = item[alias]
      delete item[alias]
    }

    item.itemType = Zotero.ItemTypes.getLocalizedString(item.itemType)

    save('/tmp/item.json', JSON.stringify(item, null, 2))
  }

  private async init() {
    if (this.initialized) return
    this.initialized = true

    await Zotero.Schema.initializationPromise

    this.fields = {
      valid: new Set([ 'itemType', 'dateAdded', 'dateModified', 'tags', 'attachments', 'notes', 'collections' ]),
      aliasOf: {},
    }

    const sql = `
      SELECT it.typeName, COALESCE(bf.fieldName, f.fieldName) as fieldName, CASE WHEN bf.fieldName IS NULL THEN NULL ELSE f.fieldName END as fieldAlias
      FROM itemTypes it
      JOIN itemTypeFields itf ON it.itemTypeID = itf.itemTypeID
      JOIN fields f ON f.fieldID = itf.fieldID
      LEFT JOIN baseFieldMappingsCombined bfmc ON it.itemTypeID = bfmc.itemTypeID AND f.fieldID = bfmc.fieldID
      LEFT JOIN fields bf ON bf.fieldID = bfmc.baseFieldID
    `.replace(/\r/g, '').replace(/\n/g, ' ').trim()
    for (const row of await Zotero.DB.queryAsync(sql)) {
      this.fields.valid.add(`item.${row.fieldName}`)
      if (row.fieldAlias) this.fields.aliasOf[row.fieldAlias] = row.fieldName
    }

    this.report = new ThinReport(this.fields.valid)

    this.report.load(this.report.defaultReport())
    save('/tmp/template.html', this.report.template)
  }
}

Zotero.Report.HTML.listGenerator = function* listGenerator(items, combineChildItems) {
  const html = ReportCustomizer.render(items)
  save('/tmp/report.html', html)

  yield html
}
