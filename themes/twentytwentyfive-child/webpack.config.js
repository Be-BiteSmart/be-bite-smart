const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
  ...defaultConfig,
  entry: {
    'style':        './src/style.js',
    'navbar':       './src/navbar.js',
    'forminator':   './src/forminator.js',
    'shared-blocks': './src/shared-blocks.js',
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
  },
};