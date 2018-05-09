const download = require('download-tarball');
const {PROJECT, API_URL, needed} = require('../config.js');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

let link = url.parse(API_URL + PROJECT + "/tags");
link.headers =  {'User-Agent': 'CN-TU/nta-meta-analysis-editor updater'};

req = https.get(link);
req.on('response', (response) => {
    if (response.statusCode == 200) {
        var data = ''
        response.on('data', (chunk) => {
            data += chunk
        })
        response.on('end', () => {
            data = JSON.parse(data)
            data = new Map(data.map(tag => {return [tag.name, tag.commit.sha];}));
            let tags = Array.from(data.keys()).filter(tag => tag[tag.length - 1] != "a").sort();
            let latestTag = tags[tags.length - 1];
            fs.writeFileSync('./spec/commit.json', JSON.stringify({sha:data.get(latestTag), tag:latestTag}));
            download({
                url: API_URL + PROJECT +'/tarball/'+latestTag,
                dir: './spec/',
                extractOpts: {
                    ignore: (_, header) => {
                        if(needed.has(header.name)) return false;
                        return true;
                    },
                    map: header => {
                        header.name = header.name.split('/').slice(1).join('/');
                        return header;
                    }
                }
            }).then(() => {
                console.log("updated to latest tag")
            }).catch(err => {
                console.log(err);
            });
        })
    }
})
