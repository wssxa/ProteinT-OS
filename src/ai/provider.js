const provider = process.env.AI_PROVIDER || "none";
const openAiKey = process.env.OPENAI_API_KEY;

const parseUserPayload = (user) => {
  if (!user) {
    return null;
  }
  if (typeof user === "object") {
    return user;
  }
  const trimmed = String(user).trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return null;
    }
  }
  return null;
};

const formatPolicyFallback = (payload) => {
  const excerpts = payload?.excerpts || [];
  const excerptLines = excerpts.length
    ? excerpts.map((item, index) => `- [${index + 1}] ${item}`).join("\n")
    : "- No matching policy excerpts found.";
  return [
    "Policy Interpreter (fallback)",
    "",
    "Key excerpts:",
    excerptLines,
    "",
    "Human review required before acting on this guidance.",
    "",
    "Suggested next steps:",
    payload?.nextActions?.length
      ? payload.nextActions.map((action) => `- ${action}`).join("\n")
      : "- Confirm with policy owner or HR."
  ].join("\n");
};

const formatProjectHealthFallback = (payload) => {
  const project = payload?.project || {};
  const metrics = payload?.metrics || {};
  const evidence = payload?.evidence || [];
  const evidenceLines = evidence.length
    ? evidence.map((item, index) => `- [${index + 1}] ${item}`).join("\n")
    : "- No evidence sources found.";
  return [
    `Project Health (fallback) — ${project.name || "Unknown Project"}`,
    "",
    `Health status: ${metrics.health || "unknown"}`,
    `Last update: ${metrics.lastUpdate || "n/a"}`,
    `Missed cadence: ${metrics.missedCadence ? "Yes" : "No"}`,
    `Blockers: ${metrics.blockersCount ?? 0}`,
    `Overdue milestones: ${metrics.overdueMilestones ? "Yes" : "No"}`,
    `Decision needed: ${metrics.decisionNeeded ? "Yes" : "No"}`,
    "",
    "Evidence used:",
    evidenceLines,
    "",
    "Next actions:",
    payload?.nextActions?.length
      ? payload.nextActions.map((action) => `- ${action}`).join("\n")
      : "- No next actions identified."
  ].join("\n");
};

const fallbackGenerate = ({ system, user }) => {
  const payload = parseUserPayload(user) || {};
  if (system?.includes("P2_POLICY_INTERPRETER")) {
    return { text: formatPolicyFallback(payload) };
  }
  if (system?.includes("P3_PROJECT_HEALTH")) {
    return { text: formatProjectHealthFallback(payload) };
  }
  return { text: "AI provider not configured. Enable AI_PROVIDER and API key to generate responses." };
};

export const generate = async ({ system, user, temperature = 0.2, jsonSchema }) => {
  if (provider !== "openai" || !openAiKey) {
    return fallbackGenerate({ system, user });
  }

  const model = process.env.OPENAI_MODEL_STANDARD || "gpt-4o-mini";
  const payload = {
    model,
    temperature,
    messages: [
      { role: "system", content: system || "" },
      { role: "user", content: typeof user === "string" ? user : JSON.stringify(user) }
    ]
  };

  if (jsonSchema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: jsonSchema
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return fallbackGenerate({ system, user });
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return {
    text,
    usage: data.usage
  };
};
