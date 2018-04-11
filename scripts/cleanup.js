const path = require('path');
const fs = require('fs');

const MAIN_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Paper Editor</title><link href="main.css" rel="stylesheet"></head><body><div id="root"></div><script type="text/javascript" src="main.js"></script></body></html>';
const REMOVE = ['asset-manifest.json', 'service-worker.js'];

function moveFile(type) {
    for(let file of fs.readdirSync(path.resolve(__dirname, '../build/static', type))) {
        if (file.endsWith('.'+type))
            fs.renameSync(path.resolve(__dirname, '../build/static', type, file), path.resolve(__dirname, '../build', 'main.'+type));
        else
            fs.unlinkSync(path.resolve(__dirname, '../build/static', type, file));
    }
    fs.rmdirSync(path.resolve(__dirname, '../build/static', type));
}

fs.writeFileSync(path.resolve(__dirname, '../build/index.html'), MAIN_HTML);
moveFile('css');
moveFile('js');
fs.rmdirSync(path.resolve(__dirname, '../build/static'));
for(let file of REMOVE) {
    fs.unlinkSync(path.resolve(__dirname, '../build', file));
}