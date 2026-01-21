const loadConfig = async () => {
  const response = await fetch("/api/config");
  return response.json();
};

const loadDigest = async () => {
  const response = await fetch("/api/digest/daily");
  return response.json();
};

const loadSubmissions = async () => {
  const response = await fetch("/api/submissions");
  return response.json();
};

const loadProjects = async () => {
  const response = await fetch("/api/projects");
  return response.json();
};

const loadTasks = async () => {
  const response = await fetch("/api/tasks");
  return response.json();
};

const loadMyTasks = async () => {
  const sessionToken = sessionStorage.getItem("sessionToken");
  const response = await fetch("/api/my/tasks", {
    headers: {
      ...(sessionToken ? { "x-session-token": sessionToken } : {})
    }
  });
  return response.json();
};

const loadCurrentUser = async () => {
  const sessionToken = sessionStorage.getItem("sessionToken");
  const response = await fetch("/api/me", {
    headers: {
      ...(sessionToken ? { "x-session-token": sessionToken } : {})
    }
  });
  return response.json();
};

const loadExceptions = async () => {
  const response = await fetch("/api/exceptions");
  return response.json();
};

const loadDecisions = async () => {
  const response = await fetch("/api/decisions");
  return response.json();
};

const loadCompliance = async () => {
  const response = await fetch("/api/compliance");
  return response.json();
};

const loadFinanceExceptions = async () => {
  const response = await fetch("/api/finance/exceptions");
  return response.json();
};

const loadAudit = async () => {
  const response = await fetch("/api/audit");
  return response.json();
};

const submitJson = async (url, payload) => {
  const adminKey = sessionStorage.getItem("adminKey");
  const sessionToken = sessionStorage.getItem("sessionToken");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(adminKey ? { "x-admin-key": adminKey } : {}),
      ...(sessionToken ? { "x-session-token": sessionToken } : {})
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Submission failed");
  }
  return response.json();
};

