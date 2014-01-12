// Only create main object once
if (!Zotero.ReportCustomizer) {
	let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
	loader.loadSubScript("chrome://zotero-report-customizer/content/report.js");
	loader.loadSubScript("chrome://zotero-report-customizer/content/zotero-report-customizer.js");
}
