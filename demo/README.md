# 交互展示页

GitHub Pages 部署生成的 `site/`。构建使用 Python 标准库；访客只下载静态前端，不需要 Python、API Key 或数据库。

`index.html` 是六段功能导览与交互试用入口。`build.py` 原样复制桌面版 `static/app.js`、`core.js`、`styles.css`；HTML 仅调整静态资源路径并插入演示适配器。每次构建都在临时数据库中生成虚构课程、复习和任务，不读取用户数据。

`adapter.js` 拦截当前窗口的 `/api/` 调用，以内存中的演示数据提供首页、日历、复习勾选、任务添加/编辑/删除/恢复及外观设置。演示日期固定为构建时的北京时间，刷新后重置；各个演示窗口的数据互不影响。它不保存密钥、不连接 AI、不提供真实导入、通知或完整的复习重新排期算法；未实现的操作明确提示使用完整版。

`director.js` 通过真实 DOM 操作模拟六个页面的交互。进入视野的章节自动播放；离开视野或切到后台时暂停，支持暂停与重播。系统启用减少动画时默认暂停。手机宣传页自适应，自动展示按桌面尺寸等比例缩放；交互试用沿用应用自身的窄屏布局，也可打开独立窗口。

本地预览：`python demo/build.py site`，然后在 `site/` 中运行 `python -m http.server`。界面检查：`node tests/demo_ui.cjs <预览网址>`，需可用 Playwright；可通过 `CHROME_PATH` 指定浏览器。

部署由 `.github/workflows/pages.yml` 完成；GitHub Pages 来源选择 GitHub Actions。
