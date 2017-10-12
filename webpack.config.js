module.exports = {
  entry: '.',
  output: {
    filename: 'dist/bundle.js',
  },
  devServer: {
    host: '0.0.0.0',
    port: 8081,
    inline: true,
    disableHostCheck: true,
    filename: "bundle.js"
  },
  devtool: 'source-map',
  cache: true,
};
