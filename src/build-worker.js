const MemoryFS = require('memory-fs');
const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const FunctionModulePlugin = require('webpack/lib/FunctionModulePlugin');

const mem = new MemoryFS();
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

const output = {
    filename: 'compiled.js',
}

const config = {
    entry: [
        './src/worker-base.js',
        './src/worker-ntarc-base.js'
    ],
    target: (compiler) => {
        compiler.apply(
            new FunctionModulePlugin(output),
            new NodeTargetPlugin(),
            new webpack.LoaderTargetPlugin('webpack')
        )
    },
    output: output,
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
                    presets: ['env'],
                    plugins: [require('babel-plugin-transform-es2015-destructuring')]
                },
            }
        ]
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production')
        }),
        new UglifyJsPlugin()
    ]
};

const compiler = webpack(config);
compiler.outputFileSystem = mem;

compiler.run((err, stats) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(stats.toString({
        colors: true
    }));
    const content = JSON.stringify(mem.readFileSync(path.resolve(__dirname, '../compiled.js')).toString());
    fs.writeFileSync('./src/worker-ntarc.js', "module.exports.id = 'ntarc_worker';\nmodule.exports.src = "+content+";");
})