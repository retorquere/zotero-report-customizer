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
# coffeelint: disable=no_implicit_returns

Zotero.Report = {
  generateHTMLDetails: (items, combineChildItems) ->
    return (new Zotero.ReportCustomizer.Report(items, combineChildItems)).serialize()
}

class Zotero.ReportCustomizer.ReportNode extends Zotero.ReportCustomizer.XmlNode
  constructor: (@namespace, @root, @doc) ->
    super(@namespace, @root, @doc)
    @alias('head meta title link body table tr th td a h2 h3 ul li p span')

  Node: ReportNode

  show: Zotero.ReportCustomizer.show

  metadata: (item) ->
    # Move dateAdded and dateModified to the end of the array
    da = item.dateAdded
    dm = item.dateModified
    delete item.dateAdded
    delete item.dateModified
    item.dateAdded = da
    item.dateModified = dm

    key = @doc.metadata.citekeys[item.itemID]
    item.citekey = "#{key.citekey} (#{if key.citeKeyFormat then 'generated' else 'pinned'})" if key # ", " + key.conflict + " conflict"  if key.conflict

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
      continue unless v && @show(k)
      attributes[k] = {label: localizedFieldName, value: v}

    return if (!item.creators || !@show('creator')) && Object.keys(attributes).length == 0

    @table(->
      @tr({'class': 'itemType', '': ->
        @th(Zotero.getString('itemFields.itemType'))
        @td(Zotero.ItemTypes.getLocalizedString(arr.itemType))
      }) if @show('itemType')

      if @show('creator')
        for creator in item.creators || []
          displayText = switch creator.fieldMode
            when 0 then "#{creator.firstName} #{creator.lastName}"
            when 1 then creator.lastName
            else ''
          @tr({'class': "creator #{creator.creatorType}", '': ->
            @th({'class': creator.creatorType, '': Zotero.getString("creatorTypes.#{creator.creatorType}")})
            @td(displayText)
          })

      for k, v of attributes
        @tr({'class': k, '': ->
          @th({'class': k, '': v.label})
          @td(->
            switch
              when k == 'url' and v.value.match(/^https?:\/\//)
                @a({href: v, '': v})

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
        })
    )

  tags: (item) ->
    return unless item.tags?.length && @show('tags')

    @h3({'class': 'tags', '': Zotero.getString('report.tags')})
    @ul({'class', 'tags', '': ->
      @li(tag.fields.name) for tag of item.tags
    })

  note: (note) ->
    return unless note && @show('note')

    # &nbsp; isn't valid in HTML
    # Strip control characters (for notes that were added before item.setNote() started doing this)
    _note = '<div>' + note.replace(/&nbsp;/g, '&#160;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') + '</div>'
    _note = Zotero.ReportCustomizer.parser.parseFromString(note, 'text/html')
    if _note.documentElement.tagName == 'parsererror'
      # If not valid XML, display notes with entities encoded
      Zotero.debug(note.documentElement.textContent, 2)
      @p({'class': 'plaintext', '': note})
    else # Otherwise render markup normally
      @add(_note.documentElement)

  attachments: (item) ->
    return unless item.attachments?.length && @show('attachments')

    @h3({'class': 'attachments', '': Zotero.getString('itemFields.attachments')})
    @ul({'class': 'attachments', '': ->
      for attachment of item.attachments
        @li(->
          @a({href: "zotero://select/items/#{item.libraryID || 0}_#{item.key}", '': item.title})
          @add(Zotero.getString("fulltext.indexState.indexed").toLowerCase() + ': ' + Zotero.getString(
            switch Zotero.Fulltext.getIndexedState(item.itemID)
              when Zotero.Fulltext.INDEX_STATE_UNAVAILABLE  then 'fulltext.indexState.unavailable'
              when Zotero.Fulltext.INDEX_STATE_UNINDEXED    then 'general.no'
              when Zotero.Fulltext.INDEX_STATE_PARTIAL      then 'fulltext.indexState.partial'
              when Zotero.Fulltext.INDEX_STATE_INDEXED      then 'general.yes'
              else                                               'general.no'
          ))
          @tags(attachment)
          @note(attachment.note)
        )
    })

  item: (item) ->
    @li({id: "item-#{item.itemID}", 'class': "item #{item.itemType}", '': ->
      if item.title
        if item.reportSearchMatch # Top-level item matched search, so display title
          @h2(-> @a({href: "zotero://select/items/#{item.libraryID || 0}_#{item.key}", '': item.title}))
        else
          @h2({'class', 'parentItem', '': ->
            @a({href: "zotero://select/items/#{item.libraryID || 0}_#{item.key}", '': ->
              @add(Zotero.getString('report.parentItem'))
              @span({'class': 'title', '': -> item.title })
            })
          })

      if item.reportSearchMatch
        @metadata(item)
        @tags(item)
        @note(item.note)
        @attachments(item)

      if item.reportChildren?.notes?.length && @show('note')
        # Only display 'Notes:' header if parent matches search
        @h3({'class': 'notes', '': Zotero.getString('report.notes')}) if item.reportSearchMatch
        @ul({'class': 'notes', '': ->
          @li({id: "note-#{note.itemID}", '': -> @note(note.note) }) for note in item.reportChildren.notes
        })

      if item.reportSearchMatch and item.related?.length && @show('related')
        @h3({'class': 'related', '': Zotero.getString('itemFields.related')})
        @ul(->
          @li({id: "related-#{related.getID()}", '': related.getDisplayTitle()}) for related in Zotero.Items.get(item.related)
        )
    })

class Zotero.ReportCustomizer.Report extends Zotero.ReportCustomizer.ReportNode
  constructor: (items, combineChildItems) ->
    super('http://www.w3.org/1999/xhtml', 'html')

    @doc.metadata = {}

    try
      order = (s for s in JSON.parse(Zotero.ReportCustomizer.prefs.getCharPref("sort")) when s.order)
    catch
      order = []

    items.sort((a, b) => return (rank for rank in (@compare(a, b, s) for s in order) when rank != 0)[0] || 0) if order.length > 0

    try
      @doc.metadata.citekeys = Zotero.BetterBibTex.getCiteKeys((Zotero.Items.get(item.itemID) for item in items)) if Zotero.BetterBibTex
    catch err
      Zotero.ReportCustomizer.log('could not load bibtex citation keys:', err)

    @head(->
      @meta({'http-equiv': 'Content-Type', content: 'text/html; charset=utf-8'})
      @title(Zotero.getString('report.title.default'))
      @link({rel: 'stylesheet', type: 'text/css', href: 'zotero://report/detail.css'})
      @link({rel: 'stylesheet', type: 'text/css', media: 'screen,projection', href: 'zotero://report/detail_screen.css'})
      @link({rel: 'stylesheet', type: 'text/css', media: 'print', href: 'zotero://report/detail_print.css'})
    )
    @body(->
      @ul({'class': "report#{if combineChildItems then ' combineChildItems' else ''}", '': ->
        @item(item) for item in items
      })
    )

    field: (item, field) ->
      return switch field
        when 'itemType'
          Zotero.ItemTypes.getName(item.itemTypeID)
        when 'date'
          item.getField('date', true, true)
        else
          item[field] || item.getField(field)

    compare: (a, b, sort) ->
      order = (if sort.order == 'd' then 1 else -1)
      a = @field(a, sort.name)
      b = @field(b, sort.name)

      if typeof a != number || typeof b != 'number'
        a = '' + a
        b = '' + b

        return 0 if a == b
        return -order if a < b
        return order
