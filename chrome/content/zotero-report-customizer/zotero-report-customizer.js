Zotero.ReportCustomizer = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer."),
  discardableFields: {},

  remove: function(key) {
    try {
      return Zotero.ReportCustomizer.prefs.getBoolPref('remove.' + key);
    } catch (err) {
      // console.log('Zotero.ReportCustomizer: could not get pref ' + key + ' (' + err + ')');
      return false;
    }
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

  script: function() {
    var unlinkRows = [];
    var text;

    for (field of Object.keys(Zotero.ReportCustomizer.discardableFields)) {
      if (Zotero.ReportCustomizer.remove(field)) {
        text = Zotero.ReportCustomizer.discardableFields[field];
        if ((typeof text) != 'undefined' && text != null && text != '') {
          unlinkRows.push(text);
        }
      }
    }

    var remove = {}
    for (p of ['attachments', 'tags']) {
      try {
        remove[p] = Zotero.ReportCustomizer.prefs.getBoolPref('remove.' + p);
      } catch (err) {
        remove[p] = false;
      }
    }

    return '<script type="text/javascript">'
      + 'var scrub = ' + Zotero.ReportCustomizer.scrub.toString() + ";\n"
      + 'try { scrub('
        + JSON.stringify(unlinkRows) + ','
        + JSON.stringify(remove['attachments']) + ','
        + JSON.stringify(remove['tags']) + "); } catch (err) { console.log(err); } \n"
      + '</script>';
  },

  scrub: function(unlinkRows, removeAttachments, removeTags) {
    var unlinkNodes = [];

    var getNodes = function(name, klass) {
      var nodes = [];
      var elements = document.getElementsByTagName(name); 
      for (var i = 0; i < elements.length; i++) { 
        if (!klass || elements[i].getAttribute('class') == klass) {
          nodes.push(elements[i]);
        }
      }
      return nodes;
    };

    for (node of getNodes('th')) {
      if (unlinkRows.indexOf(node.textContent) > -1) {
        unlinkNodes.push(node.parentNode);
      }
    }

    if (removeAttachments) {
      unlinkNodes = unlinkNodes.concat(getNodes('h3', 'attachments'));
      unlinkNodes = unlinkNodes.concat(getNodes('ul', 'attachments'));
    }

    if (removeTags) {
      unlinkNodes = unlinkNodes.concat(getNodes('h3', 'tags'));
      unlinkNodes = unlinkNodes.concat(getNodes('ul', 'tags'));
    }
        
    for (node of unlinkNodes) {
      try {
        node.parentNode.removeChild(node);
      } catch (err) { }
    }
  },

	init: function () {
    for (field of ['abstractNote', 'accessDate', 'applicationNumber', 'archive',
                    'archiveLocation', 'artworkMedium', 'artworkSize', 'assignee',
                    'attachments', 'audioFileType', 'audioRecordingFormat', 'billNumber',
                    'blogTitle', 'bookTitle', 'callNumber', 'caseName', 'code',
                    'codeNumber', 'codePages', 'codeVolume', 'committee', 'company',
                    'conferenceName', 'country', 'court', 'date', 'dateAdded',
                    'dateDecided', 'dateEnacted', 'dateModified', 'dictionaryTitle',
                    'distributor', 'docketNumber', 'documentNumber', 'DOI', 'edition',
                    'encyclopediaTitle', 'episodeNumber', 'extra', 'filingDate',
                    'firstPage', 'forumTitle', 'genre', 'history', 'institution',
                    'interviewMedium', 'ISBN', 'ISSN', 'issue', 'issueDate',
                    'issuingAuthority', 'journalAbbreviation', 'label', 'language',
                    'legalStatus', 'legislativeBody', 'letterType', 'libraryCatalog',
                    'manuscriptType', 'mapType', 'medium', 'meetingName', 'nameOfAct',
                    'network', 'notes', 'number', 'numberOfVolumes', 'numPages',
                    'pages', 'patentNumber', 'place', 'postType', 'presentationType',
                    'priorityNumbers', 'proceedingsTitle', 'programmingLanguage',
                    'programTitle', 'publicationTitle', 'publicLawNumber', 'publisher',
                    'references', 'related', 'reporter', 'reporterVolume', 'reportNumber',
                    'reportType', 'rights', 'runningTime', 'scale', 'section', 'series',
                    'seriesNumber', 'seriesText', 'seriesTitle', 'session', 'shortTitle',
                    'source', 'studio', 'subject', 'system', 'tags', 'thesisType', 'title',
                    'university', 'url', 'version', 'videoRecordingFormat', 'volume',
                    'websiteTitle', 'websiteType']) {
      Zotero.ReportCustomizer.discardableFields[field] = Zotero.getString('itemFields.' + field);
    }

    // monkey-patch Zotero.Report.generateHTMLDetails to modify the generated report
    Zotero.Report.generateHTMLDetails = (function (self, original) {
      return function (items, combineChildItems) {
        var report = original.apply(this, arguments);

        console.log('Scrubbing report');

        try {
          report = report.replace(/<\/body>/i, Zotero.ReportCustomizer.script() + '</body>');
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
