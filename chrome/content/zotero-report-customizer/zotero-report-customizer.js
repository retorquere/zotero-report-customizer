Components.utils.import("resource://gre/modules/Services.jsm");

Zotero.ReportCustomizer = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer."),
  parser: Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser),
  serializer: Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer),

  show: function(key, visible) {
    if (visible !== undefined) {
      Zotero.ReportCustomizer.prefs.setBoolPref('show.' + key, visible);
      return visible;
    }

    try {
      return Zotero.ReportCustomizer.prefs.getBoolPref('show.' + key);
    } catch (err) { }

    var visible = true;
    try {
      visible = !Zotero.ReportCustomizer.prefs.getBoolPref('remove.' + key);
    } catch (err) { }

    Zotero.ReportCustomizer.prefs.setBoolPref('show.' + key, visible);
    return visible;
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

  init: function () {
    // Load in the localization stringbundle for use by getString(name)
    var appLocale = Services.locale.getApplicationLocale();
    Zotero.ReportCustomizer.localizedStringBundle = Services.strings.createBundle("chrome://zotero-report-customizer/locale/zotero-report-customizer.properties", appLocale);

    // monkey-patch Zotero.ItemFields.getLocalizedString to supply new translations
    Zotero.ItemFields.getLocalizedString = (function (self, original) {
      return function(itemType, field) {
        try {
          if (field == 'bibtexKey') {
            return Zotero.ReportCustomizer.localizedStringBundle.GetStringFromName('itemFields.bibtexKey');
          }
        } catch(err) {} // pass to original for consistent error messages
        return original.apply(this, arguments);
      }
    })(this, Zotero.ItemFields.getLocalizedString);

    // monkey-patch Zotero.getString to supply new translations
    Zotero.getString = (function (self, original) {
      return function(name, params) {
        try {
          if (name == 'itemFields.bibtexKey') {
            return Zotero.ReportCustomizer.localizedStringBundle.GetStringFromName(name);
          }
        } catch(err) {} // pass to original for consistent error messages
        return original.apply(this, arguments);
      }
    })(this, Zotero.getString);

    // monkey-patch Zotero.Report.generateHTMLDetails to modify the generated report
    Zotero.Report.generateHTMLDetails = (function (self, original) {
      return function (items, combineChildItems) {
        Zotero.ReportCustomizer.bibtexKeys = {};
        try {
          if (Zotero.BetterBibTex) {
            Zotero.ReportCustomizer.bibtexKeys = Zotero.BetterBibTex.getCiteKeys([Zotero.Items.get(item.itemID) for (item of items)]);
          }
        } catch (err)  {
          console.log('Scrub failed: ' + err + "\n" + err.stack);
        }

        var report = original.apply(this, arguments);

        Zotero.ReportCustomizer.bibtexKeys = {};

        console.log('Scrubbing report');

        try {
          var doc = Zotero.ReportCustomizer.parser.parseFromString(report, 'text/html');

          var remove = []
          for (field of Zotero.ReportCustomizer.fields().fields) {
            if (!Zotero.ReportCustomizer.show(field)) {
              remove.push('.' + field);
            }
          }
          console.log('remove: ' + remove);
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

          report = Zotero.ReportCustomizer.serializer.serializeToString(doc);
          console.log('scrub finished');
        } catch (err) {
          console.log('Scrub failed: ' + err + "\n" + err.stack);
        }

        return report;
      }
    })(this, Zotero.Report.generateHTMLDetails);

    Zotero.Report._generateMetadataTable = (function (self, original) {
      return function(root, arr) {
        if (Zotero.BetterBibTex) {
          var key = Zotero.ReportCustomizer.bibtexKeys[arr.itemID];
          if (key) {
            arr.bibtexKey = key.key + ' (' + (key.pinned ?  'pinned' : 'generated') + ')';
            if (key.duplicates) {
              arr.bibtexKey += ', ' + (key.pinned ?  'hard' : 'soft') + ' conflict';
              if (key.default && key.default != key.key) {
                arr.bibtexKey += ' with ' + key.default;
              }
            }
          }
        }

        return original.apply(this, [root, arr]);
      }
    })(this, Zotero.Report._generateMetadataTable);

    Zotero.Report._generateAttachmentsList = (function (self, original) {
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
    })(this, Zotero.Report._generateAttachmentsList);

    // monkey-patch ZoteroPane.getSortField to alter sort order
    ZoteroPane.getSortField = (function (self, original) {
      return function getSortField() {
        console.log('in getSortField');
        var order;
        try {
          order = JSON.parse(Zotero.ReportCustomizer.prefs.getCharPref('sort'));
        } catch (err) {
          console.log('default order');
          order = [ ];
        }

        var queryString = '';

        for (var sort of order) {
          if (sort.order) {
            if (queryString != '') { queryString += ','; }
            queryString += sort.name;
            if (sort.order == 'd') { queryString += '/d'; }
          }
        }

        if (queryString == '') { return original.apply(arguments); }
        console.log('patched queryString=' + queryString);
        return queryString;
      }
    })(this,  ZoteroPane.getSortField);

    // monkey-patch ZoteroPane.getSortDirection to alter sort order
    ZoteroPane.getSortDirection = (function (self, original) {
      return function getSortDirection() {
        var order;
        try {
          order = JSON.parse(Zotero.ReportCustomizer.prefs.getCharPref('sort'));
        } catch (err) {
          order = [ ];
        }

        for (var sort of order) {
          if (sort.order) {
            return 'ascending';
          }
        }

        return original.apply(arguments);
      }
    })(this,  ZoteroPane.getSortDirection);
  }
};

// Initialize the utility
window.addEventListener('load', function(e) { Zotero.ReportCustomizer.init(); }, false);
