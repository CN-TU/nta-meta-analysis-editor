const { feature2text, text2feature } = require('./features.js');
importScripts('./worker.js');
require('node_modules/ace-builds/src/ace');

define("ace/worker/mirror", ["require", "exports", "module", "ace/range", "ace/document", "ace/lib/lang"], function (require, exports, module) {
    "use strict";

    var Range = require("../range").Range;
    var Document = require("../document").Document;
    var lang = require("../lib/lang");

    var Mirror = exports.Mirror = function (sender) {
        this.sender = sender;
        var doc = this.doc = new Document("");

        var deferredUpdate = this.deferredUpdate = lang.delayedCall(this.onUpdate.bind(this));

        var _self = this;
        sender.on("change", function (e) {
            var data = e.data;
            if (data[0].start) {
                doc.applyDeltas(data);
            } else {
                for (var i = 0; i < data.length; i += 2) {
                    if (Array.isArray(data[i + 1])) {
                        var d = { action: "insert", start: data[i], lines: data[i + 1] };
                    } else {
                        var d = { action: "remove", start: data[i], end: data[i + 1] };
                    }
                    doc.applyDelta(d, true);
                }
            }
            if (_self.$timeout)
                return deferredUpdate.schedule(_self.$timeout);
            _self.onUpdate();
        });
    };

    (function () {

        this.$timeout = 500;

        this.setTimeout = function (timeout) {
            this.$timeout = timeout;
        };

        this.setValue = function (value) {
            this.doc.setValue(value);
            this.deferredUpdate.schedule(this.$timeout);
        };

        this.getValue = function (callbackId) {
            this.sender.callback(this.doc.getValue(), callbackId);
        };

        this.onUpdate = function () {
        };

        this.isPending = function () {
            return this.deferredUpdate.isPending();
        };

    }).call(Mirror.prototype);

});

define("ntarc_worker", function (require, exports, module) {
    "use strict";

    var oop = require("ace/lib/oop");
    var Mirror = require("ace/worker/mirror").Mirror;

    var WorkerModule = exports.WorkerModule = function (sender) {
        Mirror.call(this, sender);
        this.setTimeout(500);
    };

    oop.inherits(WorkerModule, Mirror);

    (function () {
        this.onUpdate = function () {
            var value = this.doc.getValue();
            let features = value.split(';');
            let current_line = 0;
            let current_column = 0;
            let markers = [];
            let errors = [];
            let obj = [];
            for (let i = 0; i < features.length; i++) {
                let current_warnings = [];
                let lines = features[i].split('\n');
                let next_line = lines.length - 1;
                let next_column = lines[lines.length - 1].length;
                let feature = null;
                try {
                    feature = text2feature(features[i], current_warnings);
                    if (feature != null) {
                        obj.push(feature);
                    }
                    for(let j=0; j<current_warnings.length; j++) {
                        let error = {
                            row: current_warnings[j].location.start.line - 1 + current_line,
                            column: current_warnings[j].location.start.column - 1 + (current_warnings[j].location.start.line == 1 ? current_column : 0),
                            range: [
                                current_warnings[j].location.start.line - 1 + current_line,
                                current_warnings[j].location.start.column - 1 + (current_warnings[j].location.start.line == 1 ? current_column : 0),
                                current_warnings[j].location.end.line - 1 + current_line,
                                current_warnings[j].location.end.column - 1 + (current_warnings[j].location.end.line == 1 ? current_column : 0),
                            ],
                            text: current_warnings[j].error,
                            type: "warning"
                        }
                        errors.push(error);
                        if(j==0) {
                            markers.push(error);
                        }
                    }
                } catch (e) {
                    if (e.location === undefined) throw e;
                    let error = {
                        row: e.location.start.line - 1 + current_line,
                        column: e.location.start.column - 1 + (e.location.start.line == 1 ? current_column : 0),
                        range: [
                            e.location.start.line - 1 + current_line,
                            e.location.start.column - 2 + (e.location.start.line == 1 ? current_column : 0),
                            e.location.end.line - 1 + current_line,
                            e.location.end.column - 1 + (e.location.end.line == 1 ? current_column : 0),
                        ],
                        text: e.message,
                        type: "error"
                    }
                    errors.push(error);
                    markers.push(error);
                } finally {
                    current_line += next_line;
                    current_column = next_column;
                }
            }
            let result = JSON.stringify(obj, null, 2);

            this.sender.emit("lint", {
                result: result,
                errors: errors,
                markers: markers
            });
        };
    }).call(WorkerModule.prototype);

});
