# 像素边牧桌面电子宠物 — 项目实现步骤规划

> 技术栈：Electron + HTML5 Canvas + Electron-Builder  
> 运行平台：macOS  
> 开发方式：AI Coding（全流程通过 AI 对话驱动实现）

---

## 第一阶段：项目初始化与环境搭建

### 步骤 1.1：初始化 Electron 项目

**目标：** 搭建基础 Electron 项目骨架，能在 Mac 上启动一个窗口。

**AI 提示词：**

> 请使用 Electron 初始化一个 Mac 桌面应用项目，具体要求：
> 1. 使用 npm 初始化项目，安装 electron 和 electron-builder 依赖
> 2. 创建主进程入口 `main.js`。**重要：必须在 app.whenReady() 之后调用 `app.dock.hide()` 隐藏 Mac 下的 Dock 图标。**
> 3. 创建一个透明窗口，参数：`width: 200, height: 200, frame: false, transparent: true, alwaysOnTop: true, hasShadow: false`，并设置 `webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }`。窗口初始位置在屏幕右下角。
> 4. 隐藏窗口的标题栏和关闭按钮
> 5. 创建 `preload.js`（先留空）。渲染页面为一个覆盖全窗口的透明背景 `<canvas>`，用于后续渲染宠物，验证窗口可正常启动。

---

### 步骤 1.2：配置 Mac 打包

**目标：** 配置 electron-builder，能打包出 .dmg 安装包。

**AI 提示词：**

> 请在 package.json 中配置 electron-builder，要求：
> 1. 配置 appId 为 com.edog.bordercollie
> 2. 目标平台为 mac，输出格式为 dmg
> 3. 配置 mac.target 为 dmg 和 zip 双格式，添加 hardenedRuntime: true 用于公证
> 4. 添加打包脚本

---

## 第二阶段：像素宠物渲染系统

### 步骤 2.1：创建像素边牧精灵图（Spritesheet）

**目标：** 生成一张包含所有动画帧的像素风边牧精灵图。

**AI 提示词：**

> 请编写一个 Node.js 脚本 `scripts/generate-placeholder.js`，使用 Canvas API 绘制一张**用于测试引擎的占位图(spritesheet)**。
> 1. 我们不需要复杂的图案，只需要不同颜色的方块代表不同帧即可，确保坐标和尺寸精准。
> 2. 画布大小：1600x200 像素（8帧 × 200px宽），每帧 200x200 像素
> 3. 第1-2帧(待机)：用蓝色方块；第3-4帧(行走)：用绿色方块；第5帧(扑)：用红色方块；第6帧(悬空)：用黄色方块；第7帧(摸头)：用粉色方块；第8帧(戳肚)：用紫色方块。
> 4. 在每个方块中心写上对应的帧序号（1-8）
> 5. 输出到 `assets/spritesheet.png`。后续我会手动替换为真实的像素画资产

---

### 步骤 2.2：实现 Canvas 动画渲染引擎

**目标：** 在渲染进程中实现一个基于 Canvas 的精灵动画引擎。

**AI 提示词：**

> 请在前端渲染页面中实现一个 Canvas 精灵动画引擎，要求：
> 1. 创建全屏 Canvas，背景透明。
> 2. 加载 `assets/spritesheet.png`。
> 3. 实现 `SpriteAnimator` 类，支持 `loadSpritesheet` 和 `play(animationName)`。
> 4. 动画帧配置：
>    ```javascript
>    const ANIMS = {
>      idle:    { frames: [0, 1], fps: 2 },   // 待机呼吸
>      walk:    { frames: [2, 3], fps: 4 },   // 行走
>      pounce:  { frames: [4],    fps: 4 },   // 扑
>      lifted:  { frames: [5],    fps: 1 },   // 悬空
>      pet:     { frames: [6],    fps: 1 },   // 摸头
>      poke:    { frames: [7],    fps: 1 },   // 戳肚皮
>    }
>    ```
> 5. **关键渲染设置：** 必须在 JS 中设置 `ctx.imageSmoothingEnabled = false;`，并在 CSS 中设置 `canvas { image-rendering: pixelated; }`，确保像素边缘锐利。
> 6. 确保图片以 image-rendering: pixelated 方式渲染（清晰像素块）
> 7. Canvas 尺寸与窗口一致，确保透明区域可穿透鼠标事件

---

## 第三阶段：宠物状态机与行为系统

### 步骤 3.1：实现宠物状态机

**目标：** 实现一个有限状态机，管理宠物的所有状态和状态切换逻辑。

**AI 提示词：**

