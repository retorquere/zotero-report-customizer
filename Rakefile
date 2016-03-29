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
require_relative 'lib/rake/xpi'
require_relative 'lib/rake/xpi/github'


task :gather do
  found = [
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
  found.sort!
  found.uniq!

  expected = XPI.files.sort

  if expected == found
    STDERR.puts "All accounted for"
  else
    STDERR.puts "Intended for publishing, but no source:  #{expected - found}" if (expected - found).length > 0
    STDERR.puts "Not published: #{found - expected}" if (found - expected).length > 0
  end
end

Dir['**/*.js'].reject{|f| f =~ /^(node_modules|www)\//}.each{|f| CLEAN.include(f)}
CLEAN.include('tmp/**/*')
CLEAN.include('.depend.mf')
CLEAN.include('*.xpi')
CLEAN.include('*.log')
CLEAN.include('*.cache')
CLEAN.include('*.debug')
