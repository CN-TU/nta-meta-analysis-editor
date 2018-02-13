const features = require('./features.js');
define('ntarc-feature', function (require, exports, module) {

    var oop = require("ace/lib/oop");
    var config = require("ace/config");
    var TextMode = require("ace/mode/text").Mode;
    var NTARCHighlightRules = require("ntarc_highlight_rules").NTARCHighlightRules;
    var competions = [];

    for (var key of features.specification.functions.keys()) {
        competions.push({
            caption: key,
            snippet: key,
            meta: "functions",
            score: 100000
        })
    }
    for (var i = 0; i < features.own_ies.length; i++) {
        competions.push({
            caption: features.own_ies[i],
            snippet: features.own_ies[i],
            meta: "custom",
            score: 1000
        })
    }
    for (var i = 0; i < features.iana_ies.length; i++) {
        competions.push({
            caption: features.iana_ies[i],
            snippet: features.iana_ies[i],
            meta: "iana",
            score: 10000
        })
    }

    var WorkerClient = require("ace/worker/worker_client").WorkerClient;

    var Mode = function () {
        this.HighlightRules = NTARCHighlightRules;
        this.createWorker = function (session) {
            MyWorkerClient = function(){
                this.$sendDeltaQueue = this.$sendDeltaQueue.bind(this);
                this.changeListener = this.changeListener.bind(this);
                this.onMessage = this.onMessage.bind(this);

                this.$worker = new Worker('worker-ntarc.js');

                this.$worker.postMessage({
                    init: true,
                    tlns: undefined,
                    module: "ntarc_worker",
                    classname: "WorkerModule"
                });

                this.callbackId = 1;
                this.callbacks = {};

                this.$worker.onmessage = this.onMessage;
            }
            MyWorkerClient.prototype = WorkerClient.prototype;
            var worker = new MyWorkerClient();
            
            var markers = new Map();

            worker.attachToDocument(session.getDocument());

            worker.on("lint", function (results) {
                session._signal("ntarc", results.data.result);
                session.setAnnotations(results.data.errors);
                let markers = [];
                for(let i=0;i<results.data.markers.length;i++) {
                    let r = results.data.markers[i].range;
                    markers.push({
                        range : new Range(...r),
                        type : "text",
                        renderer: null,
                        clazz : "ntarc_"+results.data.markers[i].type,
                        inFront: false,
                        id: i
                    });
                }
                session.$backMarkers = markers;
                session._signal("changeBackMarker");
            });

            worker.on("terminate", function () {
                session.clearAnnotations();
            });

            return worker;
        };
    };
    oop.inherits(Mode, TextMode);

    (function () {
        this.getCompletions = function (state, session, pos, prefix) {
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
                    token: function (value) {
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
