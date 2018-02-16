const {app, BrowserWindow, ipcMain, dialog, net, webContents} = require('electron')
const path = require('path')
const url = require('url')
const https = require('https')
const fs = require('fs')


const PROJECT = "CN-TU/nta-meta-analysis"
const API_URL = "https://api.github.com/repos/"
const DL_URL = "https://raw.githubusercontent.com/"

var windows = {}
var helpwindow = null
const base_path = '.'

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
    const id = win.id
    windows[id] = win

    win.loadURL(url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: 'file:',
        slashes: true,
        search: filename
    }))

    win.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
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

function updateAvailable(sha) {
    result = dialog.showMessageBox({
            "type": "info",
            "title": "Update available",
            "message": "There is a newer paper JSON spec available. Update?",
            "buttons": ["Yes", "No"],
            "defaultId": 0,
            "cancelId": 1
    })
    if (result == 0) {
        file = fs.createWriteStream(path.join(app.getPath('appData'), 'schema_v2.json'))
        request = https.get(DL_URL + PROJECT + "/master/schema_v2.json", function(response) {
            response.pipe(file);
            response.on('end', () => {
                fs.writeFileSync(path.join(app.getPath('appData'), 'commit.txt'), sha)
                dialog.showMessageBox({
                        "type": "info",
                        "title": "Update downloaded",
                        "message": "Update successfully downloaded. To use the new specification, reopen all windows.",
                        "buttons": ["Ok"]
                })
            })
        });
    }
}

function checkUpdate() {
    req = net.request(API_URL + PROJECT + "/commits?path=schema_v2.json")
    req.on('response', (response) => {
        if (response.statusCode == 200) {
            var data = ''
            response.on('data', (chunk) => {
                data += chunk
            })
            response.on('end', () => {
                data = JSON.parse(data)
                if (data.length > 1) {
                    if (data[0].sha != fs.readFileSync(path.join(cfgpath, 'commit.txt'), 'utf8').trim()) {
                        updateAvailable(data[0].sha)
                    }
                }
            })
        }
    })
    req.end()
}

app.on('ready', () => {
    cfgpath = app.getPath('appData') //use subpath
    if (!fs.existsSync(path.join(cfgpath, 'schema_v2.json')) || !fs.existsSync(path.join(cfgpath, 'commit.txt'))) {
        copy(path.join(__dirname, 'schema_v2.json'), path.join(cfgpath, 'schema_v2.json'))
        copy(path.join(__dirname, 'commit.txt'), path.join(cfgpath, 'commit.txt'))
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
/*        width: 800,
        height: 600,*/
        modal: true,
        parent: windows[id],
        webPreferences: {
            nodeIntegrationInWorker: true
        }
    });
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
    featureWindow.setMenu(null);
    featureWindow.openDevTools();
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

