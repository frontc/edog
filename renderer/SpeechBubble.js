/**
 * SpeechBubble.js
 * 对话气泡类
 * 职责：在宠物头顶绘制像素风对话气泡，支持弹性缩放动画和文字自动换行
 *
 * 气泡位置：宠物头顶上方
 *   x = pet.x + 100 - bubbleWidth / 2
 *   y = pet.y - bubbleHeight - 15
 *
 * 气泡宽 160px，高度根据文字自动换行计算
 */
export class SpeechBubble {
  constructor(ctx) {
    this.ctx = ctx;

    // ---- 气泡尺寸 ----
    this._bubbleWidth = 160;          // 固定宽度
    this._bubbleHeight = 0;           // 根据文字动态计算

    // ---- 内边距 ----
    this._paddingX = 12;
    this._paddingY = 8;

    // ---- 字体 ----
    this._font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    // ---- 文字 ----
    this._text = '';
    this._textLines = [];             // 自动换行后的行数组

    // ---- 可见状态 ----
    this._visible = false;

    // ---- 弹性缩放动画 ----
    this._scale = 0;                  // 当前缩放值
    this._targetScale = 0;            // 目标缩放（0=隐藏，1=完全显示）
    this._animating = false;          // 是否正在播放动画

    // ---- 显示时长计时 ----
    this._durationTimer = 0;          // 已显示时间（ms）
    this._duration = 0;               // 总显示时长（ms）
    this._callbackOnHide = null;      // 隐藏后的回调

    // ---- 三角形指示器参数 ----
    this._triangleWidth = 14;
    this._triangleHeight = 10;
  }

  /**
   * 显示气泡
   * @param {string} text - 要显示的文字
   * @param {number} [duration=10000] - 显示时长（ms），默认 10 秒
   * @param {Function} [onHide] - 气泡隐藏后的回调
   */
  show(text, duration = 10000, onHide = null) {
    this._text = text;
    this._duration = duration;
    this._durationTimer = 0;
    this._callbackOnHide = onHide;

    // 计算文字换行和气泡高度
    this._wrapText();

    // 启动弹性缩放动画（从 0 → 1）
    this._visible = true;
    this._targetScale = 1;
    this._animating = true;
  }

  /**
   * 立即隐藏气泡
   */
  hide() {
    if (!this._visible && this._scale === 0) return;

    // 反向弹性缩放（从当前 → 0）
    this._targetScale = 0;
    this._animating = true;
  }

  /**
   * 每帧更新
   * @param {number} dt - 距上一帧的时间间隔（秒）
   */
  update(dt) {
    // ---- 弹性缩放动画 ----
    if (this._animating) {
      this._updateScaleAnimation(dt);
    }

    // ---- 显示时长倒计时 ----
    if (this._visible && this._scale >= 0.99 && !this._animating) {
      this._durationTimer += dt * 1000;
      if (this._durationTimer >= this._duration) {
        // 倒计时结束，自动隐藏
        this.hide();
      }
    }
  }

  /**
   * 在宠物头顶绘制气泡
   * @param {number} petX - 宠物 X 坐标
   * @param {number} petY - 宠物 Y 坐标
   */
  render(petX, petY) {
    if (!this._visible && this._scale === 0) return;

    const ctx = this.ctx;
    const bw = this._bubbleWidth;
    const bh = this._bubbleHeight + this._triangleHeight;

    // 气泡位置（相对于宠物）
    const bx = petX + 100 - bw / 2;
    const by = petY - bh - 15;

    ctx.save();

    // ---- 弹性缩放变换 ----
    const cx = bx + bw / 2;
    const cy = by + (bh - this._triangleHeight) / 2;
    ctx.translate(cx, cy);
    ctx.scale(this._scale, this._scale);
    ctx.translate(-cx, -cy);

    // ---- 绘制圆角矩形 ----
    const rectW = bw;
    const rectH = this._bubbleHeight;
    const radius = 8;

    ctx.beginPath();
    ctx.moveTo(bx + radius, by);
    ctx.lineTo(bx + rectW - radius, by);
    ctx.quadraticCurveTo(bx + rectW, by, bx + rectW, by + radius);
    ctx.lineTo(bx + rectW, by + rectH - radius);
    ctx.quadraticCurveTo(bx + rectW, by + rectH, bx + rectW - radius, by + rectH);
    ctx.lineTo(bx + (rectW + this._triangleWidth) / 2, by + rectH);
    ctx.lineTo(bx + rectW / 2, by + rectH + this._triangleHeight);
    ctx.lineTo(bx + (rectW - this._triangleWidth) / 2, by + rectH);
    ctx.lineTo(bx + radius, by + rectH);
    ctx.quadraticCurveTo(bx, by + rectH, bx, by + rectH - radius);
    ctx.lineTo(bx, by + radius);
    ctx.quadraticCurveTo(bx, by, bx + radius, by);
    ctx.closePath();

    // 填充白色
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 黑色 2px 边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- 绘制文字 ----
    if (this._textLines.length > 0) {
      ctx.font = this._font;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const textX = bx + this._paddingX;
      const lineHeight = 18;
      this._textLines.forEach((line, i) => {
        ctx.fillText(line, textX, by + this._paddingY + i * lineHeight);
      });
    }

    ctx.restore();
  }

  /**
   * 获取当前是否正在显示
   * @returns {boolean}
   */
  get isVisible() {
    return this._visible;
  }

  // ========== 内部方法 ==========

  /**
   * 更新弹性缩放动画
   * 动画曲线：0.8 → 1.05 → 1.0（弹性过渡效果）
   * @param {number} dt
   */
  _updateScaleAnimation(dt) {
    if (this._targetScale === 0) {
      // 隐藏动画：快速缩到 0
      this._scale -= dt * 4;
      if (this._scale <= 0) {
        this._scale = 0;
        this._animating = false;
        this._visible = false;
        this._text = '';
        this._textLines = [];
        this._durationTimer = 0;
        if (this._callbackOnHide) {
          this._callbackOnHide();
          this._callbackOnHide = null;
        }
      }
      return;
    }

    if (this._targetScale === 1) {
      // 显示动画：三段式弹性缩放
      if (this._scale < 0.8) {
        // 第一阶段：0 → 0.8（快速）
        this._scale += dt * 4;
        if (this._scale > 0.8) this._scale = 0.8;
      } else if (this._scale < 1.05) {
        // 第二阶段：0.8 → 1.05（减速）
        this._scale += dt * 1.5;
        if (this._scale > 1.05) this._scale = 1.05;
      } else if (this._scale > 1.0) {
        // 第三阶段：1.05 → 1.0（回弹稳定）
        this._scale += dt * -0.5;
        if (this._scale < 1.0) {
          this._scale = 1.0;
          this._animating = false;
        }
      }
    }
  }

  /**
   * 根据文字内容自动换行并计算气泡高度
   */
  _wrapText() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = this._font;

    const maxTextWidth = this._bubbleWidth - this._paddingX * 2;
    const words = this._text.split('');
    let currentLine = '';
    this._textLines = [];

    for (let i = 0; i < this._text.length; i++) {
      const char = this._text[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxTextWidth && currentLine !== '') {
        this._textLines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      this._textLines.push(currentLine);
    }

    ctx.restore();

    // 计算气泡高度
    const lineHeight = 18;
    const textHeight = this._textLines.length * lineHeight;
    this._bubbleHeight = Math.max(textHeight + this._paddingY * 2, 30);
  }
}
