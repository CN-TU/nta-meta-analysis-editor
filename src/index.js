import React, { Component } from 'react';
import Tooltip from 'rc-tooltip';
import ReactDOM from 'react-dom';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'rc-tooltip/assets/bootstrap.css';
import JSONEditor from 'rjson-editor';

import { File, Save, Copy, Folder, XCircle, CheckCircle, Edit, AlertCircle, Circle } from 'react-feather';

const electron = window.require('electron')
const { remote, ipcRenderer } = electron;
const dialog = remote.dialog;
const fs = window.require('fs');
const path = window.require('path');

const { ntarc_filename, ntarc_base_path } = remote.getCurrentWindow();

const features = require('./features.js')(ntarc_base_path);
const { feature2text, text2feature } = features;
const Ajv = require('ajv/dist/ajv.min.js');

class FeatureEditor extends Component {
    constructor(props) {
        super(props);

        this.backdrop = document.createElement("div");
        this.backdrop.classList.add("modal-backdrop", "show");
        this.dialog = React.createRef();
        this.session = null;
        this.editor = null;
        this.obj = null;
        this.state = {
            mode: 'ntarc'
        }
    }

    close = () => {
        this.obj = null;
        const dialog = this.dialog.current;
        document.body.removeChild(this.backdrop);
        dialog.classList.remove("show");
        dialog.style.display = 'none';
        document.body.classList.remove("modal-open");
    }

    ok = () => {
        let result;
        try {
            if (this.state.mode === "ntarc")
                result = this.textSession.getValue().split(';').map(feature => { return text2feature(feature, [], this.context); }).filter(feature => { return feature !== null; });
            else
                result = JSON.parse(this.ntarcSession.getValue());
        } catch (e) {
            alert("Invalid Specification");
            return;
        }

        this.obj.setValue(result);
        this.close();
    }

    open = (path, obj) => {
        this.obj = obj;
        this.context = path.split('.')[1];
        this.textSession.$worker.emit("setContext", { data: this.context })
        this.textSession.setValue(JSON.parse(JSON.stringify(this.obj.getValue())).map(feature => { return feature2text(feature); }).join(";\n"));
        this.editor.setSession(this.textSession);
        this.setState({
            mode: 'ntarc'
        });
        const dialog = this.dialog.current;
        dialog.classList.add("show");
        dialog.style.display = 'block';
        document.body.appendChild(this.backdrop);
        document.body.classList.add("modal-open");
    }

    componentDidMount() {
        var ace = require('brace');
        require('brace/ext/language_tools')
        require('brace/theme/github');

        this.editor = ace.edit('features');
        this.editor.setTheme('ace/theme/github');
        this.editor.$blockScrolling = Infinity;
        this.editor.setOptions({
            showPrintMargin: false,
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true
        })


        const EditSession = ace.acequire('ace/edit_session').EditSession;

        this.textSession = new EditSession("");
        require('./mode-ntarc-feature.js')(ace, features, ntarc_base_path); //this is a bit hacky - but I don't know a better way :(
        var ntarcMode = ace.acequire('ntarc-feature').Mode;
        this.textSession.setMode(new ntarcMode());
        this.editor.setSession(this.textSession);

        this.ntarcSession = new EditSession("");
        require('brace/mode/json');
        this.ntarcSession.setMode('ace/mode/json');
    }

    switchMode = (mode) => {
        if (this.state === mode)
            return;
        if (mode === "json") {
            try {
                this.ntarcSession.setValue(JSON.stringify(this.textSession.getValue().split(';').map(feature => { return text2feature(feature, [], this.context); }).filter(feature => { return feature !== null; }), null, 2));
            } catch (e) {
                alert("Invalid Text");
                return;
            }
            this.editor.setSession(this.ntarcSession);
        } else {
            try {
                this.textSession.setValue(JSON.parse(this.ntarcSession.getValue()).map(feature => { return feature2text(feature); }).join(";\n"));
            } catch (e) {
                alert("Invalid Text");
                return;
            }
            this.editor.setSession(this.textSession);
        }
        this.setState({ mode: mode });
    }

