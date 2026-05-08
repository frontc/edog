/**
 * renderer.js
 * 渲染进程入口文件
 * 负责 Canvas 初始化、动画引擎驱动和渲染循环
 */

import { SpriteAnimator } from './SpriteAnimator.js';
import { SPRITESHEET_PATH } from './const.js';

// 获取 Canvas 元素和 2D 上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 禁用图像平滑，确保像素渲染锐利
ctx.imageSmoothingEnabled = false;

// 创建精灵动画引擎实例
const animator = new SpriteAnimator(ctx);

/**
 * 初始化：加载精灵图并启动默认待机动画
 */
async function init() {
  try {
    await animator.loadSpritesheet(SPRITESHEET_PATH);
    console.log('[渲染进程] 精灵图加载成功');
  } catch (err) {
    console.error('[渲染进程] 精灵图加载失败:', err.message);
    // 即使加载失败也启动循环，避免白屏（但不会渲染任何内容）
  }

  // 默认播放待机动画
  animator.play('idle');

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

  // 更新动画状态
  animator.update(dt);

  // 清空 Canvas（透明背景，适配 Electron 透明窗口）
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 在原点绘制宠物（宠物 200×200 填满整个 200×200 Canvas）
  animator.render(0, 0, false);

  // 继续下一帧
  requestAnimationFrame(gameLoop);
}

// 启动
init();
