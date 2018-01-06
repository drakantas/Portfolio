"use strict";

const Path = require("path");
const Webpack = require("webpack");
const UglifyPlugin = require('uglifyjs-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
    entry: "./ui/app.js",
    output: {
        filename: "js/app.bundle.js",
        path: Path.resolve(__dirname, "build"),
        publicPath: "/static/"
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["es2015"]
                    }
                }
            },
            {
                test: /\.(?:s?css|sass)$/,
                use: ExtractTextPlugin.extract({
                    fallback: 'style-loader',
                    use: [
                        {
                            loader: 'css-loader',
                            options: {
                                minimize: true
                            }
                        }, 
                        {
                            loader: 'sass-loader'
                        }
                    ]
                })
            }
        ]
    },
    plugins: [
        new UglifyPlugin(),
        new ExtractTextPlugin({
            filename: "css/app.bundle.css",
            disable: false
        })
    ]
}
