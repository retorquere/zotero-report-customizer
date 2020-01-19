declare const Zotero: any
declare const Zotero_Report_Interface: any
declare const ZoteroPane_Local: any

import Ajv = require('ajv')

const backend = `http://127.0.0.1:${Zotero.Prefs.get('httpServer.port')}/report-customizer`
const report = require('./report.pug')
const save = require('./save.pug')({ backend })

function debug(msg) {
  Zotero.debug(`{zotero-report-customizer} ${msg}`)
}

const marker = 'ReportCustomizerMonkeyPatched'

function patch(object, method, patcher) {
  debug(`patching ${method}`)
  if (object[method][marker]) return
  object[method] = patcher(object[method])
  object[method][marker] = true
}

const fields = `
  SELECT DISTINCT it.typeName, COALESCE(bf.fieldName, f.fieldName) as fieldName, CASE WHEN bf.fieldName IS NULL THEN NULL ELSE f.fieldName END as fieldAlias
  FROM itemTypes it
  JOIN itemTypeFields itf ON it.itemTypeID = itf.itemTypeID
  JOIN fields f ON f.fieldID = itf.fieldID
  LEFT JOIN baseFieldMappingsCombined bfmc ON it.itemTypeID = bfmc.itemTypeID AND f.fieldID = bfmc.fieldID
  LEFT JOIN fields bf ON bf.fieldID = bfmc.baseFieldID
  ORDER BY itf.orderIndex
`.replace(/\n/g, ' ').trim()
const fieldAlias: { [key: string]: string } = {}
const defaultFieldOrder: string[] = ['itemType', 'citationKey', 'citationKeyConflicts', 'bibliography', 'creator']
const publicationTitleAlias: string[] = []

function getLibraryIDFromkey(key) {
  for (const [libraryID, keys] of Object.entries(Zotero.Items._objectIDs)) {
    if (keys[key]) return parseInt(libraryID)
  }
  return undefined
}

