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
      var _fields = {tree: [], fields: {itemType: true}};

      var collation = Zotero.getLocaleCollation();                                                              
      var t = Zotero.ItemTypes.getSecondaryTypes();                                                             
      for (var i=0; i<t.length; i++) {                                                                          
        _fields.tree.push({ id: t[i].id, name: t[i].name, label: Zotero.ItemTypes.getLocalizedString(t[i].id) });
      }
      _fields.tree.sort(function(a, b) { return collation.compareString(1, a.label, b.label); });
            
      for (var type of _fields.tree) {
        type.fields = [];
        for (field of Zotero.ItemFields.getItemTypeFields(type.id)) {
          var name = Zotero.ItemFields.getName(field);
          type.fields.push({name: name, label: Zotero.ItemFields.getLocalizedString(type.id, field)});
          _fields.fields[name] = true;
        }
      }
      _fields.fields = Object.keys(_fields.fields);

      Zotero.ReportCustomizer._fields = _fields;
      console.log(Zotero.ReportCustomizer._fields.fields.length + ' fields found');
    }

    return Zotero.ReportCustomizer._fields;
  },

  init: function () {
    console.log('initializing scrubber');
    
    // monkey-patch Zotero.Report.generateHTMLDetails to modify the generated report
    Zotero.Report.generateHTMLDetails = (function (self, original) {
      return function (items, combineChildItems) {
        var report = original.apply(this, arguments);

        console.log('Scrubbing report');

        try {
          var doc = Zotero.ReportCustomizer.parser.parseFromString(report, 'text/html');

          var remove = []
          for (field of Object.keys(Zotero.ReportCustomizer.fields().fields)) {
            if (!Zotero.ReportCustomizer.show(field)) {
              remove.push('.' + field);
            }
          }
          if (remove.length != 0) {
            var head = doc.getElementsByTagName('head')[0];
            var style = doc.createElement('style');
            head.appendChild(style);
            style.appendChild(doc.createTextNode(remove.join(', ') + '{display:none;}'));
          }
          report = Zotero.ReportCustomizer.serializer.serializeToString(doc);
        } catch (err) {
          console.log('Scrub failed: ' + err + "\n" + err.stack);
        }

        return report;
      }
    })(this, Zotero.Report.generateHTMLDetails);
  }
};

// Initialize the utility
window.addEventListener('load', function(e) { Zotero.ReportCustomizer.init(); }, false);
