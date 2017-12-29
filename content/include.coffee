# Only create main object once
unless Zotero.ReportCustomizer
  loader = Components.classes['@mozilla.org/moz/jssubscript-loader;1'].getService(Components.interfaces.mozIJSSubScriptLoader)
  loader.loadSubScript('chrome://zotero-report-customizer/content/zotero-report-customizer.js')
  loader.loadSubScript('chrome://zotero-report-customizer/content/report.js')
