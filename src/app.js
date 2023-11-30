const { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, nativeTheme, dialog, shell, Tray } = require('electron')
const { autoUpdater } = require('electron-updater')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sound = require('sound-play')
const PLATFORM = undefined
const BUILD_DATE = '2023.11.30'

let clips = []
let settings
let mainWindow
let tray
let updateAvailable = false
let lastCFU = new Date().getTime()

app.whenReady().then(() => {
    if (fs.existsSync(path.join(app.getPath('userData'), 'settings.json'))) {
        settings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json')))
    } else {
        settings = {
            'appearance': 'system',
            'always_on_top': false,
            'dock-icon': true,
            'font': 'system',
            'tray': undefined
        }
    }
    app.setActivationPolicy(settings['dock-icon'] === false ? 'accessory' : 'regular')
    createAppMenu()
    createTrayIcon(settings['tray'])
    if (settings['dock-icon'] !== false) {
        createMainWindow()
    } else if (fs.existsSync(path.join(app.getPath('userData'), 'clips.json'))) {
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
    autoUpdater.checkForUpdatesAndNotify()
    .then((res) => {
        updateAvailable = res && res.updateInfo.version > app.getVersion()
        if (updateAvailable === false) {
            lastCFU = new Date().getTime()
        }
    })
    .catch((error) => console.log(error))
})

app.on('activate', createMainWindow)

app.on('window-all-closed', () => {
    if (tray === undefined) {
        app.quit()
    } else if (updateAvailable) {
        autoUpdater.quitAndInstall()
    }
})

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
    dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        message: 'Clippiez',
        detail: 'Version ' + app.getVersion() + ' (' + BUILD_DATE + ')\nDeveloped by YUH APPS',
        buttons: ['OK & Close', 'YUH APPS Website'],
        defaultId: 0,
        noLink: true,
        normalizeAccessKeys: process.platform === 'win32'
    }).then(({ response }) => {
        if (response === 1) shell.openExternal('https://yuhapps.dev')
    })
}

