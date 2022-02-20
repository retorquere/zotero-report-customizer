/* eslint-disable @typescript-eslint/no-unsafe-return, prefer-arrow/prefer-arrow-functions, no-magic-numbers */

declare const Zotero: any
declare const Zotero_Report_Interface: any
declare const ZoteroPane_Local: any

import Ajv from 'ajv'

const backend = `http://127.0.0.1:${Zotero.Prefs.get('httpServer.port')}/report-customizer`
const report = require('./report.pug')
const inline = {
  js: {
    report: require('!!inline-ts!./report.ts'),
  },
  css: {
    detail: require('./detail.css'),
    detail_screen: require('./detail_screen.css'),
    detail_print: require('./detail_print.css'),
    material: require('../gen/materialdesignicons.css'),
  },
  font: {
    material: require('@mdi/font/fonts/materialdesignicons-webfont.woff2'),
  },
}
const save = require('./save.pug')({ backend })

function debug(...msg) {
  const txt: string[] = []
  let error: string
  for (const m of msg) {
    if (m instanceof Error) {
      if (error) {
        txt.push(`Error<${m.message}>`)
      }
      else {
        error = `${m.message}\n${m.stack}`.trim()
      }
    }
    else if (typeof m === 'string') {
      txt.push(m)
    }
    else {
      try {
        txt.push(JSON.stringify(m))
      }
      catch (err) {
        txt.push(`${m}`)
      }
    }
  }
  if (error) txt.push(error)
  Zotero.debug(`{zotero-report-customizer} ${txt.join(' ').trim()}`)
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
  for (const [libraryID, keys] of Object.entries(Zotero.Items._objectIDs as Record<string, Record<string, any>>)) { // eslint-disable-line no-underscore-dangle
    if (keys[key]) return parseInt(libraryID)
  }
  return undefined
}

function normalizeDate(str) {
  if (!str) return ''

  if (Zotero.Date.isMultipart(str)) return Zotero.Date.multipartToSQL(str)

  const date: { month?: number | string, day?: number | string, year?: number } = Zotero.Date.strToDate(str)
  if (typeof date.month === 'number') date.month = `0${date.month + 1}`.slice(-2)
  if (typeof date.day === 'number') date.day = `0${date.day}`.slice(-2)

  if (date.day) return `${date.year}-${date.month}-${date.day}`
  if (date.month) return `${date.year}-${date.month}`
  if (date.year) return `${date.year}`
  return ''
}

const schema = require('./report-config-schema.json')
const ajv = new Ajv({allErrors: true})
const validate = ajv.compile(schema)
const defaults = require('json-schema-defaults')(schema)

const pending = 'ReportCustomizer: Zotero is still loading, please try again later.'

Zotero.Report.HTML.listGenerator = function*(_items, _combineChildItems) {
  yield pending
}

