// vim: set expandtab
// vim: set ts=2

function applyAttributes(node, attrs) {
  if (attrs) {
    for (var key in attrs){
      if (attrs.hasOwnProperty(key)) {
        node.setAttribute(key, attrs[key]);
      }
    }
  }
}

function saveSortOrder() {
  var sortOrder = document.getElementById('sortOrder');
  var save = [];
  for (field of sortOrder.getElementsByTagName('listitem')) {
    var rec = {name: field.getAttribute('id')};
    switch (field.getAttribute('class')) {
      case 'report-sort-order-a':
        rec.order = 'a';
        break;
      case 'report-sort-order-d':
        rec.order = 'd';
        break;
    }
    save.push(rec);
  }

  Zotero.ReportCustomizer.prefs.setCharPref('sort', JSON.stringify(save));
}

function initializePrefs() {
  const XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

  var itemTypes = document.getElementById('itemTypes');

  if (itemTypes.childNodes.length == 0) {
    function elt(host, name, attrs) {
      var node = document.createElementNS(XUL, name);
      applyAttributes(node, attrs);
      host.appendChild(node);
      return node;
    }

    for (var type of Zotero.ReportCustomizer.fields().tree) {
      var _type = elt(itemTypes, 'treeitem', {container: 'true'});
      var _type_row = elt(_type, 'treerow');
      var _type_cell = elt(_type_row, 'treecell', {properties: 'not-editable', editable: 'false'});
      var _type_cell = elt(_type_row, 'treecell', {editable: 'false', label: type.label});
      var _type_children = elt(_type, 'treechildren');
    
      for (var field of type.fields) {
        var _field = elt(_type_children, 'treeitem');
        var _field_row = elt(_field, 'treerow');
        var _field_cell = elt(_field_row, 'treecell', {'class': field.name + ' checkbox'});
        var _field_cell = elt(_field_row, 'treecell', {editable: 'false', label: field.label});
      }
    }

    var fields = [  'title', 'firstCreator', 'date', 'accessed', 'dateAdded', 'dateModified', 'publicationTitle', 'publisher',
                    'itemType', 'series', 'type', 'medium', 'callNumber', 'pages', 'archiveLocation', 'DOI', 'ISBN', 'ISSN',
                    'edition', 'url', 'rights' ];
    // load stored order
    var order;
    try {
      order = JSON.parse(Zotero.ReportCustomizer.prefs.getCharPref('sort'));
    } catch (err) {
      order = [ ];
    }

    // kick out non-existing fields and remove already-ordered fields from the "fields" array
    for (field of order) {
      var i = fields.indexOf(field.name);
      if (i > -1) {
        fields.splice(i, 1);
      } else {
        field.invalid = true;
      }
    }
    order = order.filter(function(field) { return !field.invalid; });

    // add the non-ordered fields
    for (field of fields) {
      order.push({name: field});
    }

    var droppable = {
      droppable:    'true',
      ondragstart:  'return ReportSort_onDragStart(event)',
      ondragover:   'return ReportSort_onDragOver(event)',
      ondrop:       'return ReportSort_onDrop(event)'
    }
    var sortOrder = document.getElementById('sortOrder');
    sortOrder.setAttribute('allowevents', 'true');
    applyAttributes(droppable);

    sortOrder.addEventListener("click", function(event) {
      var target = event.target;
      while (target && target.localName != "listitem") { target = target.parentNode; }
      if (!target) { return; }

      var order = null;
      switch (target.getAttribute('class')) {
        case 'report-sort-order-a':
          target.setAttribute('class', 'report-sort-order-d');
          break;
        case 'report-sort-order-d':
          target.removeAttribute('class');
          break;
        default:
          target.setAttribute('class', 'report-sort-order-a');
      }
      saveSortOrder();
    }, false);

    for (field of order) {
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
      label = Zotero.getString(label);

      var attrs = {id: field.name, label: label, draggable: 'true'};
      if (field.order == 'a' || field.order == 'd') { attrs['class'] = 'report-sort-order-' + field.order; }
      var _field = elt(sortOrder, 'listitem', attrs);
      applyAttributes(_field, droppable);
    }
  }

  for (field of Zotero.ReportCustomizer.fields().fields) {
    var show = Zotero.ReportCustomizer.show(field);
    for (var cb of document.getElementsByClassName(field + ' checkbox')) {
      cb.setAttribute('value', (show ? 'true' : ''));
      // if (!show) { cb.parentNode.parentNode.setAttribute('class', cb.getAttribute('class') + ' hidden') };
    }
  }
}

function toggleShowField(tree, event) {
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

function ReportSort_onDragStart(event) {
  var target = event.target;
  while (target && target.localName != "listitem") { target = target.parentNode; }
  if (!target) { return; }
  event.dataTransfer.setData('text/plain', 'sortkey:' + target.getAttribute('id'));
  event.dataTransfer.effectAllowed = 'move';
}
function ReportSort_onDragOver(event) {
  event.preventDefault();
  var moved = event.dataTransfer.mozGetDataAt('text/plain', 0);
  if (moved.indexOf('sortkey:') == 0) { return false; }
}
function ReportSort_onDrop(event) {
  var moved = event.dataTransfer.mozGetDataAt('text/plain', 0);
  if (moved.indexOf('sortkey:') != 0) { return; }
  moved = moved.split(':')[1];
  moved = document.getElementById(moved);

  var target = event.target;
  if (target.nodeName.toLowerCase() == 'listbox') {
    target.appendChild(moved);
  } else {
    target.parentNode.insertBefore(moved, target.nextSibling);
  }
  event.preventDefault();
  saveSortOrder();
}
