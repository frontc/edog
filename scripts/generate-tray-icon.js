/**
 * generate-tray-icon.js
 * 生成 16×16 像素边牧托盘图标（PNG 格式）
 *
 * 设计：像素风狗头剪影
 * - 深灰色 #2d2d2d 为主色，白色 #ffffff 为辅助色
 * - Template 风格（黑色图标在 macOS 菜单栏中自动适配亮/暗模式）
 *
 * 依赖：sharp（与 generate-placeholder.js 同样的技术栈）
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZE = 16;

/**
 * 生成狗头 SVG
 * 16×16 像素，像素风设计：
 * - 中间宽椭圆代表脸
 * - 顶部两个小三角代表耳朵
 * - 小眼睛白点
 */
function generateSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 16 16">
    <!-- 左耳（三角形） -->
    <polygon points="2,5 5,2 5,6" fill="#2d2d2d"/>
    <!-- 右耳（三角形） -->
    <polygon points="11,2 14,5 11,6" fill="#2d2d2d"/>
    <!-- 脸（宽椭圆） -->
    <ellipse cx="8" cy="9" rx="5.5" ry="4.5" fill="#2d2d2d"/>
    <!-- 左眼（白点） -->
    <circle cx="6" cy="8" r="1" fill="#ffffff"/>
    <!-- 右眼（白点） -->
    <circle cx="10" cy="8" r="1" fill="#ffffff"/>
    <!-- 鼻子（小椭圆） -->
    <ellipse cx="8" cy="10" rx="1" ry="0.7" fill="#ffffff" opacity="0.7"/>
  </svg>`;
}

async function main() {
  const assetsDir = path.resolve(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const outputPath = path.join(assetsDir, 'tray-icon.png');

  const svgContent = generateSvg();

  // 用 sharp 渲染 SVG → PNG
  await sharp(Buffer.from(svgContent))
    .png()
    .toFile(outputPath);

  // 验证输出
  const meta = await sharp(outputPath).metadata();
  console.log(`✅ 托盘图标已生成: ${outputPath}`);
  console.log(`   尺寸: ${meta.width} × ${meta.height}`);
  console.log(`   格式: ${meta.format}`);

  if (meta.width === SIZE && meta.height === SIZE && meta.format === 'png') {
    console.log(`\n✅ 验证通过：尺寸和格式均正确`);
    process.exit(0);
  } else {
    console.error(`\n❌ 验证失败：期望 ${SIZE}×${SIZE} PNG，实际 ${meta.width}×${meta.height} ${meta.format}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
