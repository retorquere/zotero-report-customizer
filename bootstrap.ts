/* eslint-disable prefer-arrow/prefer-arrow-functions, no-var, @typescript-eslint/no-unused-vars, no-caller, @typescript-eslint/explicit-module-boundary-types */

import { DebugLog } from 'zotero-plugin/debug-log'

declare const dump: (msg: string) => void
declare const Components: any
declare const ChromeUtils: any
declare var Services: any
const {
  interfaces: Ci,
  results: Cr,
  utils: Cu,
  Constructor: Cc,
} = Components

if (typeof Zotero == 'undefined') {
  var Zotero
}

function log(msg) {
  Zotero.debug(`Debug Log for Zotero: ${msg}`)
}

// In Zotero 6, bootstrap methods are called before Zotero is initialized, and using include.js
// to get the Zotero XPCOM service would risk breaking Zotero startup. Instead, wait for the main
// Zotero window to open and get the Zotero object from there.
//
// In Zotero 7, bootstrap methods are not called until Zotero is initialized, and the 'Zotero' is
// automatically made available.
async function waitForZotero() {
  if (typeof Zotero != 'undefined') {
    await Zotero.initializationPromise
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-shadow
  var { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm')
  var windows = Services.wm.getEnumerator('navigator:browser')
  var found = false
  while (windows.hasMoreElements()) {
    const win = windows.getNext()
    if (win.Zotero) {
      Zotero = win.Zotero
      found = true
      break
    }
  }
  if (!found) {
    await new Promise(resolve => {
      var listener = {
        onOpenWindow(aWindow) {
          // Wait for the window to finish loading
          const domWindow = aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowInternal || Components.interfaces.nsIDOMWindow)
          domWindow.addEventListener('load', function() {
            domWindow.removeEventListener('load', arguments.callee, false)
            if (domWindow.Zotero) {
              Services.wm.removeListener(listener)
              Zotero = domWindow.Zotero
              resolve(undefined)
            }
          }, false)
        },
      }
      Services.wm.addListener(listener)
    })
  }
  await Zotero.initializationPromise
}

export function install() {
  // nothing to do
}

function writer(dir: any, name: string): (m: string) => void {
  const file = dir.clone()
  file.append(name)
  log(`logging to ${file.path}`)
  const rawStream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream)
  log('have raw stream')
  rawStream.init(file, 0x02 | 0x08 | 0x20, 0o664, 0) // eslint-disable-line no-bitwise
  log('raw stream init')
  const outputStream = Components.classes['@mozilla.org/intl/converter-output-stream;1'].createInstance(Components.interfaces.nsIConverterOutputStream)
  log('have output stream')
  outputStream.init(rawStream, 'UTF-8', 1024, '?'.charCodeAt(0))
  log('output stream init')

  return (m: string) => {
    if (!m.match(/\r?\n$/)) m += '\n'
    outputStream.writeString(m)
  }
}

let logwriter: ReturnType<typeof writer>

export async function startup({ id, version, resourceURI, rootURI = resourceURI.spec }) {
  await waitForZotero()

  const env = Components.classes['@mozilla.org/process/environment;1'].getService(Components.interfaces.nsIEnvironment)
  let path = env.get('ZOTERO_DEBUG_LOG')
  log(`log enabled? ${!!path}`)

  if (path === '.') {
    const dirService = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties)
    const cwd = dirService.get('CurWorkD', Components.interfaces.nsIFile)
    path = cwd.path
  }

  if (path) {
    const dir = Zotero.File.pathToFile(path)
    if (!dir.isDirectory()) {
      log(`${JSON.stringify(path)} is not a directory, log-writer disabled`)
    }
    else {
      log(`logging to ${path}`)
      const start = new Date()
      const logname = `zotero-${new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().replace('Z', '').replace(/:/g, '.')}.txt`
      logwriter = writer(dir, logname)
      Zotero.Debug.addListener(logwriter)
    }
  }

  log('registering')
  try {
    DebugLog.register('Debug Log')
  }
  catch (err) {
    log(`registering failed ${err}`)
  }
}

export function shutdown() {
  DebugLog.unregister('Debug Log')
  if (logwriter) {
    Zotero.Debug.removeListener(logwriter)
    logwriter = null
  }
}

export function uninstall() {
  // nothing to do
}
