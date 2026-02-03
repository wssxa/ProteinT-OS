# ProteinT-OS（MVP Web 仪表盘 + 企微提交占位）

本仓库包含“电子 CEO 办公室”的 **MVP 起步版**。它是轻量实现，聚焦于：

- **Web 仪表盘**（CEO 页面、异常收件箱、项目注册表）
- **提交接口**（项目更新 + 会议纪要）
- **日报摘要占位**
- **企微集成占位**（提交 + 通知 + 管理动作）

## 快速开始

### 1) 安装
```bash
node --version
```

### 2) 运行
```bash
npm run dev
```

打开：http://localhost:3000

## 使用方式（非技术）

1. 打开仪表盘。
2. 使用 **WeCom Login (Stub)** 输入姓名登录。
3. Admin 账号会看到 **管理员界面**（项目注册表 + 任务台账）。
4. Reporter 账号会看到 **汇报人界面**。
5. 用 **Try It: Project Update** 或 **Try It: Meeting Memo** 提交内容。
6. 预览区会展示后端收到的数据。

> 注意：当前仅为企微 OAuth 占位，后续将替换为真实登录。

### 管理员访问

设置管理员密钥：

```bash
ADMIN_KEY="your-secret" npm run dev
```

浏览器中配置（UI 会读取 `sessionStorage.adminKey`）：

```bash
sessionStorage.setItem("adminKey", "your-secret")
```

## 前端 / 后端 / 端口

- **前端**：`public/`
- **后端**：`server.js`（Node HTTP 服务）
- **端口**：`3000`

## API 接口（用于企微对接）

```bash
GET  /api/config
GET  /api/digest/daily (admin)
GET  /api/submissions (admin)
GET  /api/my/submissions
GET  /api/projects (admin)
GET  /api/tasks (admin)
GET  /api/users (admin)
GET  /api/me
GET  /api/exceptions (admin)
GET  /api/decisions (admin)
GET  /api/compliance (admin)
GET  /api/my/tasks
GET  /api/finance (admin)
GET  /api/finance/exceptions (admin)
POST /api/auth/wecom/mock
POST /api/auth/logout
POST /api/submissions/project-update
POST /api/submissions/meeting-memo
POST /api/admin/actions
POST /api/projects (admin)
POST /api/tasks (admin)
POST /api/tasks/update
POST /api/users (admin)
POST /api/decisions (admin)
POST /api/finance
```

### 示例：项目更新
```bash
curl -X POST http://localhost:3000/api/submissions/project-update \
  -H "Content-Type: application/json" \
  -d '{
    "project": "D2C Growth Push",
    "owner": "康弘宇",
    "tier": "T2",
    "currentMilestone": "New ad set live",
    "progress": "60%",
    "evidenceLink": "https://example.com/evidence",
    "nextMilestone": "Scale creative to 3 variants",
    "nextDueDate": "2026-02-01",
    "blockers": "None"
  }'
```

## 目录结构

```
.
├── data/
│   ├── seed.json
│   └── submissions.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server.js
└── package.json
```

## 配置（修改 `data/seed.json`）

- **部门列表**（已包含所有部门）
- **管理员用户**（Hongyu Kang / 康弘宇）
- **企微集成范围**（提交 + 通知 + 管理动作 + 日报）

## 下一步（Phase 1）

1. 用数据库替换 JSON 存储（Postgres + Prisma）
2. 接入企微 OAuth + 回调
3. 加入日报/通知的后台任务
4. 加强证据校验与节奏规则

## 会话与权限说明

- 默认会话 12 小时过期，可用 `SESSION_TTL_HOURS` 覆盖。
- 管理员接口需要 Admin 身份或 `ADMIN_KEY`。

## 部署交接

详见 `DEPLOYMENT.md`。

## 交接指南（最终打磨）

详见 `HANDOFF.md` 与 `HANDOFF.zh-CN.md`。

## Docker 快速启动

```bash
cp .env.example .env
docker compose up --build
```

## 数据库示例

迁移到数据库时可使用 `db/schema.sql`。

### JSON → SQL 导出

```bash
npm run seed:sql
```
