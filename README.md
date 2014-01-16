# Zotero Report Customizer

Does what [Jason Priem's "Report Cleaner"](http://jasonpriem.org/projects/report_cleaner.php), but
without the copy-paste-into-website bit. Configuration panel allows you to pick the elements to remove
from the report, and they will simple not show up. Settings are synced through Firefox Sync if you
have set it up.

## Customizing the fields to display

The default is to display everything, and by default, all possible fields will have a checkmark set before them. If you remove the checkmark,
that field will not show up on the report. The fields are grouped per item type, but many of the fields are present in most of the itemtypes; if you
untick 'Title', it will untick them for *all* item types, as 'Title' is present in them all.

## Customizing the sort order

By default, Zotero orders reports for collections in whatever order they are sorted in your library, on title by default. The second tab of the
Resport Customizer config screen allows you to override this order. You can click the fields in order to change their sorting behavior
(ascending, descending, or not involved), and you can drag and drop the fields to change the grouping of the sort. If all fields are set to "not involved",
the sort falls back to the Zotero-default behavior.
