const fs = require('fs');

for(let i=0;i<iana_ies.length; i++)
    console.log(iana_ies[i]);

for(let i=0;i<own_ies.length; i++)
    console.log(own_ies[i]);

const {feature2text, text2feature} = require('./features.js');

function doit(input) {
    let features = JSON.parse(input);
    let featuresOrig = JSON.parse(input);
    for(let i=0; i<features.length; i++) {
        let text = feature2text(features[i]);
        console.log(text);
        let errors = [];
        let parsed = text2feature(text, errors);
        let equal = JSON.stringify(featuresOrig[i]) === JSON.stringify(parsed);
        if (!equal) {
          throw "bad";
        }
        if(errors.length) {
          throw errors;
        }
    }
}

doit(fs.readFileSync("tests.json").toString());
