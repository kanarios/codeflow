const TerserPlugin = require('terser-webpack-plugin');

module.exports = function override(config, env) {
  // Настраиваем обфускацию только для production сборки
  if (env === 'production') {
    // Отключаем source maps
    config.devtool = false;

    // Настраиваем минификатор
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