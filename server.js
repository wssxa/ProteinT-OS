import fs from "fs";
import http from "http";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { generate } from "./src/ai/provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS) || 12;

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
const chunksPath = path.join(dataDir, "chunks.json");
const contextPackagesPath = path.join(dataDir, "context_packages.json");
const workArtifactsPath = path.join(dataDir, "work_artifacts");
const ingestStatePath = path.join(dataDir, "ingest_state.json");
const publicDir = path.join(__dirname, "public");
const allowedIngestionExts = new Set([".txt", ".md", ".json", ".csv"]);
const CHUNK_MIN_CHARS = 800;
const CHUNK_MAX_CHARS = 1200;

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

const ensureWorkArtifactsDir = () => {
  fs.mkdirSync(workArtifactsPath, { recursive: true });
};

const ensureIngestionFiles = () => {
  ensureWorkArtifactsDir();
  ensureFile(chunksPath, { chunks: [] });
  ensureFile(ingestStatePath, { files: {}, lastScan: null });
};

const getDocIdForPath = (relativePath) => {
  const digest = crypto.createHash("sha1").update(relativePath).digest("hex");
  return `doc_${digest.slice(0, 16)}`;
};

const walkDirectory = (directoryPath) => {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
};

const chunkText = (input) => {
  const normalized = String(input || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  const paragraphs = normalized.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
    }
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_MAX_CHARS) {
      pushCurrent();
      for (let index = 0; index < paragraph.length; index += CHUNK_MAX_CHARS) {
        chunks.push(paragraph.slice(index, index + CHUNK_MAX_CHARS).trim());
      }
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > CHUNK_MAX_CHARS && current.length >= CHUNK_MIN_CHARS) {
      pushCurrent();
      current = paragraph;
      continue;
    }
    if (candidate.length > CHUNK_MAX_CHARS && current.length < CHUNK_MIN_CHARS) {
      pushCurrent();
      current = paragraph;
      continue;
    }
    current = candidate;
  }

  pushCurrent();

  if (chunks.length > 1) {
    const lastChunk = chunks[chunks.length - 1];
    const prevChunk = chunks[chunks.length - 2];
    if (lastChunk.length < CHUNK_MIN_CHARS && prevChunk.length + 2 + lastChunk.length <= CHUNK_MAX_CHARS) {
      chunks[chunks.length - 2] = `${prevChunk}\n\n${lastChunk}`;
      chunks.pop();
    }
  }

  return chunks;
};

const extractMarkdownTitle = (text, fallback) => {
  const headingMatch = text.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }
  return fallback;
};

