const features = require('./features.js');
define('ntarc-feature', function (require, exports, module) {

    var oop = require("ace/lib/oop");
    var TextMode = require("ace/mode/text").Mode;
    var NTARCHighlightRules = require("ntarc_highlight_rules").NTARCHighlightRules;
    var competions = [];
    
    for(var key of features.specification.functions.keys()) {
        competions.push({
            caption: key,
            snippet: key,
            meta: "functions",
            score: Number.MAX_VALUE
        })
    }
    for(var i=0; i<features.own_ies.length; i++) {
        competions.push({
            caption: features.own_ies[i],
            snippet: features.own_ies[i],
            meta: "custom",
            score: Number.MAX_VALUE
        })
    }
    for(var i=0; i<features.iana_ies.length; i++) {
        competions.push({
            caption: features.iana_ies[i],
            snippet: features.iana_ies[i],
            meta: "iana",
            score: Number.MAX_VALUE
        })
    }

    var Mode = function () {
        this.HighlightRules = NTARCHighlightRules;
    };
    oop.inherits(Mode, TextMode);

    (function () {
        this.getCompletions = function(state, session, pos, prefix) {
            return competions;
        }
    }).call(Mode.prototype);

    exports.Mode = Mode;
});

define('ntarc_highlight_rules', function (require, exports, module) {

    var oop = require("ace/lib/oop");
    var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

    var NTARCHighlightRules = function () {
        let iana = new Set(features.iana_ies);
        let own = new Set(features.own_ies);
        this.$rules = {
            start: [
                {
                    token: "constant.language",
                    regex: "true|false|[0-9]+(\\.[0-9]*)?|\\.[0-9]+"
                },
                {
                    token: "paren.keyword.operator",
                    regex: "[()]"
                },
                {
                    token: function(value) {
                        if (value.startsWith('__')) {
                            return "comment";
                        }
                        if (own.has(value)) {
                            return "variable";
                        }
                        if (iana.has(value)) {
                            return "support.type";
                        }
                        if (features.specification.functions.has(value)) {
                            return "keyword";
                        }
                        return "text";
                    },
                    regex: "\\w+"
                },
                {
                    token: "entity.name.section",
                    regex: "__\\w+"
                }
            ]
        };

    }

    oop.inherits(NTARCHighlightRules, TextHighlightRules);

    exports.NTARCHighlightRules = NTARCHighlightRules;
});