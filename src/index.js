require('v8-compile-cache');

const { app, BrowserWindow, globalShortcut, protocol, ipcMain, dialog, clipboard} = require('electron');
app.startedAt = Date.now();
const path = require('path');
const official_settings = ['Unlimited FPS', 'Accelerated Canvas'];

const shortcuts = require('electron-localshortcut');    

//auto update
const { autoUpdater } = require("electron-updater")
const { MacUpdater } = require("electron-updater")
let updateLoaded = false;
let updateNow = false;


//Settings
const Store = require('electron-store');
Store.initRenderer();
const settings = new Store();

//Discord RPC
const DiscordRPC = require('discord-rpc');
const clientId = '727533470594760785';
const RPC = new DiscordRPC.Client({ transport: 'ipc' });
DiscordRPC.register(clientId);
const rpc_script = require('./rpc.js');

//swapper_func
const swapper = require('./swapper.js');
const { machine } = require('os');


//Uncap FPS
if (settings.get('Unlimited FPS') === undefined) settings.set('Unlimited FPS', true);
if (settings.get('Unlimited FPS')) {
    app.commandLine.appendSwitch('disable-frame-rate-limit');
    app.commandLine.appendSwitch('disable-gpu-vsync');
}

//acceleratedCanvas
if (settings.get('Accelerated Canvas') === undefined) settings.set('Accelerated Canvas', false);
if (settings.get('Accelerated Canvas')) {
    app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
}

app.commandLine.appendSwitch('ignore-gpu-blacklist');

//main Client Code
const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: `Venge Client`,
        backgroundColor: '#202020',
        icon: __dirname + "/icon.ico",
        webPreferences: {
            preload: __dirname + '/preload.js',
            nodeIntegration: false,
        }
    });
    win.removeMenu();
    win.maximize();
    win.setFullScreen(settings.get('Fullscreen'));
    
    //Shortcuts
    shortcuts.register(win, "F4", () => win.loadURL('https://venge.io/'));
    shortcuts.register(win, "F5", () => win.reload());
    shortcuts.register(win, "F6", () => {if(clipboard.readText().includes("venge.io")){win.loadURL(clipboard.readText())}})
    shortcuts.register(win, 'F11', () => { win.fullScreen = !win.fullScreen; settings.set('Fullscreen', win.fullScreen) });
    shortcuts.register(win, "F12", () => win.webContents.toggleDevTools());
    shortcuts.register(win, "Escape", () => win.webContents.executeJavaScript('document.exitPointerLock()', true));

    win.on('page-title-updated', (e) => {
        e.preventDefault();
    });

    win.loadURL('https://venge.io/');

    //Swapper

    //Auto Update

    autoUpdater.setFeedURL({
        owner: "MetaHumanREAL",
        repo: "Venge-Client",
        provider: "github",
        updaterCacheDirName: "venge-client-updater",
    });

    if (process.platform == "win32") {
        autoUpdater.checkForUpdates();

        autoUpdater.on('update-available', () => {

            const options = {
                title: "Client Update",
                buttons: ["Now", "Later"],
                message: "Client Update available, do you want to install it now or after the next restart?",
                icon: __dirname + "/icon.ico"
            }
            dialog.showMessageBox(options).then((result) => {
                if (result.response === 0) {
                    updateNow = true;
                    if (updateLoaded) {
                        autoUpdater.quitAndInstall();
                    }
                }
            });

        });

        autoUpdater.on('update-downloaded', () => {
            updateLoaded = true;
            if (updateNow) {
                autoUpdater.quitAndInstall(true, true);
            }
        });
    }

    if (process.platform == "darwin") {
        MacUpdater.checkForUpdates();

        MacUpdater.on('update-available', () => {
            const options = {
                title: "Client Update",
                buttons: ["Now", "Later"],
                message: "Client Update available, do you want to install it now or after the next restart?",
                icon: __dirname + "/icon.ico"
            }
            dialog.showMessageBox(options).then((result) => {
                if (result.response === 0) {
                    updateNow = true;
                    if (updateLoaded) {
                        autoUpdater.quitAndInstall();
                    }
                }
            });

        });

        MacUpdater.on('update-downloaded', () => {
            updateLoaded = true;
            if (updateNow) {
                MacUpdater.quitAndInstall();
            }
        });
    }

    ipcMain.on('loadScripts', function (event) {
        swapper.runScripts(win, app);
        event.sender.send('scriptsLoaded', true);
    });

    swapper.replaceResources(win, app);

    //Discord RPC

    ipcMain.on('loadRPC', (event, data) => {
        if (data.area == 'game') {
            rpc_script.setActivity(RPC, {
                state: 'In a game',
                startTimestamp: data.now,
                largeImageKey: data.maps.includes(data.map) ? data.map.toLowerCase() : 'custom',
                largeImageText: data.mapText == undefined ? data.map + ' - CUSTOM MATCH' : data.mapText,
                smallImageKey: data.weapon.toLowerCase(),
                smallImageText: data.weapon,
                instance: false,
                buttons: [
                    {
                        label: 'Download Client',
                        url: 'https://social.venge.io/client.html'
                    }
                ]
            });
        }

        if (data.area == 'menu') {
            rpc_script.setActivity(RPC, {
                state: 'On the menu',
                startTimestamp: app.startedAt,
                largeImageKey: 'menu',
                largeImageText: 'Venge.io',
                instance: false,
                buttons: [
                    {
                        label: 'Download Client',
                        url: 'https://social.venge.io/client.html'
                    }
                ]
            });
        }
    });

    ipcMain.on('settingChange', function (event, setting) {
        if (official_settings.includes(setting.name)) {
            settings.set(setting.name, setting.value);
            if (setting.name == 'Unlimited FPS') { app.exit(); app.relaunch(); }
            if (setting.name == 'Accelerated Canvas') { app.exit(); app.relaunch(); }
        }
    });
}


app.whenReady().then(() => {
    protocol.registerFileProtocol('swap', (request, callback) => {
        callback({
            path: path.normalize(request.url.replace(/^swap:/, ''))
        });
    });
    
    createWindow()
    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

RPC.login({ clientId }).catch(console.error);