const runIngestionScan = () => {
  ensureIngestionFiles();
  const startedAt = new Date().toISOString();
  const state = readJsonFile(ingestStatePath, { files: {}, lastScan: null });
  const previousFiles = state.files || {};
  const currentFiles = {};
  const errors = [];

  const candidateFiles = walkDirectory(workArtifactsPath)
    .filter((filePath) => allowedIngestionExts.has(path.extname(filePath).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  const changedFiles = [];
  let newDocs = 0;
  let updatedDocs = 0;

  for (const absolutePath of candidateFiles) {
    const relativePath = path.relative(dataDir, absolutePath).split(path.sep).join("/");
    const stats = fs.statSync(absolutePath);
    const docId = getDocIdForPath(relativePath);
    const metadata = {
      docId,
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      timestamp: stats.mtime.toISOString()
    };
    currentFiles[relativePath] = metadata;
    const previous = previousFiles[relativePath];
    const hasChanged = !previous || previous.mtimeMs !== metadata.mtimeMs || previous.size !== metadata.size;
    if (hasChanged) {
      changedFiles.push({ absolutePath, relativePath, metadata, isNew: !previous });
      if (!previous) {
        newDocs += 1;
      } else {
        updatedDocs += 1;
      }
    }
  }

  const deletedDocIds = Object.entries(previousFiles)
    .filter(([relativePath]) => !currentFiles[relativePath])
    .map(([, fileInfo]) => fileInfo.docId)
    .filter(Boolean);

  const { chunks: existingChunks } = readJsonFile(chunksPath, { chunks: [] });
  const changedDocIds = new Set(changedFiles.map((item) => item.metadata.docId));
  const removedDocIds = new Set(deletedDocIds);
  const retainedChunks = existingChunks.filter(
    (chunk) => !changedDocIds.has(chunk.docId) && !removedDocIds.has(chunk.docId)
  );
  const newChunks = [];

  for (const file of changedFiles) {
    try {
      const text = fs.readFileSync(file.absolutePath, "utf-8");
      const parsed = path.normalize(file.relativePath).split(path.sep);
      const [artifactRoot, spaceType = "unknown", spaceName = "unknown"] = parsed;
      if (artifactRoot !== "work_artifacts") {
        continue;
      }
      const filename = path.basename(file.relativePath);
      const fallbackTitle = filename;
      const title = path.extname(filename).toLowerCase() === ".md" ? extractMarkdownTitle(text, fallbackTitle) : fallbackTitle;
      const chunks = chunkText(text);
      chunks.forEach((chunkTextValue, index) => {
        newChunks.push({
          chunkId: `${file.metadata.docId}_c${index + 1}`,
          docId: file.metadata.docId,
          title,
          path: file.relativePath,
          spaceType,
          spaceName,
          text: chunkTextValue,
          timestamp: file.metadata.timestamp
        });
      });
    } catch (error) {
      errors.push({ file: file.relativePath, message: error.message });
    }
  }

  const chunks = [...retainedChunks, ...newChunks];
  writeJsonFile(chunksPath, { chunks });

  const result = {
    scannedFiles: candidateFiles.length,
    newDocs,
    updatedDocs,
    deletedDocs: deletedDocIds.length,
    changedDocs: changedFiles.length,
    chunksAdded: newChunks.length,
    chunkCount: chunks.length,
    errors,
    startedAt,
    finishedAt: new Date().toISOString()
  };

  writeJsonFile(ingestStatePath, {
    files: currentFiles,
    lastScan: result
  });

  return result;
};

const readSubmissions = () => {
  ensureSubmissionsFile();
  const raw = fs.readFileSync(submissionsPath, "utf-8");
  return JSON.parse(raw);
};

const writeSubmissions = (payload) => {
  fs.writeFileSync(submissionsPath, JSON.stringify(payload, null, 2));
};

const stopwords = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "is",
  "are",
  "was",
  "were",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "by",
  "at",
  "from",
  "as",
  "about",
  "this",
  "that",
  "it",
  "its",
  "our",
  "your",
  "please",
  "policy",
  "procedure",
  "项目",
  "部门",
  "流程",
  "制度",
  "规定",
  "关于",
  "如何",
  "什么",
  "哪个",
  "哪些"
]);

const tokenizeQuery = (query) => {
  if (!query) {
    return [];
  }
  const matches = query.toLowerCase().match(/[a-z0-9\u4e00-\u9fa5]+/g) || [];
  return matches.filter((term) => term && !stopwords.has(term));
};

const normalizeSpace = (value) => (value ? String(value).trim().toLowerCase() : "");

const extractChunkTimestamp = (chunk) => {
  const candidates = [
    chunk.docTimestamp,
    chunk.timestamp,
    chunk.updatedAt,
    chunk.createdAt,
    chunk.date
  ].filter(Boolean);
  if (!candidates.length) {
    return null;
  }
  const date = new Date(candidates[0]);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const scoreChunk = (chunk, terms) => {
  const haystack = `${chunk.text || ""} ${chunk.title || ""}`.toLowerCase();
  const matchCount = terms.reduce((count, term) => (haystack.includes(term) ? count + 1 : count), 0);
  const timestamp = extractChunkTimestamp(chunk);
  let recencyScore = 0;
  if (timestamp) {
    const ageDays = daysBetween(timestamp, new Date());
    recencyScore = Math.max(0, 30 - ageDays) / 30;
  }
  return matchCount * 2 + recencyScore;
};

const filterChunksByScope = (chunks, scope) => {
  if (!scope?.spaceType) {
    return chunks;
  }
  const scopeType = normalizeSpace(scope.spaceType);
  const scopeName = normalizeSpace(scope.spaceName);
  return chunks.filter((chunk) => {
    const chunkType = normalizeSpace(chunk.spaceType || chunk.space?.type);
    const chunkName = normalizeSpace(chunk.spaceName || chunk.space?.name);
    if (scopeType && chunkType !== scopeType) {
      return false;
    }
    if (scopeName && chunkName !== scopeName) {
      return false;
    }
    return true;
  });
};

const retrieveTopChunks = ({ question, scope, topK = 8 }) => {
  const { chunks } = readJsonFile(chunksPath, { chunks: [] });
  const scopedChunks = filterChunksByScope(chunks, scope);
  const terms = tokenizeQuery(question);
  const scored = scopedChunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms) }))
    .filter(({ score }) => (terms.length ? score > 0 : true))
    .sort((a, b) => b.score - a.score);
  const seen = new Set();
  const selected = [];
  for (const entry of scored) {
    const docId = entry.chunk.docId || entry.chunk.doc_id || entry.chunk.documentId;
    if (docId && seen.has(docId)) {
      continue;
    }
    if (docId) {
      seen.add(docId);
    }
    selected.push(entry.chunk);
    if (selected.length >= topK) {
      break;
    }
  }
  return selected;
};

