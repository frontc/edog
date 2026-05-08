/**
 * BehaviorManager.js
 * 宠物行为管理器
 * 职责：管理宠物的自动散步、扑击等自发行为
 * 依赖：Pet 实例（通过其 _fsm 状态机和 direction 控制行为）
 *
 * 核心设计原则：
 * 散步不是改变宠物在 Canvas 中的 x/y 坐标，而是通过 IPC 移动整个 Electron 窗口。
 * 宠物在 Canvas 中永远位于 (0, 0) 居中位置，只在渲染 sprite 动画时通过 direction/flipX 控制朝向。
 */
import { STATES } from './const.js';

export class BehaviorManager {
  /**
   * @param {import('./Pet.js').Pet} pet - 宠物实体实例
   */
  constructor(pet) {
    this._pet = pet;

    // ---- 散步状态 ----
    this._walkActive = false;        // 散步是否激活
    this._walkTargetX = 0;           // 目标 X（屏幕绝对坐标）
    this._walkTargetY = 0;           // 目标 Y（屏幕绝对坐标）
    this._walkSpeed = 0;             // 散步速度（px/s）
    this._windowX = 0;               // 当前窗口 X（本地跟踪，避免频繁 IPC 查询）
    this._windowY = 0;               // 当前窗口 Y（本地跟踪）
    this._walkDirection = 0;         // 移动方向：1=右，-1=左

    // ---- 扑击状态 ----
    this._pounceScheduled = false;   // 本次散步是否安排了扑击
    this._pounceTimer = 0;           // 扑击倒计时
    this._pounceDelay = 0;           // 散步开始后多少秒触发扑击
    this._pouncePendingResume = false; // 扑击结束后是否需要恢复散步

    // ---- 调度定时器 ----
    this._walkTimer = null;          // setTimeout 句柄

    // ---- 多屏幕缓存 ----
    this._screens = null;            // 所有屏幕信息数组，由 _initScreens() 填充

    // ---- 空闲微动作（预留，步骤 6.1 实现） ----
    this._idleTimer = 0;

    // 异步初始化屏幕信息
    this._initScreens();

    // 首次调度散步
    this._scheduleNextWalk();

    // 监听状态变化（用于扑击结束后恢复散步）
    this._boundOnStateChange = this._onStateChange.bind(this);
    this._pet._fsm.on('stateChange', this._boundOnStateChange);
  }

  // ========== 公开方法 ==========

  /**
   * 暂停散步调度
   * 清除当前定时器，暂不重新调度
   * 用于提醒期间暂停宠物自动行为
   */
  pause() {
    console.log('[BehaviorManager] pause: 暂停散步调度');
    this._cancelScheduledWalk();
    // 如果正在散步，也取消当前散步
    if (this._walkActive) {
      this._cancelWalk('pause');
    }
  }

  /**
   * 恢复散步调度
   * 重新 scheduleNextWalk
   * 提醒结束后恢复宠物自动行为
   */
  resume() {
    console.log('[BehaviorManager] resume: 恢复散步调度');
    // 如果当前是 IDLE 状态，直接调度下一次散步
    if (this._pet._fsm.currentState === STATES.IDLE) {
      this._scheduleNextWalk();
    }
    // 非 IDLE 状态（如 LIFTED/PETTED）不需要立即调度，
    // 等到状态切回 IDLE 时自然会触发调度
  }


  /**
   * 每帧更新
   * 在游戏主循环中调用
   * @param {number} dt - 距上一帧的时间间隔（秒）
   */
  update(dt) {
    if (this._walkActive) {
      this._updateWalk(dt);
    }
  }

  /**
   * 重置调度（取消当前散步计划）
   */
  reset() {
    this._cancelWalk('reset');
  }

  /**
   * 销毁：清理定时器和事件监听
   */
  destroy() {
    this._cancelScheduledWalk();
    this._walkActive = false;
    this._walkDirection = 0;
    this._pouncePendingResume = false;
    this._pounceScheduled = false;
    if (this._boundOnStateChange) {
      this._pet._fsm.off('stateChange', this._boundOnStateChange);
      this._boundOnStateChange = null;
    }
  }

  // ========== 内部方法：调度 ==========

  /**
   * 初始化所有屏幕信息
   * 异步查询所有显示器的 bounds 和 workArea，缓存到本地
   * 若获取失败，回退到主屏幕 single-screen 模式
   */
  async _initScreens() {
    try {
      if (window.electronAPI && window.electronAPI.getAllScreens) {
        this._screens = await window.electronAPI.getAllScreens();
      } else {
        // 降级：使用 getScreenSize 模拟单屏幕
        const size = await window.electronAPI.getScreenSize();
        this._screens = [{
          x: 0, y: 0, width: size.width, height: size.height,
          workArea: { x: 0, y: 0, width: size.width, height: size.height }
        }];
      }
      console.log(`[BehaviorManager] 屏幕数量: ${this._screens.length}`);
    } catch (e) {
      console.warn('[BehaviorManager] 获取屏幕信息失败:', e.message);
      // 回退默认值（1920×1080）
      this._screens = [{
        x: 0, y: 0, width: 1920, height: 1080,
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      }];
    }
  }

