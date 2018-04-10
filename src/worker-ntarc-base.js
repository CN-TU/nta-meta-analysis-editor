ace.define("ntarc_worker", [], function (acequire, exports, module) {
    "use strict";

    var oop = acequire("ace/lib/oop");
    var Mirror = acequire("ace/worker/mirror").Mirror;
    var context = 'flow';
    var text2feature;

    var Worker = exports.Worker = function (sender) {
        sender.on("setBasePath", function (e) {
            text2feature = require('./features.js')(e.data).text2feature;
        });
        sender.on("setContext", function (e) {
            context = e.data;
        });
        Mirror.call(this, sender);
        this.setTimeout(500);
    };

    oop.inherits(Worker, Mirror);

    (function () {
        this.onUpdate = function () {
            var value = this.doc.getValue();
            let features = value.split(';');
            let current_line = 0;
            let current_column = 0;
            let markers = [];
            let errors = [];
            for (let i = 0; i < features.length; i++) {
                let current_warnings = [];
                let lines = features[i].split('\n');
                let next_line = lines.length - 1;
                let next_column = lines[lines.length - 1].length;
                try {
                    text2feature(features[i], current_warnings, context);
                    for (let j = 0; j < current_warnings.length; j++) {
                        let error = {
                            row: current_warnings[j].location.start.line - 1 + current_line,
                            column: current_warnings[j].location.start.column - 1 + (current_warnings[j].location.start.line == 1 ? current_column : 0),
                            range: [
                                current_warnings[j].location.start.line - 1 + current_line,
                                current_warnings[j].location.start.column - 1 + (current_warnings[j].location.start.line == 1 ? current_column : 0),
                                current_warnings[j].location.end.line - 1 + current_line,
                                current_warnings[j].location.end.column - 1 + (current_warnings[j].location.end.line == 1 ? current_column : 0),
                            ],
                            text: current_warnings[j].msg,
                            type: "warning"
                        }
                        errors.push(error);
                        if (j == 0) {
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
            this.sender.emit("lint", {
                errors: errors,
                markers: markers
            });
        };
    }).call(Worker.prototype);

});