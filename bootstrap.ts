/* eslint-disable prefer-arrow/prefer-arrow-functions, no-var, @typescript-eslint/no-unused-vars, no-caller, @typescript-eslint/explicit-module-boundary-types */

declare namespace Zotero {
  let ReportCustomizer: ReportCustomizer
}

import { MenuManager } from 'zotero-plugin-toolkit'
import { DebugLog } from 'zotero-plugin/debug-log'
const Menu = new MenuManager()

declare const dump: (msg: string) => void
declare const Components: any
declare const ChromeUtils: any
declare var Services: any

/*
const {
  interfaces: Ci,
  results: Cr,
  utils: Cu,
  Constructor: Cc,
} = Components
*/

class ReportCustomizer {
  public alert(text: string, title?: string): void {
    Services.prompt.alert(null, title || 'Alert', text)
  }

  public launchDesigner(): void {
    // @ts-expect-error TS2339
    const window = Zotero.getMainWindow()
    window.openDialog('chrome://report-customizer/content/designer.xhtml', '_blank', 'chrome,centerscreen,modal', {})
  }

  public log(msg: string): void {
    // @ts-expect-error TS2339
    Zotero.debug(`report-customizer: ${msg}`)
  }

  public dataSource
}

export function install() {
  // nothing to do
}

let chromeHandle
export async function startup({ id, version, resourceURI, rootURI = resourceURI.spec }) {
  const aomStartup = Cc['@mozilla.org/addons/addon-manager-startup;1'].getService(Ci.amIAddonManagerStartup)
  const manifestURI = Services.io.newURI(`${rootURI}manifest.json`)
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ['content', 'report-customizer', 'content/'],
    ['locale', 'report-customizer', 'en-US', 'locale/en-US/'],
  ])

  Zotero.ReportCustomizer = new ReportCustomizer()
  Zotero.ReportCustomizer.log('startup')

  // @ts-expect-error TS2339
  const doc = Zotero.getMainWindow().document
  if (!doc.querySelector('#better-bibtex-menuHelp')) {
    Menu.register('menuTools', {
      id: 'report-customizer-menuTools',
      tag: 'menuitem',
      label: 'Report customizer',
      oncommand: 'Zotero.ReportCustomizer.launchDesigner()',
    })
  }

  DebugLog.register('Report customizer')
}

export function shutdown() {
  delete Zotero.ReportCustomizer
  DebugLog.unregister('Report customizer')
  if (typeof chromeHandle !== 'undefined') {
    chromeHandle.destruct()
    chromeHandle = undefined
  }
}

export function uninstall() {
  // nothing to do
}
