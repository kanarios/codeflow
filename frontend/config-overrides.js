const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = function override(config, env) {
  config.plugins.push(new MonacoWebpackPlugin({
    languages: ['javascript', 'python', 'ruby'],
    features: ['!gotoSymbol']
  }));

  return config;
}