function setLabels() {
  // var rc_stringsBundle = document.getElementById('zotero-report-customizer-options');
  var z_stringsBundle = document.getElementById('zotero-options');

  var field, label, id, checkbox;
  for (field of Object.keys(Zotero.ReportCustomizer.discardableFields)) {
    id = 'id-zotero-report-customizer_remove_' + field;
    label = z_stringsBundle.getString('itemFields.' + field) + ' (' + field + ')';
    console.log('report: ' + field + ': ' + label);
    checkbox = document.getElementById(id);
    checkbox.setAttribute('label', label);
  }
}
