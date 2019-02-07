// tslint:disable:no-console

import * as path from 'path'
import * as fs from 'fs-extra'

import CircularDependencyPlugin = require('circular-dependency-plugin')
import { compileFromFile } from 'json-schema-to-typescript'

import 'zotero-plugin/make-dirs'
import 'zotero-plugin/copy-assets'
import 'zotero-plugin/rdf'
import 'zotero-plugin/version'

export default (async function() {
  fs.ensureDirSync('gen/typings')
  fs.writeFileSync('gen/typings/report-config.d.ts', (await compileFromFile('content/report-config.json')).replace(/\nexport interface /g, '\ninterface '))

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
      occurrenceOrder: false,
      usedExports: true,
      minimize: false,
      concatenateModules: false,
      noEmitOnErrors: true,
      namedModules: true,
      namedChunks: true,
      // runtimeChunk: false,
    },

    resolve: {
      extensions: ['.ts', '.js'],
    },

    node: { fs: 'empty' },

    resolveLoader: {
      alias: {
        'json-jsesc-loader': 'zotero-plugin/loader/json',
        'wrap-loader': 'zotero-plugin/loader/wrap',
        'inline-ts': path.join(__dirname, './loaders/inline-ts.ts'),
      },
    },
    module: {
      rules: [
        { test: /\.pug$/, use: [ 'pug-loader' ] },
        { test: /\.json$/, type: 'javascript/auto', use: [ 'json-jsesc-loader' ] }, // https://github.com/webpack/webpack/issues/6572
        { test: /\.woff2?$/, use: [ 'url-loader' ] },
        { test: /\.ts$/, exclude: [ /node_modules/ ], use: [ 'wrap-loader', 'ts-loader' ] },
      ],
    },

    plugins: [
      new CircularDependencyPlugin({ failOnError: true }),
    ],

    context: path.resolve(__dirname, './content'),

    entry: {
      ReportCustomizer: './zotero-report-customizer.ts',
    },

    output: {
      globalObject: 'Zotero',
      path: path.resolve(__dirname, './build/content'),
      filename: '[name].js',
      jsonpFunction: 'WebPackedReportCustomizer',
      devtoolLineToLine: true,
      pathinfo: true,
      library: 'Zotero.[name]',
      libraryTarget: 'assign',
    },
  }
})()
