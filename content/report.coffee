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
    try
      return (new Zotero.ReportCustomizer.Report(items, combineChildItems)).serialize()
    catch e
      return '' + e
    return
}

class Zotero.ReportCustomizer.ReportNode extends Zotero.ReportCustomizer.XmlNode
  constructor: (@namespace, @root, @doc) ->
    super(@namespace, @root, @doc)

  Node: ReportNode

  ReportNode::alias(['head', 'meta', 'title', 'link', 'body', 'table', 'tr', 'th', 'td', 'a', 'h2', 'h3', 'ul', 'li', 'p', 'span'])

  show: (field) -> Zotero.ReportCustomizer.show(field)

  metadata: (item) ->
    # Move dateAdded and dateModified to the end of the array
    da = item.dateAdded
    dm = item.dateModified
    delete item.dateAdded
    delete item.dateModified
    item.dateAdded = da
    item.dateModified = dm

    citekey = Zotero.BetterBibTeX?.keymanager.get(item)
    if citekey
      properties = [if citekey.citekeyFormat then 'generated' else 'pinned']
      properties.push('duplicate') if @doc.citekeys?[citekey.citekey] > 1
      item.citekey = "#{citekey.citekey} (#{properties.join(', ')})"

    attributes = Object.create(null)
    for k, v of item
      # Skip certain fields
      switch k
        when 'reportSearchMatch', 'reportChildren', 'libraryID', 'key', 'itemType', 'itemID', 'sourceItemID', 'title', 'firstCreator', 'creators', 'tags', 'related', 'notes', 'note', 'attachments'
          continue
      try
        localizedFieldName = Zotero.ItemFields.getLocalizedString(item.itemType, k)
      catch e # Skip fields we don't have a localized string for
        Zotero.ReportCustomizer.log("Localized string not available for itemFields.#{k}")
        continue

      v = Zotero.Utilities.trim(v + '')
      continue unless v && @show(k)
      attributes[k] = {label: localizedFieldName, value: v}

    return if (!item.creators || !@show('creator')) && Object.keys(attributes).length == 0

    @table(->
      @tr({'class': 'itemType', '': ->
        @th(Zotero.getString('itemFields.itemType'))
        @td(Zotero.ItemTypes.getLocalizedString(item.itemType))
      }) if @show('itemType')

      if @show('creator')
        for creator in item.creators || []
          @tr({'class': "creator #{creator.creatorType}", '': ->
            @th({'class': creator.creatorType, '': Zotero.getString("creatorTypes.#{creator.creatorType}")})
            @td(if creator.fieldMode == 1 then creator.lastName else (name for name in [creator.firstName, creator.lastName] when name).join(' '))
          })

      for k, v of attributes
        @tr({'class': k, '': ->
          @th({'class': k, '': v.label})
          @td(->
            switch
              when k == 'url' and v.value.match(/^https?:\/\//)
                @a({href: v.value, '': v.value})

              # Remove SQL date from multipart dates
              # (e.g. '2006-00-00 Summer 2006' becomes 'Summer 2006')
              when k == 'date'
                @add(Zotero.Date.multipartToStr(v.value))

              when k == 'DOI'
                url = v.value
                url = 'http://doi.org/' + url unless url.match(/^https?:\/\//)
                @a({href: url, '': v.value})

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
      @li(tag.fields.name) for tag in item.tags
    })

  note: (note) ->
    return unless note && @show('notes')

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
      for attachment in item.attachments
        @li(->
          @a({href: "zotero://select/items/#{attachment.libraryID || 0}_#{attachment.key}", '': attachment.title})
          @add(', ' + Zotero.getString("fulltext.indexState.indexed").toLowerCase() + ': ' + Zotero.getString(
            switch Zotero.Fulltext.getIndexedState(attachment.itemID)
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

      if item.reportChildren?.notes?.length && @show('notes')
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

    try
      order = (s for s in JSON.parse(Zotero.ReportCustomizer.get('sort')) when s.order)
    catch
      order = []

    items.sort((a, b) => return (rank for rank in (@compare(a, b, s) for s in order) when rank != 0)[0] || 0) if order.length > 0

    @doc.citekeys = {}
    if Zotero.BetterBibTeX
      for item in items
        citekey = Zotero.BetterBibTeX.keymanager.get(item)
        continue unless citekey
        @doc.citekeys[citekey.citekey] ||= 0
        @doc.citekeys[citekey.citekey] += 1

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
    return Zotero.ItemTypes.getName(item.itemTypeID) if field == 'itemType'
    return item[field]

  compare: (a, b, sort) ->
    order = {d: 1, a: -1}[sort.order]
    return 0 unless order

    a = @field(a, sort.name)
    b = @field(b, sort.name)

    if typeof a != 'number' || typeof b != 'number'
      a = '' + a
      b = '' + b

      return 0 if a == b
      return -order if a < b
      return order
