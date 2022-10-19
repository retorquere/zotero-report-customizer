// tslint:disable:no-console

const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')
const rmrf = require('rimraf')

const loader = require('./loaders')

require('zotero-plugin/make-dirs')
require('zotero-plugin/copy-assets')
require('zotero-plugin/rdf')
require('zotero-plugin/version')

async function bundle(config) {
  config = {
    ...config,
    bundle: true,
    format: 'iife',
  }
  if (!config.platform) config.target = ['firefox60']

  config.metafile = true

  if (config.prepend) {
    if (!Array.isArray(config.prepend)) config.prepend = [config.prepend]
    for (const source of config.prepend.reverse()) {
      config.banner.js = `${await fs.promises.readFile(source, 'utf-8')}\n${config.banner.js}`
    }
    delete config.prepend
  }

  let target
  if (config.outfile) {
    target = config.outfile
  }
  else if (config.entryPoints.length === 1 && config.outdir) {
    target = path.join(config.outdir, path.basename(config.entryPoints[0]).replace(/\.ts$/, '.js'))
  }
  else {
    target = `${config.outdir} [${config.entryPoints.join(', ')}]`
  }
  console.log('** bundling', target)
  await esbuild.build(config)
}

(async function() {
  rmrf.sync('gen')
  await fs.promises.writeFile(
    'gen/materialdesignicons.css',
    (await fs.promises.readFile('node_modules/@mdi/font/css/materialdesignicons.css', 'utf-8')).replace(/@font-face\s*\{(.|\r|\n)*?\}/, ''),
    'utf-8'
  )

  // plugin code
  await bundle({
    entryPoints: [ 'content/zotero-report-customizer.ts' ],
    plugins: [loader.pug, loader.css, loader.__dirname],
    loader: { '.woff': 'dataurl', '.woff2': 'dataurl' },
    outdir: 'build/content',
  })
})().catch(err => {
  console.log(err)
  process.exit(1)
})
