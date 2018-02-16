var {app, BrowserWindow} = require('electron');

function openFeatureEditor(feature, context, base_path) {
    var featureWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegrationInWorker: true
        }
    });
    featureWindow.ntarc_feature = feature;
    featureWindow.ntarc_context = context;
    featureWindow.ntarc_base_path = base_path;
    featureWindow.loadURL('file://' + __dirname + '/index.html');
    featureWindow.openDevTools();
}

app.on('ready', function () {
    openFeatureEditor(
        '[{"map": [{"multiply": [{"add": [{"add": ["transportOctetDeltaCount",40]},1000]},{"subtract": [{"multiply": ["flowDirection",2]},1]}]},{"select": [{"greater": ["transportOctetDeltaCount",0]}]}]}]',
        "flows",
        ".")
});

app.on('window-all-closed', function () {
  app.quit();
});
