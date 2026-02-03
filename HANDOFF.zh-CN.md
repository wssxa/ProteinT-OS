# ProteinT-OS 交接说明（最终打磨与部署）

本文件是给最终打磨/部署同事的交接说明。它覆盖当前可用功能、使用方式、存储结构、API 说明以及后续生产化任务。

## 1) 当前可用内容（MVP）

**已可用：**
- Admin + Reporter 仪表盘（`public/`）。
- 项目更新 + 会议纪要提交接口（`/api/submissions/*`）。
- 异常收件箱、决策队列、合规指标、审计日志。
- 财务提交（起步版）与异常列表。
- 企微登录 **占位**（Stub）。

**仍未生产化：**
- 真实企微 OAuth。
- 数据库存储（当前为 JSON 文件）。
- 定时任务（日报/通知）。

## 2) 本地启动

```bash
npm install
npm run dev
```

打开：http://localhost:3000

### 可选管理员密钥
```bash
ADMIN_KEY="your-secret" npm run dev
```

浏览器控制台：
```bash
sessionStorage.setItem("adminKey", "your-secret")
```

## 3) MVP 使用流程

### Reporter
1. 使用 **WeCom Login (Stub)** 登录。
2. 在 **Try It: Project Update** 或 **Try It: Meeting Memo** 提交内容。
3. 在 **My Tasks** 更新任务与证据链接。

### Admin
1. 以管理员身份登录（见 `data/seed.json`）。
2. 查看 **异常/决策/合规/财务异常/审计**。
3. 在 **Project Registry** 与 **Task Ledger** 新建项目和任务。

## 4) 数据存储（当前）

所有数据保存在 `data/` 下 JSON 文件：

```
data/
├── audit.json
├── decisions.json
├── finance.json
├── projects.json
├── sessions.json
├── submissions.json
├── tasks.json
└── users.json
```

### 清空数据
删除 JSON 文件后重新启动，服务会自动生成空文件。

## 5) 会话与权限

- Reporter 可访问 `/api/my/tasks` 与 `/api/my/submissions`。
- 管理员接口要求 Admin 身份或 `ADMIN_KEY`。
- 会话默认 12 小时过期，可通过 `SESSION_TTL_HOURS` 调整。

## 6) 接口一览

**认证**
- `POST /api/auth/wecom/mock`
- `POST /api/auth/logout`
- `GET /api/me`

**Reporter**
- `GET /api/my/tasks`
- `GET /api/my/submissions`

**Admin**
- `GET /api/digest/daily`
- `GET /api/submissions`
- `GET /api/projects`
- `GET /api/tasks`
- `GET /api/users`
- `GET /api/exceptions`
- `GET /api/decisions`
- `GET /api/compliance`
- `GET /api/finance`
- `GET /api/finance/exceptions`
- `GET /api/audit`
- `POST /api/projects`
- `POST /api/tasks`
- `POST /api/users`
- `POST /api/decisions`
- `POST /api/admin/actions`

**提交**
- `POST /api/submissions/project-update`
- `POST /api/submissions/meeting-memo`
- `POST /api/finance`
- `POST /api/tasks/update`

## 7) 部署说明

详见 `DEPLOYMENT.md`。

## 8) 建议的打磨清单

1. **替换 JSON 存储** → Postgres（参考 `db/schema.sql`）。
2. **接入企微 OAuth** 并绑定用户角色。
3. **加入后台任务**（日报与通知）。
4. **完善 UX**：校验、错误提示、空状态。
5. **观测性**：日志、指标、追踪 ID。

## 9) 关键文件

- `server.js` – API 服务。
- `public/index.html` – UI 布局。
- `public/app.js` – 前端请求逻辑。
- `db/schema.sql` – Postgres 示例 schema。
- `scripts/seed_to_sql.js` – JSON 导出 SQL。
