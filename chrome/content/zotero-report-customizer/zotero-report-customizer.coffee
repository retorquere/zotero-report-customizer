Components.utils.import("resource://gre/modules/Services.jsm")

Zotero.ReportCustomizer =
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer.")
  parser: Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser)
  serializer: Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer)

  show: (key, visible) ->
    unless typeof visible is "undefined"
      Zotero.ReportCustomizer.prefs.setBoolPref "remove." + key, not visible
      return visible
    try
      return not Zotero.ReportCustomizer.prefs.getBoolPref("remove." + key)
    true

  openPreferenceWindow: (paneID, action) ->
    io =
      pane: paneID
      action: action

    window.openDialog "chrome://zotero-report-customizer/content/options.xul", "zotero-report-custimizer-options", (if "chrome,titlebar,toolbar,centerscreen" + Zotero.Prefs.get("browser.preferences.instantApply", true) then "dialog=no" else "modal"), io
    return

  
  # deferred because I get a 
  #   * Error: [Exception... "Component returned failure code: 0x8052000e (NS_ERROR_FILE_IS_LOCKED) [mozIStorageStatement.executeStep]"  nsresult: "0x8052000e (NS_ERROR_FILE_IS_LOCKED)"  location: "JS frame :: chrome://zotero/content/xpcom/db.js :: Zotero.DBConnection.prototype.query :: line 140"  data: no] [QUERY: SELECT itemTypeID AS id, typeName AS name, custom FROM itemTypesCombined WHERE display IN (1,2)] [ERROR: database table is locked: itemTypesCombined]
  #   * error
  #   
  _fields: null
  fields: ->
    unless Zotero.ReportCustomizer._fields
      label = (name) ->
        unless labels[name]
          labels[name] =
            name: name
            label: Zotero.getString("itemFields." + name)
        labels[name]
      addField = (type, field) ->
        type.fields.push field
        _fields.fields[field.name] = true
        return
      _fields =
        tree: []
        fields: {}

      labels = {}
      collation = Zotero.getLocaleCollation()
      t = Zotero.ItemTypes.getSecondaryTypes()
      i = 0

      while i < t.length
        _fields.tree.push
          id: t[i].id
          name: t[i].name
          label: Zotero.ItemTypes.getLocalizedString(t[i].id)

        i++
      _fields.tree.sort (a, b) ->
        collation.compareString 1, a.label, b.label

      
      for type in _fields.tree
        type.fields = []
        addField type, label("itemType")
        
        # getItemTypeFields yields an iterator, not an arry, so we can't just add them
        for field in Zotero.ItemFields.getItemTypeFields(type.id)
          addField type, label(Zotero.ItemFields.getName(field))
        addField type, label("bibtexKey")  if Zotero.BetterBibTex
        addField type, label("tags")
        addField type, label("attachments")
        addField type, label("dateAdded")
        addField type, label("dateModified")
        addField type, label("accessDate")
        addField type, label("extra")
      _fields.fields = Object.keys(_fields.fields)
      Zotero.ReportCustomizer._fields = _fields
    Zotero.ReportCustomizer._fields

  bibtexKeys: {}
  linkTo: (node, item) ->
    a = Zotero.Report.doc.createElement("a")
    [].forEach.call node.childNodes, (child) ->
      a.appendChild child
      return

    a.setAttribute "href", "zotero://select/items/" + (item.libraryID or 0) + "_" + item.key
    node.appendChild a
    return

  log: (msg, err) ->
    msg = JSON.stringify(msg)  unless typeof msg is "string"
    msg = "[report customizer] " + msg
    msg += "\n" + err + "\n" + err.stack  if err
    Zotero.debug msg
    console.log msg
    return

  init: ->
    
    # migrate & clear legacy data
    show = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer.show.")
    show.getChildList("", {}).forEach (key) ->
      try
        Zotero.ReportCustomizer.prefs.getBoolPref "remove." + key
      catch err
        Zotero.ReportCustomizer.show key, show.getBoolPref(key)
      show.clearUserPref key
      return

    
    # Load in the localization stringbundle for use by getString(name)
    appLocale = Services.locale.getApplicationLocale()
    Zotero.ReportCustomizer.localizedStringBundle = Services.strings.createBundle("chrome://zotero-report-customizer/locale/zotero-report-customizer.properties", appLocale)
    Zotero.ItemFields.getLocalizedString = ((original) ->
      (itemType, field) ->
        try
          return Zotero.ReportCustomizer.localizedStringBundle.GetStringFromName("itemFields.bibtexKey")  if field is "bibtexKey"
        # pass to original for consistent error messages
        original.apply this, arguments
    )(Zotero.ItemFields.getLocalizedString)
    
    # monkey-patch Zotero.getString to supply new translations
    Zotero.getString = ((original) ->
      (name, params) ->
        try
          return Zotero.ReportCustomizer.localizedStringBundle.GetStringFromName(name)  if name is "itemFields.bibtexKey"
        # pass to original for consistent error messages
        original.apply this, arguments
    )(Zotero.getString)
    
    # monkey-patch Zotero.Report.generateHTMLDetails to modify the generated report
    Zotero.Report.generateHTMLDetails = ((original) ->
      (items, combineChildItems) ->
        Zotero.ReportCustomizer.bibtexKeys = {}
        try
          Zotero.ReportCustomizer.bibtexKeys = Zotero.BetterBibTex.getCiteKeys( Zotero.Items.get(item.itemID) for item in items )
        catch err
          Zotero.ReportCustomizer.log "Scrub failed", err
        report = original.apply(this, arguments)
        Zotero.ReportCustomizer.bibtexKeys = {}
        try
          doc = Zotero.ReportCustomizer.parser.parseFromString(report, "text/html")
          remove = []
          
          for field in Zotero.ReportCustomizer.fields().fields
            remove.push "." + field  unless Zotero.ReportCustomizer.show(field)
          Zotero.ReportCustomizer.log "remove: " + remove
          unless remove.length is 0
            head = doc.getElementsByTagName("head")[0]
            style = doc.createElement("style")
            head.appendChild style
            style.appendChild doc.createTextNode(remove.join(", ") + "{display:none;}")
          [].forEach.call doc.getElementsByTagName("h2"), (title) ->
            return  unless title.parentNode
            id = title.parentNode.getAttribute("id")
            Zotero.ReportCustomizer.linkTo title, Zotero.Items.get(parseInt(id.substring("item-".length, id.length)))  if id and id.indexOf("item-") is 0
            return

          try
            order = JSON.parse(Zotero.ReportCustomizer.prefs.getCharPref("sort")).filter((s) ->
              s.order
            )
            if order.length > 0
              getField = (obj, field) ->
                switch field
                  when "itemType"
                    Zotero.ItemTypes.getName obj.itemTypeID
                  when "date"
                    obj.getField "date", true, true
                  else
                    obj[field] or obj.getField(field)
              compare = (a, b, field, order) ->
                order = ((if order is "d" then 1 else -1))
                a = getField(a, field)
                b = getField(b, field)
                Zotero.ReportCustomizer.log
                  name: field
                  typea: typeof a
                  typeb: typeof b

                if (typeof a) isnt "number" or (typeof b) isnt "number"
                  a = "" + a
                  b = "" + b
                return 0  if a is b
                return -order  if a < b
                order
              items = []
              [].forEach.call doc.getElementsByClassName("item"), (item) ->
                items.push item
                return

              items.sort (a, b) ->
                a = Zotero.Items.get(parseInt(a.getAttribute("id").replace(/item-/, "")))
                b = Zotero.Items.get(parseInt(b.getAttribute("id").replace(/item-/, "")))
                order.map((s) ->
                  compare a, b, s.name, s.order
                ).filter((c) ->
                  c isnt 0
                ).concat([0])[0]

              itemList = doc.getElementsByClassName("report")[0]
              items.reverse()
              items.forEach (item) ->
                itemList.appendChild item
                return

          catch err
            Zotero.ReportCustomizer.log "reorder failed", err
          report = Zotero.ReportCustomizer.serializer.serializeToString(doc)
        catch err
          Zotero.ReportCustomizer.log "Scrub failed", err
        report
    )(Zotero.Report.generateHTMLDetails)
    Zotero.Report._generateMetadataTable = ((original) ->
      (root, arr) ->
        if Zotero.BetterBibTex
          key = Zotero.ReportCustomizer.bibtexKeys[arr.itemID]
          if key
            arr.bibtexKey = key.key + " (" + ((if key.pinned then "pinned" else "generated")) + ")"
            arr.bibtexKey += ", " + key.conflict + " conflict"  if key.conflict
        original.apply this, [
          root
          arr
        ]
    )(Zotero.Report._generateMetadataTable)
    Zotero.Report._generateAttachmentsList = ((original) ->
      (root, arr) ->
        original.apply this, arguments
        [].forEach.call root.getElementsByClassName("attachments"), (attachments) ->
          [].forEach.call attachments.getElementsByTagName("li"), (title) ->
            id = title.getAttribute("id")
            if id and id.indexOf("attachment-") is 0
              id = parseInt(id.substring("attachment-".length, id.length))
              status = "fulltext.indexState."
              switch Zotero.Fulltext.getIndexedState(id)
                when Zotero.Fulltext.INDEX_STATE_UNAVAILABLE
                  status += "unavailable"
                when Zotero.Fulltext.INDEX_STATE_UNINDEXED
                  status = "general.no"
                when Zotero.Fulltext.INDEX_STATE_PARTIAL
                  status += "partial"
                when Zotero.Fulltext.INDEX_STATE_INDEXED
                  status = "general.yes"
              item = Zotero.Items.get(id)
              Zotero.ReportCustomizer.linkTo title, Zotero.Items.get(id)
              title.appendChild Zotero.Report.doc.createTextNode(", " + Zotero.getString("fulltext.indexState.indexed").toLowerCase() + ": " + Zotero.getString(status))
            return

          return

        return
    )(Zotero.Report._generateAttachmentsList)
    return


# Initialize the utility
window.addEventListener "load", ((e) ->
  Zotero.ReportCustomizer.init()
  return
), false