const renderSubmissions = (items) => {
  const list = document.getElementById("submissionsList");
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No submissions yet.";
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.type.replace("_", " ")} • ${item.project || item.context || "—"}`;
    const meta = document.createElement("p");
    meta.textContent = `Owner: ${item.owner || "—"} • ${new Date(item.createdAt).toLocaleString()}`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderProjects = (items) => {
  const list = document.getElementById("projectsList");
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No projects yet.";
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.name} • ${item.tier}`;
    const meta = document.createElement("p");
    meta.textContent = `Owner: ${item.owner || "—"} • ${item.department || "—"}`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderTasks = (items) => {
  const list = document.getElementById("tasksList");
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No tasks yet.";
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.title} • ${item.status}`;
    const meta = document.createElement("p");
    meta.textContent = `Owner: ${item.owner || "—"} • Project: ${item.project || "—"}`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderMyDueItems = (items, userName) => {
  const list = document.getElementById("myDueItems");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  if (!userName) {
    list.textContent = "Log in to see your items.";
    return;
  }
  const mine = items.filter((item) => item.owner === userName);
  if (!mine.length) {
    list.textContent = "No submissions yet.";
    return;
  }
  mine.slice(0, 5).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.project || "Project"} • ${item.tier || "—"}`;
    const meta = document.createElement("p");
    meta.textContent = `Progress: ${item.progress || "—"} • Next: ${item.nextMilestone || "—"}`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderMyTasks = (items) => {
  const list = document.getElementById("myTasksList");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No tasks assigned.";
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.title} • ${item.status}`;
    const meta = document.createElement("p");
    meta.textContent = `ID: ${item.id} • Project: ${item.project}`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderExceptions = (items) => {
  const list = document.getElementById("exceptionsList");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No exceptions right now.";
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.project} • ${item.type}`;
    const meta = document.createElement("p");
    meta.textContent = `Owner: ${item.owner || "—"} • ${item.detail}`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderDecisions = (items) => {
  const list = document.getElementById("decisionsList");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No decisions queued.";
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.project} • Decision`;
    const meta = document.createElement("p");
    meta.textContent = `${item.summary || "Decision needed"} • ${item.owner || "—"}`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderCompliance = (items) => {
  const list = document.getElementById("complianceList");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No compliance data yet.";
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.department} • ${item.rate}%`;
    const meta = document.createElement("p");
    meta.textContent = `${item.compliant}/${item.total} projects compliant`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderAudit = (items) => {
  const list = document.getElementById("auditList");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No audit events yet.";
    return;
  }
  items.slice(0, 8).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.type} • ${item.actor || "system"}`;
    const meta = document.createElement("p");
    meta.textContent = `${item.project || item.target || ""} ${new Date(item.createdAt).toLocaleString()}`.trim();
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const renderFinanceExceptions = (items) => {
  const list = document.getElementById("financeExceptionsList");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "No finance exceptions.";
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-item";
    const title = document.createElement("h3");
    title.textContent = `${item.vendor} • ${item.amount}`;
    const meta = document.createElement("p");
    meta.textContent = `${item.docType} • ${item.exceptionReason}`;
    card.appendChild(title);
    card.appendChild(meta);
    list.appendChild(card);
  });
};

const render = async () => {
  const config = await loadConfig();
  const digest = await loadDigest();
  const submissions = await loadSubmissions();
  const projects = await loadProjects();
  const tasks = await loadTasks();
  const exceptions = await loadExceptions();
  const decisions = await loadDecisions();
  const compliance = await loadCompliance();
  const financeExceptions = await loadFinanceExceptions();
  const audit = await loadAudit();
  const myTasks = await loadMyTasks();
  const me = await loadCurrentUser();

  const adminName = document.getElementById("adminName");
  const wecomScope = document.getElementById("wecomScope");
  const departments = document.getElementById("departments");

  adminName.textContent = `${config.admin.name} / ${config.admin.nameZh}`;
  wecomScope.textContent = config.integrations.wecom.scope.join(", ");

  departments.innerHTML = "";
  config.departments.forEach((dept) => {
    const span = document.createElement("span");
    span.className = "pill";
    span.textContent = dept;
    if (config.pilotDepartments.includes(dept)) {
      span.classList.add("pilot");
    }
    departments.appendChild(span);
  });

  document.getElementById("digestTotal").textContent = digest.totals.submissions;
  document.getElementById("digestUpdates").textContent = digest.totals.projectUpdates;
  document.getElementById("digestMemos").textContent = digest.totals.meetingMemos;

  renderSubmissions(submissions.submissions);
  renderProjects(projects.projects);
  renderTasks(tasks.tasks);
  renderMyDueItems(submissions.submissions, sessionStorage.getItem("sessionUser"));
  renderExceptions(exceptions.exceptions);
  renderDecisions(decisions.decisions);
  renderCompliance(compliance.compliance);
  renderFinanceExceptions(financeExceptions.exceptions);
  renderAudit(audit.events);
  renderMyTasks(myTasks.tasks);

  const projectForm = document.getElementById("projectForm");
  const memoForm = document.getElementById("memoForm");
  const projectRegistryForm = document.getElementById("projectRegistryForm");
  const taskForm = document.getElementById("taskForm");
  const loginForm = document.getElementById("loginForm");
  const loginStatus = document.getElementById("loginStatus");
  const interfaceMode = document.getElementById("interfaceMode");
  const taskUpdateForm = document.getElementById("taskUpdateForm");
  const financeForm = document.getElementById("financeForm");

  const updateLoginStatus = () => {
    const userName = sessionStorage.getItem("sessionUser");
    if (!userName) {
      loginStatus.textContent = "Not logged in";
      interfaceMode.textContent = "Reporter";
      document.querySelectorAll("[data-role='admin']").forEach((section) => {
        section.classList.add("hidden");
      });
      document.querySelectorAll("[data-role='reporter']").forEach((section) => {
        section.classList.remove("hidden");
      });
      return;
    }
    loginStatus.textContent = `Logged in as ${userName}`;
    if (me.user?.role === "Admin") {
      interfaceMode.textContent = "Admin";
      document.querySelectorAll("[data-role='admin']").forEach((section) => {
        section.classList.remove("hidden");
      });
      document.querySelectorAll("[data-role='reporter']").forEach((section) => {
        section.classList.add("hidden");
      });
    } else {
      interfaceMode.textContent = "Reporter";
      document.querySelectorAll("[data-role='admin']").forEach((section) => {
        section.classList.add("hidden");
      });
      document.querySelectorAll("[data-role='reporter']").forEach((section) => {
        section.classList.remove("hidden");
      });
    }
  };

  updateLoginStatus();

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());
    const response = await submitJson("/api/auth/wecom/mock", payload);
    sessionStorage.setItem("sessionToken", response.token);
    sessionStorage.setItem("sessionUser", response.user.name);
    window.location.reload();
    loginForm.reset();
  });

  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(projectForm);
    const payload = Object.fromEntries(formData.entries());
    await submitJson("/api/submissions/project-update", payload);
    projectForm.reset();
    const refreshed = await loadSubmissions();
    renderSubmissions(refreshed.submissions);
  });

  memoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(memoForm);
    const payload = Object.fromEntries(formData.entries());
    await submitJson("/api/submissions/meeting-memo", payload);
    memoForm.reset();
    const refreshed = await loadSubmissions();
    renderSubmissions(refreshed.submissions);
  });

  projectRegistryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(projectRegistryForm);
    const payload = Object.fromEntries(formData.entries());
    await submitJson("/api/projects", payload);
    projectRegistryForm.reset();
    const refreshed = await loadProjects();
    renderProjects(refreshed.projects);
  });

  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(taskForm);
    const payload = Object.fromEntries(formData.entries());
    await submitJson("/api/tasks", payload);
    taskForm.reset();
    const refreshed = await loadTasks();
    renderTasks(refreshed.tasks);
  });

  taskUpdateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(taskUpdateForm);
    const payload = Object.fromEntries(formData.entries());
    await submitJson("/api/tasks/update", payload);
    taskUpdateForm.reset();
    const refreshed = await loadMyTasks();
    renderMyTasks(refreshed.tasks);
  });

  financeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(financeForm);
    const payload = Object.fromEntries(formData.entries());
    await submitJson("/api/finance", payload);
    financeForm.reset();
    const refreshed = await loadFinanceExceptions();
    renderFinanceExceptions(refreshed.exceptions);
  });
};

render().catch((error) => {
  console.error("Failed to load dashboard data", error);
});