  /**
   * 调度下一次散步
   * 使用随机延迟 30-120 秒
   */
  _scheduleNextWalk() {
    this._cancelScheduledWalk();
    const delay = 30000 + Math.random() * 90000; // 30,000ms ~ 120,000ms
    console.log(`[BehaviorManager] ${(delay / 1000).toFixed(1)}s 后调度散步`);
    this._walkTimer = setTimeout(() => {
      this._startWalk();
    }, delay);
  }

  /**
   * 取消已调度的散步任务
   */
  _cancelScheduledWalk() {
    if (this._walkTimer !== null) {
      clearTimeout(this._walkTimer);
      this._walkTimer = null;
    }
  }

  // ========== 内部方法：散步 ==========

  /**
   * 开始散步
   * 校验：仅在 IDLE 状态下触发；获取当前窗口位置；生成随机目标和速度
   */
  async _startWalk() {
    // 只在 IDLE 状态触发
    if (this._pet._fsm.currentState !== STATES.IDLE) {
      console.log('[BehaviorManager] 当前非 IDLE 状态，跳过散步');
      this._scheduleNextWalk();
      return;
    }

    // 获取当前窗口位置
    try {
      const pos = await window.electronAPI.getWindowPosition();
      this._windowX = pos.x;
      this._windowY = pos.y;
    } catch (e) {
      console.warn('[BehaviorManager] 获取窗口位置失败:', e.message);
      this._scheduleNextWalk();
      return;
    }

    // 边界检测：若窗口当前位置超出所有屏幕可见区域，回弹到主屏幕右下角
    if (this._screens && this._screens.length > 0) {
      const isOutOfBounds = !this._screens.some(s =>
        this._windowX >= s.workArea.x &&
        this._windowX < s.workArea.x + s.workArea.width - 200 &&
        this._windowY >= s.workArea.y &&
        this._windowY < s.workArea.y + s.workArea.height - 200
      );
      if (isOutOfBounds) {
        // 回弹到主屏幕（第一个屏幕）右下角
        const primaryScreen = this._screens[0];
        this._windowX = primaryScreen.workArea.x + primaryScreen.workArea.width - 200;
        this._windowY = primaryScreen.workArea.y + primaryScreen.workArea.height - 200;
        window.electronAPI.moveWindowTo(this._windowX, this._windowY);
        console.log('[BehaviorManager] 窗口越界，回弹到主屏幕右下角');
      }
    }

    // 生成随机目标（距屏幕边缘至少 100px）
    const target = await this._getRandomTarget();
    this._walkTargetX = target.x;
    this._walkTargetY = target.y;
    this._walkSpeed = 30 + Math.random() * 30; // 30 ~ 60 px/s

    // 计算初始移动方向
    this._walkDirection = this._walkTargetX > this._windowX ? 1 : -1;
    this._pet.direction = this._walkDirection === 1 ? 'right' : 'left';

    // 决定本次散步是否触发扑击（20% 概率）
    this._pounceScheduled = Math.random() < 0.2;
    this._pounceTimer = 0;
    this._pounceDelay = 2 + Math.random() * 3; // 散步开始后 2~5 秒触发

    // 激活散步
    this._walkActive = true;
    this._pet.setState(STATES.WALKING);

    console.log(
      `[BehaviorManager] 开始散步: ` +
      `目标(${Math.round(target.x)}, ${Math.round(target.y)}), ` +
      `速度=${this._walkSpeed.toFixed(1)}px/s, ` +
      `扑击=${this._pounceScheduled ? '是' : '否'}`
    );
  }

