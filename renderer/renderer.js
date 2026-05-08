/**
 * renderer.js
 * 渲染进程入口文件
 * 负责 Canvas 初始化和渲染循环
 */

// 获取 Canvas 元素和 2D 上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 禁用图像平滑，确保像素渲染锐利
ctx.imageSmoothingEnabled = false;

// 绘制测试图形：一个彩色方块，验证渲染链是否正常
ctx.fillStyle = '#4A90D9';
ctx.fillRect(0, 0, 200, 200);

// 绘制一个像素风格的"边牧"文字
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 24px "Courier New", monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('边牧', 100, 80);

// 绘制一个小像素装饰方块（模拟狗的眼睛）
ctx.fillStyle = '#333333';
ctx.fillRect(70, 110, 16, 16);
ctx.fillRect(114, 110, 16, 16);

// 绘制鼻子
ctx.fillStyle = '#FF6B6B';
ctx.fillRect(94, 130, 12, 8);

// 绘制嘴巴
ctx.fillStyle = '#FFFFFF';
ctx.fillRect(82, 142, 8, 4);
ctx.fillRect(110, 142, 8, 4);

console.log('[渲染进程] Canvas 初始化完成，测试图形已绘制');