function normalizeDate(str) {
  if (!str) return ''

  if (Zotero.Date.isMultipart(str)) return Zotero.Date.multipartToSQL(str)

  const date = Zotero.Date.strToDate(str)
  if (date.month) date.month = `0${date.month + 1}`.slice(-2) // tslint:disable-line:no-magic-numbers
  if (date.day) date.day = `0${date.day}`.slice(-2) // tslint:disable-line:no-magic-numbers

  if (date.day) return `${date.year}-${date.month}-${date.day}`
  if (date.month) return `${date.year}-${date.month}`
  if (date.year) return `${date.year}`
  return ''
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
        case 'bibliography':
          return 'Bibliography'
      }
    }

    const id = `${itemType}.${field}`
    if (typeof fieldNames[id] === 'undefined') {
      try {
        fieldNames[id] = Zotero.ItemFields.getLocalizedString(field) || ''
      } catch (err) {
        debug(`Localized string not available for '${id}'`)
        fieldNames[id] = ''
      }
    }
    return fieldNames[id]
  }

  const bibliography = Zotero.Prefs.get('report-customizer.bibliography') ? Zotero.ReportCustomizer.bibliography : {}

  debug(`listGenerator.bibliography = ${JSON.stringify(bibliography, null, 2)}`)

  const tagCount: { [key: string]: number } = {}
  for (const item of items) {
    if (item.tags) {
      // tag count
      item.tags.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' }))
      for (const tag of item.tags) {
        tagCount[tag.tag] = (tagCount[tag.tag] || 0) + 1
      }
    }

    if (item.itemType === 'attachment' || item.itemType === 'note') continue

    // citation key
    if (Zotero.BetterBibTeX && Zotero.BetterBibTeX.KeyManager.keys) {
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

    } else {
      if (item.extra) {
        item.extra = item.extra.replace(/(?:^|\n)citation key\s*:\s*([^\s]+)(?:\n|$)/i, (m, citationKey) => {
          item.citationKey = citationKey
          return '\n'
        }).trim()
      }
    }

    if (item.key) item.bibliography = bibliography[item.key]

    debug(JSON.stringify(item, null, 2))

    if (item.creators) {
      for (const creator of item.creators) {
        if (typeof creator.name !== 'undefined') continue
        creator.name = `${creator.firstName} ${creator.lastName}`.trim()
      }
    }

    if (item.attachments) {
      item.attachments.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
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

  debug('getting report-customizer.config...')
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
  debug(`report-customizer.config: ${JSON.stringify(config)}`)

  for (const field of defaultFieldOrder) {
    if (!config.fields.order.includes(field)) config.fields.order.push(field)
  }
  debug(`fieldOrder: ${defaultFieldOrder.join(',')} vs ${config.fields.order.join(',')}`)

  // Zotero doesn't save the document as it is displayed... make it so that the default load is as displayed... oy.
  if (config.items.sort) {
    const sort = config.items.sort.replace(/^-/, '')
    const order = config.items.sort[0] === '-' ? 1 : 0
    const onISODate = ['accessDate', 'dateAdded', 'dateModified'].includes(sort)
    items.sort((a, b) => {
      const t = [a, b].map(item => {
        if (!item[sort]) return '\u10FFFF' // maximum unicode codepoint, will put this item last in sort
        if (sort === 'creator' && !item.creators.length) return '\u10FFFF'
        if (onISODate) return item[sort].replace(/T.*/, '')
        if (sort === 'date') return normalizeDate(item[sort])
        return item[sort]
      })

      return t[order].localeCompare(t[1 - order])
    })
  }

  // tslint:disable-next-line:variable-name
  const html = report({ MathJax: Zotero.Prefs.get('report-customizer.MathJax'), defaults, backend, config, fieldName, items, fieldAlias, tagCount, normalizeDate })
  if (Zotero.Prefs.get('report-customizer.dump')) {
    debug(`report-customizer-save:\n${save}`)
    debug(`report-customizer-report:\n${html}`)
  }
  yield html
}

const ReportCustomizer = Zotero.ReportCustomizer || new class { // tslint:disable-line:variable-name
  public bibliography: { [key: string]: string } = {}

  private initialized: boolean = false

  constructor() {
    window.addEventListener('load', event => {
      this.init().catch(err => Zotero.logError(err))
    }, false)
  }

  public get_bibliography(items) {
    this.bibliography = {}

    if (!Zotero.Prefs.get('report-customizer.bibliography')) return

    debug(`get bibliography for ${items.length} items`)

    const format = Zotero.Prefs.get('export.quickCopy.setting')

    for (const item of items) {
      this.bibliography[item.key] = Zotero.QuickCopy.getContentFromItems([item], format, null, false).text
    }
    debug(JSON.stringify(this.bibliography, null, 2))
  }

  private async init() {
    if (this.initialized) return
    this.initialized = true

    // await Zotero.Schema.initializationPromise
    await Zotero.Schema.schemaUpdatePromise

    const defaultFieldOrderEnd = ['selectLink', 'dateAdded', 'dateModified']
    for (const row of await Zotero.DB.queryAsync(fields)) {
      fieldAlias[`${row.typeName}.${row.fieldAlias}`] = row.fieldName
      if (row.fieldName === 'title' && !publicationTitleAlias.includes(row.fieldAlias)) publicationTitleAlias.push(row.fieldAlias)

      if (!defaultFieldOrder.includes(row.fieldName) && !defaultFieldOrderEnd.includes(row.fieldName)) defaultFieldOrder.push(row.fieldName)
    }
    for (const field of defaultFieldOrderEnd) {
      defaultFieldOrder.push(field)
    }
    defaults.fields.order = defaultFieldOrder.slice()
    debug(`defaults.fields = ${JSON.stringify(defaults.fields)}`)

    Zotero.Report.HTML.listGenerator = listGenerator

    Zotero.Server.Endpoints['/report-customizer'] = class {
      public supportedMethods = ['GET', 'POST']
      public supportedDataTypes = ['application/json']
      public permitBookmarklet = false

      public init(req) {
        switch (req.method) {
          case 'GET':
            return [200, 'text/html', save] // tslint:disable-line:no-magic-numbers

          case 'POST':
            debug(`saving report-customizer.config ${JSON.stringify(req.data)}`)

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

export = ReportCustomizer

// otherwise this entry point won't be reloaded: https://github.com/webpack/webpack/issues/156
delete require.cache[module.id]

patch(Zotero_Report_Interface, 'loadCollectionReport', original => function loadCollectionReport(event) {
  try {
    let source = null
    let items = []

    if (source = ZoteroPane_Local.getSelectedCollection()) {
      items = source.getChildItems()

    } else if (source = ZoteroPane_Local.getSelectedSavedSearch()) {
      items = ZoteroPane_Local.getSortedItems()

    } else {
      items = []

    }

    ReportCustomizer.get_bibliography(items)
  } catch (err) {
    Zotero.logError(err)
  }

  return original(event)
})

patch(Zotero_Report_Interface, 'loadItemReport', original => function loadItemReport(event) {
  try {
    ReportCustomizer.get_bibliography(ZoteroPane_Local.getSelectedItems() || [])

  } catch (err) {
    Zotero.logError(err)
  }

  return original(event)
})
