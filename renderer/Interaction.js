/**
 * Interaction.js
 * 鼠标交互核心类
 * 职责：监听 Canvas 上的鼠标事件，根据 hitTest 结果触发宠物状态切换
 * 支持三种交互：拖动（body → LIFTED）、摸头（head → PETTED）、戳肚皮（belly → POKED）
 */
import { STATES } from './const.js';

// ---- 常量 ----

/** 窗口逻辑半宽/半高（Canvas 尺寸 200×200） */
const WINDOW_HALF_WIDTH = 100;
const WINDOW_HALF_HEIGHT = 100;

/** 触发窗口移动的边缘阈值（距离 Canvas 边缘 80px 以内时移动窗口） */
const EDGE_MARGIN = 80;

/** 点击判定最大移动距离（px） */
const CLICK_THRESHOLD = 5;

/** 释放后落回动画时长（秒） */
const RELEASE_DURATION = 0.5;

// ---- Easing 缓动函数 ----

/**
 * easeOutBounce — 弹跳缓出
 * 用于宠物释放后落回桌面中心的动画
 * @param {number} t 归一化时间 [0, 1]
 * @returns {number} 缓动后的进度值 [0, 1]
 */
function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

export class Interaction {
  /**
   * @param {import('./Pet.js').Pet} pet - 宠物实体实例
   * @param {HTMLCanvasElement} canvas - Canvas DOM 元素
   * @param {Object} electronAPI - 通过 preload.js contextBridge 暴露的 API
   * @param {Function} [electronAPI.moveWindow] - 移动窗口方法 (dx, dy) => void
   */
  constructor(pet, canvas, electronAPI) {
    this._pet = pet;
    this._canvas = canvas;
    this._electronAPI = electronAPI || {};

    // ---- 拖动状态 ----
    this._isDragging = false;
    this._dragTargetX = 0;        // mousemove 计算的 Canvas 内目标 X
    this._dragTargetY = 0;        // mousemove 计算的 Canvas 内目标 Y
    this._dragOffsetX = 0;        // mousedown 时鼠标相对于 pet 的 X 偏移
    this._dragOffsetY = 0;        // mousedown 时鼠标相对于 pet 的 Y 偏移

    // ---- 点击检测（区分 click 与 drag） ----
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._mouseDownTarget = null; // mousedown 时的 hitTest 结果
    this._mouseDownTime = 0;

    // ---- 摸头状态 ----
    this._isPetting = false;      // 鼠标是否正在头部区域内

    // ---- 释放回中动画 ----
    this._releaseAnimating = false;
    this._releaseStartX = 0;
    this._releaseStartY = 0;
    this._releaseTimer = 0;

    // ---- LIFTED 摇摆效果 ----
    this._swayTimer = 0;

    // ---- 绑定事件处理器（用于 destroy 解绑） ----
    this._boundMouseDown = this._onMouseDown.bind(this);
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
  }

  // ========== 生命周期 ==========

  /**
   * 初始化：绑定鼠标事件
   * mousedown 绑定在 Canvas 上，mousemove/mouseup 绑定在 window 上以支持拖出 Canvas 范围
   */
  init() {
    this._canvas.addEventListener('mousedown', this._boundMouseDown);
    window.addEventListener('mousemove', this._boundMouseMove);
    window.addEventListener('mouseup', this._boundMouseUp);
  }

  /**
   * 销毁：解绑所有事件，清理状态
   */
  destroy() {
    this._canvas.removeEventListener('mousedown', this._boundMouseDown);
    window.removeEventListener('mousemove', this._boundMouseMove);
    window.removeEventListener('mouseup', this._boundMouseUp);
    this._isDragging = false;
    this._isPetting = false;
    this._releaseAnimating = false;
  }

  /**
   * 每帧更新：处理释放回中动画 和 LIFTED 摇摆效果
   * @param {number} dt - 距上一帧的时间间隔（秒）
   */
  update(dt) {
    // ---- 释放回中弹跳动画 ----
    if (this._releaseAnimating) {
      this._releaseTimer += dt;
      const t = Math.min(this._releaseTimer / RELEASE_DURATION, 1);
      const ease = easeOutBounce(t);

      const x = this._releaseStartX + (0 - this._releaseStartX) * ease;
      const y = this._releaseStartY + (0 - this._releaseStartY) * ease;

      this._pet.moveTo(x, y);

      if (t >= 1) {
        this._releaseAnimating = false;
        this._pet.moveTo(0, 0);
      }
      return;
    }

    // ---- LIFTED 状态摇摆效果 ----
    if (this._isDragging) {
      this._swayTimer += dt;
      // 正弦波 X 方向 ±2px 摇摆 + Y 方向轻微上下浮动
      const swayX = Math.sin(this._swayTimer * 6) * 2;
      const swayY = Math.abs(Math.sin(this._swayTimer * 4)) * 1.5;
      this._pet.moveTo(this._dragTargetX + swayX, this._dragTargetY + swayY);
    } else {
      this._swayTimer = 0;
    }
  }

  // ========== 事件处理器 ==========

