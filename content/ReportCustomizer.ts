declare const Zotero: any
declare const window: any

import mime = require('mime-types')

const ReportCustomizer = new class { // tslint:disable-line:variable-name
  private template: string

  constructor() {
    window.addEventListener('load', e => { this.load() }, false)
  }

  public openPreferenceWindow(pane, action) {
    window.openDialog(
      'chrome://zotero-report-customizer/content/Configure.xul',
      'zotero-report-customizer-options',
      `chrome,titlebar,toolbar,centerscreen${Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal'}`,
      { pane, action }
    )
  }

  public get() {
    try {
      this.template = Zotero.Prefs.get('report-customizer.template')
    } catch (err) {
      this.log('failed to load template', err)
      this.template = ''
    }

    if (!this.template) {
      this.template = Zotero.File.getContentsFromURL('resource://zotero-report-customizer/template.html')
    }
    return this.template
  }

  public set(template) {
    this.template = template
    return Zotero.Prefs.set('report-customizer.template', template)
  }

  public log(...msg) {
    const result = []
    for (const m of msg) {
      if (typeof m === 'number' || typeof m === 'string' || m instanceof String) result.push(`${m}`)

      else if (Array.isArray(m)) result.push(JSON.stringify(m))

      else if (typeof m === 'object' && m.name && m.fileName) result.push(`${m.name}: ${m.message} \n(${m.fileName}, ${m.lineNumber})\n${m.stack}`)

      else if (m instanceof Error) result.push(`${m}\n${m.stack}`)

      else result.push(JSON.stringify(m))
    }
    Zotero.debug(`[report-customizer] ${result.join(' ')}`)
  }

  private async load() {
    this.log('starting')
  }
}

function install_url_handler(resource) {
  Zotero.Server.Endpoints[`/report-customizer/${resource}`] = class {
    public supportedMethods = ['GET']
    public OK = 200
    public SERVER_ERROR = 500

    public async init(request) {
      try {
        return [200, mime.lookup(resource) || 'application/octet-stream', Zotero.File.getContentsFromURL(`resource://zotero-report-customizer/${resource}`)] // tslint:disable-line:no-magic-numbers
      } catch (err) {
        ReportCustomizer.log(`could not serve URL ${resource}`, err)
        return [500, 'application/text', `RC failed: ${err}\n${err.stack}`] // tslint:disable-line:no-magic-numbers
      }
    }
  }
}
for (const resource of [
  'index.html',
  'zotero-z-32px-australis-unix.svg',
  'token/lang/en.js',
  'token/lang/ru.js',
  'token/plugin.js',
  'token/dialogs/token.js',
]) {
  install_url_handler(resource)
}

export = ReportCustomizer
