const { app, BrowserWindow, screen, ipcMain } = require('electron');
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

  // 捕获渲染进程控制台日志并输出到终端
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const prefix = ['', '[INFO]', '[WARN]', '[ERROR]', '[DEBUG]'];
    console.log(`[渲染进程]${prefix[level] || ''} ${message}`);
  });

  // 开发环境可开启 DevTools（注释掉以保持窗口纯净）
  // mainWindow.webContents.openDevTools();

  // ========== IPC 消息处理 ==========

  /**
   * move-window：根据偏移量移动窗口位置
   * 用于渲染进程拖动宠物时同步移动窗口
   */
  ipcMain.on('move-window', (_event, { dx, dy }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [winX, winY] = mainWindow.getPosition();
      mainWindow.setPosition(winX + Math.round(dx), winY + Math.round(dy));
    }
  });

  /**
   * set-ignore-mouse-events：设置鼠标事件穿透
   * 用于步骤 4.2 实现穿透交互（宠物空闲时鼠标穿透窗口，点击时恢复交互）
   */
  ipcMain.on('set-ignore-mouse-events', (_event, ignore) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });
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
