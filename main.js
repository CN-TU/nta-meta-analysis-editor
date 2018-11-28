const { app, BrowserWindow, ipcMain, dialog, net, webContents } = require('electron')

// fix bug with transparency and drag+drop
if (process.platform === "linux")
    app.disableHardwareAcceleration()

const path = require('path')
const url = require('url')
const https = require('https')
const fs = require('fs')
const download = require('download-tarball');

const { PROJECT, API_URL, needed } = require('./config.js');

var windows = {}
var helpwindow = null
const base_path = path.join(app.getPath('appData'), 'ntarc');

let INDEX_URL = url.format({
    pathname: path.join(__dirname, "build/index.html"),
    protocol: 'file:',
    slashes: true
})
if (global.DEBUG === true && process.env.ELECTRON_START_URL !== undefined)
    INDEX_URL = process.env.ELECTRON_START_URL;

function displayHelp(url) {
    if (helpwindow === null) {
        helpwindow = new BrowserWindow({
            title: "NTA Help",
            webPreferences: {
                devTools: false,
                nodeIntegration: false,

            }
        });
        helpwindow.on('closed', () => {
            helpwindow = null;
        })
        helpwindow.on('page-title-updated', (event) => {
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

function createWindow(filename) {
    let win = new BrowserWindow({
        title: "Paper Editor",
        webPreferences: {
            nodeIntegrationInWorker: true
        }
    })
    win.ntarc_base_path = base_path;
    const id = win.id
    windows[id] = win

    win.ntarc_filename = filename;
    win.loadURL(INDEX_URL);

    win.webContents.on('will-navigate', (event, url) => {
        if ((url.startsWith('http://') || url.startsWith('https://'))) {
            if (global.DEBUG === true && url.startsWith(process.env.ELECTRON_START_URL))
                return;
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
    let a = fs.openSync(src, 'r')
    let b = fs.openSync(dst, 'w')
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
    const result = dialog.showMessageBox({
        "type": "info",
        "title": "Update available",
        "message": "There is a newer specification available. Update?",
        "buttons": ["Yes", "No"],
        "defaultId": 0,
        "cancelId": 1
    })
    if (result == 0) {
        download({
            url: API_URL + PROJECT + '/tarball/' + tag,
            dir: base_path,
            extractOpts: {
                ignore: (_, header) => {
                    if (needed.has(header.name)) return false;
                    return true;
                },
                map: header => {
                    header.name = header.name.split('/').slice(1).join('/');
                    return header;
                }
            }
        }).then(() => {
            fs.writeFileSync(path.join(base_path, 'commit.json'), JSON.stringify({ sha: sha, tag: tag }));
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
    link.headers = { 'User-Agent': 'CN-TU/nta-meta-analysis-editor updater' };
    let req = net.request(link);
    req.on('response', (response) => {
        if (response.statusCode == 200) {
            var data = ''
            response.on('data', (chunk) => {
                data += chunk
            })
            response.on('end', () => {
                data = JSON.parse(data)
                data = new Map(data.map(tag => { return [tag.name, tag.commit.sha]; }));
                let tags = Array.from(data.keys()).filter(tag => tag[tag.length - 1] != "a").sort();
                let latestTag = tags[tags.length - 1];
                let { sha, tag } = JSON.parse(fs.readFileSync(path.join(base_path, 'commit.json'), 'utf8'));
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
    for (let f of needed) {
        if (!fs.existsSync(path.join(base_path, f))) {
            needFix = true;
            break;
        }
    }
    if (needFix == false) {
        if (!fs.existsSync(path.join(base_path, 'commit.json'))) {
            needFix = true;
        }
    }
    if (needFix) {
        fs.mkdirSync(base_path);
        for (let f of needed)
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

