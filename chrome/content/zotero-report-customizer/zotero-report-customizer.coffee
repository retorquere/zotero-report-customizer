Components.utils.import("resource://gre/modules/Services.jsm")

Zotero.ReportCustomizer =
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer.")
  parser: Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser)
  serializer: Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer)

  show: (key, visible) ->
    if typeof visible == 'undefined' # get state
      try
        return not Zotero.ReportCustomizer.prefs.getBoolPref("remove." + key)
      return true

    # set state
    Zotero.ReportCustomizer.prefs.setBoolPref("remove.#{key}", not visible)
    return visible

  openPreferenceWindow: (paneID, action) ->
    io = {
      pane: paneID
      action: action
    }
    window.openDialog(
      "chrome://zotero-report-customizer/content/options.xul",
      "zotero-report-customizer-options",
      "chrome,titlebar,toolbar,centerscreen" + (if Zotero.Prefs.get("browser.preferences.instantApply", true) then "dialog=no" else "modal"),
      io
    )
    return

  label: (name) ->
    @labels ?= Object.create(null)
    @labels[name] ?= {
      name: name
      label: Zotero.getString("itemFields.#{name}")
    }
    return @labels[name]

  addField: (type, field) ->
    type.fields.push(field)
    @fields[field.name] = true
    return

  log: (msg...) ->
    msg = for m in msg
      switch
        when (typeof m) in ['string', 'number'] then '' + m
        when Array.isArray(m) then JSON.stringify(m)
        when m instanceof Error and m.name then "#{m.name}: #{m.message} \n(#{m.fileName}, #{m.lineNumber})\n#{m.stack}"
        when m instanceof Error then "#{e}\n#{e.stack}"
        when (typeof m) == 'object' then JSON.stringify(Zotero.BetterBibTeX.inspect(m)) # unpacks db query objects
        else JSON.stringify(m)

    Zotero.debug("[report-customizer] #{msg.join(' ')}")
    return

  init: ->
    @tree = []
    @fields = {}
    collation = Zotero.getLocaleCollation()

    for type in Zotero.ItemTypes.getSecondaryTypes()
      @tree.push({
        id: type.id
        name: type.name
        label: Zotero.ItemTypes.getLocalizedString(type.id)
      })
    @tree.sort((a, b) -> collation.compareString(1, a.label, b.label))

    for type in @tree
      type.fields = []
      @addField(type, @label("itemType"))

      # getItemTypeFields yields an iterator, not an arry, so we can't just add them
      @addField(type, @label(Zotero.ItemFields.getName(field))) for field in Zotero.ItemFields.getItemTypeFields(type.id)
      @addField(type, @label("bibtexKey")) if Zotero.BetterBibTex
      @addField(type, @label("tags"))
      @addField(type, @label("attachments"))
      @addField(type, @label("dateAdded"))
      @addField(type, @label("dateModified"))
      @addField(type, @label("accessDate"))
      @addField(type, @label("extra"))
    @fields = Object.keys(@fields)

    # Load in the localization stringbundle for use by getString(name)
    Zotero.ReportCustomizer.localizedStringBundle = Services.strings.createBundle("chrome://zotero-report-customizer/locale/zotero-report-customizer.properties", Services.locale.getApplicationLocale())
    Zotero.ItemFields.getLocalizedString = ((original) ->
      return (itemType, field) ->
        try
          return Zotero.ReportCustomizer.localizedStringBundle.GetStringFromName('itemFields.citekey') if field == 'citekey'
        # pass to original for consistent error messages
        return original.apply(this, arguments)
    )(Zotero.ItemFields.getLocalizedString)

    # monkey-patch Zotero.getString to supply new translations
    Zotero.getString = ((original) ->
      return (name, params) ->
        try
          return Zotero.ReportCustomizer.localizedStringBundle.GetStringFromName(name)  if name == 'itemFields.citekey'
        # pass to original for consistent error messages
        return original.apply(this, arguments)
    )(Zotero.getString)

    return

class Zotero.ReportCustomizer.XmlNode
  constructor: (@namespace, @root, @doc) ->
    if !@doc
      @doc = Zotero.OPDS.document.implementation.createDocument(@namespace, @root, null)
      @root = @doc.documentElement

  serialize: -> Zotero.OPDS.serializer.serializeToString(@doc)

  alias: (names) ->
    for name in names.trim().split(/\s+/)
      @[name] = (content) ->
        return @add({name: content})
    return

  add: (what) ->
    switch
      when typeof what == 'string'
        @root.appendChild(@doc.createTextNode(what))
        return

      when what.appendChild
        @root.appendChild(what)
        return

    for own name, content of what
      node = @doc.createElementNS(@namespace, name)
      @root.appendChild(node)

      switch typeof content
        when 'function'
          content.call(new @Node(@namespace, node, @doc))

        when 'string', 'number'
          node.appendChild(@doc.createTextNode('' + content))

        else # assume node with attributes
          for own k, v of content
            if k == ''
              if typeof v == 'function'
                v.call(new @Node(@namespace, node, @doc))
              else
                node.appendChild(@doc.createTextNode('' + v))
            else
              node.setAttribute(k, '' + v)

    return

# Initialize the utility
window.addEventListener("load", ((e) ->
  Zotero.ReportCustomizer.init()
  return
), false)
