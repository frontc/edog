/**
 * Pet.js
 * 宠物实体类 — 整合层
 * 职责：封装 SpriteAnimator + PetStateMachine，提供统一的高层 API
 * 外观模式：对外隐藏动画引擎和状态机的内部实现细节
 */

import { SpriteAnimator } from './SpriteAnimator.js';
import { PetStateMachine } from './PetStateMachine.js';
import { STATES } from './const.js';

export class Pet {
  /**
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 渲染上下文
   */
  constructor(ctx) {
    this.ctx = ctx;

    // 位置与尺寸
    this.x = 0;
    this.y = 0;
    this.width = 200;
    this.height = 200;

    // 朝向：'right' | 'left'，影响渲染水平翻转
    this.direction = 'right';

    // 内部组件
    this._animator = new SpriteAnimator(ctx);
    this._fsm = new PetStateMachine(this._animator);
  }

  /**
   * 异步初始化：加载精灵图，进入默认待机状态
   * @param {string} spritesheetPath - 精灵图路径
   */
  async init(spritesheetPath) {
    await this._animator.loadSpritesheet(spritesheetPath);
    this._fsm.transition(STATES.IDLE);
  }

  /**
   * 每帧更新
   * 先更新状态机（可能触发自动状态切换），再更新动画帧
   * @param {number} dt - 距上一帧的时间间隔（秒）
   */
  update(dt) {
    this._fsm.update(dt);
    this._animator.update(dt);
  }

  /**
   * 绘制当前帧
   * 根据 direction 决定是否水平翻转
   */
  render() {
    const flipX = (this.direction === 'left');
    this._animator.render(this.x, this.y, flipX);
  }

  /**
   * 切换宠物状态
   * @param {string} stateName - 目标状态（STATES 中的枚举值）
   */
  setState(stateName) {
    this._fsm.transition(stateName);
  }

  /**
   * 移动宠物到指定坐标
   * @param {number} x - 目标 X 坐标
   * @param {number} y - 目标 Y 坐标
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * 碰撞检测
   * 将鼠标/触摸坐标转换为相对宠物左上角的偏移，判断命中区域
   * 检测顺序：belly 优先于 body（因为 belly 是 body 的子区域）
   *
   * 区域划分（200×200 画布内）：
   *   头部 (head):   X 60-140, Y 0-80
   *   身体 (body):   X 40-160, Y 80-160
   *   肚皮 (belly):  X 60-140, Y 120-160
   *
   * @param {number} mx - 鼠标/触摸 X 坐标（Canvas 坐标系）
   * @param {number} my - 鼠标/触摸 Y 坐标（Canvas 坐标系）
   * @returns {string|null} 'head' | 'body' | 'belly' | null
   */
  hitTest(mx, my) {
    // 转换为相对宠物左上角的坐标
    const relX = mx - this.x;
    const relY = my - this.y;

    // 超出宠物边界
    if (relX < 0 || relX > this.width || relY < 0 || relY > this.height) {
      return null;
    }

    // 肚皮（优先级最高，和身体重叠，先检测）
    if (relX >= 60 && relX <= 140 && relY >= 120 && relY <= 160) {
      return 'belly';
    }

    // 头部
    if (relX >= 60 && relX <= 140 && relY >= 0 && relY <= 80) {
      return 'head';
    }

    // 身体
    if (relX >= 40 && relX <= 160 && relY >= 80 && relY <= 160) {
      return 'body';
    }

    return null;
  }
}
