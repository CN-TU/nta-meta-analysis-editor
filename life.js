const {text2feature} = require('./features.js');

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'feature> '
});

rl.prompt();

rl.on('line', line => {
    let errors = [];
    try {
        let ret = text2feature(line, errors, 'flows')
        if (errors.length) {
            console.log(errors.join("\n"));
        } else {
            console.log(JSON.stringify(ret, null, 2));
        }
    } catch(e) {
        console.log(e.message);
    }
    rl.prompt();
});
