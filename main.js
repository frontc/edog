const electron = require('electron');
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, dialog } = electron;
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isMuted = false;

// ========== 提醒系统（步骤 6.1） ==========

const REMINDER_INTERVALS = {
  STAND: 60 * 60 * 1000,   // 60 分钟（3600000ms）
  DRINK: 120 * 60 * 1000,  // 120 分钟（7200000ms）
  // STAND: 10 * 1000,   // 10 秒
  // DRINK: 20 * 1000,   // 20 秒

};

const REMINDER_STATE_FILE = 'reminder-state.json';

let standTimer = null;
let drinkTimer = null;

/**
 * 获取提醒状态文件的完整路径
 */
function getReminderStatePath() {
  return path.join(app.getPath('userData'), REMINDER_STATE_FILE);
}

/**
 * 从 JSON 文件读取上次提醒时间戳
 * 如果文件不存在或损坏，返回 null
 */
function loadReminderState() {
  try {
    const filePath = getReminderStatePath();
    const data = fs.readFileSync(filePath, 'utf-8');
    const state = JSON.parse(data);
    if (typeof state.lastStandReminder === 'number' && typeof state.lastDrinkReminder === 'number') {
      return state;
    }
    console.warn('[提醒系统] reminder-state.json 格式无效，重置计时');
    return null;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('[提醒系统] reminder-state.json 不存在，从当前时间开始计时');
    } else {
      console.warn('[提醒系统] 读取 reminder-state.json 失败:', err.message);
    }
    return null;
  }
}

/**
 * 将上次提醒时间戳写入 JSON 文件
 */
function saveReminderState(state) {
  try {
    const filePath = getReminderStatePath();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
    console.log('[提醒系统] 已保存提醒状态');
  } catch (err) {
    console.warn('[提醒系统] 保存 reminder-state.json 失败:', err.message);
  }
}

/**
 * 发送提醒通知
 * @param {'stand'|'drink'} type - 提醒类型
 */
function sendReminder(type) {
  if (isMuted) {
    console.log(`[提醒系统] 静音模式，跳过提醒: ${type}`);
    return;
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // 通过 IPC 通知渲染进程显示气泡
  mainWindow.webContents.send('reminder', type);

  // 更新 JSON 持久化
  const now = Date.now();
  const state = loadReminderState() || { lastStandReminder: now, lastDrinkReminder: now };
  if (type === 'stand') {
    state.lastStandReminder = now;
  } else {
    state.lastDrinkReminder = now;
  }
  saveReminderState(state);

  console.log(`[提醒系统] 已发送提醒: ${type}`);
}

/**
 * 计算给定类型距离上次提醒的剩余时间（ms）
 * 若上次记录不存在，则从当前时间开始计时（即返回完整间隔）
 * @param {'stand'|'drink'} type
 * @returns {number} 剩余毫秒数（至少 1000ms）
 */
function computeRemainingTime(type) {
  const state = loadReminderState();
  const interval = type === 'stand' ? REMINDER_INTERVALS.STAND : REMINDER_INTERVALS.DRINK;
  const now = Date.now();

  if (state) {
    const lastTime = type === 'stand' ? state.lastStandReminder : state.lastDrinkReminder;
    const elapsed = now - lastTime;
    const remaining = interval - elapsed;
    // 如果已过间隔或剩余时间不足1秒，在1秒后触发
    return Math.max(remaining, 1000);
  }

  // 无状态文件，完整间隔后触发
  return interval;
}

/**
 * 启动单个提醒定时器
 * @param {'stand'|'drink'} type
 * @returns {number} 本次设定的延迟（ms）
 */
function startReminderTimer(type) {
  const remaining = computeRemainingTime(type);
  const timer = setTimeout(() => {
    sendReminder(type);
    // 发送后重新设置定时器（完整的循环间隔）
    if (type === 'stand') {
      standTimer = setInterval(() => sendReminder('stand'), REMINDER_INTERVALS.STAND);
    } else {
      drinkTimer = setInterval(() => sendReminder('drink'), REMINDER_INTERVALS.DRINK);
    }
  }, remaining);

  if (type === 'stand') {
    standTimer = timer;
  } else {
    drinkTimer = timer;
  }

  console.log(`[提醒系统] ${type === 'stand' ? '站立' : '喝水'}提醒将于 ${(remaining / 1000 / 60).toFixed(1)} 分钟后首次触发`);
  return remaining;
}

/**
 * 初始化提醒系统
 * 在 app.whenReady() 中调用
 */
function initReminderSystem() {
  console.log('[提醒系统] 初始化提醒定时器...');

  // 启动站立提醒定时器
  startReminderTimer('stand');

  // 启动喝水提醒定时器
  startReminderTimer('drink');

  console.log('[提醒系统] 提醒系统初始化完成');
}

/**
 * 清理所有提醒定时器
 */
function clearReminderTimers() {
  if (standTimer) {
    clearTimeout(standTimer);
    clearInterval(standTimer);
    standTimer = null;
  }
  if (drinkTimer) {
    clearTimeout(drinkTimer);
    clearInterval(drinkTimer);
    drinkTimer = null;
  }
  console.log('[提醒系统] 定时器已清理');
}

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
   * move-window-to：将窗口移动到绝对坐标
   * 用于散步行为中平滑移动窗口
   */
  ipcMain.on('move-window-to', (_event, { x, y }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setPosition(Math.round(x), Math.round(y));
    }
  });

  /**
   * get-screen-size：返回主屏幕 workArea 尺寸
   * 用于 BehaviorManager 计算随机散步目标
   */
  ipcMain.handle('get-screen-size', () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    return { width, height };
  });

  /**
   * get-window-position：返回当前窗口位置
   * 用于 BehaviorManager 获取散步起始点
   */
  ipcMain.handle('get-window-position', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [x, y] = mainWindow.getPosition();
      return { x, y };
    }
    return { x: 0, y: 0 };
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

