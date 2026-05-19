# 股市操作记录网站

这是一个纯静态网页项目，只使用 HTML、CSS、JavaScript。网站通过 Supabase 共享账号登录，登录后可以维护股票操作记录，并支持下载 JSON 备份。

## 当前功能

- 密码登录：使用 Supabase Auth 的共享邮箱账号登录。
- 操作记录管理：新增、编辑、删除股票操作记录。
- 字段格式：日期、名称、代码、操作、单价、操作股数。
- 操作类型：买入、卖出、加仓、减仓、观察。
- 默认日期：登录后新增记录的日期默认填入当天，格式如 `2026-0519`。
- 手机端优化：手机端记录列表会显示为卡片，更方便阅读。
- JSON 下载：网页内可下载当前记录为 `stock-operations.json`。
- 本地自动下载：可用脚本从 Supabase 下载最新数据并覆盖本地 `stock-operations.json`。
- 工作日定时下载：可创建 Windows 计划任务，在周一到周五固定时间自动下载。

## 目录说明

```text
web/
  index.html          网站页面
  styles.css          网站样式
  app.js              登录、增删改查、JSON 下载逻辑
  config.js           网站 Supabase 配置

supabase/
  schema.sql          Supabase 建表和 RLS 权限策略

download-stock-operations.js       从 Supabase 下载表数据
download-stock-operations.cmd      双击运行下载
download-config.js                 本地下载密码配置，不建议上传 GitHub
download-config.example.js         下载密码配置示例，可上传 GitHub
create-weekday-download-task.cmd   创建工作日定时下载任务

stock-operations.json              下载到本地的记录备份
stock_analysis_600415_daily.py     600415 每日行情分析和飞书推送脚本
send_analysis.py                   发送固定分析内容到飞书的脚本
```

## Supabase 初始化

1. 打开 Supabase 项目。
2. 进入 SQL Editor。
3. 执行 `supabase/schema.sql`。
4. 确认生成表：

```text
stock_operations
```

表字段：

```text
id
trade_date
stock_name
stock_code
operation
unit_price
operation_shares
created_at
updated_at
```

RLS 已开启，策略允许已登录用户读取、新增、修改、删除记录。

## 网站配置

编辑 `web/config.js`：

```js
window.STOCK_ADMIN_CONFIG = {
  supabaseUrl: "https://your-project.supabase.co",
  anonKey: "your-anon-key",
  adminEmail: "owner@stockmonitor.local",
  tableName: "stock_operations",
};
```

说明：

- `supabaseUrl`：Supabase 项目 URL。
- `anonKey`：Supabase anon/publishable key。
- `adminEmail`：Supabase Auth 里的共享登录邮箱。
- `tableName`：操作记录表名，当前为 `stock_operations`。

注意：不要把 Supabase 密码写入 `web/config.js`，网站登录时由用户输入密码。

## 操作类型说明

- 买入：首次买入某只股票，或开始建仓。
- 加仓：已经持有该股票，又继续买入。
- 卖出：卖出较大部分或全部持仓。
- 减仓：卖出一部分，仍继续持有。
- 观察：不发生实际交易，只记录关注、判断或计划。

如果以后做持仓统计，通常按下面规则处理：

```text
买入、加仓 = 增加股数
卖出、减仓 = 减少股数
观察 = 不影响股数
```

## JSON 下载

网页内点击“下载 JSON”，会下载当前页面记录。

本地脚本下载方式：

1. 编辑 `download-config.js`：

```js
module.exports = {
  password: "这里填 Supabase 共享账号密码",
};
```

2. 双击运行：

```text
download-stock-operations.cmd
```

脚本会读取 `web/config.js` 中的 Supabase 配置，登录后下载 `tableName` 指定的表，并覆盖生成：

```text
stock-operations.json
```

安全建议：`download-config.js` 已加入 `.gitignore`，不要上传 GitHub。上传仓库时保留 `download-config.example.js` 即可。

## 工作日定时下载

双击：

```text
create-weekday-download-task.cmd
```

输入运行时间，例如：

```text
08:30
```

它会创建 Windows 计划任务：

```text
Stock Operations JSON Download
```

运行频率：

```text
周一到周五，每天指定时间运行
```

任务会自动执行 `download-stock-operations.cmd`，更新本地 `stock-operations.json`。

## GitHub 上传建议

建议上传：

```text
web/
supabase/
download-stock-operations.js
download-stock-operations.cmd
download-config.example.js
create-weekday-download-task.cmd
stock_analysis_600415_daily.py
send_analysis.py
```

不建议上传：

```text
download-config.js
```

原因：里面保存 Supabase 登录密码。

另外，`send_analysis.py` 和 `stock_analysis_600415_daily.py` 里包含飞书 webhook，也属于敏感信息。如果仓库是公开仓库，建议改成从本地配置或环境变量读取 webhook。

## 部署

如果使用 GitHub Pages，发布 `web/` 目录中的静态文件即可。网站本身不需要 Node、Python 或服务器。
