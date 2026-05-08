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
    this._spritesheet = null;      // Image 对象
    this._loaded = false;          // 精灵图是否加载完成
    this._fallbackMode = false;    // 是否使用后备剪影模式

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
   * 获取 _spritesheet（兼容 Pet.js 中 pet._animator.spritesheet 的引用）
   * @returns {Image|null}
   */
  get spritesheet() {
    return this._spritesheet;
  }

  /**
   * 获取 _loaded（兼容外部引用）
   * @returns {boolean}
   */
  get loaded() {
    return this._loaded;
  }

  /**
   * 加载精灵图
   * @param {string} path - 精灵图路径
   * @returns {Promise<Image|null>} 加载成功返回 Image，失败返回 null
   */
  loadSpritesheet(path) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this._spritesheet = img;
        this._loaded = true;
        this._fallbackMode = false;
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`[SpriteAnimator] 精灵图加载失败: ${path}，使用后备剪影`);
        this._spritesheet = null;
        this._loaded = false;
        this._fallbackMode = true;
        resolve(null); // 不 reject，使用后备模式
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
    if (!this._loaded && !this._fallbackMode) return;
    if (!this.playing) return;

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
    const ctx = this.ctx;

    // 确保像素渲染锐利
    ctx.imageSmoothingEnabled = false;

    ctx.save();

    if (flipX) {
      // 水平翻转：先平移至翻转后的原点，再镜像缩放
      ctx.translate(x + FRAME_WIDTH, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }

    if (this._fallbackMode) {
      this._drawFallbackSilhouette(ctx, x, y);
    } else if (this._spritesheet && this._loaded) {
      // 计算精灵图中的裁剪起始 X
      const frameCol = this.config.frames[this.frameIndex];
      const sx = frameCol * FRAME_WIDTH;
      const sy = 0;

      ctx.drawImage(
        this._spritesheet,
        sx, sy, FRAME_WIDTH, FRAME_HEIGHT,
        x, y, FRAME_WIDTH, FRAME_HEIGHT,
      );
    }

    ctx.restore();

    // 渲染完成，重置脏标记
    this.dirty = false;
  }

  /**
   * 绘制后备剪影 — 用几何图形画一个简单的边牧轮廓
   * 在 spritesheet 加载失败时使用
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - 绘制起点 X
   * @param {number} y - 绘制起点 Y
   */
  _drawFallbackSilhouette(ctx, x, y) {
    const cx = x + 100; // 中心 X（200×200 Canvas 居中）
    const cy = y + 110; // 中心 Y（偏下）

    ctx.imageSmoothingEnabled = false;

    // ---- 身体：深灰色椭圆矩形 ----
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 5, 40, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- 头：略小椭圆，偏左上 ----
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 65, 28, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- 耳朵：两个三角形在头顶 ----
    ctx.fillStyle = '#2d3748';
    // 左耳
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy - 78);
    ctx.lineTo(cx - 8, cy - 105);
    ctx.lineTo(cx - 2, cy - 78);
    ctx.closePath();
    ctx.fill();
    // 右耳
    ctx.beginPath();
    ctx.moveTo(cx + 20, cy - 78);
    ctx.lineTo(cx + 8, cy - 105);
    ctx.lineTo(cx + 2, cy - 78);
    ctx.closePath();
    ctx.fill();

    // ---- 腿：4 个矩形 ----
    ctx.fillStyle = '#3d4a5c';
    // 左前腿
    ctx.fillRect(cx - 30, cy + 35, 12, 35);
    // 右前腿
    ctx.fillRect(cx - 8, cy + 35, 12, 35);
    // 左后腿
    ctx.fillRect(cx + 8, cy + 35, 12, 35);
    // 右后腿
    ctx.fillRect(cx + 26, cy + 35, 12, 35);

    // ---- 尾巴：从身体后部延伸的竖条 ----
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.moveTo(cx + 42, cy - 35);
    ctx.lineTo(cx + 48, cy - 50);
    ctx.lineTo(cx + 44, cy - 52);
    ctx.lineTo(cx + 38, cy - 35);
    ctx.closePath();
    ctx.fill();

    // ---- 眼睛：两个小白点 ----
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 68, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 10, cy - 68, 4, 0, Math.PI * 2);
    ctx.fill();

    // ---- 鼻子：小黑点 ----
    ctx.fillStyle = '#1a202c';
    ctx.beginPath();
    ctx.arc(cx, cy - 60, 3, 0, Math.PI * 2);
    ctx.fill();
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
