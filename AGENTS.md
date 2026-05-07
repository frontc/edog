# 边牧电子宠物开发全局约束
1. 平台：严格针对 macOS 优化，忽略 Windows 特性。
2. 架构：严格遵守 main.js (系统级/定时器) -> preload.js (安全桥接) -> renderer/ (UI与逻辑) 的 Electron 架构分离。
3. 代码风格：在 Renderer 进程中采用面向对象编程（OOP），务必将 Pet、StateMachine、BehaviorManager 拆分到独立的 .js 文件中（使用 ES Module），禁止写成面条代码。
4. 安全：main.js 中 BrowserWindow 必须配置 `contextIsolation: true`、`nodeIntegration: false`，所有主进程与渲染进程之间的通信只能通过 preload.js 中 contextBridge 暴露的 API 进行。
5. UI限制：完全依赖 HTML5 Canvas 进行渲染，禁止使用复杂的 DOM 叠加进行动画。
