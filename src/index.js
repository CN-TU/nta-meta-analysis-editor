import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import JSONEditor from 'rjson-editor';

import { File, Save, Copy, Folder } from 'react-feather';

const electron = window.require('electron')
const { remote, ipcRenderer } = electron;
const dialog = remote.dialog;
const fs = window.require('fs');

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

class MainWindow extends Component {
    constructor(props) {
        super(props);

        var value = {};
        if (props.filename !== undefined)
            value = MainWindow.loadFile(props.filename)
        this.state = {
            filename: props.filename,
            value: value,
        }
        this.editor = React.createRef();
        this.saveButton = React.createRef();
        this.closeWindow = false;
    }

    componentDidMount() {
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

    onEdit = () => {
        this.saveButton.current.setState({ changed: true });
    }

    render() {
        document.title = "Paper editor - " + (this.state.filename || "new file");
        const defaults = {
            optionalPropertiesTrue: true,
            collapsed: (path) => {
                const p = path.split('.');
                if (p[p.length-1] === "features")
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
                </div>
                <div className="pt-2 pl-2 main">
                    <JSONEditor schema={this.props.schema} value={this.state.value} ref={this.editor} defaults={defaults} onEdit={this.onEdit} />
                </div>
            </React.Fragment>
        );
    }
}

ReactDOM.render(<MainWindow
    filename={remote.getCurrentWindow().ntarc_filename}
    schema={JSON.parse(fs.readFileSync(path.join(remote.getCurrentWindow().ntarc_base_path, 'schema_v2.json'), 'utf8'))}
     />, document.getElementById('root'));
