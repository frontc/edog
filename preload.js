/**
 * preload.js
 * 预加载脚本 - 通过 contextBridge 安全地暴露 API 给渲染进程
 *
 * 暴露的 API（通过 window.electronAPI 访问）：
 * - moveWindow(dx, dy)          → 移动窗口（用于拖动宠物）
 * - onReminder(callback)        → 监听主进程提醒（为步骤 6.1 预留）
 * - setIgnoreMouseEvents(ignore) → 鼠标穿透控制（为步骤 4.2 预留）
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 移动窗口
   * @param {number} dx - X 方向偏移（像素）
   * @param {number} dy - Y 方向偏移（像素）
   */
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', { dx, dy }),

  /**
   * 监听主进程提醒事件（为步骤 6.1 预留）
   * @param {Function} callback - 回调函数，接收提醒类型参数
   */
  onReminder: (callback) => {
    ipcRenderer.on('reminder', (_event, type) => callback(type));
  },

  /**
   * 设置鼠标事件穿透（为步骤 4.2 预留）
   * @param {boolean} ignore - true 时鼠标事件穿透窗口，false 时恢复正常交互
   */
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore),
});
