Zotero.ReportCustomizer = {
	init: function () {
    // monkey-patch Zotero.Report.generateHTMLDetails to modify the generated report
    Zotero.Report.generateHTMLDetails = (function (self, original) {
      return function (items, combineChildItems) {
        var parser = new DOMParser(); 
        var report = parser.parseFromString(original.apply(this, arguments), 'text/html');

        console.log('Scrubbing report');

        try {
          var toUnlink = [];

          var node;
          var nodes
          
          nodes = report.evaluate('//th', report, null, XPathResult.ANY_TYPE, null );
          while (node = nodes.iterateNext()) {
            switch (node.textContent) {
              case 'Call Number':
              case 'ISBN':
              case 'ISSN':
              case 'Issue':
              case 'Journal Abbr':
              case 'Library Catalog':
              case '# of Pages':
              case 'Pages':
              case 'Place':
              case 'Publication':
              case 'Publisher':
              case 'Series':
              case 'Series Number':
              case 'Short Title':
              case 'Type':
              case 'Volume':
              case 'Language':
              case 'URL':
              case 'Rights':
              case 'Accessed':
              case 'Website Type':
              case 'Date Added':
              case 'Modified':
              case 'DOI':
                toUnlink.push(node.parentNode);
            }
          }
        } catch (err) {
          console.log('Scrub failed: ' + err);
        }

        nodes = report.evaluate("//ul[@class='attachments']", report, null, XPathResult.ANY_TYPE, null );
        while (node = nodes.iterateNext()) { toUnlink.push(node); }
        nodes = report.evaluate("//h3[@class='tags']", report, null, XPathResult.ANY_TYPE, null );
        while (node = nodes.iterateNext()) { toUnlink.push(node); }
        nodes = report.evaluate("//ul[@class='tags']", report, null, XPathResult.ANY_TYPE, null );
        while (node = nodes.iterateNext()) { toUnlink.push(node); }
        
        for (node of toUnlink) {
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
