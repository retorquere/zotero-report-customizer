alert('hey!);

function setLabels() {
  alert('load');
  // var rc_stringsBundle = document.getElementById('zotero-report-customizer-options');
  var z_stringsBundle = document.getElementById('zotero-options');

  var itemTypes = document.getElementById('itemTypes');
  var field, label, id, checkbox;
  for (field of Object.keys(Zotero.ReportCustomizer.discardableFields)) {
    id = 'id-zotero-report-customizer_remove_' + field;
    label = z_stringsBundle.getString('itemFields.' + field) + ' (' + field + ')';

    var treeItem = document.createElement('treeItem'); itemTypes.appendChild(treeItem);
    treeItem.setAttribute('container', 'true');

    var treeRow = document.createElement('treerow'); treeItem.appendChild(treeRow);
    var treeCell = document.createElement('treecell'); treeRow.appendChild(treeCell);
    treeCell.setAttribute('label', field);
    var treeCell = document.createElement('treecell'); treeRow.appendChild(treeCell);
    treeCell.setAttribute('editable', false);

    var treeChildren = document.createElement('treechildren'); treeItem.appendChild(treeChildren);
    var treeItem = document.createElement('treeItem'); treeChildren.appendChild(treeItem);
    var treeRow = document.createElement('treerow'); treeItem.appendChild(treeRow);
    var treeCell = document.createElement('treecell'); treeRow.appendChild(treeCell);
    treeCell.setAttribute('label', field);
  }
}
