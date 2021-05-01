const fs = require('fs')
const path = require('path')
const pug = require('pug')
const ts = require('typescript')
const tsconfig = require('../tsconfig.json')

module.exports.inline_ts = {
  name: 'inline-ts',
  setup(build) {
    build.onResolve({ filter:/^!!inline-ts!.+/ }, args => {
      args.path = args.path.replace(/^!!inline-ts!/, '')
      return {
        path: path.isAbsolute(args.path) ? args.path : path.join(args.resolveDir, args.path),
        namespace: 'inline-ts',
      }
    })

    build.onLoad({ filter: /^.+/, namespace: 'inline-ts' }, async (args) => {
      return {
        contents: ts.transpileModule(await fs.promises.readFile(args.path, 'utf-8'), tsconfig.compilerOptions).outputText,
        loader: 'text',
      }
    })
  }
}

module.exports.css = {
  name: 'css',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      return {
        contents: await fs.promises.readFile(args.path, 'utf-8'),
        loader: 'text'
      }
    })
  }
}
module.exports.pug = {
  name: 'pugjs',
  setup(build) {
    build.onLoad({ filter: /\.pug$/ }, async (args) => {
      await fs.promises.writeFile(args.path.replace(/\.pug$/, '.js'), pug.compileClient(await fs.promises.readFile(args.path, 'utf-8')) + '\nmodule.exports = template\n')
      return {
        contents: pug.compileClient(await fs.promises.readFile(args.path, 'utf-8')) + '\nmodule.exports = template\n',
        loader: 'js'
      }
    })
  }
}

module.exports.__dirname = {
  name: '__dirname',
  setup(build) {
    build.onLoad({ filter: /\/node_modules\/.+\.js$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf-8')
      const filename = 'resource://zotero-better-bibtex/' + args.path.replace(/.*\/node_modules\/(\.pnpm)?/, '')
      const dirname = path.dirname(filename)

      contents = [
        `var __dirname=${JSON.stringify(dirname)};`,
        `var __filename=${JSON.stringify(filename)};`,
        contents,
      ].join('\n')

      return {
        contents,
        loader: 'js'
      }
    })
  }
}
