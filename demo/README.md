# 交互展示页

GitHub Pages 部署生成的 `site/`。构建使用 Python 标准库；访客只下载静态前端，不需要 Python、API Key 或数据库。

`index.html` 是六段功能导览与交互试用入口。`build.py` 原样复制桌面版 `static/app.js`、`core.js`、`styles.css`；HTML 仅调整静态资源路径并插入演示适配器。每次构建都在临时数据库中生成虚构课程、复习和任务，不读取用户数据。

`adapter.js` 拦截当前窗口的 `/api/` 调用，以内存中的演示数据提供首页、日历、复习勾选、任务添加/编辑/删除/恢复及外观设置。演示日期固定为构建时的北京时间，刷新后重置；各个演示窗口的数据互不影响。它不保存密钥、不连接 AI、不提供真实导入、通知或完整的复习重新排期算法；未实现的操作明确提示使用完整版。

`director.js` 通过真实 DOM 操作模拟六个页面的交互。进入视野的章节自动播放；离开视野或切到后台时暂停，支持暂停与重播。系统启用减少动画时默认暂停。手机宣传页自适应，自动展示按桌面尺寸等比例缩放；交互试用沿用应用自身的窄屏布局，也可打开独立窗口。

本地预览：`python demo/build.py site`，然后在 `site/` 中运行 `python -m http.server`。界面检查：`node tests/demo_ui.cjs <预览网址>`，需可用 Playwright；可通过 `CHROME_PATH` 指定浏览器。

部署由 `.github/workflows/pages.yml` 完成；GitHub Pages 来源选择 GitHub Actions。

## 嵌入其他网页

这不是 GIF 或视频，而是在 iframe 中运行真实 HTML/CSS/JavaScript 前端，再按脚本模拟点击、输入和界面反馈。`embed.html` 是独立播放器，可嵌入外部网站；播放器内部与演示前端保持同源，外部宿主不需要发送跨域控制消息。

```html
<iframe
  src="https://caiwu557-ai.github.io/study-planner/embed.html?scene=todos"
  title="Study Planner 待办功能演示"
  width="100%"
  height="720"
  loading="lazy"
  style="border:0;border-radius:16px;"
></iframe>
```

`scene` 可选：`home`（首页）、`calendar`（日历）、`reviews`（复习）、`todos`（待办）、`ddls`（到期）、`settings`（设置）。不指定时展示首页。支持自动播放、暂停、重播与减少动画偏好；只有演示窗口内的内容会滚动，脚本不滚动外层网页。需要可执行 HTML iframe 的宿主；GitHub README 不支持这种 iframe 嵌入，可使用普通演示链接。