  /**
   * 生成随机目标位置（跨屏幕）
   * 从所有屏幕中随机选择一个屏幕，再从该屏幕的 workArea 中随机生成目标（距边缘 100px）
   * 确保窗口不会移出可视区域
   * @returns {{ x: number, y: number }}
   */
  async _getRandomTarget() {
    let screens = this._screens;
    if (!screens || screens.length === 0) {
      try {
        screens = await window.electronAPI.getAllScreens();
        this._screens = screens;
      } catch (e) {
        console.warn('[BehaviorManager] 获取屏幕列表失败，回退单屏幕:', e.message);
        screens = [{
          x: 0, y: 0, width: 1920, height: 1080,
          workArea: { x: 0, y: 0, width: 1920, height: 1080 }
        }];
      }
    }
    // 随机选择一个屏幕
    const screen = screens[Math.floor(Math.random() * screens.length)];
    const wa = screen.workArea;
    const margin = 100;
    const minX = wa.x + margin;
    const minY = wa.y + margin;
    const maxX = Math.max(minX + 100, wa.x + wa.width - margin);
    const maxY = Math.max(minY + 100, wa.y + wa.height - margin);

    return {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
  }

  // ========== 内部方法：散步执行 ==========

  /**
   * 每帧散步逻辑
   * 1. 检查散步是否被外部打断（状态被交互改变）
   * 2. 如果处于 POUNCING 状态（扑击中），跳过步行逻辑
   * 3. 执行插值移动 + 方向更新 + 窗口定位
   * 4. 尝试触发扑击
   * @param {number} dt
   */
  _updateWalk(dt) {
    const currentState = this._pet._fsm.currentState;

    // 如果当前状态既不是 WALKING 也不是 POUNCING，说明散步被交互打断
    if (currentState !== STATES.WALKING && currentState !== STATES.POUNCING) {
      this._cancelWalk(`状态变为 ${currentState}`);
      return;
    }

    // 扑击进行中，跳过步行逻辑（保持窗口不动，播放动画）
    if (currentState === STATES.POUNCING) {
      return;
    }

    // 执行步行步骤
    this._performWalkStep(dt);
  }

  /**
   * 执行单帧步行步骤
   * 速度插值 + 方向判断 + 窗口移动 + 扑击检查
   * @param {number} dt
   */
  _performWalkStep(dt) {
    // 计算到目标的方向向量
    const dx = this._walkTargetX - this._windowX;
    const dy = this._walkTargetY - this._windowY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 到达目标判定（距离 < 5px 认为已到达）
    if (dist < 5) {
      this._onWalkComplete();
      return;
    }

    // 本帧理论移动距离
    const step = this._walkSpeed * dt;

    // 如果一步就能到达或超过目标，直接定位到目标点
    if (step >= dist) {
      this._windowX = this._walkTargetX;
      this._windowY = this._walkTargetY;
    } else {
      // 按比例插值移动
      const ratio = step / dist;
      this._windowX += dx * ratio;
      this._windowY += dy * ratio;
    }

    // 根据实际剩余方向更新宠物朝向
    if (dx < -1 && this._walkDirection !== -1) {
      this._walkDirection = -1;
      this._pet.direction = 'left';
    } else if (dx > 1 && this._walkDirection !== 1) {
      this._walkDirection = 1;
      this._pet.direction = 'right';
    }

    // 移动窗口到新位置
    window.electronAPI.moveWindowTo(this._windowX, this._windowY);

    // 检查是否触发扑击
    if (this._pounceScheduled) {
      this._pounceTimer += dt;
      if (this._pounceTimer >= this._pounceDelay) {
        this._performPounce();
        this._pounceScheduled = false;
      }
    }
  }

  // ========== 内部方法：扑击 ==========

  /**
   * 执行扑击
   * 1. 记录需要恢复散步的标记
   * 2. 向前移动窗口 30px（散步方向的 x 方向）
   * 3. 切换到 POUNCING 状态（播放扑击动画）
   * PetStateMachine 会自动在动画结束后切回 IDLE，
   * BehaviorManager 监听 stateChange 事件恢复散步
   */
  _performPounce() {
    // 计算扑击前进偏移（沿散步方向 +30px）
    const pounceDelta = this._walkDirection === 1 ? 30 : -30;

    // 标记扑击结束后需要恢复散步
    this._pouncePendingResume = true;

    // 向前移动窗口 30px
    this._windowX += pounceDelta;
    window.electronAPI.moveWindowTo(this._windowX, this._windowY);

    // 切换到 POUNCING 状态（播放扑击动画）
    this._pet.setState(STATES.POUNCING);

    console.log(
      `[BehaviorManager] 扑击! ` +
      `方向=${this._walkDirection === 1 ? '右' : '左'}, ` +
      `新位置=(${Math.round(this._windowX)}, ${Math.round(this._windowY)})`
    );
  }

  // ========== 内部方法：状态变更回调 ==========

  /**
   * 监听状态变化
   * 主要用于捕获 POUNCING → IDLE 转换，恢复被中断的散步
   * @param {{ from: string|null, to: string }} event
   */
  _onStateChange({ from, to }) {
    // POUNCING 动画结束后自动回到 IDLE，此时恢复散步
    if (from === STATES.POUNCING && to === STATES.IDLE) {
      if (this._pouncePendingResume && this._walkActive) {
        this._pouncePendingResume = false;
        // 恢复散步状态
        this._pet.setState(STATES.WALKING);
        console.log('[BehaviorManager] 扑击结束，恢复散步');
      }
    }
  }

  // ========== 内部方法：完成/取消 ==========

  /**
   * 散步完成：回到 IDLE 状态，调度下一次散步
   */
  _onWalkComplete() {
    console.log('[BehaviorManager] 散步完成');
    this._walkActive = false;
    this._walkDirection = 0;
    this._pounceScheduled = false;
    this._pouncePendingResume = false;

    // 仅在当前仍是 WALKING 状态时切回 IDLE
    if (this._pet._fsm.currentState === STATES.WALKING) {
      this._pet.setState(STATES.IDLE);
    }

    // 调度下一次散步
    this._scheduleNextWalk();
  }

  /**
   * 取消散步（被打断时调用）
   * @param {string} reason - 取消原因（用于日志）
   */
  _cancelWalk(reason) {
    if (!this._walkActive) return;

    console.log(`[BehaviorManager] 散步取消: ${reason}`);
    this._walkActive = false;
    this._walkDirection = 0;
    this._pounceScheduled = false;
    this._pouncePendingResume = false;

    // 调度下一次散步
    this._scheduleNextWalk();
  }
}
