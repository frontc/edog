/**
 * renderer.js
 * 渲染进程入口文件
 * 负责 Canvas 初始化、宠物实例创建、鼠标交互集成、行为管理和游戏循环
 */

// ========== 渲染进程全局异常处理 ==========

window.onerror = (message, source, lineno, colno, error) => {
  console.error('[渲染进程] 全局错误:', message, error?.stack);
  // 尝试通过 IPC 发送到主进程日志
  try {
    if (window.electronAPI && window.electronAPI.sendLog) {
      window.electronAPI.sendLog('error', `全局错误: ${message} ${error?.stack || ''}`);
    }
  } catch (_) {
    // 忽略 IPC 发送异常
  }
};

window.onunhandledrejection = (event) => {
  console.error('[渲染进程] 未处理的 Promise 拒绝:', event.reason);
  try {
    if (window.electronAPI && window.electronAPI.sendLog) {
      window.electronAPI.sendLog('error', `未处理的 Promise 拒绝: ${event.reason}`);
    }
  } catch (_) {
    // 忽略 IPC 发送异常
  }
};

import { Pet } from './Pet.js';
import { Interaction } from './Interaction.js';
import { BehaviorManager } from './BehaviorManager.js';
import { SpeechBubble } from './SpeechBubble.js';
import { SPRITESHEET_PATH, REMINDERS, STATES } from './const.js';

// 获取 Canvas 元素和 2D 上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 禁用图像平滑，确保像素渲染锐利
ctx.imageSmoothingEnabled = false;

// 创建宠物实体（外观模式：整合 animator + fsm）
const pet = new Pet(ctx);

// 创建鼠标交互实例（通过 preload.js 的 contextBridge 暴露的 electronAPI）
const interaction = new Interaction(pet, canvas, window.electronAPI);
interaction.init();

// 创建行为管理器（管理散步、扑击等自发行为）
const behaviorManager = new BehaviorManager(pet);

// 创建对话气泡（用于提醒系统）
const speechBubble = new SpeechBubble(ctx);

// ========== 提醒系统集成 ==========

/**
 * 处理提醒事件
 * @param {'stand'|'drink'} type - 提醒类型
 */
function handleReminder(type) {
  const text = type === REMINDERS.STAND ? REMINDERS.STAND_TEXT : REMINDERS.DRINK_TEXT;
  console.log(`[提醒系统] 收到提醒: ${type} -> "${text}"`);

  // 1. 暂停 BehaviorManager 的散步调度
  behaviorManager.pause();

  // 2. 让宠物面向屏幕中央（direction 朝屏幕内，即 'right'）
  pet.direction = 'right';

  // 3. 显示对应文字的气泡，10 秒后自动消失并恢复行为
  speechBubble.show(text, REMINDERS.BUBBLE_DURATION, () => {
    // 5. 气泡消失后恢复 BehaviorManager
    behaviorManager.resume();
    console.log('[提醒系统] 气泡消失，恢复正常行为');
  });
}

// 监听主进程提醒事件
window.electronAPI.onReminder((type) => {
  handleReminder(type);
});

// ---- 状态变化标记（用于脏矩形跳过渲染） ----
let stateChanged = false;

// 监听托盘点击事件（打招呼动画）
window.electronAPI.onTrayClick((data) => {
  if (data && data.action === 'greet') {
    console.log('[渲染进程] 托盘点击 → 打招呼');
    // 如果宠物处于 IDLE 状态，短暂切换到 POUNCING 作为打招呼
    if (pet._fsm.currentState === STATES.IDLE) {
      // 使用 POUNCING 状态播放一次扑动画，自然结束后回到 IDLE
      pet._fsm.transition(STATES.POUNCING);
    }
  }
});

// 监听状态变化（用于调试 + 脏标记）
pet._fsm.on('stateChange', ({ from, to }) => {
  console.log(`[StateMachine] ${from ?? '(null)'} → ${to}`);
  stateChanged = true;
});

/**
 * 初始化：加载精灵图，进入默认待机状态，启动游戏循环
 */
async function init() {
  try {
    await pet.init(SPRITESHEET_PATH);
    console.log('[渲染进程] 精灵图加载成功');
  } catch (err) {
    console.error('[渲染进程] 精灵图加载失败:', err.message);
    // 即使加载失败也继续，避免白屏（但不会渲染任何内容）
  }

  // 启动游戏循环
  requestAnimationFrame(gameLoop);
}

let lastTime = performance.now();

// ---- 可变帧率控制 ----
const FPS_IDLE = 4;
const FPS_ACTIVE = 30;
let frameAccumulator = 0;

/**
 * 游戏主循环
 * @param {DOMHighResTimeStamp} timestamp - requestAnimationFrame 提供的时间戳
 */
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // 转为秒，上限 100ms
  lastTime = timestamp;

  // === 可变帧率：根据状态决定目标帧率 ===
  let targetFps = FPS_IDLE; // 默认 IDLE 4fps
  const state = pet._fsm.currentState;
  if (state !== STATES.IDLE || speechBubble.isVisible) {
    targetFps = FPS_ACTIVE; // WALKING/POUNCING/LIFTED/PETTED/POKED 或气泡可见时 30fps
  }
  const frameInterval = 1 / targetFps;
  frameAccumulator += dt;

  // === 始终更新逻辑（不跳过状态机和动画的 delta time） ===
  try {
    pet.update(dt);
    interaction.update(dt);
    behaviorManager.update(dt);
    speechBubble.update(dt);
  } catch (err) {
    console.error('[gameLoop] 更新异常:', err);
  }

  // === 条件渲染：只在需要时绘制 ===
  const shouldRender = frameAccumulator >= frameInterval || stateChanged || speechBubble.isVisible;
  if (shouldRender) {
    frameAccumulator = 0;

    // 脏矩形检测：_animator.dirty 或状态改变时才清屏重绘
    if (stateChanged || pet._animator.dirty || speechBubble.isVisible) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pet.render();
      speechBubble.render(pet.x, pet.y);
    }
    stateChanged = false;
  }

  // 继续下一帧
  requestAnimationFrame(gameLoop);
}

// 暴露到 window 方便控制台手动测试
window.pet = pet;
window.behaviorManager = behaviorManager;

// 启动
init();