> 请实现一个宠物状态机 `PetStateMachine`，包含以下状态和转换：
>
> 状态定义：
> - IDLE：待机，播放待机动画，宠物在当前位置停留
> - WALKING：行走，播放行走动画，宠物沿随机方向移动
> - POUNCING：扑，播放扑动画（一次性动画，播完回到 IDLE）
> - LIFTED：被鼠标拎起来，跟随鼠标移动
> - PETTED：被摸头，播放摸头动画
> - POKED：被戳肚皮，播放戳肚皮动画
>
> 状态转换规则：
> - IDLE -> WALKING：定时器触发（见步骤4）
> - IDLE -> LIFTED：鼠标按下宠物身体区域
> - IDLE -> PETTED：鼠标在头部区域移动（抚摸检测）
> - IDLE -> POKED：鼠标在肚皮区域点击
> - WALKING -> IDLE：移动到目标位置后
> - LIFTED -> IDLE：鼠标释放
> - PETTED -> IDLE：鼠标离开头部区域后 0.5s
> - POKED -> IDLE：动画播放完毕后
> - POUNCING -> IDLE：扑动画播放完毕后
>
> 实现要求：
> 1. 每个状态有 enter()、exit()、update(dt) 生命周期方法
> 2. 状态切换时自动切换对应的精灵动画
> 3. 使用 EventEmitter 模式通知外部状态变化

---

### 步骤 3.2：实现宠物实体类

**目标：** 将状态机、动画引擎、渲染整合为一个 `Pet` 实体类。

**AI 提示词：**

> 请实现 `Pet` 类，整合动画引擎和状态机，要求：
> 1. 构造函数接收 Canvas 上下文
> 2. 属性：x, y（桌面坐标）、width, height（200x200）、direction（左右朝向）
> 3. 方法：
>    - update(dt)：更新状态机和动画
>    - render()：在 Canvas 上绘制当前动画帧（支持水平翻转）
>    - hitTest(mx, my)：检测坐标是否在宠物上，返回区域类型：'head' | 'body' | 'belly' | null
> 4. hitTest 的区域划分（宠物 200x200 画布内）：
>    - 头部区域：y: 0-80, x: 60-140
>    - 身体区域：y: 80-160, x: 40-160
>    - 肚皮区域：y: 120-160, x: 60-140
> 5. render 时根据 direction 决定是否水平翻转画布
> 6. 对外暴露简单的 API：pet.setState(stateName), pet.moveTo(x, y)

---

## 第四阶段：桌面交互功能

### 步骤 4.1：实现鼠标交互系统

**目标：** 实现用鼠标拖动宠物、摸头、戳肚皮等交互。

**AI 提示词：**

> 请实现宠物与鼠标的交互系统，要求：
> 1. 监听 Canvas 上的 mousedown/mousemove/mouseup 事件
> 2. 在渲染进程中处理事件，通过 hitTest 判断交互区域
> 3. 交互逻辑：
>    - **拖动宠物**：鼠标在身体区域按下 -> 切换 LIFTED 状态 -> 宠物跟随鼠标移动 -> 释放后回到桌面（带重力/弹性动画落回）
>    - **摸头**：鼠标在头部区域短暂停留/移动 -> 切换 PETTED 状态 -> 0.5秒后恢复 IDLE
>    - **戳肚皮**：鼠标在肚皮区域单击 -> 切换 POKED 状态 -> 播完后恢复 IDLE
> 4. LIFTED 状态：宠物跟随鼠标，有轻微摇摆/旋转效果
> 5. PETTED 状态：播放眯眼帧，宠物微微下沉表示享受
> 6. POKED 状态：播放惊讶帧，宠物弹跳并微微后退
> 7. 释放宠物时，带一个简短的缓动动画落回桌面（使用 easing 函数）
> 8. **坐标体系说明：** 宠物在 Canvas 中默认居中。在 LIFTED 状态下，当鼠标拖拽产生的 Canvas 内偏移量超过窗口半宽/半高时，渲染进程应通过 IPC 通知主进程调用 `win.setPosition()` 同步移动窗口，保证宠物可被拖到桌面任意位置。即：**Canvas 内偏移 + 窗口移动 = 最终拖拽效果**。

---

### 步骤 4.2：窗口透明穿透处理

**目标：** 确保透明区域鼠标事件可以穿透到下层应用。

**AI 提示词：**