const buildSources = (chunks) =>
  chunks.map((chunk) => ({
    docId: chunk.docId || chunk.doc_id || chunk.documentId || "unknown",
    title: chunk.title || chunk.docTitle || "Untitled",
    path: chunk.path || chunk.url || "",
    spaceType: chunk.spaceType || chunk.space?.type || "unspecified",
    spaceName: chunk.spaceName || chunk.space?.name || "",
    excerpt: chunk.excerpt || chunk.text?.slice(0, 240) || "",
    chunkId: chunk.chunkId || chunk.chunk_id || chunk.id || "chunk"
  }));

const persistContextPackage = ({ question, scope, sources }) => {
  const data = readJsonFile(contextPackagesPath, { packages: [] });
  const contextPackageId = `ctx_${Date.now()}`;
  data.packages.unshift({
    id: contextPackageId,
    query: question,
    scope,
    docIds: sources.map((source) => source.docId),
    chunkIds: sources.map((source) => source.chunkId),
    createdAt: new Date().toISOString()
  });
  writeJsonFile(contextPackagesPath, data);
  return contextPackageId;
};

const resolveScopeFromQuestion = ({ question, payloadScope, payloadProjectId, payloadProjectName }) => {
  if (payloadScope?.spaceType) {
    return payloadScope;
  }
  const { projects } = readJsonFile(projectsPath, { projects: [] });
  if (payloadProjectId) {
    const project = projects.find((item) => item.id === payloadProjectId);
    if (project) {
      return { spaceType: "project", spaceName: project.name, projectId: project.id };
    }
  }
  if (payloadProjectName) {
    const project = projects.find(
      (item) => normalizeSpace(item.name) === normalizeSpace(payloadProjectName)
    );
    if (project) {
      return { spaceType: "project", spaceName: project.name, projectId: project.id };
    }
  }
  const questionText = normalizeSpace(question);
  if (questionText) {
    const projectMatch = projects.find(
      (item) =>
        questionText.includes(normalizeSpace(item.name)) ||
        (item.id && questionText.includes(normalizeSpace(item.id)))
    );
    if (projectMatch) {
      return { spaceType: "project", spaceName: projectMatch.name, projectId: projectMatch.id };
    }
  }
  const seed = loadSeed();
  const departmentMatch = seed.departments?.find((dept) =>
    questionText.includes(normalizeSpace(dept))
  );
  if (departmentMatch) {
    return { spaceType: "department", spaceName: departmentMatch };
  }
  const policyKeywords = [
    "policy",
    "procedure",
    "handbook",
    "hr",
    "leave",
    "vacation",
    "reimbursement",
    "travel",
    "benefits",
    "attendance",
    "制度",
    "流程",
    "报销",
    "考勤",
    "人力",
    "休假"
  ];
  if (policyKeywords.some((keyword) => questionText.includes(keyword))) {
    return { spaceType: "policy", spaceName: "policy" };
  }
  return null;
};

const scopeCandidates = () => {
  const seed = loadSeed();
  const { projects } = readJsonFile(projectsPath, { projects: [] });
  const projectCandidates = projects.slice(0, 4).map((project) => ({
    spaceType: "project",
    spaceName: project.name
  }));
  const departmentCandidates = (seed.departments || []).slice(0, 4).map((dept) => ({
    spaceType: "department",
    spaceName: dept
  }));
  return [...projectCandidates, ...departmentCandidates, { spaceType: "policy", spaceName: "policy" }];
};

