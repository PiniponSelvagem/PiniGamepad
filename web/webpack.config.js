const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

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