> 请实现 Electron 透明窗口的精准鼠标穿透，要求：
> 1. 在 `main.js` 中监听 IPC 消息 `set-ignore-mouse-events`，调用 `win.setIgnoreMouseEvents(ignore, { forward: true })`。
> 2. 在 `preload.js` 中使用 `contextBridge` 暴露 API：`window.electronAPI.setIgnoreMouseEvents(ignore)`。
> 3. 在 `renderer.js` 的 `requestAnimationFrame` 循环中：
>    - 使用 `ctx.getImageData(mx, my, 1, 1).data[3]` 检测当前鼠标所在坐标的 Alpha 通道（透明度）。
>    - 如果 alpha > 0 (触碰到宠物非透明像素)，且当前处于 ignore 状态，则通过 API 发送 false（取消穿透）。
>    - 如果 alpha === 0 (鼠标在透明区域)，且当前未处于 ignore 状态，则发送 true（开启穿透）。
> 4. 注意状态缓存，只有当穿透状态发生**改变**时才发送 IPC 消息，避免性能损耗。
> 5. 不要在每一帧都调用 getImageData，请对其进行节流（Throttle），限制为最多每秒 10-15 次检测，或者仅在 mousemove 事件触发时才进行检测。

---

## 第五阶段：宠物行为系统

### 步骤 5.1：实现随机散步行为

**目标：** 宠物不定期在桌面上散步移动。

**AI 提示词：**

> 请实现宠物随机散步系统，要求：
> 1. 创建一个 `BehaviorManager` 类管理宠物行为调度
> 2. 散步行为（WalkBehavior）：
>    - 每隔 30-120 秒随机触发一次散步
>    - 随机选择一个目标位置（在屏幕范围内，避开屏幕边缘 100px）。散步逻辑不是改变宠物在 Canvas 中的坐标，而是通过 IPC 通知主进程，使用 win.setPosition(x, y) 来平滑移动整个 Electron 窗口。 宠物在 Canvas 永远居中。
>    - 随机行走速度（30-60 px/s）
>    - 行走时根据移动方向自动切换左右朝向
>    - 到达目标后切换回 IDLE
> 3. 扑行为（PounceBehavior）：
>    - 散步过程中有 20% 概率触发一次扑的动作
>    - 扑的时候向前方跳跃 30px
> 4. 空闲动画增强：
>    - IDLE 超过 10 秒时，偶尔播放一些"小动作"：摇尾巴、歪头、眨眼（可后续扩展精灵帧）
> 5. 使用 setInterval + 随机延迟实现调度（不用太精确）

---

## 第六阶段：健康提醒系统

### 步骤 6.1：实现定时提醒功能

**目标：** 每 1 小时提醒站立，每 2 小时提醒喝水。

**AI 提示词：**

> 请实现健康提醒系统，要求：
> 1. 在主进程（main.js）中创建两个定时器：
>    - 站立提醒：每 60 分钟触发一次
>    - 喝水提醒：每 120 分钟触发一次
> 2. 提醒方式：
>    - 方式一：使用 Electron 的 Notification API 发送系统通知
>    - 方式二：通过 IPC 通知渲染进程，让宠物做出特殊动作（如用爪子指屏幕、头顶弹出气泡文字）
> 3. 渲染进程收到提醒后：
>    - 宠物播放一个"提醒动画"：走几步 + 坐下 + 头顶出现文字气泡
>    - 气泡文字使用 Canvas 绘制（像素风对话框 + 文字）
>    - 站立提醒文字："该站起来活动一下啦！🐕"
>    - 喝水提醒文字："主人记得喝水哦～💧"
>    - 气泡显示 10 秒后自动消失
> 4. 持久化提醒记录：
>    - 使用 electron-store 或本地 JSON 文件保存上次提醒时间
>    - 应用重启后根据上次时间继续计时
> 5. 必须在 preload.js 的 contextBridge 中暴露一个接收消息的 API，例如 window.electronAPI.onReminder((event, type) => { ... })，用于监听主进程发来的定时器事件。

---

### 步骤 6.2：实现提醒气泡 UI

**目标：** 在宠物头顶绘制像素风对话气泡。

**AI 提示词：**

> 请实现像素风对话气泡渲染，要求：
> 1. 使用 Canvas 绘制像素风气泡
> 2. 气泡样式：
>    - 白色背景，黑色 2px 边框
>    - 气泡宽 160px，高自适应文字
>    - 底部有三角形指向宠物
>    - 使用像素字体（可内嵌一个 8px 像素字体或使用系统字体缩小）
> 3. `SpeechBubble` 类：
>    - show(text, duration)：显示气泡
>    - hide()：隐藏气泡
>    - 支持自动换行
> 4. 气泡位置：宠物头顶上方（pet.x + pet.width/2 - bubble.width/2, pet.y - bubble.height - 10）
> 5. 气泡显示/隐藏时带缩放弹性动画

---

## 第七阶段：系统托盘与菜单

### 步骤 7.1：实现系统托盘

