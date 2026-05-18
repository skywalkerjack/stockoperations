# 股市操作记录

这是一个只使用 HTML、CSS、JavaScript 的静态网站。用户输入网站密码后，通过 Supabase 共享账号登录，然后可以新增、修改、删除股票操作记录，并下载 JSON。

## 文件

- `index.html`：网页结构。
- `styles.css`：网页样式。
- `app.js`：登录、增删改查、JSON 下载逻辑。
- `supabase/schema.sql`：Supabase 建表和权限策略。

## 使用步骤

1. 在 Supabase 创建项目。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
3. 在 Supabase Auth 里创建一个共享邮箱/密码账号。
4. 打开 `app.js`，修改顶部三项：

   ```js
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   const SHARED_LOGIN_EMAIL = 'your-shared-login@example.com';
   ```

5. 用户访问网站时只需要输入这个共享账号的密码。
6. 把这些文件上传到 GitHub 仓库，可直接用于 GitHub Pages 等静态托管。

## 说明

Supabase URL、anon key 和共享邮箱会出现在前端代码中，这是 Supabase 静态前端的正常用法；真正的访问控制依靠 Supabase Auth 密码和 RLS 策略。

## 下载 JSON 备份

双击 `download-stock-operations.cmd`，输入共享账号密码后，会下载 `config.js` 中 `tableName` 指定的 Supabase 表，并覆盖生成 `stock-operations.json`。

## 持仓盈亏图表

页面会读取 `config.js` 中的 `priceTableName`，默认是 `stock_latest_prices`。请先在 Supabase SQL Editor 执行根目录的 `supabase/schema.sql`，创建当前价表和 RLS 策略。

当前价由网页手动维护：登录后在“当前价维护”区域输入每只持仓股票的当前价并保存，页面会自动计算持仓市值、成本、浮动盈亏和盈亏率，并生成图表。
