import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");

const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf-8"));

const escapeSql = (value) => {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
};

const insertRows = (table, columns, rows) => {
  if (!rows.length) {
    return "";
  }
  const values = rows
    .map((row) => `(${columns.map((col) => escapeSql(row[col])).join(", ")})`)
    .join(",\n");
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};\n`;
};

const users = readJson("users.json").users || [];
const projects = readJson("projects.json").projects || [];
const tasks = readJson("tasks.json").tasks || [];
const decisions = readJson("decisions.json").decisions || [];
const submissions = readJson("submissions.json").submissions || [];
const audits = readJson("audit.json").events || [];

const projectUpdates = submissions.filter((item) => item.type === "project_update");
const meetingMemos = submissions.filter((item) => item.type === "meeting_memo");

let sql = "-- Generated seed data from JSON files\n\n";

sql += insertRows(
  "users",
  ["id", "name", "name_zh", "role", "created_at"],
  users.map((user) => ({
    id: user.id,
    name: user.name,
    name_zh: user.nameZh,
    role: user.role,
    created_at: user.createdAt
  }))
);

sql += insertRows(
  "projects",
  ["id", "name", "owner", "tier", "department", "status", "milestone", "created_at"],
  projects.map((project) => ({
    id: project.id,
    name: project.name,
    owner: project.owner,
    tier: project.tier,
    department: project.department,
    status: project.status,
    milestone: project.milestone,
    created_at: project.createdAt
  }))
);

sql += insertRows(
  "project_updates",
  [
    "id",
    "project",
    "owner",
    "tier",
    "current_milestone",
    "progress",
    "evidence_link",
    "next_milestone",
    "next_due_date",
    "blockers",
    "decision_needed",
    "decision_summary",
    "cost",
    "expected_value",
    "created_at"
  ],
  projectUpdates.map((update) => ({
    id: update.id,
    project: update.project,
    owner: update.owner,
    tier: update.tier,
    current_milestone: update.currentMilestone,
    progress: update.progress,
    evidence_link: update.evidenceLink,
    next_milestone: update.nextMilestone,
    next_due_date: update.nextDueDate,
    blockers: update.blockers,
    decision_needed: update.decisionNeeded,
    decision_summary: update.decisionSummary,
    cost: update.cost,
    expected_value: update.expectedValue,
    created_at: update.createdAt
  }))
);

sql += insertRows(
  "meeting_memos",
  ["id", "owner", "context", "decisions", "actions", "risks", "follow_ups", "created_at"],
  meetingMemos.map((memo) => ({
    id: memo.id,
    owner: memo.owner,
    context: memo.context,
    decisions: memo.decisions,
    actions: memo.actions,
    risks: memo.risks,
    follow_ups: memo.followUps,
    created_at: memo.createdAt
  }))
);

sql += insertRows(
  "tasks",
  ["id", "title", "owner", "project", "status", "evidence_link", "created_at"],
  tasks.map((task) => ({
    id: task.id,
    title: task.title,
    owner: task.owner,
    project: task.project,
    status: task.status,
    evidence_link: task.evidenceLink,
    created_at: task.createdAt
  }))
);

sql += insertRows(
  "decisions",
  ["id", "project", "owner", "summary", "created_at"],
  decisions.map((decision) => ({
    id: decision.id,
    project: decision.project,
    owner: decision.owner,
    summary: decision.summary,
    created_at: decision.createdAt
  }))
);

sql += insertRows(
  "audit_events",
  ["id", "type", "actor", "project", "target", "created_at"],
  audits.map((event) => ({
    id: event.id,
    type: event.type,
    actor: event.actor,
    project: event.project,
    target: event.target,
    created_at: event.createdAt
  }))
);

process.stdout.write(sql);