Zotero.ReportCustomizer = Zotero.ReportCustomizer || new class {
  public bibliography: { [key: string]: string } = {}

  private initialized = false

  constructor() {
    debug('loading')
    window.addEventListener('load', _event => {
      this.init().catch(err => debug(err))
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
    debug('initializing')

    Zotero.Report.HTML.listGenerator = this.listGenerator.bind(this)

    // await Zotero.Schema.initializationPromise
    await Zotero.Schema.schemaUpdatePromise

    const defaultFieldOrderEnd = ['selectLink', 'dateAdded', 'dateModified']
    for (const row of (await Zotero.DB.queryAsync(fields)) as { typeName: string, fieldName: string, fieldAlias: string }[]) {
      fieldAlias[`${row.typeName}.${row.fieldAlias}`] = row.fieldName
      if (row.fieldName === 'title' && !publicationTitleAlias.includes(row.fieldAlias)) publicationTitleAlias.push(row.fieldAlias)

      if (!defaultFieldOrder.includes(row.fieldName) && !defaultFieldOrderEnd.includes(row.fieldName)) defaultFieldOrder.push(row.fieldName)
    }
    for (const field of defaultFieldOrderEnd) {
      defaultFieldOrder.push(field)
    }
    defaults.fields.order = defaultFieldOrder.slice()
    debug(`defaults.fields = ${JSON.stringify(defaults.fields)}`)

    Zotero.Server.Endpoints['/report-customizer'] = class {
      public supportedMethods = ['GET', 'POST']
      public supportedDataTypes = ['application/json']
      public permitBookmarklet = false

      public init(req) {
        switch (req.method) {
          case 'GET':
            return [200, 'text/html', save]

          case 'POST':
            debug(`saving report-customizer.config ${JSON.stringify(req.data)}`)

            try {
              if (!validate(req.data)) throw new Error(`Config does not conform to schema, ignoring: ${validate.errors}`)

              Zotero.Prefs.set('report-customizer.config', JSON.stringify(req.data))
              return [200, 'text/plain', 'config saved']
            }
            catch (err) {
              debug('error saving report-customizer data:', err)
            }
            return [500, `error saving report-customizer data ${JSON.stringify(req.data)}`, 'text/plain']

          default:
            return [500, `unexpected method ${req.method}`, 'text/plain']

        }
      }
    }
  }

  public load() {
    try {
      return JSON.parse(Zotero.Prefs.get('report-customizer.config') as string)
    }
    catch (err) {
      debug('report-customizer.load:', err)
      return defaults
    }
  }

  public save(config) {
    Zotero.Prefs.set('report-customizer.config', JSON.stringify(config))
  }

  public *listGenerator(items, _combineChildItems) {
    if (Zotero.Schema.schemaUpdatePromise.isPending()) {
      yield pending
      return
    }

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
        }
        catch (err) {
          debug(`Localized string not available for '${id}'`)
          fieldNames[id] = ''
        }
      }
      return fieldNames[id]
    }

    const bibliography = Zotero.Prefs.get('report-customizer.bibliography') ? this.bibliography : {}

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
      }
      else {
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
      }
      else {
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

        const item_relations = []
        for (const relation of relations) {
          const item_relation = yield Zotero.URI.getURIItem(relation)
          if (item_relation) item_relations.push({ key: item_relation.key, title: item_relation.getDisplayTitle() })
        }
        item.relations = item_relations.length ? item_relations : null

      }
      else {
        item.relations = null

      }
    }

    debug('getting report-customizer.config...')
    let serialized: string = null
    try {
      serialized = Zotero.Prefs.get('report-customizer.config')
    }
    catch (err) {
      debug('Cannot retrieve report-customizer.config:', err)
    }
    let config = defaults
    if (serialized) {
      try {
        config = JSON.parse(serialized)
      }
      catch (err) {
        debug(`Cannot parse report-customizer.config ${JSON.stringify(serialized)}:`, err)
      }
    }
    if (!validate(config)) {
      debug(`Config does not conform to schema, resetting: ${validate.errors}`)
      config = defaults
    }
    debug(`report-customizer.config: ${JSON.stringify(config)}`)

    for (const field of defaultFieldOrder) {
      if (!config.fields.order.includes(field)) config.fields.order.push(field)
    }
    debug(`fieldOrder: ${defaultFieldOrder.join(',')} vs ${config.fields.order.join(',')}`)

    // Zotero doesn't save the document as it is displayed... make it so that the default load is as displayed... oy.
    if (config.items.sort) {
      const sort: string = config.items.sort.replace(/^-/, '')
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

    const mathJax = Zotero.Prefs.get('report-customizer.MathJax')
    const saved = this.load()
    const html = report({ inline, saved, defaults, backend, mathJax, fieldName, items, fieldAlias, tagCount, normalizeDate })
    // if (Zotero.Prefs.get('report-customizer.dump'))
    debug(`report-customizer-report:\n${html}`)
    debug(`report-customizer-save:\n${save}`)
    yield html
  }
}

patch(Zotero_Report_Interface, 'loadCollectionReport', original => function loadCollectionReport(event) {
  try {
    let source = null
    let items = []

    if (source = ZoteroPane_Local.getSelectedCollection()) {
      items = source.getChildItems()

    }
    else if (source = ZoteroPane_Local.getSelectedSavedSearch()) {
      items = ZoteroPane_Local.getSortedItems()
    }
    else {
      items = []
    }

    Zotero.ReportCustomizer.get_bibliography(items)
  }
  catch (err) {
    debug(err)
  }

  return original(event)
})

patch(Zotero_Report_Interface, 'loadItemReport', original => function loadItemReport(event) {
  try {
    Zotero.ReportCustomizer.get_bibliography(ZoteroPane_Local.getSelectedItems() || [])
  }
  catch (err) {
    debug(err)
  }

  return original(event)
})
