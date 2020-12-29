// tslint:disable:no-console

import * as path from 'path'
import * as fs from 'fs-extra'

import CircularDependencyPlugin = require('circular-dependency-plugin')
import { compileFromFile } from 'json-schema-to-typescript'
import PostCompile = require('post-compile-webpack-plugin')

import 'zotero-plugin/make-dirs'
import 'zotero-plugin/copy-assets'
import 'zotero-plugin/rdf'
import 'zotero-plugin/version'

export default (async function() {
  fs.ensureDirSync('gen/typings')
  fs.writeFileSync('gen/typings/report-config.d.ts', (await compileFromFile('content/report-config-schema.json')).replace(/\nexport interface /g, '\ninterface '))

  fs.writeFileSync(
    'gen/materialdesignicons.css',
    fs.readFileSync('node_modules/@mdi/font/css/materialdesignicons.css', 'utf-8').replace(/@font-face\s*\{(.|\r|\n)*?\}/, ''),
    'utf-8'
  )

  return {
    mode: 'development',
    devtool: false,
    optimization: {
      flagIncludedChunks: true,
      usedExports: true,
      minimize: false,
      concatenateModules: false,
      emitOnErrors: false,
      moduleIds: 'named',
      chunkIds: 'named',
      runtimeChunk: {
        name: 'webpack',
      },
    },

    resolve: {
      extensions: ['.ts', '.js'],
    },

    node: false,

    resolveLoader: {
      alias: {
        'jsesc-loader': path.join(__dirname, './loaders/jsesc'),
        'wrap-loader': 'zotero-plugin/loader/wrap',
        'inline-ts': path.join(__dirname, './loaders/inline-ts.ts'),
      },
    },
    module: {
      rules: [
        { test: /\.pug$/, use: [ 'pug-loader' ] },
        { test: /\.css$/, use: [ 'jsesc-loader', 'css-loader' ] },
        { test: /\.ts$/, exclude: [ /node_modules/ ], use: [ 'ts-loader' ] },
        { test: /\.woff2?$/,
          use: [ { loader: 'url-loader', options: { limit: 1024 * 1024 } } ], // allow up to a megabyte
        },
      ],
    },

    plugins: [
      new CircularDependencyPlugin({ failOnError: true }),
      new PostCompile(() => {
        const wrapped_webpack = `${target_dir}/${webpack_js}`
        if (fs.existsSync(wrapped_webpack)) {
          let js = fs.readFileSync(`${target_dir}/${webpack_js}`, 'utf-8')

          const prefix = 'if (!Zotero.webpackChunkReportCustomizer) {\n\n'
          const postfix = '\n\n}\n'

          if (!js.startsWith(prefix)) js = `${prefix}${js}${postfix}`

          fs.writeFileSync(`${target_dir}/${webpack_js}`, js)

        } else {
          console.log(`${wrapped_webpack} does not exist -- compilation error?`)

        }
      }),
    ],

    context: path.resolve(__dirname, './content'),

    entry: {
      ReportCustomizer: './zotero-report-customizer.ts',
    },

    output: {
      globalObject: 'Zotero',
      path: path.resolve(__dirname, './build/content'),
      filename: '[name].js',
      uniqueName: 'ReportCustomizer',
      pathinfo: true,
      library: 'Zotero.[name]',
      libraryTarget: 'assign',
    },
  }
})()