const enforceScopeAccess = ({ scope, session }) => {
  if (!session?.user) {
    return false;
  }
  const seed = loadSeed();
  if (session.user.role === "Admin" || seed.admins?.includes(session.user.name)) {
    return true;
  }
  if (normalizeSpace(scope?.spaceType) === "person") {
    return normalizeSpace(scope?.spaceName) === normalizeSpace(session.user.name);
  }
  const { projects } = readJsonFile(projectsPath, { projects: [] });
  if (normalizeSpace(scope?.spaceType) === "project") {
    return projects.some(
      (project) =>
        normalizeSpace(project.name) === normalizeSpace(scope.spaceName) &&
        normalizeSpace(project.owner) === normalizeSpace(session.user.name)
    );
  }
  if (normalizeSpace(scope?.spaceType) === "department") {
    return projects.some(
      (project) =>
        normalizeSpace(project.department) === normalizeSpace(scope.spaceName) &&
        normalizeSpace(project.owner) === normalizeSpace(session.user.name)
    );
  }
  return false;
};

const buildContextPackage = ({ question, scope, topK }) => {
  const chunks = retrieveTopChunks({ question, scope, topK });
  const sourcesUsed = buildSources(chunks);
  const contextPackageId = persistContextPackage({ question, scope, sources: sourcesUsed });
  return {
    sourcesUsed,
    contextPackageId,
    scopeUsed: scope,
    assumptions: [
      "Recency boost favors newer documents.",
      "No explicit time window filter applied."
    ]
  };
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

const isAdmin = (req, seed, session) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.headers["x-admin-key"] === adminKey) {
    return true;
  }
  if (!session?.user) {
    return false;
  }
  if (session.user.role === "Admin") {
    return true;
  }
  return seed.admins?.includes(session.user.name);
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

const purgeExpiredSessions = (data) => {
  const now = Date.now();
  const filtered = data.sessions.filter((session) => {
    if (!session.expiresAt) {
      return true;
    }
    return new Date(session.expiresAt).getTime() > now;
  });
  if (filtered.length !== data.sessions.length) {
    writeJsonFile(sessionsPath, { sessions: filtered });
  }
  return filtered;
};

