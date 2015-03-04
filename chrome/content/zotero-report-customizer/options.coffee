applyAttributes = (node, attrs) ->
  return unless attrs
  for own key, value of attrs
    node.setAttribute(key, value)
  return

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
  Zotero.ReportCustomizer.prefs.setCharPref('sort', JSON.stringify(save))
  return

initializePrefs = ->
  XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
  itemTypes = document.getElementById('itemTypes')
  if itemTypes.childNodes.length is 0
    elt = (host, name, attrs) ->
      node = document.createElementNS(XUL, name)
      applyAttributes(node, attrs)
      host.appendChild(node)
      return node

    for type in Zotero.ReportCustomizer.fields.tree
      _type = elt(itemTypes, 'treeitem', {container: 'true'})
      _type_row = elt(_type, 'treerow')
      _type_cell = elt(_type_row, 'treecell', {properties: 'not-editable', editable: 'false'})
      _type_cell = elt(_type_row, 'treecell', {editable: 'false', label: type.label})
      _type_children = elt(_type, 'treechildren')

      for field in type.fields
        _field = elt(_type_children, 'treeitem')
        _field_row = elt(_field, 'treerow')
        _field_cell = elt(_field_row, 'treecell', {class: field.name + ' checkbox'})
        _field_cell = elt(_field_row, 'treecell', {editable: 'false', label: field.label})
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
      order = (field for field in JSON.parse(Zotero.ReportCustomizer.prefs.getCharPref('sort')) when field.order && fields.indexOf(field.name) >= 0)
    catch err
      order = []
    Zotero.debug("report-customizer: order = #{JSON.stringify(order)} out of #{JSON.stringify(fields)}")

    # add all of the fields that didn't have an explicit sort order set
    order = order.concat(({name: field} for field in fields when (1 for sorted in order when sorted.name == field).size == 0))

    Zotero.debug("report-customizer: full order = #{JSON.stringify(order)} out of #{JSON.stringify(fields)}")
    droppable = {
      droppable: 'true'
      ondragstart: 'return ReportSort_onDragStart(event)'
      ondragover: 'return ReportSort_onDragOver(event)'
      ondrop: 'return ReportSort_onDrop(event)'
    }

    sortOrder = document.getElementById('sortOrder')
    sortOrder.setAttribute('allowevents', 'true')
    applyAttributes(sortOrder, droppable)

    sortOrder.addEventListener('click', ((event) ->
      target = event.target
      target = target.parentNode  while target and target.localName isnt 'listitem'
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

    for field in order
      switch field.name
        when 'firstCreator'
          label = 'creatorTypes.author'
        when 'accessed'
          label = 'itemFields.accessDate'
        when 'type'
          label = 'itemFields.itemType'
        else
          label = 'itemFields.' + field.name
      label = Zotero.getString(label)

      attrs = {
        id: field.name
        label: label
        draggable: 'true'
      }

      attrs['class'] = 'report-sort-order-' + field.order  if field.order is 'a' or field.order is 'd'
      _field = elt(sortOrder, 'listitem', attrs)
      applyAttributes(_field, droppable)

  for field in Zotero.ReportCustomizer.fields.fields
    show = Zotero.ReportCustomizer.show(field)

    for cb in document.getElementsByClassName(field + ' checkbox')
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
  unless chkbox.getAttribute('editable') is 'false'
    show = (chkbox.getAttribute('value') is 'true')

    for cb in document.getElementsByClassName(cls)
      cb.setAttribute('value', (if show then 'true' else ''))

    # item.setAttribute('class', show ? '' : 'hidden');
    Zotero.ReportCustomizer.show(cls.replace(/(?:^|\s)checkbox(?!\S)/g, ''), show)
  return

ReportSort_onDragStart = (event) ->
  target = event.target
  target = target.parentNode  while target and target.localName isnt 'listitem'
  return  unless target
  event.dataTransfer.setData('text/plain', 'sortkey:' + target.getAttribute('id'))
  event.dataTransfer.effectAllowed = 'move'
  return

ReportSort_onDragOver = (event) ->
  event.preventDefault()
  moved = event.dataTransfer.mozGetDataAt('text/plain', 0)
  return false if moved.indexOf('sortkey:') is 0
  return

ReportSort_onDrop = (event) ->
  moved = event.dataTransfer.mozGetDataAt('text/plain', 0)
  return  unless moved.indexOf('sortkey:') is 0
  moved = moved.split(':')[1]
  moved = document.getElementById(moved)
  target = event.target
  if target.nodeName.toLowerCase() is 'listbox'
    target.appendChild(moved)
  else
    target.parentNode.insertBefore(moved, target.nextSibling)
  event.preventDefault()
  saveSortOrder()
  return