**目标：** 在 Mac 菜单栏添加托盘图标，支持退出和控制。

**AI 提示词：**

> 请实现系统托盘功能，要求：
> 1. 在主进程中创建 Tray
> 2. 托盘图标使用一个 16x16 的像素边牧小头像（用 Canvas 生成或使用简单几何形状）
> 3. 右键菜单包含：
>    - 显示/隐藏宠物（切换窗口可见性）
>    - 切换静音（暂时关闭提醒通知）
>    - 立即提醒（手动触发站立/喝水提醒）
>    - 关于
>    - 退出
> 4. 点击托盘图标时，如果宠物窗口被隐藏则显示，并让宠物做一个打招呼动作
> 5. 使用 `generate-tray-icon.js` 脚本生成托盘图标

---

## 第八阶段：细节打磨与优化

### 步骤 8.1：窗口定位与多屏幕适配

**AI 提示词：**

> 请优化窗口定位系统：
> 1. 启动时宠物出现在屏幕右下角
> 2. 使用 screen API 获取主屏幕尺寸
> 3. 宠物始终保持在屏幕可见范围内（边界检测）
> 4. 支持多屏幕：宠物可以跨屏幕移动
> 5. 窗口失去焦点时不改变层级

---

### 步骤 8.2：性能优化

**AI 提示词：**

> 请对应用进行性能优化：
> 1. 渲染优化：只在动画帧确实需要更新时才重绘 Canvas（脏矩形检测）
> 2. 空闲时降低帧率（IDLE 状态使用 4fps，移动状态使用 30fps）
> 3. 减少不必要的 IPC 通信
> 4. 确保长时间运行时内存不泄漏（清理定时器、事件监听器）

---

### 步骤 8.3：错误处理与健壮性

**AI 提示词：**

> 请加强应用的错误处理和健壮性：
> 1. 精灵图加载失败时显示后备图形（用 Canvas 绘制一个简单的几何边牧剪影）
> 2. 主进程崩溃保护
> 3. 日志系统：使用 electron-log 记录运行日志
> 4. 异常捕获全局处理，避免应用闪退

---

## 第九阶段：打包与发布

### 步骤 9.1：Mac 应用打包

**AI 提示词：**

> 请打包 Mac 应用：
> 1. 运行 electron-builder 打包
> 2. 生成 .dmg 安装包
> 3. 配置应用图标（icns 格式，可先用脚本生成一个像素风边牧图标）
> 4. 验证打包后的应用功能正常
> 5. 配置代码签名（如需发布到非 App Store 渠道则使用 ad-hoc 签名）

---

## 附录：交互 Prompt 速查表

| 场景 | 关键 Prompt 指令 |
|------|-----------------|
| 修改精灵图某帧 | "请修改 spritesheet 的第 X 帧，让边牧的尾巴翘得更高一些" |
| 调整动画速度 | "将 walk 动画的 fps 从 4 调整为 6" |
| 新增动画帧 | "请新增一帧'摇尾巴'动画，追加到 spritesheet 的第 9 帧位置" |
| 调整行为概率 | "将散步触发间隔改为 20-60 秒" |
| 修改提醒时间 | "将站立提醒改为每 45 分钟一次" |
| 调整宠物大小 | "将宠物缩放为 0.8 倍大小显示" |
| 更换配色 | "将边牧的深灰色改为蓝灰色 #4a5568" |

---

## 技术架构概览

```
edog/
├── package.json
├── main.js                  # 主进程：窗口管理、托盘、提醒定时器
├── preload.js               # 预加载脚本：IPC 桥接
├── renderer/
│   ├── renderer.js          # 渲染进程入口
│   ├── Pet.js               # 宠物实体类
│   ├── SpriteAnimator.js    # 精灵动画引擎
│   ├── PetStateMachine.js   # 状态机
│   ├── BehaviorManager.js   # 行为调度器
│   ├── SpeechBubble.js      # 对话气泡
│   ├── Interaction.js       # 鼠标交互处理
│   └── const.js             # 常量配置
├── assets/
│   └── spritesheet.png      # 精灵图
├── scripts/
│   └── generate-spritesheet.js  # 精灵图生成脚本
├── index.html               # 渲染页面
└── styles.css               # 样式
```

---

## 开发顺序建议

按阶段顺序执行，每个步骤完成后验证功能正常再进入下一步：

```
第一阶段（基础）→ 第二阶段（渲染）→ 第三阶段（状态机）
→ 第四阶段（交互）→ 第五阶段（行为）→ 第六阶段（提醒）
→ 第七阶段（托盘）→ 第八阶段（优化）→ 第九阶段（打包）
```
