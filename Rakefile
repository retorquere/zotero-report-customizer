require 'rake'
require 'shellwords'
require 'nokogiri'
require 'openssl'
require 'net/http'
require 'json'
require 'fileutils'
require 'time'
require 'date'
require 'pp'
require 'zip'
require 'tempfile'
require 'rubygems/package'
require 'zlib'
require 'open3'
require 'yaml'
require 'rake/loaders/makefile'
require 'rake/clean'
require 'net/http/post/multipart'

ZIPFILES = [
  'chrome/content/zotero-report-customizer/include.js',
  'chrome/content/zotero-report-customizer/options.js',
  'chrome/content/zotero-report-customizer/overlay.xul',
  'chrome/content/zotero-report-customizer/options.xul',
  'chrome/content/zotero-report-customizer/report.js',
  'chrome/content/zotero-report-customizer/zotero-report-customizer.js',
  'chrome/locale/en-US/zotero-report-customizer/zotero-report-customizer.dtd',
  'chrome/locale/en-US/zotero-report-customizer/zotero-report-customizer.properties',
  'chrome.manifest',
  'defaults/preferences/defaults.js',
  'install.rdf'
] + Dir['chrome/skin/**/*.*']

class String
  def shellescape
    Shellwords.escape(self)
  end
end

require 'zotplus-rakehelper'

Dir['**/*.js'].reject{|f| f =~ /^(node_modules|www)\//}.each{|f| CLEAN.include(f)}
CLEAN.include('tmp/**/*')
CLEAN.include('.depend.mf')
CLEAN.include('*.xpi')
CLEAN.include('*.log')
CLEAN.include('*.cache')
CLEAN.include('*.debug')
