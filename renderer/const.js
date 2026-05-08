/**
 * const.js
 * 动画帧配置常量
 * 定义所有动画状态对应的帧索引、帧率和循环行为
 */

// 动画帧配置
export const ANIMS = {
  idle:    { frames: [0, 1], fps: 2, loop: true },
  walk:    { frames: [2, 3], fps: 4, loop: true },
  pounce:  { frames: [4],    fps: 4, loop: false },  // 一次性动画
  lifted:  { frames: [5],    fps: 1, loop: true },
  pet:     { frames: [6],    fps: 1, loop: true },
  poke:    { frames: [7],    fps: 1, loop: false },   // 一次性动画
};

// 每帧宽高（精灵图中每帧为 200×200）
export const FRAME_WIDTH = 200;
export const FRAME_HEIGHT = 200;

// 精灵图路径
export const SPRITESHEET_PATH = 'assets/spritesheet.png';

// 状态常量
export const STATES = {
  IDLE: 'idle',
  WALKING: 'walking',
  POUNCING: 'pouncing',
  LIFTED: 'lifted',
  PETTED: 'petted',
  POKED: 'poked',
};
