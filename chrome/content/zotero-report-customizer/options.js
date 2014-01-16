function initializePrefs() {
  const XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  var itemTypes = document.getElementById('itemTypes');

  if (itemTypes.childNodes.length == 0) {
    console.log('building prefs');
    function elt(host, name, attrs) {
      var node = document.createElementNS(XUL, name);
      if (attrs) {
        for (var key in attrs){
          if (attrs.hasOwnProperty(key)) {
            node.setAttribute(key, attrs[key]);
          }
        }
      }
      host.appendChild(node);
      return node;
    }

    var itemType = Zotero.getString('itemFields.itemType');
    for (var type of Zotero.ReportCustomizer.fields().tree) {
      var _type = elt(itemTypes, 'treeitem', {container: 'true'});
      var _type_row = elt(_type, 'treerow');
      var _type_cell = elt(_type_row, 'treecell', {editable: 'false'});
      var _type_cell = elt(_type_row, 'treecell', {editable: 'false', label: type.label});
      var _type_children = elt(_type, 'treechildren');
    
      var _field = elt(_type_children, 'treeitem');
      var _field_row = elt(_field, 'treerow');
      var _field_cell = elt(_field_row, 'treecell', {'class': 'itemType checkbox'});
      var _field_cell = elt(_field_row, 'treecell', {editable: 'false', label: itemType});
    
      for (var field of type.fields) {
        var _field = elt(_type_children, 'treeitem');
        var _field_row = elt(_field, 'treerow');
        var _field_cell = elt(_field_row, 'treecell', {'class': field.name + ' checkbox'});
        var _field_cell = elt(_field_row, 'treecell', {editable: 'false', label: field.name});
      }

      var preferences = document.getElementById('preferences');
      for (field of Zotero.ReportCustomizer.fields().fields) {
        elt(preferences, 'preference', {id: 'pref-zotero-report-customizer-show-' + field, name: 'extensions.zotero-report-customizer.show.' + field, type: 'bool'});
      }
    }
  }

  for (field of Zotero.ReportCustomizer.fields().fields) {
    var show = Zotero.ReportCustomizer.show(field);
    for (var cb of document.getElementsByClassName('checkbox')) {
      cb.setAttribute('value', (show ? 'true' : 'false'));
    }
  }
}

function togglePref(tree, event) {
  var row;
  if (event) {
    row = tree.treeBoxObject.getRowAt(event.clientX, event.clientY);
  } else {
    row = tree.currentIndex;
  }

  var item = tree.contentView.getItemAtIndex(row); 
  var chkbox = item.firstChild.firstChild; 
  if (chkbox.getAttribute('editable') != 'false') { 
    var show = (chkbox.getAttribute('value') == 'true');
    var cls = chkbox.getAttribute('class');
    for (var cb of document.getElementsByClassName(cls)) {
      cb.setAttribute('value', (show ? 'true' : 'false'));
    }

    Zotero.ReportCustomizer.show(cls = (' ' + cls + ' ').replace(' checkbox ').trim(), show);
  } 
}

