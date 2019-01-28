// tslint:disable:no-console

import * as webpack from 'webpack'
import * as path from 'path'

import CircularDependencyPlugin = require('circular-dependency-plugin')

import 'zotero-plugin/make-dirs'
import 'zotero-plugin/copy-assets'
import 'zotero-plugin/rdf'
import 'zotero-plugin/version'

const config = {
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
      'json-loader': 'zotero-plugin/loader/json',
      'wrap-loader': 'zotero-plugin/loader/wrap',
    },
  },
  module: {
    rules: [
      { test: /\.pug$/, use: [ 'pug-loader' ] },
      { test: /\.json$/, use: [ 'json-loader' ] },
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

export default config
