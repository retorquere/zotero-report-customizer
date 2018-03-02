// tslint:disable:no-console

import * as webpack from 'webpack'
import * as path from 'path'

// import BailPlugin from 'zotero-plugin/plugin/bail'

import CircularDependencyPlugin = require('circular-dependency-plugin')

import 'zotero-plugin/make-dirs'
import 'zotero-plugin/copy-assets'
import 'zotero-plugin/rdf'
import 'zotero-plugin/version'

const config = {
  mode: 'production',
  optimization: {
    minimize: false,
    concatenateModules: false,
    noEmitOnErrors: true,
    namedModules: true,
    namedChunks: true,
  },

  node: { fs: 'empty' },
  resolveLoader: {
    alias: {
      'json-jsesc-loader': 'zotero-plugin/loader/json',
      'wrap-loader': 'zotero-plugin/loader/wrap',
    },
  },
  module: {
    rules: [
      // https://github.com/webpack/webpack/issues/6572
      { test: /\.json$/, type: 'javascript/auto', use: [ 'json-jsesc-loader' ] },
      { test: /\.ts$/, exclude: [ /node_modules/ ], use: [ 'wrap-loader', 'ts-loader' ] },
    ],
  },

  plugins: [
    new webpack.NamedModulesPlugin(),
    new CircularDependencyPlugin({ failOnError: true }),
    // BailPlugin, noEmitOnErrors
  ],

  context: path.resolve(__dirname, './content'),

  entry: {
    ReportCustomizer: './ReportCustomizer.ts',
    'ReportCustomizer.Configure': './Configure.ts',
  },

  output: {
    pathinfo: true,

    path: path.resolve(__dirname, './build/content'),
    filename: '[name].js',
    jsonpFunction: 'Zotero.WebPackedReportCustomizer',
    devtoolLineToLine: true,
    library: 'Zotero.[name]',
    libraryTarget: 'assign',
  },
}

export default config
