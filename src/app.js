const { app, BrowserWindow, ipcMain, Menu, nativeTheme, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const fs = require('fs')
const os = require('os')
const path = require('path')

const PLATFORM = undefined

let clips = []
let settings
let mainWindow

app.whenReady().then(() => {
    if (fs.existsSync(path.join(app.getPath('userData'), 'settings.json'))) {
        settings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json')))
    } else {
        settings = {
            'appearance': 'system',
            'always_on_top': false,
            'font': 'system'
        }
    }
    createAppMenu()
    createMainWindow()
    autoUpdater.checkForUpdatesAndNotify()
})

app.on('window-all-closed', app.quit)

app.on('quit', () => {
    fs.writeFileSync(path.join(app.getPath('userData'), 'clips.json'), JSON.stringify(clips))
    fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(settings))
})

nativeTheme.addListener('updated', () => {
    if (settings['appearance'] === 'system') {
        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', PLATFORM || process.platform, nativeTheme.shouldUseDarkColors, settings['font'] === 'lato'))
    }
})

ipcMain.on('delete-clip', (e, index) => {
    if (clips.length > 0) {
        clips.splice(index, 1)
    }
})

ipcMain.on('new', (e) => {
    createAddClipWindow(mainWindow)
})

ipcMain.on('show-options', (e, bounds) => {
    createAppOptionsMenu(bounds)
})

ipcMain.on('clip-added', (e, text, background) => {
    try {
        let newClips = JSON.parse(text)
        clips = [...clips, ...newClips]
        mainWindow.webContents.send('update', newClips)
    } catch (err) {
        let newClip = { text, background }
        clips.push(newClip)
        mainWindow.webContents.send('update', [newClip])
    }
})

ipcMain.on('minimize:main-window', () => mainWindow.minimize())

ipcMain.on('maximize:main-window', () => mainWindow.maximize())

ipcMain.on('unmaximize:main-window', () => mainWindow.unmaximize())

ipcMain.on('close:main-window', () => mainWindow.close())

function showAbout() {
    let build_date = '(2023.08.07)'
    dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        message: 'Clippiez',
        detail: 'Version ' + app.getVersion() + ' ' + build_date + '\nDeveloped by YUH APPS',
        buttons: ['OK & Close', 'YUH APPS Website'],
        defaultId: 0,
        noLink: true,
        normalizeAccessKeys: process.platform === 'win32'
    }).then(({ response }) => {
        if (response === 1) shell.openExternal('https://yuhapps.dev')
    })
}

function createAppMenu() {
    let menu = [
        {
            label: 'Clippiez',
            submenu: [
                {
                    label: 'About Clippiez',
                    click: showAbout
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Always on top',
                    submenu: [
                        {
                            label: 'On',
                            checked: settings['always_on_top'] === true,
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                browserWindow.setAlwaysOnTop(true)
                                settings['always_on_top'] = true
                                menuItem.checked = true
                            }
                        },
                        {
                            label: 'Off',
                            checked: settings['always_on_top'] === false,
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                browserWindow.setAlwaysOnTop(false)
                                settings['always_on_top'] = false
                                menuItem.checked = true
                            }
                        }
                    ]
                },
                {
                    label: 'Theme',
                    submenu: [
                        {
                            label: 'System',
                            checked: settings['appearance'] === 'system',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['appearance'] = 'system'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', PLATFORM || process.platform, nativeTheme.shouldUseDarkColors, settings['font'] === 'lato'))
                            }
                        },
                        {
                            label: 'Light',
                            checked: settings['appearance'] === 'light',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['appearance'] = 'light'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', PLATFORM || process.platform, false, settings['font'] === 'lato'))
                            }
                        },
                        {
                            label: 'Dark',
                            checked: settings['appearance'] === 'dark',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['appearance'] = 'dark'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', PLATFORM || process.platform, true, settings['font'] === 'lato'))
                            }
                        },
                    ]
                },
                {
                    label: 'Font',
                    submenu: [
                        {
                            label: 'System',
                            checked: settings['font'] === undefined || settings['font'] === 'system',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['font'] = 'system'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', PLATFORM || process.platform, false, false))
                            }
                        },
                        {
                            label: 'Lato',
                            checked: settings['font'] === 'lato',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['font'] = 'lato'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', PLATFORM || process.platform, false, true))
                            }
                        }
                    ]
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'File',
            submenu: [
                {
                    label: 'Add new clip',
                    click: (menuItem, browserWindow, event) => createAddClipWindow(browserWindow)
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Import from JSON',
                    click: (menuItem, browserWindow, event) => importFromJson(browserWindow)
                },
                {
                    label: 'Export as JSON',
                    click: (menuItem, browserWindow, event) => exportAsJson(browserWindow)
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Delete all clips',
                    click: (menuItem, browserWindow, event) => {
                        dialog.showMessageBox(browserWindow, {
                            message: 'Delete all clips?\nThis cannot be undone.',
                            buttons: ['Delete', 'Cancel'],
                            defaultId: 1,
                            noLink: true,
                        }).then(({ response }) => {
                            if (response === 0) {
                                browserWindow.webContents.send('delete-all')
                                clips = []
                            }
                        })
                    }
                }
            ]
        },
        { role: 'editMenu' },
        { role: 'windowMenu' }
    ]
    if (app.isPackaged === false) menu.splice(3, 0, { role: 'viewMenu' })
    Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate(menu) : null)
}

