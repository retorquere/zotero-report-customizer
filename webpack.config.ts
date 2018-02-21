// tslint:disable:no-console

import * as webpack from 'webpack'
import * as path from 'path'

import BailPlugin from 'zotero-plugin/plugin/bail'

import CircularDependencyPlugin = require('circular-dependency-plugin')

import 'zotero-plugin/make-dirs'
import 'zotero-plugin/copy-assets'
import 'zotero-plugin/rdf'
import 'zotero-plugin/version'

const config = {
  node: { fs: 'empty' },
  resolveLoader: {
    alias: {
      'json-loader': 'zotero-plugin/loader/json',
      'wrap-loader': 'zotero-plugin/loader/wrap',
    },
  },
  module: {
    rules: [
      { test: /\.json$/, use: [ 'json-loader' ] },
      { test: /\.ts$/, exclude: [ /node_modules/ ], use: [ 'wrap-loader', 'ts-loader' ] },
    ],
  },

  plugins: [
    new webpack.NamedModulesPlugin(),
    new CircularDependencyPlugin({ failOnError: true }),
    BailPlugin,
  ],

  context: path.resolve(__dirname, './content'),

  entry: {
    ReportCustomizer: './ReportCustomizer.ts',
    'ReportCustomizer.Configure': './Configure.ts',
  },

  output: {
    path: path.resolve(__dirname, './build/content'),
    filename: '[name].js',
    jsonpFunction: 'Zotero.WebPackedReportCustomizer',
    devtoolLineToLine: true,
    pathinfo: true,
    library: 'Zotero.[name]',
    libraryTarget: 'assign',
  },
}

export default config
