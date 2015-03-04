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

# coffeelint: disable=no_implicit_braces

Zotero.Report = {
  generateHTMLDetails: (items, combineChildItems) ->
    return (new Zotero.ReportCustomizer.report(items, combineChildItems)).serialize()
}

class Zotero.ReportCustomizer.XmlNode
  constructor: (@doc, @root) ->

  namespace: 'http://www.w3.org/1999/xhtml'

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
          content.call(new Zotero.ReportCustomizer.XmlNode(@doc, node))

        when 'string', 'number'
          node.appendChild(@doc.createTextNode('' + content))

        else # assume node with attributes
          for own k, v of content
            if k == ''
              if typeof v == 'function'
                v.call(new Zotero.ReportCustomizer.XmlNode(@doc, node))
              else
                node.appendChild(@doc.createTextNode('' + v))
            else
              node.setAttribute(k, '' + v)

    return

  metadata: (item) ->
    # Move dateAdded and dateModified to the end of the array
    da = item.dateAdded
    dm = item.dateModified
    delete item.dateAdded
    delete item.dateModified
    item.dateAdded = da
    item.dateModified = dm

    attributes = Object.create(null)
    for k, v of arr
      # Skip certain fields
      switch k
        when 'reportSearchMatch', 'reportChildren', 'libraryID', 'key', 'itemType', 'itemID', 'sourceItemID', 'title', 'firstCreator', 'creators', 'tags', 'related', 'notes', 'note', 'attachments'
          continue
      try
        localizedFieldName = Zotero.ItemFields.getLocalizedString(item.itemType, k)
      catch e # Skip fields we don't have a localized string for
        Zotero.debug("Localized string not available for itemFields.#{k}", 2)
        continue

      v = Zotero.Utilities.trim(v + '')
      continue unless v
      attributes[k] = {label: localizedFieldName, value: v}

    return if !item.creators && Object.keys(attributes).length == 0

    @add(table: ->
      @add(tr: {'class': 'itemType', '': ->
        @add(th: Zotero.getString('itemFields.itemType'))
        @add(td: Zotero.ItemTypes.getLocalizedString(arr.itemType))
        return
      })
      for creator in item.creators || []
        displayText = switch creator.fieldMode
          when 0 then "#{creator.firstName} #{creator.lastName}"
          when 1 then creator.lastName
          else ''
        @add(tr: {'class': "creator #{creator.creatorType}", '': ->
          @add(th: {'class': creator.creatorType, '': Zotero.getString("creatorTypes.#{creator.creatorType}")})
          @add(td: displayText)
          return
        })

      for k, v of attributes
        @add(tr: {'class': k, '': ->
          @add(th: {'class': k, '': v.label})
          @add(td: ->
            switch
              when k == 'url' and v.value.match(/^https?:\/\//)
                @add(a: {href: v, '': v})

              # Remove SQL date from multipart dates
              # (e.g. '2006-00-00 Summer 2006' becomes 'Summer 2006')
              when k == 'date'
                @add(Zotero.Date.multipartToStr(v.value))

              # Convert dates to local format
              when k == 'accessDate' or k == 'dateAdded' or k == 'dateModified'
                date = Zotero.Date.sqlToDate(v.value, true)
                @add(date.toLocaleString())

              else
                @add(v.value)
          )
          return
        })

      return
    )
    return

  tags: (item) ->
    return unless item.tags?.length

    @add(h3: {'class': 'tags', '': Zotero.getString('report.tags')})
    @add(ul: {'class', 'tags', '': ->
      for tag of item.tags
        @add(li: tag.fields.name)
      return
    })
    return

  note: (note) ->
    return unless note
    # If not valid XML, display notes with entities encoded
    # &nbsp; isn't valid in HTML
    # Strip control characters (for notes that were added before item.setNote() started doing this)
    _note = '<div>' + note.replace(/&nbsp;/g, '&#160;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') + '</div>'
    _note = Zotero.ReportCustomizer.parser.parseFromString(note, 'text/html')
    if _note.documentElement.tagName == 'parsererror'
      Zotero.debug(note.documentElement.textContent, 2)
      @add('p', {'class': 'plaintext', '': note})
    else # Otherwise render markup normally
      @add(_note.documentElement)
    return

  attachments: (item) ->
    return unless item.attachments?.length

    @add(h3: {'class': 'attachments', '': Zotero.getString('itemFields.attachments')})
    @add(ul: {'class': 'attachments', '': ->
      for attachment of item.attachments
        @add(li: ->
          @add(attachment.title)
          @tags(attachment)
          @note(attachment.note)
          return
        )
    })
    return

  item: (item) ->
    @add(li: {id: "item-#{item.itemID}", 'class': "item #{item.itemType}", '': ->
      if item.title
        if item.reportSearchMatch # Top-level item matched search, so display title
          @add(h2: item.title)
        else
          @add(h2: {'class', 'parentItem', '': ->
            @add(Zotero.getString('report.parentItem'))
            @add(span: {'class': 'title', '': -> item.title })
            return
          })

      if item.reportSearchMatch
        @metadata(item)
        @tags(item)
        @note(item.note)
        @attachments(item)

      if item.reportChildren?.notes?.length
        # Only display 'Notes:' header if parent matches search
        @add(h3: {'class': 'notes', '': Zotero.getString('report.notes')}) if item.reportSearchMatch
        @add(ul: {'class': 'notes', '': ->
          @add(li: {id: "note-#{note.itemID}", '': -> @note(note.note) }) for note in item.reportChildren.notes
          return
        })

      if item.reportSearchMatch and item.related?.length
        @add(h3: {'class': 'related', '': Zotero.getString('itemFields.related')})
        @add(ul: ->
          @add(li: {id: "related-#{related.getID()}", '': related.getDisplayTitle()}) for related in Zotero.Items.get(item.related)
          return
        )
      return
    })
    return

class Zotero.ReportCustomizer.Report extends Zotero.ReportCustomizer.XmlDocument
  constructor: (items, combineChildItems) ->
    @doc = Zotero.ReportCustomizer.document.implementation.createDocument(@namespace, 'html', null)
    @root = @doc.documentElement

    @add(head: ->
      @add(meta: {'http-equiv': 'Content-Type', content: 'text/html; charset=utf-8'})
      @add(title: Zotero.getString('report.title.default'))
      @add(link: {rel: 'stylesheet', type: 'text/css', href: 'zotero://report/detail.css'})
      @add(link: {rel: 'stylesheet', type: 'text/css', media: 'screen,projection', href: 'zotero://report/detail_screen.css'})
      @add(link: {rel: 'stylesheet', type: 'text/css', media: 'print', href: 'zotero://report/detail_print.css'})
      return
    )
    @add(body: ->
      @add(ul: {'class': "report#{if combineChildItems then ' combineChildItems' else ''}", '': ->
        for item in items
          @item(item)
        return
      })
      return
    )

  serialize: -> Zotero.ReportCustomizer.serializer.serializeToString(@doc)
