#
#    ***** BEGIN LICENSE BLOCK *****
#    
#    Copyright © 2009 Center for History and New Media
#                     George Mason University, Fairfax, Virginia, USA
#                     http://zotero.org
#    
#    This file is part of Zotero.
#    
#    Zotero is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#    
#    Zotero is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#    
#    You should have received a copy of the GNU Affero General Public License
#    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
#    
#    ***** END LICENSE BLOCK *****
#
Zotero.Report = new ->
  @fillElement = (elt, text) ->
    elt.appendChild @doc.createTextNode(text)
    return

  @addElement = (parent, child) ->
    child = @doc.createElement(child)  if typeof child is "string"
    
    # for no indentation, just do
    # parent.appendChild(child);
    # return child;
    indent = ""
    elem = parent
    while elem.parentNode
      indent += "  "
      elem = elem.parentNode
    if parent.hasChildNodes() # && parent.lastChild.nodeType === 3 && /^\s*[\r\n]\s*$/.test(parent.lastChild.textContent)) {
      parent.insertBefore @doc.createTextNode("\n" + indent), parent.lastChild
      parent.insertBefore child, parent.lastChild
    else
      parent.appendChild @doc.createTextNode("\n" + indent)
      parent.appendChild child
      parent.appendChild @doc.createTextNode("\n" + indent.slice(0, -2))
    child

  @addNote = (elt, note) ->
    
    # If not valid XML, display notes with entities encoded
    
    # &nbsp; isn't valid in HTML
    
    # Strip control characters (for notes that were
    # added before item.setNote() started doing this)
    note = "<div>" + note.replace(/&nbsp;/g, "&#160;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") + "</div>"
    note = @parser.parseFromString(note, "text/html")
    if note.documentElement.tagName is "parsererror"
      Zotero.debug note.documentElement.textContent, 2
      p = @addElement(elt, "p")
      p.setAttribute "class", "plaintext"
      @fillElement p, arr.note
    else # Otherwise render markup normally
      @addElement elt, note.documentElement
    return

  @generateHTMLDetails = (items, combineChildItems) ->
    @parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser)
    @doc = @parser.parseFromString("<!DOCTYPE html><html><head></head><body></body></html>", "text/html")
    @serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer)
    head = @doc.getElementsByTagName("head")[0]
    body = @doc.getElementsByTagName("body")[0]
    meta = @addElement(head, "meta")
    meta.setAttribute "http-equiv", "Content-Type"
    meta.setAttribute "content", "text/html; charset=utf-8"
    title = @addElement(head, "title")
    @fillElement title, Zotero.getString("report.title.default")
    
    for props in [
      { href: "zotero://report/detail.css" }
      { href: "zotero://report/detail_screen.css", media: "screen,projection" }
      { href: "zotero://report/detail_print.css", media: "print" }
    ]
      link = @addElement(head, "link")
      link.setAttribute "rel", "stylesheet"
      link.setAttribute "style", "text/css"
      link.setAttribute "href", props.href
      link.setAttribute "media", props.media  if props.media
    reportUL = @addElement(body, "ul")
    reportUL.setAttribute "class", "report" + ((if combineChildItems then " combineChildItems" else ""))
    for arr of items
      reportItem = @addElement(reportUL, "li")
      reportItem.setAttribute "id", "item-" + arr.itemID
      reportItem.setAttribute "class", "item " + arr.itemType
      if arr.title
        h2 = @addElement(reportItem, "h2")
        if arr.reportSearchMatch # Top-level item matched search, so display title
          @fillElement h2, arr.title
        else # Non-matching parent, so display "Parent Item: [Title]"
          h2.setAttribute "class", "parentItem"
          @fillElement h2, Zotero.getString("report.parentItem")
          span = @addElement(h2, "span")
          span.setAttribute "class", "title"
          @fillElement span, arr.title
      
      # If parent matches search, display parent item metadata table and tags
      if arr.reportSearchMatch
        @_generateMetadataTable reportItem, arr
        @_generateTagsList reportItem, arr
        
        # Independent note
        @addNote reportItem, arr.note  if arr["note"]
      
      # Children
      if arr.reportChildren
        
        # Child notes
        if arr.reportChildren.notes.length
          
          # Only display "Notes:" header if parent matches search
          if arr.reportSearchMatch
            h3 = @addElement(reportItem, "h3")
            h3.setAttribute "class", "notes"
            @fillElement h3, Zotero.getString("report.notes")
          notesUL = @addElement(reportItem, "ul")
          notesUL.setAttribute "class", "notes"
          for note of arr.reportChildren.notes
            notesLI = @addElement(notesUL, "li")
            notesLI.setAttribute "id", "note-" + note.itemID
            @addNote notesLI, note.note
            
            # Child note tags
            @_generateTagsList notesLI, note
        
        # Chid attachments
        @_generateAttachmentsList reportItem, arr.reportChildren
      
      # Related
      if arr.reportSearchMatch and arr.related and arr.related.length
        h3 = @addElement(reportItem, "h3")
        h3.setAttribute "class", "related"
        @fillElement h3, Zotero.getString("itemFields.related")
        relatedUL = @addElement(reportItem, "ul")
        relateds = Zotero.Items.get(arr.related)
        for related of relateds
          relatedLI = @addElement(relatedUL, "li")
          relatedLI.setAttribute "id", "related-" + related.getID()
          @fillElement relatedLI, related.getDisplayTitle()
    @serializer.serializeToString @doc

  @_generateMetadataTable = (root, arr) ->
    table = @addElement(root, "table")
    unlink = true
    
    # add and optionally unlink or the indentation is off
    
    # Item type
    tr = @addElement(table, "tr")
    tr.setAttribute "class", "itemType"
    th = @addElement(tr, "th")
    @fillElement th, Zotero.getString("itemFields.itemType")
    td = @addElement(tr, "td")
    @fillElement td, Zotero.ItemTypes.getLocalizedString(arr.itemType)
    
    # Creators
    if arr["creators"]
      unlink = false
      displayText = undefined
      for creator of arr["creators"]
        # Two fields
        switch creator["fieldMode"]
          when 0 then displayText = creator["firstName"] + " " + creator["lastName"]
          when 1 then displayText = creator["lastName"]
          else Zotero.debug "TODO"

        tr = @addElement(table, "tr")
        tr.setAttribute "class", "creator " + creator.creatorType
        th = @addElement(tr, "th")
        th.setAttribute "class", creator.creatorType
        @fillElement th, Zotero.getString("creatorTypes." + creator.creatorType)
        td = @addElement(tr, "td")
        @fillElement td, displayText
    
    # Move dateAdded and dateModified to the end of the array
    da = arr.dateAdded
    dm = arr.dateModified
    delete arr.dateAdded
    delete arr.dateModified

    arr.dateAdded = da
    arr.dateModified = dm

    for i of arr
      # Skip certain fields
      switch i
        when "reportSearchMatch", "reportChildren", "libraryID", "key", "itemType", "itemID", "sourceItemID", "title", "firstCreator", "creators", "tags", "related", "notes", "note", "attachments"
          continue
      try
        localizedFieldName = Zotero.ItemFields.getLocalizedString(arr.itemType, i)
      catch e # Skip fields we don't have a localized string for
        Zotero.debug "Localized string not available for " + "itemFields." + i, 2
        continue

      arr[i] = Zotero.Utilities.trim(arr[i] + "")
      
      # Skip empty fields
      continue  unless arr[i]
      unlink = false
      tr = @addElement(table, "tr")
      tr.setAttribute "class", i
      th = @addElement(tr, "th")
      th.setAttribute "class", i
      @fillElement th, localizedFieldName
      td = @addElement(tr, "td")

      switch
        when i is "url" and arr[i].match(/^https?:\/\//)
          a = @addElement(td, "a")
          a.setAttribute "href", arr[i]
          @fillElement a, arr[i]
      
        # Remove SQL date from multipart dates
        # (e.g. '2006-00-00 Summer 2006' becomes 'Summer 2006')
        when i is "date"
          @fillElement td, Zotero.Date.multipartToStr(arr[i])
      
        # Convert dates to local format
        when i is "accessDate" or i is "dateAdded" or i is "dateModified"
          date = Zotero.Date.sqlToDate(arr[i], true)
          @fillElement td, date.toLocaleString()

        else
          @fillElement td, arr[i]
    root.removeChild table  if unlink
    return

  @_generateTagsList = (root, arr) ->
    if arr["tags"] and arr["tags"].length
      h3 = @addElement(root, "h3")
      h3.setAttribute "class", "tags"
      @fillElement h3, Zotero.getString("report.tags")
      ul = @addElement(root, "ul")
      ul.setAttribute "class", "tags"
      for tag of arr.tags
        @fillElement @addElement(ul, "li"), tag.fields.name
    return

  @_generateAttachmentsList = (root, arr) ->
    if arr.attachments and arr.attachments.length
      h3 = @addElement(root, "h3")
      h3.setAttribute "class", "attachments"
      @fillElement h3, Zotero.getString("itemFields.attachments")
      ul = @addElement(root, "ul")
      ul.setAttribute "class", "attachments"
      for attachment of arr.attachments
        li = @addElement(ul, "li")
        li.setAttribute "id", "attachment-" + attachment.itemID
        @fillElement li, attachment.title
        
        # Attachment tags
        @_generateTagsList li, attachment
        
        # Attachment note
        @addNote li, attachment.note  if attachment.note
    return

  return
