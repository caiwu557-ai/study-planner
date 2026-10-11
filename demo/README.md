# 交互展示页

GitHub Pages 仅部署此目录，不依赖 Python、API Key 或数据库。

`index.html` 是简化交互原型，使用虚构课程、相对当前日期的示例任务；支持周/月视图、复习勾选、任务添加/删除/六秒撤销、三种配色。演示数据只存于浏览器 sessionStorage，不连接完整版数据。AI、导入、调课、真实复习计算、通知及桌面设置不在演示范围。

手机周课表允许横向滑动，其他内容适应窄屏。正式 Android 应用仍需独立适配存储、提醒、导入与密钥保护，不能把此展示页直接当成完整应用。

部署由 `.github/workflows/pages.yml` 完成；GitHub Pages 来源选择 GitHub Actions。
