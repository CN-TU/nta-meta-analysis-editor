const {app, BrowserWindow, ipcMain, dialog, net, webContents} = require('electron')
const path = require('path')
const url = require('url')
const https = require('https')
const fs = require('fs')
const download = require('download-tarball');

const {PROJECT, API_URL, needed} = require('./config.js');

var windows = {}
var helpwindow = null
const base_path = path.join(app.getPath('appData'), 'ntarc');

function displayHelp(url) {
    if (helpwindow === null) {
        helpwindow = new BrowserWindow({
            title: "NTA Help",
            webPreferences: {
                devTools: false,
                nodeIntegration: false,

            }
        });
        helpwindow.on('closed', ()=>{
            helpwindow = null;
        })
        helpwindow.on('page-title-updated', (event)=>{
            event.preventDefault();
        })
        helpwindow.setMenu(null);
    }
    helpwindow.loadURL(url);
    if (helpwindow.isMinimized()) {
        helpwindow.restore();
    }
    helpwindow.focus();
}

function createWindow (filename) {
    win = new BrowserWindow()
    win.ntarc_base_path = base_path;
    const id = win.id
    windows[id] = win

    win.ntarc_filename = filename;
    win.loadURL(process.env.ELECTRON_START_URL || url.format({
        pathname: path.join(__dirname, "build/index.html"),
        protocol: 'file:',
        slashes: true
    }))

    win.webContents.on('will-navigate', (event, url) => {
        if ((url.startsWith('http://') || url.startsWith('https://')) && !url.startsWith(process.env.ELECTRON_START_URL)) {
            event.preventDefault()
            displayHelp(url)
        }
    });

    win.on('closed', () => {
        delete windows[id]
        if (Object.keys(windows).length == 0 && helpwindow !== null) {
            helpwindow.destroy();
            helpwindow = null;
            app.quit();
        }
    })
}

function copy(src, dst) {
    a = fs.openSync(src, 'r')
    b = fs.openSync(dst, 'w')
    let bytesRead = 1
    let pos = 0
    let _buff = Buffer.alloc(4096)

    while (bytesRead > 0) {
        bytesRead = fs.readSync(a, _buff, 0, 4096, pos)
        fs.writeSync(b, _buff, 0, bytesRead)
        pos += bytesRead
    }
    fs.closeSync(a)
    fs.closeSync(b)
}

function updateAvailable(sha, tag) {
    result = dialog.showMessageBox({
            "type": "info",
            "title": "Update available",
            "message": "There is a newer specification available. Update?",
            "buttons": ["Yes", "No"],
            "defaultId": 0,
            "cancelId": 1
    })
    if (result == 0) {
        download({
            url: API_URL + PROJECT + '/tarball/'+tag,
            dir: base_path,
            extractOpts: {
                ignore: (_, header) => {
                    if(needed.has(header.name)) return false;
                    return true;
                },
                map: header => {
                    header.name = header.name.split('/').slice(1).join('/');
                    return header;
                }
            }
        }).then(() => {
            fs.writeFileSync(path.join(base_path, 'commit.json'), JSON.stringify({sha:sha, tag:tag}));
            dialog.showMessageBox({
                    "type": "info",
                    "title": "Update downloaded",
                    "message": "Update successfully downloaded. To use the new specification, reopen all windows.",
                    "buttons": ["Ok"]
            });
            console.log("update ok!")
        }).catch(err => {
            dialog.showMessageBox({
                "type": "error",
                "title": "Error during download",
                "message": err.toString(),
                "buttons": ["Ok"]
            });
        });
    }
}

function checkUpdate() {
    let link = url.parse(API_URL + PROJECT + "/tags");
    link.headers =  {'User-Agent': 'CN-TU/nta-meta-analysis-editor updater'};
    req = net.request(link);
    req.on('response', (response) => {
        if (response.statusCode == 200) {
            var data = ''
            response.on('data', (chunk) => {
                data += chunk
            })
            response.on('end', () => {
                data = JSON.parse(data)
                data = new Map(data.map(tag => {return [tag.name, tag.commit.sha];}));
                let tags = Array.from(data.keys()).sort();
                let latestTag = tags[tags.length - 1];
                let {sha, tag} = JSON.parse(fs.readFileSync(path.join(base_path, 'commit.json'), 'utf8'));
                if (latestTag > tag) {
                    updateAvailable(data.get(latestTag), latestTag);
                } else {
                    if (sha != data.get(latestTag))
                        updateAvailable(data.get(latestTag), latestTag);
                    else
                        console.log("no update needed")
                }
            })
        }
    })
    req.end()
}

app.on('ready', () => {
    var needFix = false;
    for(let f of needed) {
        if(!fs.existsSync(path.join(base_path, f)))
        {
            needFix = true;
            break;
        }
    }
    if(needFix == false) {
        if(!fs.existsSync(path.join(base_path, 'commit.json'))) {
            needFix = true;
        }
    }
    if (needFix) {
        fs.mkdirSync(base_path);
        for(let f of needed)
            copy(path.join(__dirname, 'spec', f), path.join(base_path, f))
        copy(path.join(__dirname, 'spec', 'commit.json'), path.join(base_path, 'commit.json'))
    }

    createWindow()

    require('./menu')

    checkUpdate()
})

ipcMain.on('fileNew', () => {
    createWindow()
})

ipcMain.on('fileOpen', (event, arg) => {
    createWindow(arg)
})

ipcMain.on('launchEditor', (event, id, which, feature, context) => {
    let featureWindow = new BrowserWindow({
        title: "Feature Editor - "+context,
        modal: true,
        parent: windows[id],
        webPreferences: {
            nodeIntegrationInWorker: true
        }
    });
    featureWindow.setMenu(null);
    featureWindow.ntarc_id = event.sender.id;
    featureWindow.ntarc_which = which;
    featureWindow.ntarc_feature = feature;
    featureWindow.ntarc_context = context;
    featureWindow.ntarc_base_path = base_path;
    featureWindow.loadURL(url.format({
        pathname: path.join(__dirname, "feature_editor.html"),
        protocol: 'file:',
        slashes: true
    }));
});

ipcMain.on('editorResult', (event, id, which, feature) => {
    webContents.fromId(id).send('change-feature', which, feature);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (Object.keys(windows).length === 0) {
        createWindow()
    }
})

