/**
 * renderer.js
 * 渲染进程入口文件
 * 负责 Canvas 初始化、宠物实例创建、鼠标交互集成和游戏循环
 */
import { Pet } from './Pet.js';
import { Interaction } from './Interaction.js';
import { SPRITESHEET_PATH } from './const.js';

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

  // 清空 Canvas（透明背景，适配 Electron 透明窗口）
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 渲染宠物当前帧
  pet.render();

  // 继续下一帧
  requestAnimationFrame(gameLoop);
}

// 暴露到 window 方便控制台手动测试
window.pet = pet;

// 启动
init();
