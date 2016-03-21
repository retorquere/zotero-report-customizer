---
title: Report Customizer
---
# Zotero Report Customizer

Install by downloading the [latest version](https://zotplus.github.io/report-customizer/zotero-report-customizer-{% include report-customizer-version.html %}.xpi) (**{% include report-customizer-version.html %}**). If you are not
prompted with a Firefox installation dialog then double-click the downloaded xpi; Firefox ought to start and present you
with the installation dialog.

For standalone Zotero, do the following:

1. In the main menu go to Tools > Add-ons
2. Select 'Extensions'
3. Click on the gear in the top-right corner and choose 'Install Add-on From File...'
4. Choose .xpi that you've just downloaded, click 'Install'
5. Restart Zotero

Does what [Jason Priem's "Report Cleaner"](http://jasonpriem.org/projects/report_cleaner.php), but
without the copy-paste-into-website bit. Configuration panel allows you to pick the elements to remove
from the report, and they will simple not show up. Settings are synced through Firefox Sync if you
have set it up.

## Integration with [Zotero: Better BibTeX](/better-bibtex/)

This plugin now integrates with [Zotero: Better BibTeX](/better-bibtex/), to display the
bibtex key plus any conflicts between them.

## Customizing the fields to display

The default is to display everything, and by default, all possible fields will have a checkmark set before them. If you remove the checkmark,
that field will not show up on the report. The fields are grouped per item type, but many of the fields are present in most of the itemtypes; if you
untick 'Title', it will untick them for *all* item types, as 'Title' is present in them all.

## Customizing the sort order

By default, Zotero orders reports for collections in whatever order they are sorted in your library, on title by default. The second tab of the
Resport Customizer config screen allows you to override this order. You can click the fields in order to change their sorting behavior
(ascending, descending, or not involved), and you can drag and drop the fields to change the grouping of the sort. If all fields are set to "not involved",
the sort falls back to the Zotero-default behavior. **NOTICE**: the plugin now no longer forces Zotero to sort a chosen
order by fiddling with the report URL parameters (sort=) but by re-sorting the report after it has been generated. This
means the sort= parameter will be *ineffectual*; whatever you change it to, the plugin will re-sort according to the
plugin config. Somewhere along the line, the way I patched the sorting got broken, and I can't figure out why. This
works, and if you're using this plugin, you probably don't want to fiddle with the URL anyhow.

## Includes indexing status of attachments

Shows indexing status of attachments, plus links to select attachment

If you experience any problems, or are unclear on how to use it, I'll be glad to [help](/support.html).
