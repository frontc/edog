/**
 * generate-placeholder.js
 * 生成像素边牧占位精灵图（spritesheet）
 *
 * 画布：1600×200px（8帧 × 200px/帧）
 * 每帧：200×200px
 *
 * 依赖：sharp（纯 JS，无系统库依赖）
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 帧定义：序号(1-based), 动画名, 帧号(0-based), 颜色
const FRAMES = [
  { index: 1, anim: 'idle',  frame: 0, color: '#4A90D9', label: 'idle(0)'  },  // 蓝色
  { index: 2, anim: 'idle',  frame: 1, color: '#4A90D9', label: 'idle(1)'  },  // 蓝色
  { index: 3, anim: 'walk',  frame: 2, color: '#2ECC71', label: 'walk(2)'  },  // 绿色
  { index: 4, anim: 'walk',  frame: 3, color: '#2ECC71', label: 'walk(3)'  },  // 绿色
  { index: 5, anim: 'pounce', frame: 4, color: '#E74C3C', label: 'pounce(4)' }, // 红色
  { index: 6, anim: 'lifted', frame: 5, color: '#F1C40F', label: 'lifted(5)' }, // 黄色
  { index: 7, anim: 'pet',   frame: 6, color: '#FF69B4', label: 'pet(6)'   },  // 粉色
  { index: 8, anim: 'poke',  frame: 7, color: '#9B59B6', label: 'poke(7)'  },  // 紫色
];

const FRAME_W = 200;
const FRAME_H = 200;
const SHEET_W = FRAME_W * FRAMES.length; // 1600
const SHEET_H = FRAME_H;                 // 200

/**
 * 生成单帧的 SVG 字符串
 */
function frameSvg(frame) {
  const x = (frame.index - 1) * FRAME_W;
  const cx = x + FRAME_W / 2;   // 水平中心
  const cy = FRAME_H / 2;       // 垂直中心

  // 文字颜色：黄色和亮色用黑色，其余用白色
  const textColor = (frame.color === '#F1C40F' || frame.color === '#FF69B4') ? '#222' : '#FFF';

  return `
    <rect x="${x}" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="${frame.color}" stroke="#333" stroke-width="2"/>
    <text x="${cx}" y="${cy - 10}" font-family="Arial,sans-serif" font-size="36" font-weight="bold"
          fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${frame.label}</text>
    <text x="${cx}" y="${cy + 40}" font-family="Arial,sans-serif" font-size="28"
          fill="${textColor}" text-anchor="middle" dominant-baseline="middle">#${frame.index}</text>
  `;
}

async function main() {
  // 构建完整 SVG
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}">
    ${FRAMES.map(f => frameSvg(f)).join('\n    ')}
  </svg>`;

  // 输出目录
  const assetsDir = path.resolve(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const outputPath = path.join(assetsDir, 'spritesheet.png');

  // 用 sharp 渲染 SVG → PNG
  await sharp(Buffer.from(svgContent))
    .png()
    .toFile(outputPath);

  // 验证输出
  const meta = await sharp(outputPath).metadata();
  console.log(`✅ 精灵图已生成: ${outputPath}`);
  console.log(`   尺寸: ${meta.width} × ${meta.height}`);
  console.log(`   格式: ${meta.format}`);
  console.log(`   帧数: ${FRAMES.length} 帧`);
  console.log(`   每帧: ${FRAME_W} × ${FRAME_H}px`);

  // 验证尺寸
  if (meta.width === SHEET_W && meta.height === SHEET_H && meta.format === 'png') {
    console.log(`\n✅ 验证通过：尺寸和格式均正确`);
    process.exit(0);
  } else {
    console.error(`\n❌ 验证失败：期望 ${SHEET_W}×${SHEET_H} PNG，实际 ${meta.width}×${meta.height} ${meta.format}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
