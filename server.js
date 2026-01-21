import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const submissionsPath = path.join(dataDir, "submissions.json");
const projectsPath = path.join(dataDir, "projects.json");
const tasksPath = path.join(dataDir, "tasks.json");
const usersPath = path.join(dataDir, "users.json");
const sessionsPath = path.join(dataDir, "sessions.json");
const decisionsPath = path.join(dataDir, "decisions.json");
const auditPath = path.join(dataDir, "audit.json");
const financePath = path.join(dataDir, "finance.json");
const seedPath = path.join(dataDir, "seed.json");
const publicDir = path.join(__dirname, "public");

const ensureSubmissionsFile = () => {
  if (!fs.existsSync(submissionsPath)) {
    fs.writeFileSync(submissionsPath, JSON.stringify({ submissions: [] }, null, 2));
  }
};

const ensureFile = (filePath, payload) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  }
};

const loadSeed = () => {
  const raw = fs.readFileSync(seedPath, "utf-8");
  return JSON.parse(raw);
};

const readJsonFile = (filePath, fallback) => {
  ensureFile(filePath, fallback);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
};

const writeJsonFile = (filePath, payload) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

const readSubmissions = () => {
  ensureSubmissionsFile();
  const raw = fs.readFileSync(submissionsPath, "utf-8");
  return JSON.parse(raw);
};

const writeSubmissions = (payload) => {
  fs.writeFileSync(submissionsPath, JSON.stringify(payload, null, 2));
};