    render() {
        return (
            <div className="modal" tabIndex="-1" role="dialog" ref={this.dialog}>
                <div className="modal-dialog raw-dialog" role="document">
                    <div className="modal-content raw-content">
                        <div className="modal-header" style={{ borderBottom: "none" }}>
                            <h5 className="modal-title">Edit Features</h5>
                            <button type="button" className="close" onClick={this.close}>
                                <span>&times;</span>
                            </button>
                        </div>
                        <div>
                            <ul className="nav nav-tabs">
                                <li className="nav-item">
                                    <a className={"nav-link" + (this.state.mode === "ntarc" ? " active" : "")} href="#NTARC" onClick={this.switchMode.bind(this, "ntarc")} >Features</a>
                                </li>
                                <li className="nav-item">
                                    <a className={"nav-link" + (this.state.mode !== "ntarc" ? " active" : "")} href="#JSON" onClick={this.switchMode.bind(this, "json")}>JSON</a>
                                </li>
                            </ul>
                        </div>
                        <div className="modal-body" id="features"></div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-primary" onClick={this.ok}><CheckCircle /> Modify</button>
                            <button type="button" className="btn btn-secondary" onClick={this.close}><XCircle /> Cancel</button>
                        </div>
                    </div>
                </div>
            </div>)
    }
}

class NavButton extends Component {
    constructor(props) {
        super(props);

        this.state = {
            saved: false,
            changed: false,
        }
    }
    render() {
        const Icon = this.props.icon;
        let flash = "";
        if (this.state.saved === true) {
            flash = "actionDone";
        }
        let changed = "";
        if (this.state.changed === true) {
            changed = "changed";
        }
        return (
            <div>
                <a href={this.props.url} onClick={this.props.click} className={changed}>
                    <div><Icon /></div>
                    <div className={flash}>{this.props.text}</div>
                </a>
            </div>
        );
    }
}

class StatusDisplay extends Component {
    constructor(props) {
        super(props);

        this.state = {
            ok: false,
            full: false,
            error: "test",
        }
    }
    render() {
        if (this.state.full)
            return (
                <div className="fileStatus" style={{color:"green"}} >
                    <CheckCircle style={{"marginBottom": "-10px"}} /><br />
                    complete
                </div>
            );
        if (this.state.ok)
            return (
                <Tooltip placement="right" overlay={<span>{this.state.error}</span>}>
                    <div className="fileStatus" style={{color:"yellow"}} >
                        <AlertCircle style={{"marginBottom": "-10px"}} /><br />
                        basic
                    </div>
                </Tooltip>
            );
        return (
            <Tooltip placement="right" overlay={this.state.error}>
                <div className="fileStatus" style={{color:"red"}} >
                    <XCircle style={{"marginBottom": "-10px"}} /><br />
                    error
                </div>
            </Tooltip>
        );
    }
}


class MainWindow extends Component {
    constructor(props) {
        super(props);

        var ajv = new Ajv({ schemaId: 'id' });
        ajv.addFormat("table", () => true);
        ajv.addFormat("grid", () => true);
        ajv.addFormat("checkbox", () => true);

        ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
        this.validator = ajv.compile(props.schema);
        this.fullvalidator = ajv.compile(props.fullschema);

        var value = {};
        if (props.filename !== undefined) {
            value = MainWindow.loadFile(props.filename)
        }
        this.state = {
            filename: props.filename,
            value: value,
        }
        this.editor = React.createRef();
        this.saveButton = React.createRef();
        this.editModal = React.createRef();
        this.statusDisplay = React.createRef();
        this.closeWindow = false;
    }

    componentDidMount() {
        this.doValidate(this.state.value);
        window.onbeforeunload = (e) => {
            if (this.closeWindow) return
            if (this.saveButton.current.state.changed === false) return
            e.returnValue = false

            setTimeout(() => {
                let result = dialog.showMessageBox({
                    "type": "warning",
                    "title": "Unsaved changes",
                    "message": "You have unsaved changes, which will be lost if you close the window. Do you still want to close it?",
                    "buttons": ["Close", "Cancel"],
                    "defaultId": 1,
                    "cancelId": 1
                })
                if (result === 0) {
                    this.closeWindow = true
                    remote.getCurrentWindow().close()
                }
            })
        }
        ipcRenderer.on('new', this.fileNew)
        ipcRenderer.on('open', this.fileOpen)
        ipcRenderer.on('save', this.fileSave)
        ipcRenderer.on('save-as', this.fileSaveAs);
    }

    static loadFile(filename) {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    }

    saved = () => {
        this.saveButton.current.setState({ saved: true }, () => {
            window.setTimeout(() => {
                this.saveButton.current.setState({ saved: false })
            }, 1000);
        })
    }

    fileNew = () => {
        ipcRenderer.send("fileNew");
    }

    fileOpen = () => {
        var files = dialog.showOpenDialog({
            "title": "Open paper",
            "filters": [
                { name: 'JSON', extensions: ['json'] }
            ],
            "properties": ["openFile"]
        })
        if (files !== undefined) {
            if (this.state.filename === undefined && this.saveButton.current.state.changed === false) {
                try {
                    const file = MainWindow.loadFile(files[0]);
                    this.doValidate(file);
                    this.saveButton.current.setState({ changed: false });
                    this.setState({
                        filename: files[0],
                        value: file,
                    });
                } catch (e) {
                    document.alert("Could not read file: " + e);
                }
            } else {
                ipcRenderer.send("fileOpen", files[0]);
            }
        }
    }

