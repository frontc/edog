/**
 * renderer.js
 * 渲染进程入口文件
 * 负责 Canvas 初始化、状态机驱动、动画引擎和渲染循环
 */

import { SpriteAnimator } from './SpriteAnimator.js';
import { PetStateMachine } from './PetStateMachine.js';
import { SPRITESHEET_PATH } from './const.js';

// 获取 Canvas 元素和 2D 上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 禁用图像平滑，确保像素渲染锐利
ctx.imageSmoothingEnabled = false;

// 创建精灵动画引擎实例
const animator = new SpriteAnimator(ctx);

// 创建状态机实例
const fsm = new PetStateMachine(animator);

// 监听状态变化（用于调试）
fsm.on('stateChange', ({ from, to }) => {
  console.log(`[StateMachine] ${from ?? '(null)'} → ${to}`);
});

/**
 * 初始化：加载精灵图，进入默认待机状态，启动游戏循环
 */
async function init() {
  try {
    await animator.loadSpritesheet(SPRITESHEET_PATH);
    console.log('[渲染进程] 精灵图加载成功');
  } catch (err) {
    console.error('[渲染进程] 精灵图加载失败:', err.message);
    // 即使加载失败也继续，避免白屏（但不会渲染任何内容）
  }

  // 通过状态机进入待机状态
  fsm.transition('idle');

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

  // 更新状态机（驱动状态内部逻辑，例如一次性动画结束检测、定时器）
  fsm.update(dt);

  // 更新动画帧（由 animator 根据当前动画配置推进帧索引）
  animator.update(dt);

  // 清空 Canvas（透明背景，适配 Electron 透明窗口）
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 在原点绘制宠物（宠物 200×200 填满整个 200×200 Canvas）
  animator.render(0, 0, false);

  // 继续下一帧
  requestAnimationFrame(gameLoop);
}

// 暴露到 window 方便控制台手动测试
window.fsm = fsm;

// 启动
init();
