const {
  override,
  addWebpackResolve,
  addWebpackPlugin,
} = require("customize-cra");
const webpack = require("webpack");

module.exports = {
  webpack: override(
    addWebpackResolve({
      fallback: {
        fs: false,
        net: false,
        stream: require.resolve("stream-browserify"),
        crypto: require.resolve("crypto-browserify"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        os: require.resolve("os-browserify/browser"),
        vm: require.resolve("vm-browserify"),
        process: require.resolve("process/browser"),
      },
    }),
    addWebpackPlugin(
      new webpack.ProvidePlugin({
        process: "process/browser",
      })
    )
  ),

  devServer: function (configFunction) {
    return function (proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      // devServer 커스터마이징
      return config;
    };
  },
};
