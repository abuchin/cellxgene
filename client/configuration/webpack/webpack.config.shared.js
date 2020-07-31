const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ObsoleteWebpackPlugin = require("obsolete-webpack-plugin");
const ScriptExtHtmlWebpackPlugin = require("script-ext-html-webpack-plugin");

const src = path.resolve("src");
const nodeModules = path.resolve("node_modules");

const publicPath = "/";

module.exports = {
  entry: [
    "core-js",
    "regenerator-runtime/runtime",
    "fastestsmallesttextencoderdecoder",
    "whatwg-fetch",
    "abort-controller/polyfill",
    "./src/index",
  ],
  output: {
    path: path.resolve("build"),
    publicPath,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        include: src,
        exclude: [path.resolve(src, "index.css")],
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[name]__[local]___[hash:base64:5]",
              },
              importLoaders: 1,
            },
          },
        ],
      },
      {
        test: /index\.css$/,
        include: [path.resolve(src, "index.css")],
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.json$/,
        include: [src, nodeModules],
        loader: "json-loader",
        exclude: /manifest.json$/,
      },
    ],
  },
  plugins: [
    new ObsoleteWebpackPlugin({
      name: "obsolete",
      template:
        "<script>" +
        'var root = document.getElementById("root");' +
        "root.remove();" +
        'var portals = document.getElementsByClassName("bp3-portal");' +
        "for(var i = 0; i < portals.length; i += 1) {" +
        "portals[i].remove();" +
        "}" +
        "</script>" +
        '<div style="display: flex;flex-direction: column;width: 100vw;height: 100vh;text-align: center;justify-content: center;align-items: center;background: #8080801a;font-family: &quot;Roboto Condensed, sans serif&quot;;">' +
        '<img src="https://raw.githubusercontent.com/chanzuckerberg/cellxgene/main/docs/cellxgene-logo.png" style="width: 320px;"/>' +
        '<div style="margin-top: 16px;background: white;width: 40vw;border-radius: 4px;padding: 24px 64px;-webkit-box-shadow: 0px 0px 3px 2px rgba(0,0,0,0.38);-moz-box-shadow: 0px 0px 3px 2px rgba(0,0,0,0.38);box-shadow: 0px 0px 3px 2px rgba(0,0,0,0.38);max-width: 550px;">' +
        '<div style="margin-bottom: 0;font-weight: bolder;font-size: 1.2em;"> Unsupported Browser </div>' +
        '<div style="margin-top: 0;">cellxgene is currently supported on the following browsers</div>' +
        '<div style="display: flex;justify-content: space-around;margin-top: 16px">' +
        '<a href="https://www.google.com/chrome/?hl=en%22" aria-label="Download Google Chrome">' +
        '<img src="https://assets.beta.meta.org/images/browsers/chrome.png" style="width: 80px;height: 80px;"/>' +
        "<div>Chrome &gt; 60</div>" +
        "</a>" +
        '<a href="https://www.apple.com/safari/" aria-label="Download Safari">' +
        '<img src="https://assets.beta.meta.org/images/browsers/safari.png" style="width: 80px;height: 80px;"/>' +
        "<div>Safari ≥ 10.1</div>" +
        "</a>" +
        '<a href="https://www.mozilla.com/firefox/" aria-label="Download Firefox">' +
        '<img src="https://assets.beta.meta.org/images/browsers/firefox.png" style="width: 80px;height: 80px;"/>' +
        "<div>Firefox ≥ 60</div>" +
        "</a>" +
        '<a href="//www.microsoft.com/edge" aria-label="Download Edge">' +
        '<img src="https://assets.beta.meta.org/images/browsers/edge.png" style="width: 80px;height: 80px;"/>' +
        "<div>Edge ≥ 15</div>" +
        "</a>" +
        "</div>" +
        "</div>" +
        "</div>",
      promptOnNonTargetBrowser: false,
    }),
    new ScriptExtHtmlWebpackPlugin({
      async: "obsolete",
    }),
  ],
};