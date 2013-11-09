Zotero.ReportCustomizer = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zotero-report-customizer."),
  discardableFields: [],

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
        var parser = new DOMParser(); 
        var report = parser.parseFromString(original.apply(this, arguments), 'text/html');

        console.log('Scrubbing report');
        var unlinkNodes = [];

        try {
          var unlinkRows = [Zotero.ReportCustomizer.discardableFields[field] for (field of Object.keys(Zotero.ReportCustomizer.discardableFields)) if Zotero.ReportCustomizer.prefs.getBoolPref('remove.' + field)];
          unlinkRows = [text for (text of unlinkRows) if ((typeof text) != 'undefined' && text != null && text != '')];

          var node;
          var nodes
          
          nodes = report.evaluate('//th', report, null, XPathResult.ANY_TYPE, null );
          while (node = nodes.iterateNext()) {
            if (unlinkRows.indexOf(node.textContent) > -1) {
              unlinkNodes.push(node.parentNode);
            }
          }
        } catch (err) {
          console.log('Scrub failed: ' + err);
        }

        if (Zotero.ReportCustomizer.prefs.getBoolPref('remove.attachments')) {
          nodes = report.evaluate("//ul[@class='attachments']", report, null, XPathResult.ANY_TYPE, null );
          while (node = nodes.iterateNext()) { unlinkNodes.push(node); }
        }

        if (Zotero.ReportCustomizer.prefs.getBoolPref('remove.tags')) {
          nodes = report.evaluate("//h3[@class='tags']", report, null, XPathResult.ANY_TYPE, null );
          while (node = nodes.iterateNext()) { unlinkNodes.push(node); }
          nodes = report.evaluate("//ul[@class='tags']", report, null, XPathResult.ANY_TYPE, null );
          while (node = nodes.iterateNext()) { unlinkNodes.push(node); }
        }
        
        for (node of unlinkNodes) {
          try {
            node.parentNode.removeChild(node);
          } catch (err) {
          }
        }
        var ser = new XMLSerializer();
        return ser.serializeToString(report);
      }
    })(this, Zotero.Report.generateHTMLDetails);
	}
};

// Initialize the utility
window.addEventListener('load', function(e) { Zotero.ReportCustomizer.init(); }, false);
