const { app, BrowserWindow } = require('electron');
const Store = require('electron-store');

function createWindow () {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: false,
    minWidth: 800,
    minHeight: 600,
    icon: "./icon.ico",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  })

  window.loadFile('src/index.html')
}

app.whenReady().then(() => {
    setupStore()
    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})


function setupStore() {
  const schema = {
    enableNotification: { type: "boolean", default: true },
    emailDestination: { type: "string", format: "email", default: "" },
    email: { type: "string", format: "email", default: "" },
    password: { type: "string", default: "" },
    networkPath: { type: "string", default: ""},
    apiUrl: { type: "string", default: ""},
    apiAuth: { type: "string", default: ""},
    enPdfTemplate: { type: "string", default: "./templates/gexel_template_en.pdf"},
    frPdfTemplate: { type: "string", default: "./templates/gexel_template_fr.pdf"}
  };
  
  app.store = new Store({schema});
}