const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  // 获取主显示器尺寸
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // 窗口尺寸
  const windowWidth = 200;
  const windowHeight = 200;

  // 定位到屏幕右下角
  const x = screenWidth - windowWidth;
  const y = screenHeight - windowHeight;

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // 开发环境可开启 DevTools（注释掉以保持窗口纯净）
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // 隐藏 Mac Dock 图标
  app.dock.hide();

  createWindow();

  app.on('activate', () => {
    // macOS: 点击 Dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 惯例: 非全部窗口关闭时退出应用
  app.quit();
});