    fileSave = () => {
        if (this.state.filename !== undefined) {
            fs.writeFileSync(this.state.filename, JSON.stringify(this.editor.current.getValue(), null, 2), { "encoding": "utf8" });
            this.saveButton.current.setState({ changed: false });
            this.saved();
        } else {
            this.fileSaveAs();
        }
    }

    fileSaveAs = () => {
        let file = dialog.showSaveDialog({
            "title": "Save paper as",
            "filters": [
                { name: 'JSON', extensions: ['json'] }
            ]
        })
        if (file !== undefined) {
            this.setState({ filename: file }, () => { this.fileSave() })
        }
    }


    doValidate = (value) => {
        if (value === undefined)
            value = this.editor.current.getValue();
        const ok = this.validator(value);
        if (ok) {
            const full = this.fullvalidator(value);
            if (full)
                this.statusDisplay.current.setState({
                    ok: true,
                    full: true,
                    error: ""
                })
            else
                this.statusDisplay.current.setState({
                    ok: true,
                    full: false,
                    error: "Paper" + this.fullvalidator.errors[0].dataPath + " " + this.fullvalidator.errors[0].message
                })
        } else {
            this.statusDisplay.current.setState({
                ok: false,
                full: false,
                error: "Paper" + this.validator.errors[0].dataPath + " " + this.validator.errors[0].message
            })
        }
    }

    onEdit = () => {
        this.saveButton.current.setState({ changed: true });
        clearTimeout(this.validateTimeout);
        this.validateTimeout = setTimeout(() => {
            this.validateTimeout = null;
            this.doValidate();
        }, 250);
    }

    openModal = (path, val) => {
        this.editModal.current.open(path, val);
    }

    onConstruct = (path, cmds, constraints) => {
        if (constraints.optional === true && constraints.type !== "array")
            cmds.addPostcontrol("optional", 10000, (
                <span key="optional" className="badge badge-pill badge-info ml-2">optional</span>
            ))
        const p = path.split('.');
        if (p[p.length - 1] !== "features")
            return;
        cmds.addPostcontrol("EditFeature", -2000, (
            <button type="button"
                key="editFeature"
                className="btn btn-sm btn-outline-primary ml-2"
                onClick={this.openModal.bind(this, path, cmds)}><Edit /> Features</button>
        ))
    }

    render() {
        document.title = "Paper editor - " + (this.state.filename || "new file");
        const defaults = {
            optionalPropertiesTrue: true,
            optionalPropertiesAlways: (path) => {
                if (path === "version")
                    return false;
                if (path.split('.')[1] === "bibtex")
                    return false;
                return true
            },
            collapsed: (path) => {
                const p = path.split('.');
                if (p[p.length - 1] === "features")
                    return true
                if (p.length > 2)
                    return true
                return false
            }
        };
        return (
            <React.Fragment>
                <div className="leftnav py-2">
                    <NavButton icon={File} url="#new" text="New" click={this.fileNew} />
                    <NavButton icon={Folder} url="#open" text="Open" click={this.fileOpen} />
                    <NavButton icon={Save} url="#save" text="Save" click={this.fileSave} ref={this.saveButton} />
                    <NavButton icon={Copy} url="#saveAs" text="Save as" click={this.fileSaveAs} />
                    <StatusDisplay ref={this.statusDisplay} />
                </div>
                <div className="pt-2 pl-2 main">
                    <JSONEditor
                        schema={this.props.schema}
                        value={this.state.value}
                        ref={this.editor}
                        defaults={defaults}
                        onEdit={this.onEdit} onConstruct={this.onConstruct} />
                </div>
                <FeatureEditor ref={this.editModal} />
            </React.Fragment>
        );
    }
}

const schema = fs.readFileSync(path.join(ntarc_base_path, 'schema_v2.json'), 'utf8');
let fullschema = JSON.parse(schema);

function rewriteRequired(obj) {
    if (obj.properties !== undefined)
        obj.required = Object.keys(obj.properties);
    if (typeof obj === "object")
        for (let key in obj) {
            if (key === "bibtex")
                continue
            rewriteRequired(obj[key]);
        }
}

rewriteRequired(fullschema);

ReactDOM.render(<MainWindow
    filename={ntarc_filename}
    schema={JSON.parse(schema)}
    fullschema={fullschema}
/>, document.getElementById('root'));
