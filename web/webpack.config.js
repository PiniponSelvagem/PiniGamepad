const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const language = require("./js/constants/PGP_LANGUAGE.json");

module.exports = (_environment, argv) => {
  const production = argv.mode === "production";
  const outputDirectory = production ? "build" : "debug";

  return {
    entry: "./entry.js",
    output: {
      path: path.resolve(__dirname, outputDirectory),
      filename: "resources/app.js",
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          test: /\.hbs$/i,
          type: "asset/source",
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./index.html",
        filename: "index.html",
        appTitle: language.application.name,
        loadingText: language.application.loading,
        favicon: "./assets/favicon.svg",
        inject: "body",
        minify: production,
      }),
      new MiniCssExtractPlugin({
        filename: "resources/style.css",
      }),
    ],
    performance: {
      hints: false,
    },
  };
};