/**
 * 创建系统托盘
 * 在 app.whenReady() 中调用（Electron 要求 Tray 在 ready 后创建）
 */
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);

  /**
   * 构建右键菜单
   * 每次调用重新构建，确保静音状态同步
   */
  function buildContextMenu() {
    return Menu.buildFromTemplate([
      {
        label: '显示/隐藏宠物',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
              mainWindow.hide();
            } else {
              mainWindow.show();
            }
          }
        }
      },
      { type: 'separator' },
      {
        label: '切换静音',
        type: 'checkbox',
        checked: isMuted,
        click: (menuItem) => {
          isMuted = menuItem.checked;
          // 重建菜单（使下次右键打开时同步状态）
          tray.setContextMenu(buildContextMenu());
        }
      },
      { type: 'separator' },
      {
        label: '站立提醒',
        click: () => {
          manualReminder('stand');
        }
      },
      {
        label: '喝水提醒',
        click: () => {
          manualReminder('drink');
        }
      },
      { type: 'separator' },
      {
        label: '关于',
        click: () => {
          dialog.showMessageBox({
            type: 'info',
            title: '关于 像素边牧',
            message: '像素边牧 v1.0.0',
            detail: '一只可爱的桌面电子宠物，陪伴你的工作时光。\n\n功能：\n• 站立提醒（60分钟）\n• 喝水提醒（120分钟）\n• 自动散步与扑击\n• 触摸互动（抚摸/戳/提起）'
          });
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit();
        }
      }
    ]);
  }

  tray.setToolTip('像素边牧');
  tray.setContextMenu(buildContextMenu());

  // 左键点击托盘图标：仅当窗口可见时发送打招呼消息，不切换窗口可见性
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      mainWindow.webContents.send('tray-click', { action: 'greet' });
    }
  });
}

/**
 * 手动触发提醒（不受静音影响）
 * @param {'stand'|'drink'} type - 提醒类型
 */
function manualReminder(type) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reminder', type);
  }
  const timestamp = Date.now();
  const key = type === 'stand' ? 'lastStandReminder' : 'lastDrinkReminder';
  const state = loadReminderState() || { lastStandReminder: timestamp, lastDrinkReminder: timestamp };
  state[key] = timestamp;
  saveReminderState(state);
  console.log(`[提醒系统] 手动触发提醒: ${type}`);
}

app.whenReady().then(() => {
  // 隐藏 Mac Dock 图标
  app.dock.hide();

  createWindow();

  // 创建系统托盘（必须在 app.whenReady 之后）
  createTray();

  // 初始化提醒系统
  initReminderSystem();

  app.on('activate', () => {
    // macOS: 点击 Dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 下保持托盘运行，不退出
  // （点击窗口关闭按钮仅隐藏窗口，不触发此事件）
});

app.on('before-quit', () => {
  clearReminderTimers();
  // 清理托盘
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
