function initializePrefs() {
  const XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  var itemTypes = document.getElementById('itemTypes');

  if (itemTypes.childNodes.length == 0) {
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

    for (var type of Zotero.ReportCustomizer.fields().tree) {
      var _type = elt(itemTypes, 'treeitem', {container: 'true'});
      var _type_row = elt(_type, 'treerow');
      var _type_cell = elt(_type_row, 'treecell', {editable: 'false'});
      var _type_cell = elt(_type_row, 'treecell', {editable: 'false', label: type.label});
      var _type_children = elt(_type, 'treechildren');
    
      for (var field of type.fields) {
        var _field = elt(_type_children, 'treeitem');
        var _field_row = elt(_field, 'treerow');
        var _field_cell = elt(_field_row, 'treecell', {'class': field.name + ' checkbox'});
        var _field_cell = elt(_field_row, 'treecell', {editable: 'false', label: field.label});
      }
    }
  }

  for (field of Zotero.ReportCustomizer.fields().fields) {
    var show = Zotero.ReportCustomizer.show(field);
    for (var cb of document.getElementsByClassName(field + ' checkbox')) {
      cb.setAttribute('value', (show ? 'true' : ''));
      // if (!show) { cb.parentNode.parentNode.setAttribute('class', cb.getAttribute('class') + ' hidden') };
    }
  }

  var sortOrder = document.getElementById('sortOrder');
  if (sortOrder.childNodes.length == 0) {
    var fields = [  'title', 'firstCreator', 'date', 'accessed', 'dateAdded', 'dateModified', 'publicationTitle', 'publisher',
                    'itemType', 'series', 'type', 'medium', 'callNumber', 'pages', 'archiveLocation', 'DOI', 'ISBN', 'ISSN',
                    'edition', 'url', 'rights' ];
    var order;
    try {
      order = JSON.parse(Zotero.ReportCustomizer.prefs.getCharPref('sort'));
    } catch (err) {
      order = [ {name: 'title', order: 'a'} ];
    }

    for (field of order) {
      var i = fields.indexOf(field.name);
      if (i > -1) {
        fields.splice(i, 1);
      } else {
        field.invalid = true;
      }
    }
    order = order.filter(function(field) { return !field.invalid; });
    for (field of fields) {
      order.push({name: field});
    }

    for (field of order) {
      if (field.order != 'a' && field.order != 'd') { field.order = 'n'; }
      var _field = elt(sortOrder, 'treeitem');
      var _field_row = elt(_field, 'treerow');
      var label;
      switch (field.name) {
        case 'firstCreator':
          label = 'creatorTypes.author';
          break;

        case 'accessed':
          label = 'itemFields.accessDate';
          break;

        case 'type':
          label = 'itemFields.itemType';
          break;

        default:
          label = 'itemFields.' +field.name;
          break;
      }
      var _field_cell = elt(_field_row, 'treecell', {editable: 'false', label: Zotero.getString(label)});
      var _field_cell = elt(_field_row, 'treecell', {editable: 'false', id: field.name, 'class': 'report-sort-order-' + field.order});
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
  var cls = chkbox.getAttribute('class');
  if (chkbox.getAttribute('editable') != 'false') { 
    var show = (chkbox.getAttribute('value') == 'true');
    for (var cb of document.getElementsByClassName(cls)) {
      cb.setAttribute('value', show ? 'true' : '');
      // item.setAttribute('class', show ? '' : 'hidden');
    }

    Zotero.ReportCustomizer.show(cls.replace( /(?:^|\s)checkbox(?!\S)/g , '' ), show);
  }
}

