declare const Zotero: any
declare const Components: any

Components.utils.import('resource://gre/modules/osfile.jsm')
declare const OS: any

const report = require('./report.pug')

function save(path, contents) {
  const file = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile)
  file.initWithPath(path)
  Zotero.File.putContents(file, contents)
}

const fields = `
  SELECT DISTINCT it.typeName, COALESCE(bf.fieldName, f.fieldName) as fieldName, CASE WHEN bf.fieldName IS NULL THEN NULL ELSE f.fieldName END as fieldAlias
  FROM itemTypes it
  JOIN itemTypeFields itf ON it.itemTypeID = itf.itemTypeID
  JOIN fields f ON f.fieldID = itf.fieldID
  JOIN baseFieldMappingsCombined bfmc ON it.itemTypeID = bfmc.itemTypeID AND f.fieldID = bfmc.fieldID
  JOIN fields bf ON bf.fieldID = bfmc.baseFieldID
`.replace(/\n/g, ' ').trim()
const fieldAlias: { [key: string]: string } = {}

function* listGenerator(items, combineChildItems) {
  const fieldNames = {}
  function fieldName(itemType, field) {
    const id = `${itemType}.${field}`
    if (typeof fieldNames[id] === 'undefined') {
      try {
        fieldNames[id] = Zotero.ItemFields.getLocalizedString(itemType, field)
      } catch (err) {
        Zotero.debug(`Localized string not available for '${id}'`, 2)
        fieldNames[id] = ''
      }
    }
    return fieldNames[id]
  }

  for (const item of items) {
    if (item.reportSearchMatch && item.relations[Zotero.Relations.relatedItemPredicate]) {
      let relations = item.relations[Zotero.Relations.relatedItemPredicate]
      if (!Array.isArray(relations)) relations = [ relations ]

      const _relations = []
      for (const relation of relations) {
        const _relation = yield Zotero.URI.getURIItem(relation)
        if (_relation) _relations.push({ key: _relation.key, title: _relation.getDisplayTitle() })
      }
      item.relations = _relations.length ? _relations : null

    } else {
      item.relations = null

    }
  }

  const html = report({ fieldName, items, fieldAlias })
  save('/tmp/rc-report.html', html)
  yield html
}

export let ReportCustomizer = Zotero.ReportCustomizer || new class { // tslint:disable-line:variable-name
  private initialized: boolean = false

  constructor() {
    window.addEventListener('load', event => {
      this.init().catch(err => Zotero.logError(err))
    }, false)
  }

  private async init() {
    if (this.initialized) return
    this.initialized = true

    await Zotero.Schema.initializationPromise

    for (const row of await Zotero.DB.queryAsync(fields)) {
      fieldAlias[`${row.typeName}.${row.fieldAlias}`] = row.fieldName
    }

    Zotero.Report.HTML.listGenerator = listGenerator
  }
}