function createAppOptionsMenu(bounds) {
    let platform = PLATFORM || process.platform
    let menu = Menu.buildFromTemplate([
        {
            label: 'Import from JSON',
            click: (menuItem, browserWindow, event) => importFromJson(browserWindow)
        },
        {
            label: 'Export as JSON',
            click: (menuItem, browserWindow, event) => exportAsJson(browserWindow)
        },
        {
            type: 'separator'
        },
        {
            label: 'Delete all clips',
            click: (menuItem, browserWindow, event) => {
                dialog.showMessageBox(browserWindow, {
                    message: 'Delete all clips?\nThis cannot be undone.',
                    buttons: ['Delete', 'Cancel'],
                    defaultId: 1,
                    noLink: true
                }).then(({ response }) => {
                    if (response === 0) {
                        browserWindow.webContents.send('delete-all')
                        clips = []
                    }
                })
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Always on top',
            submenu: [
                {
                    label: 'On',
                    checked: settings['always_on_top'] === true,
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        browserWindow.setAlwaysOnTop(true)
                        settings['always_on_top'] = true
                        menuItem.checked = true
                    }
                },
                {
                    label: 'Off',
                    checked: settings['always_on_top'] === false,
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        browserWindow.setAlwaysOnTop(false)
                        settings['always_on_top'] = false
                        menuItem.checked = true
                    }
                }
            ]
        },
        {
            label: 'Theme',
            submenu: [
                {
                    label: 'System',
                    checked: settings['appearance'] === 'system',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['appearance'] = 'system'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, nativeTheme.shouldUseDarkColors, settings['font'] === 'lato'))
                    }
                },
                {
                    label: 'Light',
                    checked: settings['appearance'] === 'light',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['appearance'] = 'light'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, false, settings['font'] === 'lato'))
                    }
                },
                {
                    label: 'Dark',
                    checked: settings['appearance'] === 'dark',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['appearance'] = 'dark'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, true, settings['font'] === 'lato'))
                    }
                },
            ]
        },
        {
            label: 'Font',
            submenu: [
                {
                    label: 'System',
                    checked: settings['font'] === undefined || settings['font'] === 'system',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['font'] = 'system'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, nativeTheme.shouldUseDarkColors, false))
                    }
                },
                {
                    label: 'Lato',
                    checked: settings['font'] === 'lato',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['font'] = 'lato'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, nativeTheme.shouldUseDarkColors, true))
                    }
                }
            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'About Clippiez',
            click: showAbout
        }
    ])
    menu.popup({ x: Math.round(bounds.x), y: Math.round(bounds.y) })
}

