/**
 * SpeechBubble.js
 * 对话气泡类
 * 职责：在宠物头顶绘制像素风对话气泡，支持弹性缩放动画和文字自动换行
 *
 * 气泡位置：宠物头顶上方
 *   x = pet.x + 100 - bubbleWidth / 2
 *   y = pet.y - bubbleHeight - 15
 *
 * 气泡宽 160px，高度根据文字自动换行动态计算
 *
 * 动画状态机：ENTERING → BOUNCING → IDLE → EXITING → HIDDEN
 */
export class SpeechBubble {
  constructor(ctx) {
    this.ctx = ctx;

    // ---- 气泡尺寸 ----
    this._bubbleWidth = 160;          // 固定宽度

    // ---- 内边距 ----
    this._paddingTop = 12;
    this._paddingBottom = 12;
    this._paddingLeft = 10;
    this._paddingRight = 10;

    // ---- 字体 ----
    this._font = 'bold 11px "Courier New", monospace';
    this._lineHeight = 16;

    // ---- 三角形指示器 ----
    this._triangleWidth = 12;
    this._triangleHeight = 8;

    // ---- 文字 ----
    this._text = '';
    this._textLines = [];             // 自动换行后的行数组

    // ---- 可见状态 ----
    this._visible = false;

    // ---- 动画状态机 ----
    // 状态: 'HIDDEN' | 'ENTERING' | 'BOUNCING' | 'IDLE' | 'EXITING'
    this._animState = 'HIDDEN';
    this._scale = 0;                  // 当前缩放值

    // BOUNCING 内部的子阶段
    this._bouncePhase = 'overshoot';  // 'overshoot' | 'bounceback' | 'settle'

    // ---- 显示时长计时 ----
    this._durationTimer = 0;          // 已显示时间（ms）
    this._duration = 0;               // 总显示时长（ms）
    this._callbackOnHide = null;      // 隐藏后的回调
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

    // 计算文字换行
    this._wrapText();

    // 启动弹性缩放动画（从 0 → 弹跳 → 1）
    this._visible = true;
    this._animState = 'ENTERING';
    this._bouncePhase = 'overshoot';
    this._scale = 0;
  }

  /**
   * 立即隐藏气泡
   */
  hide() {
    if (!this._visible && this._scale === 0) return;
    this._animState = 'EXITING';
  }

  /**
   * 每帧更新
   * @param {number} dt - 距上一帧的时间间隔（秒）
   */
  update(dt) {
    switch (this._animState) {
      case 'ENTERING':
        // 0 → 0.8（快速弹出）
        this._scale += dt * 4;
        if (this._scale >= 0.8) {
          this._scale = 0.8;
          this._animState = 'BOUNCING';
          this._bouncePhase = 'overshoot';
        }
        break;

      case 'BOUNCING':
        this._updateBouncing(dt);
        break;

      case 'IDLE':
        // 稳定显示，倒计时
        this._durationTimer += dt * 1000;
        if (this._durationTimer >= this._duration) {
          this.hide();
        }
        break;

      case 'EXITING':
        // 缩小消失
        this._scale -= dt * 4;
        if (this._scale <= 0) {
          this._scale = 0;
          this._visible = false;
          this._animState = 'HIDDEN';
          this._text = '';
          this._textLines = [];
          this._durationTimer = 0;
          if (this._callbackOnHide) {
            this._callbackOnHide();
            this._callbackOnHide = null;
          }
        }
        break;
    }
  }

  /**
   * BOUNCING 状态内部的三阶段弹跳逻辑
   * overshoot: 0.8 → 1.05（过冲）
   * bounceback: 1.05 → 0.97（回弹）
   * settle: 0.97 → 1.0（稳定）
   */
  _updateBouncing(dt) {
    switch (this._bouncePhase) {
      case 'overshoot':
        this._scale += dt * 1.5;
        if (this._scale >= 1.05) {
          this._scale = 1.05;
          this._bouncePhase = 'bounceback';
        }
        break;

      case 'bounceback':
        this._scale -= dt * 2.5;
        if (this._scale <= 0.97) {
          this._scale = 0.97;
          this._bouncePhase = 'settle';
        }
        break;

      case 'settle':
        this._scale += dt * 3;
        if (this._scale >= 1.0) {
          this._scale = 1.0;
          this._animState = 'IDLE';
          this._bouncePhase = 'overshoot';
        }
        break;
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

    // ---- 动态计算气泡高度 ----
    const textHeight = this._textLines.length * this._lineHeight;
    const bubbleBodyHeight = this._paddingTop + textHeight + this._paddingBottom;
    const totalHeight = bubbleBodyHeight + this._triangleHeight;
    const bw = this._bubbleWidth;

    // ---- 气泡定位 ----
    // 气泡始终从 Canvas 顶部开始，与宠物头部区域重叠
    const bx = Math.floor(petX + 100 - bw / 2);
    const by = 0;

    ctx.save();

    // ---- 弹性缩放变换（以气泡矩形中心为原点） ----
    const cx = Math.floor(bx + bw / 2);
    const cy = Math.floor(by + bubbleBodyHeight / 2);
    ctx.translate(cx, cy);
    ctx.scale(this._scale, this._scale);
    ctx.translate(-cx, -cy);

    // 关闭抗锯齿以保持像素风格（对 drawImage 生效）
    ctx.imageSmoothingEnabled = false;

    // ---- 像素阴影（向右下各偏移 1px） ----
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx + 1, by + 1, bw, bubbleBodyHeight);

    // ---- 绘制气泡主体（白色矩形 + 2px 黑色边框） ----
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by, bw, bubbleBodyHeight);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bubbleBodyHeight);

    // ---- 绘制底部三角形指示器（指向下方） ----
    const triCenterX = Math.floor(bx + bw / 2);
    const triTop = by + bubbleBodyHeight;  // 与气泡底部无缝连接
    const triTip = triTop + this._triangleHeight;
    const triHalf = Math.floor(this._triangleWidth / 2);

    // 填充三角形（白色实心）
    ctx.beginPath();
    ctx.moveTo(triCenterX - triHalf, triTop);
    ctx.lineTo(triCenterX + triHalf, triTop);
    ctx.lineTo(triCenterX, triTip);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 描边三角形左边和右边（2px 黑色），顶部边不描边（与气泡主体连接）
    ctx.beginPath();
    ctx.moveTo(triCenterX - triHalf, triTop);
    ctx.lineTo(triCenterX, triTip);
    ctx.lineTo(triCenterX + triHalf, triTop);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- 绘制文字 ----
    if (this._textLines.length > 0) {
      ctx.font = this._font;
      ctx.fillStyle = '#1a1a2e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const textCenterX = Math.floor(bx + bw / 2);
      for (let i = 0; i < this._textLines.length; i++) {
        const line = this._textLines[i];
        const lineY = Math.floor(by + this._paddingTop + i * this._lineHeight);
        ctx.fillText(line, textCenterX, lineY);
      }
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
   * 根据文字内容自动换行并计算气泡高度
   * 逐字符测量宽度，超出可用宽度时换行
   */
  _wrapText() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = this._font;

    const maxTextWidth = this._bubbleWidth - this._paddingLeft - this._paddingRight;
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < this._text.length; i++) {
      const char = this._text[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxTextWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    ctx.restore();
    this._textLines = lines;
  }
}