const getSessionUser = (req) => {
  const token = req.headers["x-session-token"];
  if (!token) {
    return null;
  }
  const data = readJsonFile(sessionsPath, { sessions: [] });
  const sessions = purgeExpiredSessions(data);
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

const requireAdmin = (req, res) => {
  const session = requireAuth(req, res);
  if (!session) {
    return null;
  }
  const seed = loadSeed();
  if (!isAdmin(req, seed, session)) {
    sendJson(res, 403, { error: "Admin access required" });
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
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
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
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const exceptions = computeExceptions();
    return sendJson(res, 200, { exceptions });
  }

  if (req.method === "GET" && url.pathname === "/api/submissions") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const { submissions } = readSubmissions();
    return sendJson(res, 200, { submissions });
  }

  if (req.method === "GET" && url.pathname === "/api/my/submissions") {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }
    const { submissions } = readSubmissions();
    const mine = submissions.filter((item) => item.owner === auth.user?.name);
    return sendJson(res, 200, { submissions: mine });
  }

  if (req.method === "GET" && url.pathname === "/api/decisions") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const { decisions } = readJsonFile(decisionsPath, { decisions: [] });
    return sendJson(res, 200, { decisions });
  }

  if (req.method === "GET" && url.pathname === "/api/finance") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const { items } = readJsonFile(financePath, { items: [] });
    return sendJson(res, 200, { items });
  }

  if (req.method === "GET" && url.pathname === "/api/finance/exceptions") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const { items } = readJsonFile(financePath, { items: [] });
    const exceptions = items.filter((item) => item.exceptionReason);
    return sendJson(res, 200, { exceptions });
  }

  if (req.method === "GET" && url.pathname === "/api/compliance") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const compliance = computeCompliance();
    return sendJson(res, 200, { compliance });
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const { projects } = readJsonFile(projectsPath, { projects: [] });
    return sendJson(res, 200, { projects });
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
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
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const { users } = readJsonFile(usersPath, { users: [] });
    return sendJson(res, 200, { users });
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    const session = getSessionUser(req);
    if (!session) {
      return sendJson(res, 200, { user: null });
    }
    return sendJson(res, 200, { user: session.user, expiresAt: session.expiresAt });
  }

  if (req.method === "GET" && url.pathname === "/api/audit") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const { events } = readJsonFile(auditPath, { events: [] });
    return sendJson(res, 200, { events });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/ingest/status") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    ensureIngestionFiles();
    const state = readJsonFile(ingestStatePath, { files: {}, lastScan: null });
    const { chunks } = readJsonFile(chunksPath, { chunks: [] });
    return sendJson(res, 200, {
      chunkCount: chunks.length,
      trackedFiles: Object.keys(state.files || {}).length,
      lastScan: state.lastScan || null
    });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/ingest/scan") {
    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }
    const result = runIngestionScan();
    logAuditEvent({
      type: "ingestion_scan",
      actor: adminSession.user?.name,
      target: `new=${result.newDocs}, updated=${result.updatedDocs}, chunks=${result.chunkCount}`
    });
    return sendJson(res, 200, result);
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
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000).toISOString()
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

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }
    const data = readJsonFile(sessionsPath, { sessions: [] });
    const updated = data.sessions.filter((session) => session.token !== auth.token);
    writeJsonFile(sessionsPath, { sessions: updated });
    logAuditEvent({
      type: "logout",
      actor: auth.user?.name
    });
    return sendJson(res, 200, { status: "logged_out" });
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
      const auth = requireAdmin(req, res);
      if (!auth) {
        return;
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

  if (req.method === "POST" && url.pathname === "/api/copilot/query") {
    try {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }
      const payload = await parseBody(req);
      if (!payload.question) {
        return sendJson(res, 400, { error: "question is required" });
      }
      const scope = resolveScopeFromQuestion({
        question: payload.question,
        payloadScope: payload.scope,
        payloadProjectId: payload.projectId,
        payloadProjectName: payload.projectName
      });
      if (!scope) {
        return sendJson(res, 200, {
          needsClarification: true,
          question: "Which project or department should I search?",
          candidates: scopeCandidates()
        });
      }
      if (!enforceScopeAccess({ scope, session: auth })) {
        return sendJson(res, 403, { error: "Scope access denied for this role." });
      }
      const context = buildContextPackage({ question: payload.question, scope, topK: payload.topK || 8 });
      const answer =
        payload.mode === "retrieve_only"
          ? `Retrieved ${context.sourcesUsed.length} sources for "${payload.question}".`
          : `Retrieved ${context.sourcesUsed.length} sources. No AI synthesis configured yet.`;
      return sendJson(res, 200, {
        answer,
        sourcesUsed: context.sourcesUsed,
        contextPackageId: context.contextPackageId,
        scopeUsed: context.scopeUsed,
        assumptions: context.assumptions
      });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/playbooks/run") {
    try {
      const auth = requireAdmin(req, res);
      if (!auth) {
        return;
      }
      const payload = await parseBody(req);
      if (!payload.playbookId) {
        return sendJson(res, 400, { error: "playbookId is required" });
      }

      if (payload.playbookId === "P2_POLICY_INTERPRETER") {
        if (!payload.params?.question) {
          return sendJson(res, 400, { error: "params.question is required" });
        }
        const scope = { spaceType: "policy", spaceName: "policy" };
        const context = buildContextPackage({ question: payload.params.question, scope, topK: 8 });
        const excerpts = context.sourcesUsed.map(
          (source) => `${source.title}: ${source.excerpt}`
        );
        const nextActions = [
          "Confirm the interpretation with HR or policy owner.",
          "Check for recent updates or exceptions.",
          "Document decision and communicate to stakeholders."
        ];
        const system = [
          "PLAYBOOK:P2_POLICY_INTERPRETER",
          "You are a policy interpreter. Use the provided excerpts and cite them."
        ].join("\n");
        const user = JSON.stringify({
          question: payload.params.question,
          excerpts,
          nextActions
        });
        const response = await generate({ system, user, temperature: 0.2 });
        return sendJson(res, 200, {
          recommendation: response.text,
          keyNumbers: {},
          assumptions: context.assumptions,
          sourcesUsed: context.sourcesUsed,
          nextActions
        });
      }

      if (payload.playbookId === "P3_PROJECT_HEALTH") {
        if (!payload.params?.projectId) {
          return sendJson(res, 400, { error: "params.projectId is required" });
        }
        const { projects } = readJsonFile(projectsPath, { projects: [] });
        const project =
          projects.find((item) => item.id === payload.params.projectId) ||
          projects.find(
            (item) =>
              normalizeSpace(item.name) === normalizeSpace(payload.params.projectId)
          );
        if (!project) {
          return sendJson(res, 404, { error: "Project not found" });
        }
        const { tasks } = readJsonFile(tasksPath, { tasks: [] });
        const { decisions } = readJsonFile(decisionsPath, { decisions: [] });
        const { submissions } = readSubmissions();
        const exceptions = computeExceptions();
        const updates = submissions
          .filter((item) => item.type === "project_update" && item.project === project.name)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latestUpdate = updates[0];
        const missedCadence = exceptions.some(
          (item) => item.project === project.name && item.type === "missed_cadence"
        );
        const blockedTasks = tasks.filter(
          (task) => task.project === project.name && task.status === "Blocked"
        );
        const blockerNote = latestUpdate?.blockers && latestUpdate.blockers !== "None";
        const blockersCount = blockedTasks.length + (blockerNote ? 1 : 0);
        const nextDueDate = latestUpdate?.nextDueDate ? new Date(latestUpdate.nextDueDate) : null;
        const overdueMilestones =
          nextDueDate && !Number.isNaN(nextDueDate.getTime()) && nextDueDate < new Date();
        const decisionNeeded =
          latestUpdate?.decisionNeeded?.toLowerCase() === "y" ||
          decisions.some((item) => item.project === project.name);
        const lastUpdate = latestUpdate?.createdAt || null;
        const lastUpdateDaysAgo = lastUpdate ? daysBetween(new Date(lastUpdate), new Date()) : null;
        let health = "green";
        if (missedCadence || overdueMilestones || blockersCount > 0) {
          health = "red";
        } else if (decisionNeeded) {
          health = "yellow";
        }
        const nextActions = [];
        if (missedCadence) {
          nextActions.push("Request the latest project update from the owner.");
        }
        if (blockersCount > 0) {
          nextActions.push("Review blockers and assign owners to unblock items.");
        }
        if (overdueMilestones) {
          nextActions.push("Re-baseline the next milestone due date.");
        }
        if (decisionNeeded) {
          nextActions.push("Schedule decision review with stakeholders.");
        }
        while (nextActions.length < 3) {
          nextActions.push("Confirm progress and update the project tracker.");
        }
        const scope = { spaceType: "project", spaceName: project.name, projectId: project.id };
        const context = buildContextPackage({
          question: `Project health for ${project.name}`,
          scope,
          topK: 8
        });
        const system = [
          "PLAYBOOK:P3_PROJECT_HEALTH",
          "Summarize project health using provided metrics and evidence. Cite sources."
        ].join("\n");
        const user = JSON.stringify({
          project: { id: project.id, name: project.name },
          metrics: {
            health,
            lastUpdate,
            lastUpdateDaysAgo,
            missedCadence,
            blockersCount,
            overdueMilestones,
            decisionNeeded
          },
          evidence: context.sourcesUsed.map(
            (source) => `${source.title}: ${source.excerpt}`
          ),
          nextActions
        });
        const response = await generate({ system, user, temperature: 0.2 });
        return sendJson(res, 200, {
          recommendation: response.text,
          keyNumbers: {
            health,
            lastUpdate,
            lastUpdateDaysAgo,
            missedCadence,
            blockersCount,
            overdueMilestones,
            decisionNeeded
          },
          assumptions: context.assumptions,
          sourcesUsed: context.sourcesUsed,
          nextActions
        });
      }

      return sendJson(res, 400, { error: "Unknown playbookId" });
    } catch (error) {
      return sendJson(res, 400, { error: "Invalid JSON payload" });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/actions") {
    try {
      const auth = requireAdmin(req, res);
      if (!auth) {
        return;
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
      const auth = requireAdmin(req, res);
      if (!auth) {
        return;
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
      const auth = requireAdmin(req, res);
      if (!auth) {
        return;
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
      const auth = requireAdmin(req, res);
      if (!auth) {
        return;
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

ensureIngestionFiles();

server.listen(port, () => {
  console.log(`ProteinT-OS MVP running at http://localhost:${port}`);
});
