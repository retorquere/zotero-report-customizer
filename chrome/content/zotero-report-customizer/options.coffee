# coffeelint: disable=no_implicit_braces
# coffeelint: disable=no_implicit_returns

saveSortOrder = ->
  sortOrder = document.getElementById('sortOrder')
  save = []

  for field in sortOrder.getElementsByTagName('listitem')
    rec = {name: field.getAttribute('id')}
    switch field.getAttribute('class')
      when 'report-sort-order-a'
        rec.order = 'a'
      when 'report-sort-order-d'
        rec.order = 'd'
    save.push(rec)
  Zotero.ReportCustomizer.set('sort', JSON.stringify(save))
  return

setup = ->
  itemTypes = document.getElementById('itemTypes')
  if itemTypes.childNodes.length == 0
    pane = new Zotero.ReportCustomizer.OptionsPane('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', itemTypes, document)

    for type in Zotero.ReportCustomizer.tree
      pane.treeitem({container: 'true', '': ->
        @treerow(->
          @treecell({properties: 'not-editable', editable: 'false'})
          @treecell({editable: 'false', label: type.label})
          @treechildren(->
            for field in type.fields
              @treeitem(->
                @treerow(->
                  @treecell({class: "#{field.name} checkbox"})
                  @treecell({editable: 'false', label: field.label})
                )
              )
          )
        )
      })

    fields = [
      'title'
      'firstCreator'
      'date'
      'accessed'
      'dateAdded'
      'dateModified'
      'publicationTitle'
      'publisher'
      'itemType'
      'series'
      'type'
      'medium'
      'callNumber'
      'pages'
      'archiveLocation'
      'DOI'
      'ISBN'
      'ISSN'
      'edition'
      'url'
      'rights'
      'extra'
    ]

    # load stored order
    try
      # parse and remove cruft
      order = Zotero.ReportCustomizer.get('sort')
      Zotero.ReportCustomizer.log('order:', order)
      order = (field for field in JSON.parse(order) when field.order && field.name in fields)
    catch err
      order = []
      Zotero.ReportCustomizer.log('error fetching order', err)
    Zotero.ReportCustomizer.log("order = #{JSON.stringify(order)} out of #{JSON.stringify(fields)}")

    # add all of the fields that didn't have an explicit sort order set
    names = (sort.name for sort in order)
    order = order.concat(({name: field} for field in fields when not(field in names)))

    Zotero.debug("report-customizer: full order = #{JSON.stringify(order)} out of #{JSON.stringify(fields)}")
    droppable = {
      droppable: 'true'
      ondragstart: 'return ReportSort_onDragStart(event)'
      ondragover: 'return ReportSort_onDragOver(event)'
      ondrop: 'return ReportSort_onDrop(event)'
    }

    sortOrder = document.getElementById('sortOrder')
    sortOrder.setAttribute('allowevents', 'true')
    Zotero.ReportCustomizer.OptionsPane::set(sortOrder, {allowevents: 'true'}, droppable)

    sortOrder.addEventListener('click', ((event) ->
      target = event.target
      target = target.parentNode  while target and target.localName != 'listitem'
      return  unless target

      switch target.getAttribute('class')
        when 'report-sort-order-a'
          target.setAttribute('class', 'report-sort-order-d')
        when 'report-sort-order-d'
          target.removeAttribute('class')
        else
          target.setAttribute('class', 'report-sort-order-a')
      saveSortOrder()
      return
    ), false)

    pane = new Zotero.ReportCustomizer.OptionsPane('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', sortOrder, document)
    for field in order
      label = Zotero.getString(switch field.name
        when 'firstCreator' then 'creatorTypes.author'
        when 'accessed'     then 'itemFields.accessDate'
        when 'type'         then 'itemFields.itemType'
        else                     "itemFields.#{field.name}"
      )

      attrs = {
        id: field.name
        label: label
        draggable: 'true'
      }
      attrs['class'] = "report-sort-order-#{field.order}" if field.order in ['a', 'd']
      pane.listitem(attrs, droppable)

initializePrefs = ->
  setup()

  for field in Zotero.ReportCustomizer.fields
    show = Zotero.ReportCustomizer.show(field)

    for cb in document.getElementsByClassName("#{field} checkbox")
      cb.setAttribute('value', (if show then 'true' else ''))
  return

# if (!show) { cb.parentNode.parentNode.setAttribute('class', cb.getAttribute('class') + ' hidden') }
toggleShowField = (tree, event) ->
  if event
    row = tree.treeBoxObject.getRowAt(event.clientX, event.clientY)
  else
    row = tree.currentIndex
  item = tree.contentView.getItemAtIndex(row)
  chkbox = item.firstChild.firstChild
  cls = chkbox.getAttribute('class')
  unless chkbox.getAttribute('editable') == 'false'
    show = (chkbox.getAttribute('value') == 'true')

    for cb in document.getElementsByClassName(cls)
      cb.setAttribute('value', (if show then 'true' else ''))

    # item.setAttribute('class', show ? '' : 'hidden');
    Zotero.ReportCustomizer.show(cls.replace(/(?:^|\s)checkbox(?!\S)/g, ''), show)
  return

ReportSort_onDragStart = (event) ->
  target = event.target
  target = target.parentNode  while target and target.localName != 'listitem'
  return  unless target
  event.dataTransfer.setData('text/plain', 'sortkey:' + target.getAttribute('id'))
  event.dataTransfer.effectAllowed = 'move'
  return

ReportSort_onDragOver = (event) ->
  event.preventDefault()
  moved = event.dataTransfer.mozGetDataAt('text/plain', 0)
  return false if moved.indexOf('sortkey:') == 0
  return

ReportSort_onDrop = (event) ->
  moved = event.dataTransfer.mozGetDataAt('text/plain', 0)
  return  unless moved.indexOf('sortkey:') == 0
  moved = moved.split(':')[1]
  moved = document.getElementById(moved)
  target = event.target
  if target.nodeName.toLowerCase() == 'listbox'
    target.appendChild(moved)
  else
    target.parentNode.insertBefore(moved, target.nextSibling)
  event.preventDefault()
  saveSortOrder()
  return


class Zotero.ReportCustomizer.OptionsPane extends Zotero.ReportCustomizer.XmlNode
  constructor: (@namespace, @root, @doc) ->
    super(@namespace, @root, @doc)

  Node: OptionsPane

  for name in ['treerow', 'treeitem', 'treecell', 'treechildren', 'listitem']
    OptionsPane::[name] = OptionsPane::alias(name)
