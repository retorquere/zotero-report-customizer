Array.prototype.collect = function(transform)
{
  "use strict";
  var result = [];

  if (this === void 0 || this === null) throw new TypeError();

  var t = Object(this);
  var len = t.length >>> 0;
  if (typeof transform !== "function") throw new TypeError();
  var thisArg = void 0;

  for (var i = 0; i < len; i++) {
    if (i in t) result.push(transform.call(thisArg, t[i]));
  }

  return result;
}

function setLabels() {
  const XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  // var rc_stringsBundle = document.getElementById('zotero-report-customizer-options');
  var z_stringsBundle = document.getElementById('zotero-options');

  var itemTypes = document.getElementById('itemTypes');

  console.log('setLabels: itemType = ' + itemTypes);

  var collation = Zotero.getLocaleCollation();
  var t = Zotero.ItemTypes.getSecondaryTypes();
  var types = [];
  for (var i=0; i<t.length; i++) {
    types.push({ id: t[i].id, name: t[i].name, localized: Zotero.ItemTypes.getLocalizedString(t[i].id) });
  }
  types.sort(function(a, b) { return collation.compareString(1, a.localized, b.localized); });
  
  for (var type of types) {
    var treeItem = document.createElementNS(XUL, 'treeitem'); itemTypes.appendChild(treeItem);
    treeItem.setAttribute('container', 'true');

    // Zotero.getString('itemFields.itemType')
    // Zotero.ItemTypes.getLocalizedString(type.itemType)

    console.log(type.localized);

    var treeRow = document.createElementNS(XUL, 'treerow'); treeItem.appendChild(treeRow);
    var treeCell = document.createElementNS(XUL, 'treecell'); treeRow.appendChild(treeCell);
    treeCell.setAttribute('editable', false);
    var treeCell = document.createElementNS(XUL, 'treecell'); treeRow.appendChild(treeCell);
    treeCell.setAttribute('label', type.localized);

    var fields = Zotero.ItemFields.getItemTypeFields(type.id);
    for each(var field in fields) {
      // label = z_stringsBundle.getString('itemFields.' + field) + ' (' + field + ')';
      var treeChildren = document.createElementNS(XUL, 'treechildren'); treeItem.appendChild(treeChildren);
      var treeItem = document.createElementNS(XUL, 'treeitem'); treeChildren.appendChild(treeItem);
      var treeRow = document.createElementNS(XUL, 'treerow'); treeItem.appendChild(treeRow);
      var treeCell = document.createElementNS(XUL, 'treecell'); treeRow.appendChild(treeCell);
      var treeCell = document.createElementNS(XUL, 'treecell'); treeRow.appendChild(treeCell);
      treeCell.setAttribute('label', Zotero.ItemFields.getLocalizedString(type.id, fields[i]));
    }
  }
}
