/**
 * preload.js
 * 预加载脚本 - 通过 contextBridge 安全地暴露 API 给渲染进程
 *
 * 暴露的 API（通过 window.electronAPI 访问）：
 * - moveWindow(dx, dy)           → 移动窗口（用于拖动宠物）
 * - moveWindowTo(x, y)           → 将窗口移动到绝对坐标（用于散步行为）
 * - getScreenSize()              → 获取主屏幕 workArea 尺寸（返回 Promise）
 * - getWindowPosition()          → 获取当前窗口位置（返回 Promise）
 * - onReminder(callback)         → 监听主进程提醒（为步骤 6.1 预留）
 * - onTrayClick(callback)        → 监听托盘点击事件（为步骤 7.1 预留）
 * - setIgnoreMouseEvents(ignore) → 鼠标穿透控制（为步骤 4.2 预留）
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 移动窗口（相对偏移）
   * @param {number} dx - X 方向偏移（像素）
   * @param {number} dy - Y 方向偏移（像素）
   */
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', { dx, dy }),

  /**
   * 移动窗口到绝对坐标
   * @param {number} x - 目标 X 坐标（像素）
   * @param {number} y - 目标 Y 坐标（像素）
   */
  moveWindowTo: (x, y) => ipcRenderer.send('move-window-to', { x, y }),

  /**
   * 获取主屏幕 workArea 尺寸
   * @returns {Promise<{ width: number, height: number }>}
   */
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),

  /**
   * 获取当前窗口位置
   * @returns {Promise<{ x: number, y: number }>}
   */
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),

  /**
   * 监听主进程提醒事件（为步骤 6.1 预留）
   * @param {Function} callback - 回调函数，接收提醒类型参数
   */
  onReminder: (callback) => {
    ipcRenderer.on('reminder', (_event, type) => callback(type));
  },

  /**
   * 监听托盘点击事件（为步骤 7.1 预留）
   * @param {Function} callback - 回调函数，接收事件数据
   */
  onTrayClick: (callback) => {
    ipcRenderer.on('tray-click', (_event, data) => callback(data));
  },

  /**
   * 设置鼠标事件穿透（为步骤 4.2 预留）
   * @param {boolean} ignore - true 时鼠标事件穿透窗口，false 时恢复正常交互
   */
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore),
});
