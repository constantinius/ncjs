module.exports = {
  entry: '.',
  output: {
    filename: 'dist/bundle.js',
  },
  devServer: {
    host: '0.0.0.0',
    inline: true,
    disableHostCheck: true,
    filename: "bundle.js"
  },
  devtool: 'source-map',
  cache: true,
};
