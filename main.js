var {app, BrowserWindow} = require('electron');

app.on('ready', function () {
    var mainWindow = new BrowserWindow({
        width: 800,
        height: 600
    });
    mainWindow.loadURL('file://' + __dirname + '/index.html');
    mainWindow.openDevTools();
});

app.on('window-all-closed', function () {
  app.quit();
});
