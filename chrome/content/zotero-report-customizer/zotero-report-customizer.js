Components.utils.import("resource://gre/modules/Services.jsm");

Zotero.ReportCustomizer = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer."),
  parser: Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser),
  serializer: Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer),

  show: function(key, visible) {
    if (typeof visible != 'undefined') {
      Zotero.ReportCustomizer.prefs.setBoolPref('remove.' + key, !visible);
      return visible;
    }

    try {
      return !Zotero.ReportCustomizer.prefs.getBoolPref('remove.' + key);
    } catch (err) { }

    return true;
  },

  openPreferenceWindow: function (paneID, action) {
    var io = {
      pane: paneID,
      action: action
    };
    window.openDialog('chrome://zotero-report-customizer/content/options.xul',
      'zotero-report-custimizer-options',
      'chrome,titlebar,toolbar,centerscreen'+ Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal',io);
  },

  /* deferred because I get a 
   * Error: [Exception... "Component returned failure code: 0x8052000e (NS_ERROR_FILE_IS_LOCKED) [mozIStorageStatement.executeStep]"  nsresult: "0x8052000e (NS_ERROR_FILE_IS_LOCKED)"  location: "JS frame :: chrome://zotero/content/xpcom/db.js :: Zotero.DBConnection.prototype.query :: line 140"  data: no] [QUERY: SELECT itemTypeID AS id, typeName AS name, custom FROM itemTypesCombined WHERE display IN (1,2)] [ERROR: database table is locked: itemTypesCombined]
   * error
   */
  _fields: null,
  fields: function() {
    if (!Zotero.ReportCustomizer._fields) {
      var _fields = {tree: [], fields: {}};

      var labels = {};
      function label(name) {
        if (!labels[name]) { labels[name] = {name: name, label: Zotero.getString('itemFields.' + name)}; }
        return labels[name];
      }

      function addField(type, field) {
        type.fields.push(field);
        _fields.fields[field.name] = true;
      }

      var collation = Zotero.getLocaleCollation();                                                              
      var t = Zotero.ItemTypes.getSecondaryTypes();                                                             
      for (var i=0; i<t.length; i++) {                                                                          
        _fields.tree.push({ id: t[i].id, name: t[i].name, label: Zotero.ItemTypes.getLocalizedString(t[i].id) });
      }
      _fields.tree.sort(function(a, b) { return collation.compareString(1, a.label, b.label); });

      for (var type of _fields.tree) {
        type.fields = [];
        addField(type, label('itemType'));
        // getItemTypeFields yields an iterator, not an arry, so we can't just add them
        for (field of Zotero.ItemFields.getItemTypeFields(type.id)) { addField(type, label(Zotero.ItemFields.getName(field))); }
        if (Zotero.BetterBibTex) {
          addField(type, label('bibtexKey'));
        }
        addField(type, label('tags'));
        addField(type, label('attachments'));

        addField(type, label('dateAdded'));
        addField(type, label('dateModified'));
        addField(type, label('accessDate'));
        addField(type, label('extra'));
      }
      _fields.fields = Object.keys(_fields.fields);

      Zotero.ReportCustomizer._fields = _fields;
    }

    return Zotero.ReportCustomizer._fields;
  },

  bibtexKeys: {},

  linkTo: function(node, item) {
    var a = Zotero.Report.doc.createElement('a');
    [].forEach.call(node.childNodes, function(child) {
      a.appendChild(child);
    });
    a.setAttribute('href', 'zotero://select/items/' + (item.libraryID || 0) + '_' + item.key);
    node.appendChild(a);
  },

  log: function(msg, err) {
    if (typeof msg != 'string') { msg = JSON.stringify(msg); }
    msg = '[report customizer] ' + msg;
    if (err) {
      msg += "\n" + err + "\n" + err.stack;
    }
    Zotero.debug(msg);
    console.log(msg);
  },

  init: function () {
    // migrate & clear legacy data
    var show = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer.show.");
    show.getChildList('', {}).forEach(function(key) {
      try {
        Zotero.ReportCustomizer.prefs.getBoolPref('remove.' + key);
      } catch (err) {
        Zotero.ReportCustomizer.show(key, show.getBoolPref(key));
      }
      show.clearUserPref(key);
    });

    // Load in the localization stringbundle for use by getString(name)
    var appLocale = Services.locale.getApplicationLocale();
    Zotero.ReportCustomizer.localizedStringBundle = Services.strings.createBundle("chrome://zotero-report-customizer/locale/zotero-report-customizer.properties", appLocale);

    Zotero.ItemFields.getLocalizedString = (function (original) {
      return function(itemType, field) {
        try {
          if (field == 'bibtexKey') {
            return Zotero.ReportCustomizer.localizedStringBundle.GetStringFromName('itemFields.bibtexKey');
          }
        } catch(err) {} // pass to original for consistent error messages
        return original.apply(this, arguments);
      }
    })(Zotero.ItemFields.getLocalizedString);

    // monkey-patch Zotero.getString to supply new translations
    Zotero.getString = (function (original) {
      return function(name, params) {
        try {
          if (name == 'itemFields.bibtexKey') {
            return Zotero.ReportCustomizer.localizedStringBundle.GetStringFromName(name);
          }
        } catch(err) {} // pass to original for consistent error messages
        return original.apply(this, arguments);
      }
    })(Zotero.getString);

    // monkey-patch Zotero.Report.generateHTMLDetails to modify the generated report
    Zotero.Report.generateHTMLDetails = (function (original) {
      return function (items, combineChildItems) {
        Zotero.ReportCustomizer.bibtexKeys = {};
        try {
          if (Zotero.BetterBibTex) {
            Zotero.ReportCustomizer.bibtexKeys = Zotero.BetterBibTex.getCiteKeys([Zotero.Items.get(item.itemID) for (item of items)]);
          }
        } catch (err)  {
          Zotero.ReportCustomizer.log('Scrub failed', err);
        }

        var report = original.apply(this, arguments);

        Zotero.ReportCustomizer.bibtexKeys = {};

        try {
          var doc = Zotero.ReportCustomizer.parser.parseFromString(report, 'text/html');

          var remove = []
          for (field of Zotero.ReportCustomizer.fields().fields) {
            if (!Zotero.ReportCustomizer.show(field)) {
              remove.push('.' + field);
            }
          }
          Zotero.ReportCustomizer.log('remove: ' + remove);
          if (remove.length != 0) {
            var head = doc.getElementsByTagName('head')[0];
            var style = doc.createElement('style');
            head.appendChild(style);
            style.appendChild(doc.createTextNode(remove.join(', ') + '{display:none;}'));
          }

          [].forEach.call(doc.getElementsByTagName('h2'), function(title) {
            if (!title.parentNode) { return; }
            var id = title.parentNode.getAttribute('id');
            if (id && id.indexOf('item-') == 0) {
              Zotero.ReportCustomizer.linkTo(title, Zotero.Items.get(parseInt(id.substring('item-'.length, id.length))));
            }
          });

          try {
            var order = JSON.parse(Zotero.ReportCustomizer.prefs.getCharPref('sort')).filter(function(s) { return s.order; });

            if (order.length > 0) {
              function getField(obj, field) {
                switch (field) {
                  case 'itemType':
                    return Zotero.ItemTypes.getName(obj.itemTypeID);

                  case 'date':
                    return obj.getField('date', true, true);

                  default:
                    return obj[field] || obj.getField(field);
                }
              }
              function compare(a, b, field, order) {
                var order = (order == 'd' ? 1 : -1);

                a = getField(a, field);
                b = getField(b, field);
                Zotero.ReportCustomizer.log({name: field, typea: typeof a, typeb: typeof b});

                if ((typeof a) != 'number' || (typeof b) != 'number') {
                  a = '' + a;
                  b = '' + b;
                }
                if (a == b) { return 0; }
                if (a < b) { return -order; }
                return order;
              }
              var items = [];
              [].forEach.call(doc.getElementsByClassName('item'), function(item) { items.push(item); });

              items.sort(function(a, b) {
                a = Zotero.Items.get(parseInt(a.getAttribute('id').replace(/item-/, '')));
                b = Zotero.Items.get(parseInt(b.getAttribute('id').replace(/item-/, '')));
                return order.map(
                  function(s) { return compare(a, b, s.name, s.order); }
                ).filter(
                  function(c) { return (c != 0); }
                ).concat(
                  [0]
                )[0];
              });

              var itemList = doc.getElementsByClassName('report')[0];
              items.reverse();
              items.forEach(function(item) {
                itemList.appendChild(item);
              });
            }
          } catch (err) {
            Zotero.ReportCustomizer.log('reorder failed', err);
          }


          report = Zotero.ReportCustomizer.serializer.serializeToString(doc);
        } catch (err) {
          Zotero.ReportCustomizer.log('Scrub failed', err);
        }

        return report;
      }
    })(Zotero.Report.generateHTMLDetails);

    Zotero.Report._generateMetadataTable = (function (original) {
      return function(root, arr) {
        if (Zotero.BetterBibTex) {
          var key = Zotero.ReportCustomizer.bibtexKeys[arr.itemID];
          if (key) {
            arr.bibtexKey = key.key + ' (' + (key.pinned ?  'pinned' : 'generated') + ')';
            if (key.conflict) {
              arr.bibtexKey += ', ' + key.conflict + ' conflict';
            }
          }
        }

        return original.apply(this, [root, arr]);
      }
    })(Zotero.Report._generateMetadataTable);

    Zotero.Report._generateAttachmentsList = (function (original) {
      return function(root, arr) {
        original.apply(this, arguments);

        [].forEach.call(root.getElementsByClassName('attachments'), function(attachments) {
          [].forEach.call(attachments.getElementsByTagName('li'), function(title) {
            var id = title.getAttribute('id');
            if (id && id.indexOf('attachment-') == 0) {
              id = parseInt(id.substring('attachment-'.length, id.length));
              var status = 'fulltext.indexState.';
              switch (Zotero.Fulltext.getIndexedState(id)) {
                case Zotero.Fulltext.INDEX_STATE_UNAVAILABLE:
                status += 'unavailable';
                break;
                case Zotero.Fulltext.INDEX_STATE_UNINDEXED:
                  status = 'general.no';
                  break;
                case Zotero.Fulltext.INDEX_STATE_PARTIAL:
                  status += 'partial';
                  break;
                case Zotero.Fulltext.INDEX_STATE_INDEXED:
                  status = 'general.yes';
                  break;
              }

              var item = Zotero.Items.get(id);

              Zotero.ReportCustomizer.linkTo(title, Zotero.Items.get(id));

              title.appendChild(Zotero.Report.doc.createTextNode(', ' + Zotero.getString('fulltext.indexState.indexed').toLowerCase() + ': ' + Zotero.getString(status)));
            }
          });
        });
      }
    })(Zotero.Report._generateAttachmentsList);
  }
};

// Initialize the utility
window.addEventListener('load', function(e) { Zotero.ReportCustomizer.init(); }, false);
