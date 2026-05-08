/**
 * generate-app-icon.js
 * 生成 512×512 像素风边牧应用图标 PNG，再通过 sips + iconutil 转换为 .icns
 *
 * 设计：像素风边牧正面大头照
 * - 深灰色 #2d2d2d 主色，白色 #ffffff 辅助色
 * - 圆角矩形头部轮廓、三角形耳朵、白色眼睛白点、黑色鼻子、微微张开的嘴
 *
 * 依赖：sharp（与 generate-tray-icon.js 同样的技术栈）
 * macOS 工具链：sips + iconutil
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const SIZE = 512;

/**
 * 生成狗头 SVG（512×512 像素风设计）
 *
 * 坐标系说明：viewBox="0 0 512 512"
 * - 头部轮廓：圆角矩形，居中
 * - 耳朵：两个三角形，头顶两侧
 * - 眼睛：白色圆底 + 黑色瞳孔
 * - 鼻子：黑色椭圆
 * - 嘴巴：微微张开的弧线
 */
function generateSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
    <defs>
      <!-- 像素风格：用矩形网格模拟像素感 -->
      <filter id="pixelate">
        <feFlood x="0" y="0" width="4" height="4"/>
        <feComposite width="4" height="4"/>
        <feTile result="a"/>
        <feComposite in="SourceGraphic" in2="a" operator="in"/>
        <feMorphology operator="dilate" radius="2"/>
      </filter>
    </defs>

    <!-- 背景透明 -->

    <!-- === 耳朵（三角形） === -->
    <!-- 左耳 -->
    <polygon points="80,180 180,40 200,220" fill="#2d2d2d"/>
    <!-- 左耳内耳（浅灰色） -->
    <polygon points="110,170 170,80 180,200" fill="#3d3d3d"/>

    <!-- 右耳 -->
    <polygon points="432,180 332,40 312,220" fill="#2d2d2d"/>
    <!-- 右耳内耳（浅灰色） -->
    <polygon points="402,170 342,80 332,200" fill="#3d3d3d"/>

    <!-- === 头部轮廓（圆角矩形） === -->
    <rect x="76" y="120" width="360" height="340" rx="60" ry="60" fill="#2d2d2d"/>

    <!-- === 脸部细节：额头的白色斑纹（边牧特征） === -->
    <path d="M 196,140 Q 256,100 316,140 L 316,200 Q 256,220 196,200 Z" fill="#ffffff" opacity="0.15"/>

    <!-- === 眼睛 === -->
    <!-- 左眼白 -->
    <ellipse cx="190" cy="260" rx="36" ry="32" fill="#ffffff"/>
    <!-- 左瞳孔（黑色） -->
    <ellipse cx="195" cy="262" rx="16" ry="18" fill="#1a1a1a"/>
    <!-- 左眼高光（小白点） -->
    <circle cx="202" cy="252" r="6" fill="#ffffff"/>

    <!-- 右眼白 -->
    <ellipse cx="322" cy="260" rx="36" ry="32" fill="#ffffff"/>
    <!-- 右瞳孔（黑色） -->
    <ellipse cx="317" cy="262" rx="16" ry="18" fill="#1a1a1a"/>
    <!-- 右眼高光（小白点） -->
    <circle cx="324" cy="252" r="6" fill="#ffffff"/>

    <!-- === 鼻子（黑色椭圆） === -->
    <ellipse cx="256" cy="330" rx="22" ry="16" fill="#1a1a1a"/>
    <!-- 鼻孔 -->
    <ellipse cx="248" cy="332" rx="5" ry="4" fill="#000000"/>
    <ellipse cx="264" cy="332" rx="5" ry="4" fill="#000000"/>

    <!-- === 嘴巴（微微张开的弧线） === -->
    <!-- 从鼻子下方到嘴的直线 -->
    <line x1="256" y1="346" x2="256" y2="368" stroke="#1a1a1a" stroke-width="3"/>
    <!-- 张嘴（弧形） -->
    <path d="M 216,370 Q 256,400 296,370" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
    <!-- 舌头（粉色小弧形） -->
    <path d="M 236,378 Q 256,410 276,378" fill="#e88a9e" stroke="none"/>
    <!-- 嘴内部（深色） -->
    <path d="M 220,370 Q 256,398 292,370 Z" fill="#1a1a1a" opacity="0.3"/>

    <!-- === 像素风格网格线（增强像素感） === -->
    <!-- 在眼睛周围添加像素网格装饰 -->
    <rect x="154" y="228" width="8" height="8" fill="#ffffff" opacity="0.3"/>
    <rect x="154" y="284" width="8" height="8" fill="#ffffff" opacity="0.3"/>
    <rect x="350" y="228" width="8" height="8" fill="#ffffff" opacity="0.3"/>
    <rect x="350" y="284" width="8" height="8" fill="#ffffff" opacity="0.3"/>
  </svg>`;
}

async function main() {
  const assetsDir = path.resolve(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const pngPath = path.join(assetsDir, 'app-icon.png');
  const iconsetDir = path.join(assetsDir, 'icon.iconset');

  console.log('🎨 生成应用图标 SVG...');
  const svgContent = generateSvg();

  // 用 sharp 渲染 SVG → PNG（512×512）
  console.log('🖼️  渲染 SVG → PNG...');
  await sharp(Buffer.from(svgContent))
    .png()
    .toFile(pngPath);

  // 验证 PNG
  const meta = await sharp(pngPath).metadata();
  console.log(`   PNG 生成成功: ${pngPath}`);
  console.log(`   尺寸: ${meta.width} × ${meta.height}`);
  console.log(`   格式: ${meta.format}`);

  if (meta.width !== SIZE || meta.height !== SIZE || meta.format !== 'png') {
    console.error(`❌ PNG 验证失败：期望 ${SIZE}×${SIZE} PNG，实际 ${meta.width}×${meta.height} ${meta.format}`);
    process.exit(1);
  }

  // 创建 iconset 目录
  console.log('\n📁 创建 iconset 目录...');
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }
  fs.mkdirSync(iconsetDir, { recursive: true });

  // 用 sips 生成各尺寸
  console.log('🔧 用 sips 生成多尺寸图标...');
  const sizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ];

  for (const { name, size } of sizes) {
    const outputPath = path.join(iconsetDir, name);
    execSync(`sips -z ${size} ${size} "${pngPath}" --out "${outputPath}"`, { stdio: 'pipe' });
    console.log(`   ✅ ${name} (${size}×${size})`);
  }

  // 用 iconutil 打包为 .icns
  const icnsPath = path.join(assetsDir, 'icon.icns');
  console.log('\n📦 用 iconutil 打包为 .icns...');
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'pipe' });
  console.log(`   ✅ .icns 已生成: ${icnsPath}`);

  // 验证 .icns 文件存在
  if (!fs.existsSync(icnsPath)) {
    console.error('❌ .icns 文件生成失败');
    process.exit(1);
  }
  const icnsStat = fs.statSync(icnsPath);
  console.log(`   文件大小: ${(icnsStat.size / 1024).toFixed(1)} KB`);

  // 清理临时文件
  console.log('\n🧹 清理临时文件...');
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }
  if (fs.existsSync(pngPath)) {
    fs.rmSync(pngPath);
  }

  console.log(`\n✅✅✅ 应用图标已生成: ${icnsPath}`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