function createAppMenu() {
    let platform = PLATFORM || process.platform
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
                    label: 'Auto Launch ' + (process.platform === 'darwin' ? 'at Login' : 'on startup'),
                    submenu: [
                        {
                            label: 'On',
                            checked: app.getLoginItemSettings().openAtLogin,
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                app.setLoginItemSettings({ openAtLogin: true })
                            }
                        },
                        {
                            label: 'Off',
                            checked: !app.getLoginItemSettings().openAtLogin,
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                app.setLoginItemSettings({ openAtLogin: false })
                            }
                        }
                    ]
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
                                nativeTheme.themeSource = settings['appearance'] = 'system'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', PLATFORM || process.platform, nativeTheme.shouldUseDarkColors, settings['font'] === 'lato'))
                            }
                        },
                        {
                            label: 'Light',
                            checked: settings['appearance'] === 'light',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                nativeTheme.themeSource = settings['appearance'] = 'light'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', PLATFORM || process.platform, false, settings['font'] === 'lato'))
                            }
                        },
                        {
                            label: 'Dark',
                            checked: settings['appearance'] === 'dark',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                nativeTheme.themeSource = settings['appearance'] = 'dark'
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
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark', 'system'))
                            }
                        },
                        {
                            label: 'Lato',
                            checked: settings['font'] === 'lato',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['font'] = 'lato'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark', 'lato'))
                            }
                        },
                        {
                            label: 'Nunito',
                            checked: settings['font'] === 'nunito',
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['font'] = 'nunito'
                                menuItem.checked = true
                                BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark', 'nunito'))
                            }
                        }
                    ]
                },
                {
                    label: 'Tray icon',
                    submenu: [
                        {
                            label: 'On',
                            checked: settings['tray'] === true,
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['tray'] = true
                                menuItem.checked = true
                                createTrayIcon(true)
                            }
                        },
                        {
                            label: 'Off',
                            checked: settings['tray'] !== true,
                            type: 'radio',
                            click: (menuItem, browserWindow, event) => {
                                settings['tray'] = false
                                menuItem.checked = true
                                createTrayIcon(false)
                            }
                        },
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
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Clear system clipboard',
                    click: (menuItem, browserWindow, event) => {
                        clipboard.clear()
                        sound.play('src/views/done.wav')
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
            label: 'Auto Launch ' + (process.platform === 'darwin' ? 'at Login' : 'on startup'),
            submenu: [
                {
                    label: 'On',
                    checked: app.getLoginItemSettings().openAtLogin,
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        app.setLoginItemSettings({ openAtLogin: true })
                    }
                },
                {
                    label: 'Off',
                    checked: !app.getLoginItemSettings().openAtLogin,
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        app.setLoginItemSettings({ openAtLogin: false })
                    }
                }
            ]
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
                        nativeTheme.themeSource = settings['appearance'] = 'system'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, nativeTheme.shouldUseDarkColors, settings['font'] === 'lato'))
                    }
                },
                {
                    label: 'Light',
                    checked: settings['appearance'] === 'light',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        nativeTheme.themeSource = settings['appearance'] = 'light'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, false, settings['font'] === 'lato'))
                    }
                },
                {
                    label: 'Dark',
                    checked: settings['appearance'] === 'dark',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        nativeTheme.themeSource = settings['appearance'] = 'dark'
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
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark', 'system'))
                    }
                },
                {
                    label: 'Lato',
                    checked: settings['font'] === 'lato',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['font'] = 'lato'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark', 'lato'))
                    }
                },
                {
                    label: 'Nunito',
                    checked: settings['font'] === 'nunito',
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['font'] = 'nunito'
                        menuItem.checked = true
                        BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('platform', platform, settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark', 'nunito'))
                    }
                }
            ]
        },
        {
            label: 'Tray icon',
            submenu: [
                {
                    label: 'On',
                    checked: settings['tray'] === true,
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['tray'] = true
                        menuItem.checked = true
                        createTrayIcon(true)
                    }
                },
                {
                    label: 'Off',
                    checked: settings['tray'] !== true,
                    type: 'radio',
                    click: (menuItem, browserWindow, event) => {
                        settings['tray'] = false
                        menuItem.checked = true
                        createTrayIcon(false)
                    }
                },
            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'Clear system clipboard',
            click: (menuItem, browserWindow, event) => {
                clipboard.clear()
                sound.play('src/views/done.wav')
            }
        },
        {
            label: 'About Clippiez',
            click: showAbout
        },
        {
            label: 'Quit Clippiez',
            click: app.quit
        }
    ])
    menu.popup({ x: Math.round(bounds.x), y: Math.round(bounds.y) })
}

