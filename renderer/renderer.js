/**
 * renderer.js
 * 渲染进程入口文件
 * 负责 Canvas 初始化、宠物实例创建、鼠标交互集成、行为管理和游戏循环
 */
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

// 监听状态变化（用于调试）
pet._fsm.on('stateChange', ({ from, to }) => {
  console.log(`[StateMachine] ${from ?? '(null)'} → ${to}`);
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

/**
 * 游戏主循环
 * @param {DOMHighResTimeStamp} timestamp - requestAnimationFrame 提供的时间戳
 */
function gameLoop(timestamp) {
  const dt = (timestamp - lastTime) / 1000; // 转为秒
  lastTime = timestamp;

  // 更新宠物（内部驱动状态机 + 动画帧）
  pet.update(dt);

  // 更新交互逻辑（释放回中动画、LIFTED 摇摆效果等）
  interaction.update(dt);

  // 更新行为管理器（散步逻辑、扑击等）
  behaviorManager.update(dt);

  // 更新对话气泡
  speechBubble.update(dt);

  // 清空 Canvas（透明背景，适配 Electron 透明窗口）
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 渲染宠物当前帧
  pet.render();

  // 渲染对话气泡（在宠物之上）
  speechBubble.render(pet.x, pet.y);

  // 继续下一帧
  requestAnimationFrame(gameLoop);
}

// 暴露到 window 方便控制台手动测试
window.pet = pet;
window.behaviorManager = behaviorManager;

// 启动
init();
