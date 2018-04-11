const webpack = require('webpack');
const path = require('path');

const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
    entry: './main.js',
    target: "electron-main",
    output: {
        filename: 'electron-compiled.js',
    },
    externals: [
    ],
    module: {
        strictExportPresence: true,
        rules: [
            {
                test: /\.(js|jsx|mjs)$/,
                loader: require.resolve('babel-loader'),
                options: {
                    babelrc: false,
                    presets: ['env']
                },
            }
        ]
    },
    node: {
        __dirname: false
    },
    plugins: [
        new UglifyJsPlugin()
    ]
};
