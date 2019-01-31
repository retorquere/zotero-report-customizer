declare const Zotero: any

import Ajv = require('ajv')

const backend = 'http://127.0.0.1:23119/report-customizer'
const report = require('./report.pug')
const save = require('./save.pug')({ backend })

declare const Components: any
function saveFile(path, contents) {
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
const publicationTitleAlias: string[] = []

function getLibraryIDFromkey(key) {
  for (const [libraryID, keys] of Object.entries(Zotero.Items._objectIDs)) {
    if (keys[key]) return parseInt(libraryID)
  }
  return undefined
}

const schema = require('./report-config.json')
const ajv = new Ajv({allErrors: true})
const validate = ajv.compile(schema)
const defaults = require('json-schema-defaults')(schema)

function* listGenerator(items, combineChildItems) {
  const fieldNames = {}
  function fieldName(itemType, field) {
    if (itemType !== 'attachment' && itemType !== 'note') {
      switch (field) {
        case 'citationKey':
          return 'Citation key'
        case 'citationKeyConflicts':
          return 'Citation key conflicts'
        case 'qualityReport':
          return 'Quality report'
      }
    }

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

  const tagCount: { [key: string]: number } = {}
  for (const item of items) {
    // citation key
    if (item.itemType !== 'attachment' && item.itemType !== 'note' && Zotero.BetterBibTeX && Zotero.BetterBibTeX.KeyManager.keys) {
      const citekey = Zotero.BetterBibTeX.KeyManager.keys.findOne({ itemKey: item.key}) || {}
      item.citationKey = citekey.citekey
      if (item.citationKey) {
        const conflicts = Zotero.BetterBibTeX.KeyManager.keys.find({
          itemKey: { $ne: item.key },
          citekey: item.citationKey,
          libraryID: getLibraryIDFromkey(item.key),
        })
        item.citationKeyConflicts = conflicts.length || ''
      }
    }

    if (item.creators) {
      for (const creator of item.creators) {
        if (typeof creator.name !== 'undefined') continue
        creator.name = `${creator.firstName} ${creator.lastName}`.trim()
      }
    }

    // tag count
    for (const tag of (item.tags || [])) {
      tagCount[tag.tag] = (tagCount[tag.tag] || 0) + 1
    }

    // quality report
    const qualityReport = []
    const nonSpaceWhiteSpace = /[\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u200B\u202F\u205F\u3000\uFEFF]/
    if (!item.creators || !item.creators.length) {
      qualityReport.push('Item has no authors')
    } else {
      const creators = item.creators.filter(creator => creator.name.match(nonSpaceWhiteSpace))
      if (creators.length) qualityReport.push(`Creators with non-space whitespace: ${creators.map(creator => creator.name).join(', ')}`)
    }

    const publicationTitle = {
      field: publicationTitleAlias.find(alias => item[alias]) || 'publicationTitle',
      value: '',
    }
    if (publicationTitle.field) publicationTitle.value = item[publicationTitle.field] || ''
    if (item.journalAbbrev && publicationTitle.value && item.journalAbbrev.length >= publicationTitle.value.length) {
      qualityReport.push(`${fieldName(item.itemType, publicationTitle.field)} is shorter than the journal abbreviation')}`)
    }
    if (publicationTitle.value.indexOf('.') >= 0) {
      qualityReport.push(`${fieldName(item.itemType, publicationTitle.field)} contains a period -- is it a journal abbreviation?`)
    }
    if (qualityReport.length) item.qualityReport = qualityReport

    // optionally single creators field
    const joiner = Zotero.Prefs.get('report-customizer.join-authors')
    if (item.creators && joiner) {
      item.creators = [ { creatorType: item.creators[0].creatorType, name: item.creators.map(creator => creator.name).join(joiner) } ]
    }

    // pre-fetch relations because pug doesn't do async
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

  Zotero.debug('getting report-customizer.config...')
  let serialized = null
  try {
    serialized = Zotero.Prefs.get('report-customizer.config')
  } catch (err) {
    Zotero.logError(`Cannot retrieve report-customizer.config: ${err}`)
  }
  let config = defaults
  if (serialized) {
    try {
      config = JSON.parse(serialized)
    } catch (err) {
      Zotero.logError(`Cannot parse report-customizer.config ${JSON.stringify(serialized)}: ${err}`)
    }
  }
  if (!validate(config)) {
    Zotero.logError(`Config does not conform to schema, resetting: ${validate.errors}`)
    config = defaults
  }
  Zotero.debug(`report-customizer.config: ${JSON.stringify(config)}`)

  const html = report({ defaults, backend, config, fieldName, items, fieldAlias, tagCount })
  if (Zotero.Prefs.get('report-customizer.dump')) {
    saveFile('/tmp/rc-report.html', html)
    saveFile('/tmp/rc-save.html', save)
  }
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
      if (row.fieldName === 'title' && !publicationTitleAlias.includes(row.fieldAlias)) publicationTitleAlias.push(row.fieldAlias)
    }

    Zotero.Report.HTML.listGenerator = listGenerator

    Zotero.Server.Endpoints['/report-customizer'] = class {
      public supportedMethods = ['GET', 'POST']
      public supportedDataTypes = '*'
      public permitBookmarklet = false

      public init(req) {
        switch (req.method) {
          case 'GET':
            return [200, 'text/html', save] // tslint:disable-line:no-magic-numbers

          case 'POST':
            Zotero.debug(`saving report-customizer.config ${JSON.stringify(req.data)}`)

            try {
              if (!validate(req.data)) throw new Error(`Config does not conform to schema, ignoring: ${validate.errors}`)

              Zotero.Prefs.set('report-customizer.config', JSON.stringify(req.data))
              return [200, 'text/plain', 'config saved'] // tslint:disable-line:no-magic-numbers

            } catch (err) {
              Zotero.logError(`error saving report-customizer data: ${err}`)

            }
            return [500, `error saving report-customizer data ${JSON.stringify(req.data)}`, 'text/plain'] // tslint:disable-line:no-magic-numbers

          default:
            return [500, `unexpected method ${req.method}`, 'text/plain'] // tslint:disable-line:no-magic-numbers

        }
      }
    }
  }
}