function createMainWindow() {
    if (mainWindow !== undefined && mainWindow.isDestroyed() === false) {
        mainWindow.show()
        return
    }
    let platform = PLATFORM || process.platform
    let dark = settings['appearance'] === 'system' ? nativeTheme.shouldUseDarkColors : settings['appearance'] === 'dark'
    let font = settings['font'] || 'system'
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
        skipTaskbar: !settings['dock-icon'],
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
        mainWindow.webContents.send('platform', platform, dark, font, settings['dock-icon'])
        mainWindow.webContents.send('update', clips)
        mainWindow.show()
    })
    mainWindow.webContents.on('context-menu', (e, { x, y, editFlags, inputFieldType, selectionText }) => { 
        if (inputFieldType !== 'none') {
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
    addWindow.webContents.on('did-finish-load', (e) => {
        addWindow.webContents.send('platform', platform, dark)
        addWindow.show()
    })
}

function createTrayIcon(t) {
    if (t) {
        tray = new Tray(nativeImage.createFromPath(resolveResourcesPath('trayTemplate.png')))
        tray.on('click', (event) => {
            let now = new Date().getTime()
            if (now >= lastCFU + 86400000) {
                autoUpdater.checkForUpdatesAndNotify()
                .then((res) => {
                    updateAvailable = res && res.updateInfo.version > app.getVersion()
                    if (updateAvailable === false) {
                        lastCFU = now
                    }
                })
                .catch((error) => console.log(error))
            }
            if (settings['tray-tip'] === undefined || settings['tray-tip'] < 1) {
                dialog.showMessageBox({
                    message: 'IMPORTANT',
                    detail: 'Click the Tray icon to see the clips and click on any of them to copy the text. Hold ' + (process.platform === 'darwin' ? 'Option' : 'Alt') + ' key and click the Tray icon for app options.'
                }).then(() => settings['tray-tip'] = 1)
                return
            }
            tray.popUpContextMenu(Menu.buildFromTemplate(
                event.altKey ? [
                    {
                        label: 'Install update',
                        click: () => autoUpdater.quitAndInstall(),
                        visible: updateAvailable === true
                    },
                    {
                        type: 'separator',
                        visible: updateAvailable === true
                    },
                    {
                        label: 'Manage clips',
                        click: createMainWindow
                    },
                    {
                        label: 'Dock icon',
                        submenu: [
                            {
                                label: 'On',
                                checked: settings['dock-icon'] !== false,
                                type: 'radio',
                                click: (menuItem, browserWindow, event) => {
                                    settings['dock-icon'] = true
                                    menuItem.checked = true
                                    if (mainWindow && mainWindow.isDestroyed() === false) {
                                        mainWindow.setSkipTaskbar(false)
                                    }
                                    if (process.platform === 'darwin') {
                                        app.setActivationPolicy('regular')
                                    }
                                }
                            },
                            {
                                label: 'Off',
                                checked: settings['dock-icon'] === false,
                                type: 'radio',
                                click: (menuItem, browserWindow, event) => {
                                    settings['dock-icon'] = false
                                    menuItem.checked = true
                                    if (mainWindow && mainWindow.isDestroyed() === false) {
                                        mainWindow.setSkipTaskbar(true)
                                    }
                                    if (process.platform === 'darwin') {
                                        app.setActivationPolicy('accessory')
                                    }
                                }
                            },
                        ]
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Clear system clipboard',
                        click: (menuItem, browserWindow, event) => {
                            clipboard.clear()
                            sound.play('src/views/done.wav')
                        }
                    },
                    {
                        label: 'Quit Clippiez',
                        click: app.quit
                    }
                ] : [ 
                    {
                        label: 'Install update',
                        click: () => autoUpdater.quitAndInstall(),
                        visible: updateAvailable === true
                    },
                    {
                        type: 'separator',
                        visible: updateAvailable === true
                    },
                    ...clips.map((clip) => ({
                        label: clip.text.length > 50 ? clip.text.substring(0, 50) + '...' : clip.text,
                        click: () => clipboard.writeText(clip.text)
                    }))
                ]
            ))
        })
        tray.on('right-click', (event) => {
            tray.popUpContextMenu(Menu.buildFromTemplate(
                [
                    {
                        label: 'Install update',
                        click: () => autoUpdater.quitAndInstall(),
                        visible: updateAvailable === true
                    },
                    {
                        type: 'separator',
                        visible: updateAvailable === true
                    },
                    {
                        label: 'Manage clips',
                        click: createMainWindow
                    },
                    {
                        label: 'Dock icon',
                        submenu: [
                            {
                                label: 'On',
                                checked: settings['dock-icon'] !== false,
                                type: 'radio',
                                click: (menuItem, browserWindow, event) => {
                                    settings['dock-icon'] = true
                                    menuItem.checked = true
                                    if (mainWindow && mainWindow.isDestroyed() === false) {
                                        mainWindow.setSkipTaskbar(false)
                                    }
                                    if (process.platform === 'darwin') {
                                        app.setActivationPolicy('regular')
                                    }
                                }
                            },
                            {
                                label: 'Off',
                                checked: settings['dock-icon'] === false,
                                type: 'radio',
                                click: (menuItem, browserWindow, event) => {
                                    settings['dock-icon'] = false
                                    menuItem.checked = true
                                    if (mainWindow && mainWindow.isDestroyed() === false) {
                                        mainWindow.setSkipTaskbar(true)
                                    }
                                    if (process.platform === 'darwin') {
                                        app.setActivationPolicy('accessory')
                                    }
                                }
                            },
                        ]
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Clear system clipboard',
                        click: (menuItem, browserWindow, event) => {
                            clipboard.clear()
                            sound.play('src/views/done.wav')
                        }
                    },
                    {
                        label: 'Quit Clippiez',
                        click: app.quit
                    }
                ]
            ))
        })
    } else if (tray !== undefined) {
        tray.destroy()
        tray = undefined
    }
}

function resolveResourcesPath(name) {
    return app.isPackaged ? path.join(process.resourcesPath, 'assets', name) : path.join(__dirname, 'assets', name)
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