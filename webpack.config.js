const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const path = require('path');

// TODO: Use version in bundle release
// const fs = require('fs');
// const monacoVersion = JSON.parse(fs.readFileSync('package.json', 'utf-8')).dependencies["monaco-editor"];

module.exports = {
  entry: './index.js',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    // TODO: Use version in bundle release
    // filename: `monaco-editor@${monacoVersion}.js`,
    filename: `monaco-editor.js`,
    library: {
      type: 'module',
    },
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new MonacoWebpackPlugin({
      // TODO: Use version in bundle release
      // filename: `monaco-editor-[name].worker@${monacoVersion}.js`,
      filename: `monaco-editor-[name].worker.js`,
      publicPath: `/org.aquameta.ui.editor/widget.module/`,
      languages: ['javascript', 'typescript', 'html', 'css', 'pgsql', 'markdown'],
    })
  ],
};
