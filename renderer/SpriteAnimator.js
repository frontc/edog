/**
 * SpriteAnimator.js
 * 精灵动画引擎类
 * 职责：管理精灵图的加载和动画帧播放
 * 单一职责原则 — 只做动画播放，不做状态管理
 */

import { ANIMS, FRAME_WIDTH, FRAME_HEIGHT } from './const.js';

export class SpriteAnimator {
  /**
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 渲染上下文
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.spritesheet = null;      // Image 对象
    this.loaded = false;          // 精灵图是否加载完成

    // 当前动画状态
    this.animName = 'idle';
    this.config = ANIMS[this.animName];
    this.frameIndex = 0;          // 当前帧在该动画帧数组中的索引
    this.timer = 0;               // 累计时间（秒）
    this.playing = true;          // 动画是否正在播放

    // ---- 脏标记（用于性能优化） ----
    this.dirty = false;           // 动画是否发生变化，需要重新渲染
  }

  /**
   * 加载精灵图
   * @param {string} path - 精灵图路径
   * @returns {Promise<void>}
   */
  loadSpritesheet(path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.spritesheet = img;
        this.loaded = true;
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`精灵图加载失败: ${path}`));
      };
      img.src = path;
    });
  }

  /**
   * 播放指定动画
   * 从 ANIMS 获取配置，重置帧计时器和帧索引
   * @param {string} animName - 动画名称（对应 ANIMS 的 key）
   */
  play(animName) {
    if (!ANIMS[animName]) {
      console.warn(`[SpriteAnimator] 未知动画: ${animName}，回退到 idle`);
      animName = 'idle';
    }

    this.animName = animName;
    this.config = ANIMS[animName];
    this.frameIndex = 0;
    this.timer = 0;
    this.playing = true;
    this.dirty = true; // 动画切换，标记需要重新渲染
  }

  /**
   * 每帧更新
   * 根据 fps 计算帧间隔，推进帧索引
   * @param {number} dt - 距上一帧的时间间隔（秒）
   */
  update(dt) {
    if (!this.loaded || !this.playing) return;

    const { frames, fps, loop } = this.config;
    const frameDuration = 1 / fps;

    this.timer += dt;

    // 累计时间达到帧间隔时推进帧
    while (this.timer >= frameDuration) {
      this.timer -= frameDuration;

      if (this.frameIndex < frames.length - 1) {
        // 未到最后一帧，正常推进
        this.frameIndex++;
      } else {
        // 已到最后一帧
        if (loop) {
          // 循环动画：回到第一帧
          this.frameIndex = 0;
        } else {
          // 一次性动画：停在最后一帧，停止播放
          this.playing = false;
          break;
        }
      }
      this.dirty = true; // 帧切换，标记需要重新渲染
    }
  }

  /**
   * 绘制当前帧
   * @param {number} x - 目标绘制位置 X（Canvas 坐标）
   * @param {number} y - 目标绘制位置 Y（Canvas 坐标）
   * @param {boolean} flipX - 是否水平翻转（默认 false）
   */
  render(x, y, flipX = false) {
    if (!this.loaded || !this.spritesheet) return;

    const ctx = this.ctx;

    // 确保像素渲染锐利
    ctx.imageSmoothingEnabled = false;

    // 计算精灵图中的裁剪起始 X
    const frameCol = this.config.frames[this.frameIndex];
    const sx = frameCol * FRAME_WIDTH;
    const sy = 0;

    ctx.save();

    if (flipX) {
      // 水平翻转：先平移至翻转后的原点，再镜像缩放
      ctx.translate(x + FRAME_WIDTH, y);
      ctx.scale(-1, 1);
      ctx.drawImage(
        this.spritesheet,
        sx, sy, FRAME_WIDTH, FRAME_HEIGHT,
        0, 0, FRAME_WIDTH, FRAME_HEIGHT,
      );
    } else {
      ctx.drawImage(
        this.spritesheet,
        sx, sy, FRAME_WIDTH, FRAME_HEIGHT,
        x, y, FRAME_WIDTH, FRAME_HEIGHT,
      );
    }

    ctx.restore();

    // 渲染完成，重置脏标记
    this.dirty = false;
  }

  /**
   * 获取当前帧索引（在 ANIMS 帧数组中的位置）
   * @returns {number}
   */
  get currentFrame() {
    return this.frameIndex;
  }

  /**
   * 动画是否正在播放
   * @returns {boolean}
   */
  get isPlaying() {
    return this.playing;
  }
}
