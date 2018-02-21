// declare const document: any
// declare const window: any
declare const Zotero: any

export = new class Configure {
  public load() {
    Zotero.ReportCustomizer.get()
  }
}

// otherwise this entry point won't be reloaded: https://github.com/webpack/webpack/issues/156
delete require.cache[module.id]
