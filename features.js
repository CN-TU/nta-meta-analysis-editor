const fs = require('fs');
const csv = require('csv-parse/lib/sync');

const MATH = {
    add: '+',
    subtract: '-',
    multiply: '*',
    divide: '/',
    and: '&&',
    or: '||',
    equal: '=',
    greater: '>',
    less: '<',
    geq: '>=',
    leq: '<='
}

function ParseWarning(msg, item) {
    this.msg = msg;
    if(item.fake !== undefined) {
        this.msg = "Expanded from alias '"+item.fake+"': "+this.msg;
    }
    this.location = item.location;
    this.toString = function () {
        return this.msg;
    }
}

const iana_ies = new Set(exports.iana_ies = csv(fs.readFileSync("iana_ies.csv"), { columns: true }).map(
    function (row) {
        return row.Name;
    }
).filter(
    function (row) {
        if (row != "" &&
            row != "Reserved" &&
            row != "Unassigned" &&
            !row.startsWith('Assigned'))
            return true;
    }
).sort());
const own_ies = exports.own_ies = new Set(csv(fs.readFileSync("own_ies.csv"), { trim: true }).map(
    function (row) {
        return row[0];
    }
).sort());
const feature_aliases = JSON.parse(fs.readFileSync("feature_aliases.json").toString());
exports.feature_aliases = Object.keys(feature_aliases).sort()

const specification = exports.specification = require('./specification.js').parse(fs.readFileSync('specification.txt').toString(), { ParseWarning: ParseWarning });

function feature(element) {
    this.brace = false;
    this.element = element;
    this.render = function () {
        return "" + this.element;
    }
    this.simplify = function () { return this; };
}

function fun(op, args) {
    this.brace = false;
    this.op = op;
    this.args = args;
    this.toMath = function () {
        if (this.args.length == 2) {
            return MATH[this.op];
        }
        return undefined;
    }
    if (this.toMath() !== undefined) {
        this.brace = true;
    }
    this.render = function () {
        let ret = [];
        for (let i = 0; i < this.args.length; i++) {
            ret[i] = this.args[i].render();
        }
        let math = this.toMath();
        if (math === undefined) {
            return this.op + '(' + ret.join(', ') + ')'
        }
        ret = ret[0] + ' ' + math + ' ' + ret[1];
        if (this.brace) {
            return '(' + ret + ')';
        }
        return ret;
    }
    this.simplify = function (top, position) {
        if (this.brace) {
            if (top === undefined) {
                this.brace = false;
            } else {
                if (top.toMath() === undefined) {
                    this.brace = false;
                } else {
                    if ((this.op == "multiply" || this.op == "divide") && (top.op == "add" || top.op == "subtract")) {
                        this.brace = false;
                    }
                    if (position == 0 && (((this.op == "multiply" || this.op == "divide") && (top.op == "multiply" || top.op == "divide")) ||
                        ((this.op == "add" || this.op == "subtract") && (top.op == "add" || top.op == "subtract")))) {
                        this.brace = false;
                    }
                }
            }
        }
        for (let i = 0; i < this.args.length; i++) {
            this.args[i].simplify(this, i);
        }
        return this;
    };
}

function feature2text(input) {
    switch (typeof input) {
        case "string":
        case "boolean":
        case "number":
            return new feature(input);
        case "object":
            let key = Object.keys(input)[0];
            let args = input[key];
            for (let i = 0; i < args.length; i++) {
                args[i] = feature2text(args[i]);
            }
            return new fun(key, args);
    }
}

exports.feature2text = function (input) {
    return feature2text(input).simplify().render();
}

const featureParser = require('./feature.js');

exports.text2feature = function (input, errors, context) {
    let ret = featureParser.parse(input, {
        MATH: MATH,
        specification: specification,
        ParseWarning: ParseWarning,
        iana_ies: iana_ies,
        own_ies: own_ies,
        feature_aliases: feature_aliases
    });
    if (ret === null) {
        return ret;
    }
    let err = ret.check(errors, specification.BASE, context);
    if (err !== true)
        for (let error of err) {
            errors.push(error);
        }
    return ret.cleanup();
}
