declare const Zotero: any
declare const Components: any

const marker = 'ReportCustomizerMonkeyPatched'

// import TR here
import { ThinReport } from './thin-report'

function patch(object, method, patcher) {
  if (object[method][marker]) return
  object[method] = patcher(object[method])
  object[method][marker] = true
}

export let ReportCustomizer = Zotero.ReportCustomizer || new class { // tslint:disable-line:variable-name
  public idle: boolean = false

  private template: ThinReport

  constructor() {
    window.addEventListener('load', event => {
      this.init().catch(err => Zotero.logError(err))
    }, false)
  }

  private async init() {
    if (this.template) return
    this.template = new ThinReport({})
  }
}