function createMainWindow() {
    let platform = PLATFORM || process.platform
    let dark = settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark'
    let lato = (settings['font'] || 'system')=== 'lato'
    if (fs.existsSync(path.join(app.getPath('userData'), 'clips.json'))) {
        let buffer = fs.readFileSync(path.join(app.getPath('userData'), 'clips.json'))
        clips = JSON.parse(String(buffer))
    } else if (clips.length === 0) {
        clips = [
            {
                text: 'Welcome to Clippiez!!!',
                background: '#FFE0B2',
            },
            {
                text: 'Are you someone who usually copies and pastes from templates? This app is right for you. Just define all the text clips you need, so you can copy and paste them later with ease.',
                background: '#C8E6C9',
            },
            {
                text: 'To get started, click the pen button on the top ' + (platform === 'darwin' || platform === 'linux' ? 'right' : 'left') + ' corner of Clippiez to create a new clip.',
                background: '#BBDEFB',
            },
            {
                text: 'To copy text from a clip, for example, this yellow one, click the Copy icon right next to this text.',
                background: '#FFF9C4',
            },
            {
                text: 'To delete a clip, for example, this red one, click the Delete button whose icon is a circle containing a vertical line from the right edge of this clip.',
                background: '#FFCDD2'
            },
            {
                text: 'More options can be found by clicking the Menu button in the top ' + (platform === 'darwin' ? 'right' : 'left') + ' corner. Visit https://yuhapps.dev for more info.',
                background: '#E1BEE7'
            }
        ]
    }
    mainWindow = new BrowserWindow({
        backgroundColor: dark ? (platform === 'darwin' ? '#202020' : '#00000') : '#FFFFFF',
        height: 600,
        width: 800,
        minHeight: 400,
        minWidth: 600,
        fullscreenable: false,
        titleBarStyle: platform === 'darwin' ? 'hiddenInset' : platform === 'win32' ? 'hidden' : 'default',
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            scrollBounce: false
        }
    })
    if (platform === 'darwin') {
        mainWindow.setWindowButtonPosition({ x: 12, y: 16 })
    }
    if (os.platform() === 'darwin' && platform !== 'darwin') {
        // This method is convenient for developers to test behaviors of Windows and Linux on Mac.
        // Simply set platform = 'win32' or 'linux', and the window will disable the traffic light buttons.
        // Thus it will behave like it's on Windows or Linux.
        mainWindow.setWindowButtonVisibility(platform === 'linux')
    }
    mainWindow.loadFile('src/views/index.html')
    mainWindow.webContents.on('did-finish-load', (e) => {
        mainWindow.webContents.send('platform', platform, dark, lato)
        mainWindow.webContents.send('update', clips)
        mainWindow.show()
    })
    mainWindow.webContents.on('context-menu', (e, { x, y, editFlags, selectionText }) => {
        if (editFlags.canPaste) {
            Menu.buildFromTemplate([
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]).popup({ x, y })
        } else if (selectionText) {
            Menu.buildFromTemplate([
                { role: 'copy', label: 'Copy «' + (selectionText.length > 20 ? selectionText.substring(0, 20) + '...' : selectionText) +'»' },
            ]).popup({ x, y })
        }
    })
}

function createAddClipWindow(browserWindow) {
    let platform = process.platform
    let dark = settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark'
    let addWindow = new BrowserWindow({
        backgroundColor: dark ? (platform === 'darwin' ? '#202020' : '#00000') : '#FFFFFF',
        height: 400,
        width: 600,
        modal: true,
        frame: false,
        parent: browserWindow,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    })
    addWindow.loadFile('src/views/new.html')
    // addWindow.on('ready-to-show', () => addWindow.show())
    addWindow.webContents.on('did-finish-load', (e) => {
        addWindow.webContents.send('platform', platform, dark)
        addWindow.show()
    })
}

function importFromJson(browserWindow) {
    let aot = browserWindow.isAlwaysOnTop()
    if (aot) {
        browserWindow.setAlwaysOnTop(false)
    }
    dialog.showOpenDialog(browserWindow, { filters: [{ extensions: 'json' }] })
    .then(({ canceled, filePaths }) => {
        if (canceled || filePaths.length === 0) {
            if (aot) {
                browserWindow.setAlwaysOnTop(true)
            }
            return
        }
        fs.readFile(filePaths[0], (err, buffer) => {
            if (err) {
                dialog.showErrorBox('Cannot import data', 'Cannot import data from given file. Reason: ' + err)
            } else {
                try {
                    let json = JSON.parse(String(buffer))
                    if (Array.isArray(json) === false) {
                        dialog.showErrorBox('Cannot import data', 'Cannot import data from given file. Reason: Wrong format.')
                        return
                    }
                    clips = [...clips, ...json]
                    if (browserWindow) {
                        browserWindow.webContents.send('update', json)
                    } else {
                        BrowserWindow.getFocusedWindow().webContents.send('update', clips)
                    }
                } catch (err) {
                    dialog.showErrorBox('Cannot import data', 'Cannot import data from given file. Reason: ' + err)
                }
            }
            if (aot) {
                browserWindow.setAlwaysOnTop(true)
            }
        })
    })
}

function exportAsJson(browserWindow) {
    let aot = browserWindow.isAlwaysOnTop()
    if (aot) {
        browserWindow.setAlwaysOnTop(false)
    }
    dialog.showSaveDialog({ defaultPath: 'clips.json' })
    .then(({ canceled, filePath}) => {
        if (canceled || filePath === undefined) {
            if (aot) {
                browserWindow.setAlwaysOnTop(true)
            }
            return
        }
        let json = JSON.stringify(clips)
        fs.writeFileSync(filePath, json)
        if (aot) {
            browserWindow.setAlwaysOnTop(true)
        }
    })
}