module.exports = {
  entry: './test/',
  output: {
    filename: 'test/test.bundle.js',
  },
  devServer: {
    host: '0.0.0.0',
    port: 8090,
    inline: true,
    disableHostCheck: true,
    filename: 'test.bundle.js'
  },
  devtool: 'source-map',
  cache: true,
};
