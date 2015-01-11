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

NODEBIN="node_modules/.bin"

LINTED=[]
def expand(file, options={})
  dependencies = []

  #puts "expanding #{file.path.gsub(/^\.\//, '').inspect}"
  if File.extname(file.path) == '.coffee' && !options[:collect] && !LINTED.include?(file.path)
    sh "#{NODEBIN}/coffeelint #{file.path.shellescape}"
    LINTED << file.path
  end

  src = file.read
  src.gsub!(/(^|\n)require\s*\(?\s*'([^'\n]+)'[^\n]*/) {
    all = $&
    prefix = $1
    tbi = $2.strip

    #puts "including #{tbi.inspect}"
    i = [File.join(File.dirname(file.path), tbi), File.join('include', tbi)].detect{|f| File.file?(f) }
    throw "#{tbi} not found in #{file.path}" unless i
    dependencies << i
    result = File.file?(i) || !options[:collect] ? expand(open(i), options) : ''
    if result.is_a?(Array)
      dependencies << result[1]
      result = result[0]
    end

    prefix + result
  }
  return [src, dependencies.flatten.uniq] if options[:collect]
  return src
end

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

SOURCES = [
  'chrome/content/zotero-report-customizer/include.coffee',
  'chrome/content/zotero-report-customizer/options.coffee',
  'chrome/content/zotero-report-customizer/overlay.xul',
  'chrome/content/zotero-report-customizer/options.xul',
  'chrome/content/zotero-report-customizer/report.coffee',
  'chrome/content/zotero-report-customizer/zotero-report-customizer.coffee',
  'chrome/locale/en-US/zotero-report-customizer/zotero-report-customizer.dtd',
  'chrome/locale/en-US/zotero-report-customizer/zotero-report-customizer.properties',
  'chrome.manifest',
  'defaults/preferences/defaults.coffee',
  'install.rdf',
  "#{NODEBIN}/coffee",
  "#{NODEBIN}/coffeelint",
  'Rakefile',
  'update.rdf',
] + Dir['chrome/skin/**/*.*']

FileUtils.mkdir_p 'tmp'

class String
  def shellescape
    Shellwords.escape(self)
  end
end

require 'zotplus-rakehelper'

rule '.js' => '.coffee' do |t|
  header = t.source.sub(/\.coffee$/, '.yml')
  if File.file?(header)
    header = YAML.load_file(header)
    header['lastUpdated'] = DateTime.now.strftime('%Y-%m-%d %H:%M:%S')
  else
    header = nil
  end

  tmp = "tmp/#{File.basename(t.source)}"
  open(tmp, 'w'){|f| f.write(expand(open(t.source), header: header)) }
  puts "Compiling #{t.source}"
  output, status = Open3.capture2e("#{NODEBIN}/coffee -mbpc #{tmp.shellescape}")
  raise output if status.exitstatus != 0

  #output, status = Open3.capture2e('uglifyjs', stdin_data: output)
  #raise output if status.exitstatus != 0

  open(t.name, 'w') {|target|
    header = header ? JSON.pretty_generate(header) + "\n" : ''
    target.write(header + output)
  }
end

task :clean do
  clean = Dir['**/*.js'].select{|f| f=~ /^(defaults|chrome|resource)\//} + Dir['tmp/*'].select{|f| File.file?(f) }
  clean << 'resource/translators/latex_unicode_mapping.coffee'
  clean << 'resource/translators/mathchar.pegcoffee'
  clean.each{|f|
    File.unlink(f)
  }
end

task :dropbox => XPI do
  dropbox = File.expand_path('~/Dropbox')
  Dir["#{dropbox}/*.xpi"].each{|xpi| File.unlink(xpi)}
  FileUtils.cp(XPI, File.join(dropbox, XPI))
end

file '.depends.mf' => SOURCES do |t|
  open(t.name, 'w'){|dmf|
    dependencies = {}

    t.prerequisites.each{|src|
      next unless File.extname(src) == '.coffee' || File.extname(src) == '.pegcoffee'
      js = File.join(File.dirname(src), File.basename(src, File.extname(src)) + '.js')

      dependencies[src] ||= []
      dependencies[src] << js

      yml = File.join(File.dirname(src), File.basename(src, File.extname(src)) + '.yml')
      if File.file?(yml)
        dependencies[yml] ||= []
        dependencies[yml] << js
      end

      expand(open(src), collect: true)[1].each{|dep|
        dependencies[dep] ||= []
        dependencies[dep] << js
      }
    }

    dependencies.each_pair{|dependency, dependants|
      dmf.write("#{dependants.uniq.sort.collect{|d| d.shellescape }.join(' ')} : #{dependency.shellescape}\n")
    }
  }
end
import '.depends.mf'
