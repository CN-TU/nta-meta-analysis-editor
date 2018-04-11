module.exports = function(ace, features, base_path) {
    ace.define('ntarc-feature', [], function (acequire, exports, module) {

        var oop = acequire("ace/lib/oop");
        var TextMode = acequire("ace/mode/text").Mode;
        var Range = acequire('ace/range').Range;
        var NTARCHighlightRules = acequire("ntarc_highlight_rules").NTARCHighlightRules;
        var completions = [];

        for (var key of features.specification.functions.keys()) {
            completions.push({
                caption: key,
                snippet: key,
                meta: "functions",
                score: 100000
            })
        }
        for (let feature of features.own_ies) {
            completions.push({
                caption: feature,
                snippet: feature,
                meta: "custom",
                score: 1000
            })
        }
        for (let feature of features.iana_ies) {
            completions.push({
                caption: feature,
                snippet: feature,
                meta: "iana",
                score: 10000
            })
        }

        var WorkerClient = acequire("ace/worker/worker_client").WorkerClient;

        var Mode = function () {
            this.HighlightRules = NTARCHighlightRules;
            this.createWorker = function (session) {
                var worker = new WorkerClient(["ace"], require("./worker-ntarc"), "Worker");
                worker.emit("setBasePath", {data: base_path});

                worker.attachToDocument(session.getDocument());

                worker.on("lint", function (results) {
                    session.setAnnotations(results.data.errors);
                    let markers = [];
                    for(let i=0;i<results.data.markers.length;i++) {
                        let r = results.data.markers[i].range;
                        console.log(r);
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
                return completions;
            }
        }).call(Mode.prototype);

        exports.Mode = Mode;
    });

    ace.define('ntarc_highlight_rules', function (acequire, exports, module) {

        var oop = acequire("ace/lib/oop");
        var TextHighlightRules = acequire("ace/mode/text_highlight_rules").TextHighlightRules;

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
};