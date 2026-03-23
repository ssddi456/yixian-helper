import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import RefreshPlugin from "@rspack/plugin-react-refresh";
import path from "path";

const isDev = process.env.NODE_ENV === "development";

export default defineConfig({
  entry: {
    main: "./src/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash:8].js",
    publicPath: "/",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  experiments: {
    css: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: true,
              },
              transform: {
                react: {
                  runtime: "automatic",
                  development: isDev,
                  refresh: isDev,
                },
              },
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        type: "css/auto",
      },
      {
        test: /\.json$/,
        type: "json",
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: "./public/index.html",
    }),
    isDev && new RefreshPlugin(),
  ].filter(Boolean),
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    open: true,
  },
  devtool: isDev ? "cheap-module-source-map" : false,
  optimization: {
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin(),
      new rspack.LightningCssMinimizerRspackPlugin(),
    ],
  },
});
