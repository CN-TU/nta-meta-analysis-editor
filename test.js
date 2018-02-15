const VERSION = "v2.1";
const fs = require('fs');
const {feature2text, text2feature, specification} = require('./features.js');

var args = process.argv.slice(2);
if (args.length != 1) {
    throw "Need v2_directory as argument";
}

var path = args[0];

function test_feature(input, context) {
    let orig = JSON.stringify(input);
    let text = feature2text(input);
    console.log("\t",text);
    let errors = [];
    let parsed = text2feature(text, errors, context);
    let equal = orig === JSON.stringify(parsed);
    if (!equal) {
        throw [orig, JSON.stringify(parsed)];
    }
    if(errors.length) {
        throw errors.map((error) => { return "\t\t"+error; }).join("\n");
    }
}

function process_features(definitions, context) {
    let ret = 0;
    for(let definition of definitions) {
        if (definition.features !== undefined && definition.features.length > 0) {
            for(let feature of definition.features) {
                try {
                    test_feature(feature, context);
                } catch(e) {
                    console.log(e);
                    ret += 1;
                }
            }
        }
    }
    return ret;
}
let notok = 0;
let failed=[];
for(let year of fs.readdirSync(path)) {
    for(let file of fs.readdirSync(path+"/"+year)) {
        file = path+"/"+year+"/"+file
        console.log(file);
        let paper = JSON.parse(fs.readFileSync(file));
        if (paper["version"] != VERSION) {
            console.log("skipped - wrong version "+paper["version"]);
            continue;
        }
        let preprocessing = paper.preprocessing;
        if (preprocessing === undefined) {
            console.log("skipped - no preprocessing");
        }
        let isok=0;
        if (preprocessing.packets !== undefined && preprocessing.packets.length > 0) {
            isok += process_features(preprocessing.packets, "packets");
        }
        if (preprocessing.flows !== undefined && preprocessing.flows.length > 0) {
            isok += process_features(preprocessing.flows, "flows");
        }
        if (preprocessing.flow_aggregations !== undefined && preprocessing.flow_aggregations.length > 0) {
            isok += process_features(preprocessing.flow_aggregations, "flow_aggregations");
        }
        if(isok!=0) {
            notok++;
            failed.push(file);
        }
    }
}

console.log(notok, " failed papers:")
console.log(failed);