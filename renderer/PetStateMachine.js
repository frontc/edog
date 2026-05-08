/**
 * PetStateMachine.js
 * 宠物有限状态机
 * 职责：管理宠物 6 种状态（IDLE/WALKING/POUNCING/LIFTED/PETTED/POKED）
 *       及状态转换规则，驱动 SpriteAnimator 播放对应动画
 * 单一职责原则 — 只做状态管理，不做动画播放或位置计算
 */

import { STATES } from './const.js';

// 状态转换规则表
// key = 当前状态，value = 允许转换到的状态集合
const TRANSITIONS = {
  [STATES.IDLE]:    new Set([STATES.WALKING, STATES.LIFTED, STATES.PETTED, STATES.POKED]),
  [STATES.WALKING]: new Set([STATES.IDLE, STATES.POUNCING, STATES.LIFTED, STATES.PETTED, STATES.POKED]),
  [STATES.POUNCING]: new Set([STATES.IDLE, STATES.LIFTED]),   // 自动转 idle，可被 LIFTED 打断
  [STATES.LIFTED]:  new Set([STATES.IDLE]),
  [STATES.PETTED]:  new Set([STATES.IDLE]),     // 自动转 idle
  [STATES.POKED]:   new Set([STATES.IDLE]),     // 自动转 idle
};

export class PetStateMachine {
  /**
   * @param {import('./SpriteAnimator.js').SpriteAnimator} animator - 精灵动画引擎实例
   */
  constructor(animator) {
    this.animator = animator;
    this._currentState = null;   // 当前状态枚举值
    this._petTimer = 0;          // PETTED 状态倒计时（秒）
    this._petDuration = 0.5;     // PETTED 状态持续时长

    // EventEmitter 私有存储
    this._events = {};

    // 状态定义：每个状态是一个对象，包含 enter/exit/update 方法
    this._states = {
      [STATES.IDLE]: {
        enter: () => {
          this.animator.play(STATES.IDLE);
        },
        exit: () => {
          // 无特殊清理
        },
        update: (_dt) => {
          // 呼吸动画由 animator 自动播放
        },
      },

      [STATES.WALKING]: {
        enter: () => {
          // 注意：ANIMS 中的 key 为 'walk'，而 STATES.WALKING 为 'walking'
          this.animator.play('walk');
        },
        exit: () => {
          // 无特殊清理
        },
        update: (_dt) => {
          // 行走由 BehaviorManager 驱动（后续步骤实现）
        },
      },

      [STATES.POUNCING]: {
        enter: () => {
          // 注意：ANIMS 中的 key 为 'pounce'，而 STATES.POUNCING 为 'pouncing'
          this.animator.play('pounce');
        },
        exit: () => {
          // 无特殊清理
        },
        update: (_dt) => {
          // 一次性动画播放完毕后自动回到 idle
          if (!this.animator.isPlaying) {
            this.transition(STATES.IDLE);
          }
        },
      },

      [STATES.LIFTED]: {
        enter: () => {
          this.animator.play(STATES.LIFTED); // 'lifted' 与 ANIMS key 一致
        },
        exit: () => {
          // 无特殊清理
        },
        update: (_dt) => {
          // 位置跟随由外部设置
        },
      },

      [STATES.PETTED]: {
        enter: () => {
          // 注意：ANIMS 中的 key 为 'pet'，而 STATES.PETTED 为 'petted'
          this.animator.play('pet');
          this._petTimer = this._petDuration; // 重置 0.5s 定时器
        },
        exit: () => {
          this._petTimer = 0; // 清除定时器
        },
        update: (dt) => {
          if (this._petTimer > 0) {
            this._petTimer -= dt;
            if (this._petTimer <= 0) {
              // 定时器到期，回到 idle
              this.transition(STATES.IDLE);
            }
          }
        },
      },

      [STATES.POKED]: {
        enter: () => {
          // 注意：ANIMS 中的 key 为 'poke'，而 STATES.POKED 为 'poked'
          this.animator.play('poke');
        },
        exit: () => {
          // 无特殊清理
        },
        update: (_dt) => {
          // 一次性动画播放完毕后自动回到 idle
          if (!this.animator.isPlaying) {
            this.transition(STATES.IDLE);
          }
        },
      },
    };
  }

  /**
   * 获取当前状态名
   * @returns {string|null}
   */
  get currentState() {
    return this._currentState;
  }

  /**
   * 状态切换
   * 先调用当前状态的 exit()，再调用新状态的 enter()
   * 自动发射 'stateChange' 事件
   * @param {string} newState - 目标状态（STATES 中的枚举值）
   */
  transition(newState) {
    // 任意状态 → IDLE 始终允许（安全回退）
    if (newState !== STATES.IDLE && this._currentState !== null) {
      const allowed = TRANSITIONS[this._currentState];
      if (!allowed || !allowed.has(newState)) {
        console.warn(
          `[PetStateMachine] 非法状态转换: ${this._currentState} → ${newState}，已忽略`
        );
        return;
      }
    }

    const from = this._currentState;
    const to = newState;

    // 如果当前状态存在，调用其 exit
    if (from !== null && this._states[from]) {
      this._states[from].exit();
    }

    // 切换到新状态
    this._currentState = to;

    // 调用新状态的 enter
    if (this._states[to]) {
      this._states[to].enter();
    }

    // 发射状态变更事件
    this.emit('stateChange', { from, to });
  }

  /**
   * 每帧更新当前状态
   * @param {number} dt - 距上一帧的时间间隔（秒）
   */
  update(dt) {
    if (this._currentState === null) return;

    const state = this._states[this._currentState];
    if (state) {
      state.update(dt);
    }
  }

  // ========== EventEmitter 实现 ==========

  /**
   * 注册事件监听器
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(callback);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名
   * @param {Function} callback - 要移除的回调函数
   */
  off(event, callback) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter(cb => cb !== callback);
  }

  /**
   * 触发事件
   * @param {string} event - 事件名
   * @param {*} data - 传递给回调的数据
   */
  emit(event, data) {
    if (!this._events[event]) return;
    this._events[event].forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[PetStateMachine] 事件回调异常 (${event}):`, err);
      }
    });
  }
}