  /**
   * mousedown 处理
   * - body 区域：进入拖拽模式，切换到 LIFTED 状态
   * - 其他区域：记录点击位置和目标，用于后续判定 click vs drag
   * @param {MouseEvent} e
   */
  _onMouseDown(e) {
    const { mx, my } = this._getCanvasCoords(e);
    const hit = this._pet.hitTest(mx, my);

    // 记录点击信息（用于区分 click 与 drag）
    this._mouseDownX = mx;
    this._mouseDownY = my;
    this._mouseDownTarget = hit;

    // ---- 拖动（body mousedown） ----
    if (hit === 'body') {
      this._isDragging = true;
      this._dragOffsetX = mx - this._pet.x;
      this._dragOffsetY = my - this._pet.y;
      this._dragTargetX = this._pet.x;
      this._dragTargetY = this._pet.y;

      // 取消任何正在进行的释放回中动画
      this._releaseAnimating = false;

      // 切换到 LIFTED 状态
      this._pet.setState(STATES.LIFTED);
    }
  }

  /**
   * mousemove 处理
   * - 拖拽中（_isDragging）：计算 Canvas 内偏移，推动窗口边缘
   * - 非拖拽：检测摸头交互
   * @param {MouseEvent} e
   */
  _onMouseMove(e) {
    const { mx, my } = this._getCanvasCoords(e);

    // ---- 拖拽模式 ----
    if (this._isDragging) {
      // 取消摸头状态
      this._isPetting = false;

      let canvasOffsetX = mx - this._dragOffsetX;
      let canvasOffsetY = my - this._dragOffsetY;

      // ---- 窗口边缘推动逻辑 ----
      // 当宠物被拖到 Canvas 边缘 margin 范围内时，移动窗口让宠物保持在可视区域
      const boundaryX = WINDOW_HALF_WIDTH - EDGE_MARGIN; // = 20
      const boundaryY = WINDOW_HALF_HEIGHT - EDGE_MARGIN; // = 20

      // 左边缘：offsetX < -20
      if (canvasOffsetX < -boundaryX) {
        const shift = -(canvasOffsetX + boundaryX);
        this._tryMoveWindow(-shift, 0);
        canvasOffsetX += shift;
      }
      // 右边缘：offsetX > 20
      else if (canvasOffsetX > boundaryX) {
        const shift = canvasOffsetX - boundaryX;
        this._tryMoveWindow(shift, 0);
        canvasOffsetX -= shift;
      }

      // 上边缘：offsetY < -20
      if (canvasOffsetY < -boundaryY) {
        const shift = -(canvasOffsetY + boundaryY);
        this._tryMoveWindow(0, -shift);
        canvasOffsetY += shift;
      }
      // 下边缘：offsetY > 20
      else if (canvasOffsetY > boundaryY) {
        const shift = canvasOffsetY - boundaryY;
        this._tryMoveWindow(0, shift);
        canvasOffsetY -= shift;
      }

      // 限制宠物在 Canvas 内可见范围（留 20px 防止完全贴边）
      canvasOffsetX = Math.max(-WINDOW_HALF_WIDTH + 20, Math.min(WINDOW_HALF_WIDTH - 20, canvasOffsetX));
      canvasOffsetY = Math.max(-WINDOW_HALF_HEIGHT + 20, Math.min(WINDOW_HALF_HEIGHT - 20, canvasOffsetY));

      // 保存目标位置（实际位置由 update() 加上摇摆效果后设置）
      this._dragTargetX = canvasOffsetX;
      this._dragTargetY = canvasOffsetY;
      return;
    }

    // ---- 摸头交互（非拖拽状态） ----
    const hit = this._pet.hitTest(mx, my);

    if (hit === 'head') {
      // 鼠标刚进入头部区域时触发 PETTED 状态
      if (!this._isPetting) {
        this._isPetting = true;
        this._pet.setState(STATES.PETTED);
      }
      // 给 pet 轻微 Y 偏移模拟享受下沉
      this._pet.y = 5;
    } else if (this._isPetting) {
      // 鼠标离开头部区域
      this._isPetting = false;
      // 恢复 Y 位置（PETTED 状态机将在 0.5s 后自动切回 IDLE）
      this._pet.y = 0;
    }
  }

  /**
   * mouseup 处理
   * - 拖拽释放：切回 IDLE，启动回中弹跳动画
   * - 戳肚皮判定：如果 mousedown/mouseup 都在 belly 区域且移动 < 5px
   * @param {MouseEvent} e
   */
  _onMouseUp(e) {
    const { mx, my } = this._getCanvasCoords(e);

    // ---- 释放拖动 ----
    if (this._isDragging) {
      this._isDragging = false;
      this._pet.setState(STATES.IDLE);

      // 启动回中弹跳动画
      this._releaseStartX = this._pet.x;
      this._releaseStartY = this._pet.y;
      this._releaseTimer = 0;
      this._releaseAnimating = true;
      return;
    }

    // ---- 戳肚皮判定（click） ----
    if (this._mouseDownTarget === 'belly') {
      const dx = mx - this._mouseDownX;
      const dy = my - this._mouseDownY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < CLICK_THRESHOLD) {
        this._pet.setState(STATES.POKED);

        // 微弹跳效果：Y 方向抖动
        this._pet.y = -5;
        setTimeout(() => {
          this._pet.y = 0;
        }, 150);
      }
    }

    this._mouseDownTarget = null;
  }

  // ========== 辅助方法 ==========

  /**
   * 将鼠标事件坐标转换为 Canvas 坐标系
   * @param {MouseEvent} e
   * @returns {{ mx: number, my: number }}
   */
  _getCanvasCoords(e) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      mx: e.clientX - rect.left,
      my: e.clientY - rect.top,
    };
  }

  /**
   * 安全调用 moveWindow API（保护性调用）
   * @param {number} dx
   * @param {number} dy
   */
  _tryMoveWindow(dx, dy) {
    if (typeof this._electronAPI.moveWindow === 'function') {
      this._electronAPI.moveWindow(dx, dy);
    }
  }
}
