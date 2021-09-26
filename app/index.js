const { app, BrowserWindow, ipcMain } = require('electron');
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
      enableRemoteModule: true,
      devTools: false
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

ipcMain.on('ondragstart', (event, filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: app.getAppPath().replace('\\resources\\app.asar', '') + "\\pdf.png"
  });
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
    frPdfTemplate: { type: "string", default: "./templates/gexel_template_fr.pdf"},
    cityCode: { type: "string", default: "MTL"},
    enableAutocomplete: { type: "boolean", default: true }
  };
  
  app.store = new Store({schema, migrations: {
    '>=1.0.5': store => {
      store.set("cityCode", "MTL")
    },
    '>=1.3.1': store => {
      store.set("email", "")
      store.set("password", "")
    },
    '>=1.3.3': store => {
      store.set("enableAutocomplete", true)
    }
  }});
}