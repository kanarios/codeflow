const TerserPlugin = require('terser-webpack-plugin');

module.exports = function override(config, env) {
  // Configure obfuscation only for production build
  if (env === 'production') {
    // Disable source maps
    config.devtool = false;

    // Configure minifier
    config.optimization = {
      ...config.optimization,
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
            },
            mangle: true,
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
    };
  }

  return config;
}