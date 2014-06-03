require 'date'
require 'rake'
require 'nokogiri'

EXTENSION_ID = Nokogiri::XML(File.open('install.rdf')).at('//em:id').inner_text
EXTENSION = EXTENSION_ID.gsub(/@.*/, '')
RELEASE = Nokogiri::XML(File.open('install.rdf')).at('//em:version').inner_text
SOURCES = %w{chrome resources chrome.manifest install.rdf bootstrap.js}.collect{|f| File.directory?(f) ?  Dir["#{f}/**/*"] : f}.flatten.select{|f| File.file?(f)}
XPI = "zotero-#{EXTENSION}-#{RELEASE}.xpi"

task :default => XPI do
end

rule '.coffee' => '.js' do |t|
  sh "coffee -c #{t.source}"
end

file XPI => SOURCES do
  Dir['*.xpi'].each{|xpi| File.unlink(xpi)}
  sources = SOURCES.collect{|f| f.gsub(/\/.*/, '')}.uniq.join(' ')
  sh "zip -r #{XPI} #{sources}"
end

file 'update.rdf' => [XPI, 'install.rdf'] do
  update_rdf = Nokogiri::XML(File.open('update.rdf'))
  update_rdf.at('//em:version').content = RELEASE
  update_rdf.at('//RDF:Description')['about'] = "urn:mozilla:extension:#{EXTENSION_ID}"
  update_rdf.xpath('//em:updateLink').each{|link| link.content = "https://raw.github.com/ZotPlus/zotero-#{EXTENSION}/master/#{XPI}" }
  update_rdf.xpath('//em:updateInfoURL').each{|link| link.content = "https://github.com/ZotPlus/zotero-#{EXTENSION}" }
  File.open('update.rdf','wb') {|f| update_rdf.write_xml_to f}
end

task :publish => ['README.md', XPI, 'update.rdf'] do
  sh "git add --all ."
  sh "git commit -am #{RELEASE}"
  sh "git push"
end

file 'README.md' => [XPI, 'Rakefile'] do |t|
  puts 'Updating README.md'
  readme = File.open(t.name).read
  readme.gsub!(/\(http[^)]+\.xpi\)/, "(https://raw.github.com/ZotPlus/zotero-#{EXTENSION}/master/#{XPI})")
  readme.gsub!(/\*\*[0-9]+\.[0-9]+\.[0-9]+\*\*/, "**#{RELEASE}**")
  readme.gsub!(/[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}/, DateTime.now.strftime('%Y-%m-%d %H:%M'))
  File.open(t.name, 'w'){|f| f.write(readme)}
end

task :release, :bump do |t, args|
  bump = args[:bump] || 'patch'

  release = RELEASE.split('.').collect{|n| Integer(n)}
  release = case bump
            when 'major' then [release[0] + 1, 0, 0]
            when 'minor' then [release[0], release[1] + 1, 0]
            when 'patch' then [release[0], release[1], release[2] + 1]
            else raise "Unexpected release increase #{bump.inspect}"
            end
  release = release.collect{|n| n.to_s}.join('.')

  install_rdf = Nokogiri::XML(File.open('install.rdf'))
  install_rdf.at('//em:version').content = release
  install_rdf.at('//em:updateURL').content = "https://raw.github.com/ZotPlus/zotero-#{EXTENSION}/master/update.rdf"
  File.open('install.rdf','wb') {|f| install_rdf.write_xml_to f}
  puts "Release set to #{release}. Please publish."
end

def download(url, file)
  puts "Downloading #{url} to #{file}"
  uri = URI.parse(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true if url =~ /^https/i
  http.verify_mode = OpenSSL::SSL::VERIFY_NONE # read into this
  resp = http.get(uri.request_uri)

  #open(file, 'wb', :encoding => 'utf-8') { |file| file.write(resp.body) }
  open(file, 'w') { |file| file.write(resp.body) }
end

