Zotero.ReportCustomizer = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer."),
  parser: Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser),
  serializer: Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer),
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
		      var doc = Zotero.ReportCustomizer.parser.parseFromString(report, 'text/html');

          var remove = []
          for (field of Object.keys(Zotero.ReportCustomizer.discardableFields)) {
            if (Zotero.ReportCustomizer.remove(field)) {
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