const logAuditEvent = (event) => {
  const data = readJsonFile(auditPath, { events: [] });
  data.events.unshift({
    id: `evt_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...event
  });
  writeJsonFile(auditPath, data);
};

const isAdmin = (req, seed) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return true;
  }
  return req.headers["x-admin-key"] === adminKey;
};

const daysBetween = (from, to) => {
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const computeExceptions = () => {
  const seed = loadSeed();
  const { projects } = readJsonFile(projectsPath, { projects: [] });
  const { submissions } = readSubmissions();
  const now = new Date();
  const cadence = seed.tiers || {};
  const exceptions = [];

  projects.forEach((project) => {
    const updates = submissions.filter(
      (item) => item.type === "project_update" && item.project === project.name
    );
    const latest = updates[0];
    const cadenceDays = cadence[project.tier]?.cadenceDays;
    if (!latest) {
      exceptions.push({
        type: "missing_update",
        project: project.name,
        owner: project.owner,
        tier: project.tier,
        detail: "No updates submitted yet."
      });
      return;
    }
    if (cadenceDays) {
      const lastDate = new Date(latest.createdAt);
      const ageDays = daysBetween(lastDate, now);
      if (ageDays > cadenceDays) {
        exceptions.push({
          type: "missed_cadence",
          project: project.name,
          owner: project.owner,
          tier: project.tier,
          detail: `Last update ${ageDays} days ago.`
        });
      }
    }
  });

  return exceptions;
};

const computeCompliance = () => {
  const seed = loadSeed();
  const { projects } = readJsonFile(projectsPath, { projects: [] });
  const { submissions } = readSubmissions();
  const now = new Date();
  const cadence = seed.tiers || {};
  const summary = {};

  projects.forEach((project) => {
    const updates = submissions.filter(
      (item) => item.type === "project_update" && item.project === project.name
    );
    const latest = updates[0];
    const cadenceDays = cadence[project.tier]?.cadenceDays;
    const dept = project.department || "Unassigned";
    if (!summary[dept]) {
      summary[dept] = { total: 0, compliant: 0 };
    }
    summary[dept].total += 1;
    if (latest && cadenceDays) {
      const lastDate = new Date(latest.createdAt);
      const ageDays = daysBetween(lastDate, now);
      if (ageDays <= cadenceDays) {
        summary[dept].compliant += 1;
      }
    }
  });

  return Object.entries(summary).map(([department, stats]) => ({
    department,
    compliant: stats.compliant,
    total: stats.total,
    rate: stats.total ? Math.round((stats.compliant / stats.total) * 100) : 0
  }));
};

const getSessionUser = (req) => {
  const token = req.headers["x-session-token"];
  if (!token) {
    return null;
  }
  const { sessions } = readJsonFile(sessionsPath, { sessions: [] });
  return sessions.find((session) => session.token === token) || null;
};

const requireAuth = (req, res) => {
  const session = getSessionUser(req);
  if (!session) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }
  return session;
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const sendFile = (res, filePath) => {
  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json"
  };

  const contentType = contentTypes[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    res.writeHead(404);
    res.end("Not found");
  });
  res.writeHead(200, { "Content-Type": contentType });
  stream.pipe(res);
};

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { status: "ok", time: new Date().toISOString() });
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    return sendJson(res, 200, loadSeed());
  }

  if (req.method === "GET" && url.pathname === "/api/digest/daily") {
    const { submissions } = readSubmissions();
    const today = new Date().toISOString().slice(0, 10);
    const todayItems = submissions.filter((item) => item.createdAt?.startsWith(today));

    return sendJson(res, 200, {
      date: today,
      totals: {
        submissions: todayItems.length,
        projectUpdates: todayItems.filter((item) => item.type === "project_update").length,
        meetingMemos: todayItems.filter((item) => item.type === "meeting_memo").length
      },
      highlights: todayItems.slice(0, 5)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/exceptions") {
    const exceptions = computeExceptions();
    return sendJson(res, 200, { exceptions });
  }

  if (req.method === "GET" && url.pathname === "/api/submissions") {
    const { submissions } = readSubmissions();
    return sendJson(res, 200, { submissions });
  }

  if (req.method === "GET" && url.pathname === "/api/decisions") {
    const { decisions } = readJsonFile(decisionsPath, { decisions: [] });
    return sendJson(res, 200, { decisions });
  }

  if (req.method === "GET" && url.pathname === "/api/finance") {
    const { items } = readJsonFile(financePath, { items: [] });
    return sendJson(res, 200, { items });
  }

  if (req.method === "GET" && url.pathname === "/api/finance/exceptions") {
    const { items } = readJsonFile(financePath, { items: [] });
    const exceptions = items.filter((item) => item.exceptionReason);
    return sendJson(res, 200, { exceptions });
  }

  if (req.method === "GET" && url.pathname === "/api/compliance") {
    const compliance = computeCompliance();
    return sendJson(res, 200, { compliance });
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    const { projects } = readJsonFile(projectsPath, { projects: [] });
    return sendJson(res, 200, { projects });
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    const { tasks } = readJsonFile(tasksPath, { tasks: [] });
    return sendJson(res, 200, { tasks });
  }

  if (req.method === "GET" && url.pathname === "/api/my/tasks") {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }
    const { tasks } = readJsonFile(tasksPath, { tasks: [] });
    const mine = tasks.filter((task) => task.owner === auth.user?.name);
    return sendJson(res, 200, { tasks: mine });
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    const { users } = readJsonFile(usersPath, { users: [] });
    return sendJson(res, 200, { users });
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    const session = getSessionUser(req);
    if (!session) {
      return sendJson(res, 200, { user: null });
    }
    return sendJson(res, 200, { user: session.user });
  }

  if (req.method === "GET" && url.pathname === "/api/audit") {
    const { events } = readJsonFile(auditPath, { events: [] });
    return sendJson(res, 200, { events });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/wecom/mock") {
    try {
      const payload = await parseBody(req);
      if (!payload.name) {
        return sendJson(res, 400, { error: "name is required" });
      }
      const seed = loadSeed();
      const token = `sess_${Date.now()}`;
      const { users } = readJsonFile(usersPath, { users: [] });
      const isAdminUser = seed.admins?.includes(payload.name);
      const user =
        users.find((entry) => entry.name === payload.name) || {
          id: `user_${Date.now()}`,
          name: payload.name,
          role: isAdminUser ? "Admin" : "Reporter",
          createdAt: new Date().toISOString()
        };
      const session = {
        token,
        user,
        createdAt: new Date().toISOString()
      };
      const data = readJsonFile(sessionsPath, { sessions: [] });
      data.sessions.unshift(session);
      writeJsonFile(sessionsPath, data);
      logAuditEvent({
        type: "login",
        actor: user.name,
        role: user.role
      });
      return sendJson(res, 200, { token, user });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/submissions/project-update") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const payload = await parseBody(req);
      if (
        !payload.project ||
        !payload.owner ||
        !payload.tier ||
        !payload.currentMilestone ||
        !payload.progress ||
        !payload.evidenceLink ||
        !payload.nextMilestone ||
        !payload.nextDueDate
      ) {
        return sendJson(res, 400, {
          error:
            "project, owner, tier, currentMilestone, progress, evidenceLink, nextMilestone, and nextDueDate are required"
        });
      }

      const submissionsData = readSubmissions();
      const entry = {
        id: `upd_${Date.now()}`,
        type: "project_update",
        ...payload,
        createdAt: new Date().toISOString()
      };

      submissionsData.submissions.unshift(entry);
      writeSubmissions(submissionsData);
      logAuditEvent({
        type: "project_update_submitted",
        actor: payload.owner,
        project: payload.project
      });

      if (payload.decisionNeeded && payload.decisionNeeded.toLowerCase() === "y") {
        const decisionsData = readJsonFile(decisionsPath, { decisions: [] });
        const decisionEntry = {
          id: `dec_${Date.now()}`,
          project: payload.project,
          owner: payload.owner,
          summary: payload.decisionSummary || "Decision needed",
          createdAt: new Date().toISOString()
        };
        decisionsData.decisions.unshift(decisionEntry);
        writeJsonFile(decisionsPath, decisionsData);
        logAuditEvent({
          type: "decision_created",
          actor: payload.owner,
          project: payload.project
        });
      }

      return sendJson(res, 200, { status: "received", entry });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/submissions/meeting-memo") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const payload = await parseBody(req);
      if (!payload.context || !payload.owner) {
        return sendJson(res, 400, { error: "context and owner are required" });
      }

      const submissionsData = readSubmissions();
      const entry = {
        id: `memo_${Date.now()}`,
        type: "meeting_memo",
        ...payload,
        createdAt: new Date().toISOString()
      };

      submissionsData.submissions.unshift(entry);
      writeSubmissions(submissionsData);
      logAuditEvent({
        type: "meeting_memo_submitted",
        actor: payload.owner
      });

      if (payload.actions) {
        const data = readJsonFile(tasksPath, { tasks: [] });
        const items = payload.actions
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        items.forEach((title) => {
          data.tasks.unshift({
            id: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            title,
            owner: payload.owner,
            project: payload.project || "General",
            status: "Backlog",
            createdAt: new Date().toISOString()
          });
        });
        writeJsonFile(tasksPath, data);
        logAuditEvent({
          type: "tasks_created_from_memo",
          actor: payload.owner,
          project: payload.project || "General"
        });
      }

      return sendJson(res, 200, { status: "received", entry });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/decisions") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const seed = loadSeed();
      if (!isAdmin(req, seed)) {
        return sendJson(res, 403, { error: "Admin access required" });
      }
      const payload = await parseBody(req);
      if (!payload.project || !payload.summary) {
        return sendJson(res, 400, { error: "project and summary are required" });
      }
      const data = readJsonFile(decisionsPath, { decisions: [] });
      const entry = {
        id: `dec_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...payload
      };
      data.decisions.unshift(entry);
      writeJsonFile(decisionsPath, data);
      logAuditEvent({
        type: "decision_created",
        actor: auth.user?.name || "admin",
        project: payload.project
      });
      return sendJson(res, 200, { status: "created", entry });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/finance") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const payload = await parseBody(req);
      if (!payload.docType || !payload.date || !payload.amount || !payload.vendor) {
        return sendJson(res, 400, {
          error: "docType, date, amount, and vendor are required"
        });
      }
      const data = readJsonFile(financePath, { items: [] });
      const entry = {
        id: `fin_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...payload
      };
      data.items.unshift(entry);
      writeJsonFile(financePath, data);
      logAuditEvent({
        type: "finance_item_submitted",
        actor: auth.user?.name || "reporter",
        project: payload.project
      });
      return sendJson(res, 200, { status: "created", entry });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/actions") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const seed = loadSeed();
      if (!isAdmin(req, seed)) {
        return sendJson(res, 403, { error: "Admin access required" });
      }
      const payload = await parseBody(req);
      if (!payload.action || !payload.target) {
        return sendJson(res, 400, { error: "action and target are required" });
      }

      return sendJson(res, 200, {
        status: "queued",
        action: payload.action,
        target: payload.target,
        requestedAt: new Date().toISOString()
      });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/projects") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const seed = loadSeed();
      if (!isAdmin(req, seed)) {
        return sendJson(res, 403, { error: "Admin access required" });
      }
      const payload = await parseBody(req);
      if (!payload.name || !payload.owner || !payload.tier) {
        return sendJson(res, 400, { error: "name, owner, and tier are required" });
      }
      const data = readJsonFile(projectsPath, { projects: [] });
      const entry = {
        id: `proj_${Date.now()}`,
        status: payload.status || "Active",
        createdAt: new Date().toISOString(),
        ...payload
      };
      data.projects.unshift(entry);
      writeJsonFile(projectsPath, data);
      logAuditEvent({
        type: "project_created",
        actor: auth.user?.name || "admin",
        project: payload.name
      });
      return sendJson(res, 200, { status: "created", entry });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const seed = loadSeed();
      if (!isAdmin(req, seed)) {
        return sendJson(res, 403, { error: "Admin access required" });
      }
      const payload = await parseBody(req);
      if (!payload.title || !payload.owner || !payload.project) {
        return sendJson(res, 400, { error: "title, owner, and project are required" });
      }
      const data = readJsonFile(tasksPath, { tasks: [] });
      const entry = {
        id: `task_${Date.now()}`,
        status: payload.status || "Backlog",
        createdAt: new Date().toISOString(),
        ...payload
      };
      data.tasks.unshift(entry);
      writeJsonFile(tasksPath, data);
      logAuditEvent({
        type: "task_created",
        actor: auth.user?.name || "admin",
        project: payload.project
      });
      return sendJson(res, 200, { status: "created", entry });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/tasks/update") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const payload = await parseBody(req);
      if (!payload.id || !payload.status) {
        return sendJson(res, 400, { error: "id and status are required" });
      }
      const data = readJsonFile(tasksPath, { tasks: [] });
      const task = data.tasks.find((item) => item.id === payload.id);
      if (!task) {
        return sendJson(res, 404, { error: "Task not found" });
      }
      task.status = payload.status;
      if (payload.evidenceLink) {
        task.evidenceLink = payload.evidenceLink;
      }
      task.updatedAt = new Date().toISOString();
      writeJsonFile(tasksPath, data);
      logAuditEvent({
        type: "task_updated",
        actor: auth.user?.name || "reporter",
        project: task.project
      });
      return sendJson(res, 200, { status: "updated", task });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/users") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const seed = loadSeed();
      if (!isAdmin(req, seed)) {
        return sendJson(res, 403, { error: "Admin access required" });
      }
      const payload = await parseBody(req);
      if (!payload.name || !payload.role) {
        return sendJson(res, 400, { error: "name and role are required" });
      }
      const data = readJsonFile(usersPath, { users: [] });
      const entry = {
        id: `user_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...payload
      };
      data.users.unshift(entry);
      writeJsonFile(usersPath, data);
      logAuditEvent({
        type: "user_created",
        actor: auth.user?.name || "admin",
        target: payload.name
      });
      return sendJson(res, 200, { status: "created", entry });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "GET") {
    const filePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const resolvedPath = path.join(publicDir, filePath);
    if (resolvedPath.startsWith(publicDir) && fs.existsSync(resolvedPath)) {
      return sendFile(res, resolvedPath);
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(port, () => {
  console.log(`ProteinT-OS MVP running at http://localhost:${port}`);
});
