const QUADRANTS = {
  q1: { title: "重要且紧急", subtitle: "马上推进，减少拖延成本" },
  q2: { title: "重要不紧急", subtitle: "长期价值区，适合持续投入" },
  q3: { title: "不重要但紧急", subtitle: "快速处理，避免占用主注意力" },
  q4: { title: "不重要不紧急", subtitle: "可延后、删除，或降低频率" }
};

const STATUSES = {
  todo: "待办",
  done: "已完成",
  archived: "已归档"
};

const AREAS = {
  finance: "金融",
  health: "健康",
  reading: "阅读",
  learning: "学习",
  work: "工作",
  life: "生活",
  other: "其他"
};

const GOAL_STATUSES = {
  active: "进行中",
  done: "已完成",
  paused: "已搁置"
};

const state = {
  env: { appName: "Quadrant Todo", publicRegistration: true },
  user: null,
  view: "board",
  tasks: [],
  goals: [],
  pendingTaskIds: new Set(),
  pendingGoalIds: new Set(),
  authMode: "login",
  activeTaskId: null,
  sheetDraft: null,
  activeGoalId: null,
  goalSheetDraft: null,
  focusComposer: null,
  message: "",
  messageType: "info",
  busy: false
};

const app = document.getElementById("app");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function setMessage(text, type = "info") {
  state.message = text;
  state.messageType = type;
  render();
}

function clearMessage() {
  state.message = "";
}

function getCounts() {
  const total = state.tasks.length;
  const todo = state.tasks.filter((task) => task.status === "todo").length;
  const done = state.tasks.filter((task) => task.status === "done").length;
  const q2 = state.tasks.filter((task) => task.quadrant === "q2").length;
  return { total, todo, done, q2 };
}

function groupTasks() {
  const groups = { q1: [], q2: [], q3: [], q4: [] };
  state.tasks.forEach((task) => {
    groups[task.quadrant].push(task);
  });
  Object.values(groups).forEach((list) => {
    list.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  });
  return groups;
}

function getGoalCounts() {
  const total = state.goals.length;
  const active = state.goals.filter((goal) => goal.status === "active").length;
  const done = state.goals.filter((goal) => goal.status === "done").length;
  return { total, active, done };
}

function groupGoals() {
  const groups = {};
  Object.keys(AREAS).forEach((area) => {
    groups[area] = [];
  });
  state.goals.forEach((goal) => {
    (groups[goal.area] || groups.other).push(goal);
  });
  Object.values(groups).forEach((list) => {
    list.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  });
  return groups;
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString("zh-CN");
}

function renderBanner() {
  if (!state.message) {
    return "";
  }
  return `<div class="banner ${state.messageType}">${escapeHtml(state.message)}</div>`;
}

function renderAuthView() {
  const canRegister = state.env.publicRegistration;

  return `
    <div class="shell">
      <div class="auth-wrap">
        <div class="hero">
          <span class="status-chip">四象限任务系统</span>
          <h1>${escapeHtml(state.env.appName)}</h1>
          <p>把事务按重要性与紧急性拆开，减少被琐事裹挟的感觉。</p>
        </div>
        <div class="auth-panel">
          <div class="auth-tabs">
            <button class="ghost-btn auth-tab ${state.authMode === "login" ? "active" : ""}" data-auth-mode="login">登录</button>
            ${canRegister ? `<button class="ghost-btn auth-tab ${state.authMode === "register" ? "active" : ""}" data-auth-mode="register">注册</button>` : ""}
          </div>
          ${state.authMode === "register" && canRegister ? renderRegisterForm() : renderLoginForm()}
          ${renderBanner()}
        </div>
      </div>
    </div>
  `;
}

function renderLoginForm() {
  return `
    <form id="login-form">
      <div class="field">
        <label for="login-username">用户名</label>
        <input id="login-username" name="username" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="login-password">密码</label>
        <input id="login-password" name="password" type="password" autocomplete="current-password" required />
      </div>
      <button class="button" type="submit">${state.busy ? "登录中..." : "登录"}</button>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <form id="register-form">
      <div class="field">
        <label for="register-display-name">显示名称</label>
        <input id="register-display-name" name="displayName" maxlength="40" required />
      </div>
      <div class="field">
        <label for="register-username">用户名</label>
        <input id="register-username" name="username" minlength="3" maxlength="24" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="register-password">密码</label>
        <input id="register-password" name="password" type="password" minlength="8" autocomplete="new-password" required />
      </div>
      <div class="field">
        <label for="register-email">邮箱（可选）</label>
        <input id="register-email" name="email" type="email" autocomplete="email" />
      </div>
      <button class="button" type="submit">${state.busy ? "注册中..." : "注册并开始使用"}</button>
    </form>
  `;
}

function renderTaskCard(task) {
  const isDone = task.status === "done";
  const isPending = state.pendingTaskIds.has(task.id);
  const isToggleDisabled = task.status === "archived" || isPending;
  const toggleLabel = isDone ? "取消完成" : "标记完成";
  return `
    <article class="task-card ${isDone ? "task-card-done" : ""} ${isPending ? "task-card-pending" : ""}">
      <div class="card-head">
        <div class="task-title-row">
          <button
            class="task-check ${isDone ? "checked" : ""} ${isToggleDisabled ? "disabled" : ""} ${isPending ? "pending" : ""}"
            type="button"
            data-toggle-done="${task.id}"
            aria-label="${isPending ? "正在同步" : toggleLabel}"
            ${isToggleDisabled ? "disabled" : ""}
          >
            <span class="task-check-box" aria-hidden="true">${isDone ? "✓" : ""}</span>
          </button>
          <h4>${escapeHtml(task.title)}</h4>
        </div>
        <span class="stat-badge ${task.status}">${escapeHtml(STATUSES[task.status])}</span>
      </div>
      <p class="task-desc">${task.description ? escapeHtml(task.description) : "暂无备注"}</p>
      <div class="task-meta">
        <span class="muted">更新于 ${new Date(task.updated_at).toLocaleString("zh-CN", { hour12: false })}</span>
      </div>
      <div class="task-actions">
        <button class="mini-btn" data-open-task="${task.id}">编辑</button>
      </div>
    </article>
  `;
}

function renderBoard() {
  const groups = groupTasks();
  return `
    <section class="board">
      ${Object.entries(QUADRANTS).map(([key, meta]) => `
        <section class="quad">
          <div class="quad-head">
            <div>
              <h3 class="quad-title">${meta.title}</h3>
              <p class="quad-subtitle">${meta.subtitle}</p>
            </div>
            <span class="status-chip">${groups[key].length} 项</span>
          </div>
          <div class="task-list">
            ${groups[key].length ? groups[key].map(renderTaskCard).join("") : '<div class="empty">这里还没有任务，先放一件最想推进的事进来。</div>'}
          </div>
          <form class="inline-add" data-quad-add="${key}">
            <input class="inline-add-input" id="composer-input-${key}" name="title" maxlength="120" autocomplete="off" placeholder="+ 添加任务，回车保存" />
          </form>
        </section>
      `).join("")}
    </section>
  `;
}

function renderTaskSheet() {
  const task = state.tasks.find((item) => item.id === state.activeTaskId);
  if (!task) {
    return "";
  }

  const draft = state.sheetDraft || {
    title: task.title,
    description: task.description || "",
    quadrant: task.quadrant,
    status: task.status
  };

  return `
    <div class="overlay" data-close-sheet="true">
      <div class="sheet">
        <div class="sheet-head">
          <div>
            <h3>编辑任务</h3>
            <p class="muted">这张卡片里集中调整象限、状态和内容。</p>
          </div>
          <button class="ghost-btn" data-close-sheet="true">关闭</button>
        </div>
        <form id="task-edit-form" data-task-id="${task.id}">
          <div class="field">
            <label for="edit-title">标题</label>
            <input id="edit-title" name="title" maxlength="120" value="${escapeHtml(draft.title)}" required />
          </div>
          <div class="field">
            <label for="edit-description">备注</label>
            <textarea id="edit-description" name="description" maxlength="2000">${escapeHtml(draft.description || "")}</textarea>
          </div>
          <div class="field">
            <label>所在象限</label>
            <div class="selector-group">
              ${Object.entries(QUADRANTS).map(([key, meta]) => `
                <button type="button" class="selector ${draft.quadrant === key ? "active" : ""}" data-pick-quadrant="${key}">
                  ${meta.title}
                </button>
              `).join("")}
            </div>
            <input type="hidden" name="quadrant" value="${draft.quadrant}" />
          </div>
          <div class="field">
            <label>状态</label>
            <div class="selector-group">
              ${Object.entries(STATUSES).map(([key, label]) => `
                <button type="button" class="selector ${draft.status === key ? "active" : ""}" data-pick-status="${key}">
                  ${label}
                </button>
              `).join("")}
            </div>
            <input type="hidden" name="status" value="${draft.status}" />
          </div>
          <div class="footer-actions">
            <button class="danger-btn" type="button" data-delete-task="${task.id}">删除任务</button>
            <div class="row-inline">
              <button class="ghost-btn" type="button" data-close-sheet="true">取消</button>
              <button class="button" type="submit">保存变更</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderGoalCard(goal) {
  const isPending = state.pendingGoalIds.has(goal.id);
  const progress = Math.max(0, Math.min(100, goal.progress || 0));
  const targetText = goal.target_date ? `目标日期 ${formatDate(goal.target_date)}` : "未设目标日期";
  return `
    <article class="goal-card ${goal.status} ${isPending ? "goal-card-pending" : ""}">
      <div class="card-head">
        <h4>${escapeHtml(goal.title)}</h4>
        <span class="stat-badge goal-status-${goal.status}">${escapeHtml(GOAL_STATUSES[goal.status])}</span>
      </div>
      <p class="task-desc">${goal.description ? escapeHtml(goal.description) : "暂无备注"}</p>
      <div class="progress">
        <div class="progress-bar" style="width: ${progress}%"></div>
      </div>
      <div class="goal-progress-row">
        <span class="muted">${progress}%</span>
        <div class="row-inline">
          <button class="mini-btn" data-goal-progress="${goal.id}" data-delta="-10" ${isPending || progress <= 0 ? "disabled" : ""}>-10</button>
          <button class="mini-btn" data-goal-progress="${goal.id}" data-delta="10" ${isPending || progress >= 100 ? "disabled" : ""}>+10</button>
        </div>
      </div>
      <div class="task-meta">
        <span class="muted">${escapeHtml(targetText)}</span>
      </div>
      <div class="task-actions">
        <button class="mini-btn" data-open-goal="${goal.id}">编辑</button>
      </div>
    </article>
  `;
}

function renderGoalsView() {
  const groups = groupGoals();
  const activeAreas = Object.keys(AREAS).filter((area) => groups[area].length);
  return `
    <section class="goal-board">
      ${
        activeAreas.length
          ? activeAreas
              .map(
                (area) => `
        <section class="goal-area">
          <div class="quad-head">
            <h3 class="quad-title"><span class="area-badge area-${area}">${AREAS[area]}</span></h3>
            <span class="status-chip">${groups[area].length} 项</span>
          </div>
          <div class="goal-list">
            ${groups[area].map(renderGoalCard).join("")}
          </div>
          <form class="inline-add" data-area-add="${area}">
            <input class="inline-add-input" id="goal-composer-input-${area}" name="title" maxlength="120" autocomplete="off" placeholder="+ 添加目标，回车保存" />
          </form>
        </section>
      `
              )
              .join("")
          : '<div class="empty">还没有长期目标。在左侧添加一个，比如“读完《xx》”或“系统学完金融基础”。</div>'
      }
    </section>
  `;
}

function renderGoalSheet() {
  const goal = state.goals.find((item) => item.id === state.activeGoalId);
  if (!goal) {
    return "";
  }

  const draft =
    state.goalSheetDraft || {
      title: goal.title,
      description: goal.description || "",
      area: goal.area,
      status: goal.status,
      progress: goal.progress || 0,
      targetDate: goal.target_date || ""
    };

  return `
    <div class="overlay" data-close-goal-sheet="true">
      <div class="sheet">
        <div class="sheet-head">
          <div>
            <h3>编辑目标</h3>
            <p class="muted">调整领域、状态、进度与目标日期。</p>
          </div>
          <button class="ghost-btn" data-close-goal-sheet="true">关闭</button>
        </div>
        <form id="goal-edit-form" data-goal-id="${goal.id}">
          <div class="field">
            <label for="goal-edit-title">标题</label>
            <input id="goal-edit-title" name="title" maxlength="120" value="${escapeHtml(draft.title)}" required />
          </div>
          <div class="field">
            <label for="goal-edit-description">备注</label>
            <textarea id="goal-edit-description" name="description" maxlength="2000">${escapeHtml(draft.description || "")}</textarea>
          </div>
          <div class="field">
            <label>所属领域</label>
            <div class="selector-group">
              ${Object.entries(AREAS)
                .map(
                  ([key, label]) => `
                <button type="button" class="selector ${draft.area === key ? "active" : ""}" data-pick-area="${key}">
                  ${label}
                </button>
              `
                )
                .join("")}
            </div>
            <input type="hidden" name="area" value="${draft.area}" />
          </div>
          <div class="field">
            <label>状态</label>
            <div class="selector-group">
              ${Object.entries(GOAL_STATUSES)
                .map(
                  ([key, label]) => `
                <button type="button" class="selector ${draft.status === key ? "active" : ""}" data-pick-goal-status="${key}">
                  ${label}
                </button>
              `
                )
                .join("")}
            </div>
            <input type="hidden" name="status" value="${draft.status}" />
          </div>
          <div class="field">
            <label for="goal-edit-progress">进度：${draft.progress || 0}%</label>
            <input id="goal-edit-progress" name="progress" type="range" min="0" max="100" step="5" value="${draft.progress || 0}" />
          </div>
          <div class="field">
            <label for="goal-edit-target">目标日期（可选）</label>
            <input id="goal-edit-target" name="targetDate" type="date" value="${escapeHtml(draft.targetDate || "")}" />
          </div>
          <div class="footer-actions">
            <button class="danger-btn" type="button" data-delete-goal="${goal.id}">删除目标</button>
            <div class="row-inline">
              <button class="ghost-btn" type="button" data-close-goal-sheet="true">取消</button>
              <button class="button" type="submit">保存变更</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderTabs() {
  const tabs = [
    { key: "board", label: "四象限" },
    { key: "goals", label: "目标" }
  ];
  return `
    <div class="tabs">
      ${tabs
        .map(
          (tab) => `
        <button class="tab ${state.view === tab.key ? "active" : ""}" data-view="${tab.key}">${tab.label}</button>
      `
        )
        .join("")}
    </div>
  `;
}

function renderBoardSide() {
  const counts = getCounts();
  return `
    <aside class="panel">
      <div class="field">
        <h3>今日概览</h3>
        <p class="muted">让你快速判断今天更像是“推进”还是“救火”。</p>
      </div>
      <div class="summary-grid">
        <div class="summary-card">
          <span class="muted">全部任务</span>
          <strong>${counts.total}</strong>
        </div>
        <div class="summary-card">
          <span class="muted">待完成</span>
          <strong>${counts.todo}</strong>
        </div>
        <div class="summary-card">
          <span class="muted">已完成</span>
          <strong>${counts.done}</strong>
        </div>
        <div class="summary-card">
          <span class="muted">Q2 重点</span>
          <strong>${counts.q2}</strong>
        </div>
      </div>
      <p class="muted hint">直接在每个象限底部输入即可新增任务，回车保存。要补备注或调整状态，点卡片上的“编辑”。</p>
    </aside>
  `;
}

function renderGoalsSide() {
  const counts = getGoalCounts();
  return `
    <aside class="panel">
      <div class="field">
        <h3>目标概览</h3>
        <p class="muted">长期推进的事放这里，按领域归类、跟踪进度。</p>
      </div>
      <div class="summary-grid">
        <div class="summary-card">
          <span class="muted">全部目标</span>
          <strong>${counts.total}</strong>
        </div>
        <div class="summary-card">
          <span class="muted">进行中</span>
          <strong>${counts.active}</strong>
        </div>
        <div class="summary-card">
          <span class="muted">已完成</span>
          <strong>${counts.done}</strong>
        </div>
      </div>

      <form id="goal-add-form" class="composer">
        <div class="field">
          <label for="goal-title">新增目标</label>
          <input id="goal-title" name="title" maxlength="120" placeholder="比如：读完《xx》" required />
        </div>
        <div class="field">
          <label for="goal-description">备注</label>
          <textarea id="goal-description" name="description" maxlength="2000" placeholder="想达成什么、为什么重要。"></textarea>
        </div>
        <div class="field">
          <label for="goal-area">所属领域</label>
          <select id="goal-area" name="area">
            ${Object.entries(AREAS)
              .map(([key, label]) => `<option value="${key}" ${key === "reading" ? "selected" : ""}>${label}</option>`)
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="goal-target">目标日期（可选）</label>
          <input id="goal-target" name="targetDate" type="date" />
        </div>
        <button class="button" type="submit">${state.busy ? "保存中..." : "新增目标"}</button>
      </form>
    </aside>
  `;
}

function renderAppView() {
  const isGoals = state.view === "goals";
  return `
    <div class="shell">
      <header class="hero">
        <div class="hero-top">
          <div>
            <span class="status-chip">账号：${escapeHtml(state.user.displayName || state.user.username)}</span>
            <h1>${escapeHtml(state.env.appName)}</h1>
            <p>先把今天真正重要的事放进视野里，再决定什么值得继续推进。</p>
          </div>
          <button class="ghost-btn" id="logout-btn">退出登录</button>
        </div>
        ${renderTabs()}
        ${renderBanner()}
      </header>

      <div class="layout">
        ${isGoals ? renderGoalsSide() : renderBoardSide()}
        <main>
          ${isGoals ? renderGoalsView() : renderBoard()}
        </main>
      </div>
      ${isGoals ? renderGoalSheet() : renderTaskSheet()}
    </div>
  `;
}

function render() {
  app.innerHTML = state.user ? renderAppView() : renderAuthView();
  applyPostRenderFocus();
}

function applyPostRenderFocus() {
  if (!state.focusComposer) {
    return;
  }
  const elementId = state.focusComposer;
  state.focusComposer = null;
  const input = document.getElementById(elementId);
  if (input) {
    input.focus();
  }
}

async function refreshTasks() {
  const data = await apiFetch("./api/tasks");
  state.tasks = data.tasks || [];
}

async function refreshGoals() {
  const data = await apiFetch("./api/goals");
  state.goals = data.goals || [];
}

async function refreshData() {
  await Promise.all([refreshTasks(), refreshGoals()]);
}

async function bootstrap() {
  render();
  try {
    state.env = await apiFetch("./api/env");
  } catch (error) {
    setMessage(error.message || "环境信息读取失败", "error");
  }

  try {
    const data = await apiFetch("./api/auth/me");
    state.user = data.user;
  } catch (_error) {
    state.user = null;
  }

  if (state.user) {
    try {
      await refreshData();
    } catch (error) {
      setMessage(error.message || "数据加载失败，但登录状态还在。", "error");
    }
  }

  render();
}

async function handleAuthSubmit(type, form) {
  state.busy = true;
  clearMessage();
  render();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await apiFetch(`./api/auth/${type}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.user = data.user;
    state.activeTaskId = null;
    state.sheetDraft = null;
    state.activeGoalId = null;
    state.goalSheetDraft = null;
    await refreshData();
    setMessage(type === "register" ? "账号创建完成，已经帮你登录。" : "登录成功，开始安排今天吧。");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function addTaskInline(quadrant, input) {
  const title = input.value.trim();
  if (!title) {
    input.focus();
    return;
  }

  // Clear synchronously so a quick double-Enter can't submit the same title twice.
  input.value = "";
  state.focusComposer = `composer-input-${quadrant}`;
  clearMessage();

  try {
    const data = await apiFetch("./api/tasks", {
      method: "POST",
      body: JSON.stringify({ title, quadrant })
    });
    state.tasks = [data.task, ...state.tasks];
  } catch (error) {
    setMessage(error.message, "error");
    return;
  }
  render();
}

async function addGoalInline(area, input) {
  const title = input.value.trim();
  if (!title) {
    input.focus();
    return;
  }

  input.value = "";
  state.focusComposer = `goal-composer-input-${area}`;
  clearMessage();

  try {
    const data = await apiFetch("./api/goals", {
      method: "POST",
      body: JSON.stringify({ title, area })
    });
    state.goals = [data.goal, ...state.goals];
  } catch (error) {
    setMessage(error.message, "error");
    return;
  }
  render();
}

async function updateTask(taskId, payload, successMessage = "任务已更新。") {
  state.busy = true;
  clearMessage();
  render();

  try {
    const data = await apiFetch(`./api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    state.tasks = state.tasks.map((task) => (task.id === taskId ? data.task : task));
    state.sheetDraft = null;
    setMessage(successMessage);
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.busy = false;
    render();
  }
}

function replaceTask(taskId, nextTask) {
  state.tasks = state.tasks.map((task) => (task.id === taskId ? nextTask : task));
}

async function toggleTaskDone(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  if (task.status === "archived" || state.pendingTaskIds.has(taskId)) {
    return;
  }

  const nextStatus = task.status === "done" ? "todo" : "done";
  const previousTask = { ...task };
  const optimisticTask = {
    ...task,
    status: nextStatus,
    completed_at: nextStatus === "done" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  state.pendingTaskIds.add(taskId);
  replaceTask(taskId, optimisticTask);
  render();

  try {
    const data = await apiFetch(`./api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    replaceTask(taskId, data.task);
  } catch (error) {
    replaceTask(taskId, previousTask);
    setMessage(error.message, "error");
    return;
  } finally {
    state.pendingTaskIds.delete(taskId);
    render();
  }
}

async function deleteTask(taskId) {
  if (!window.confirm("确定要删除这条任务吗？")) {
    return;
  }

  state.busy = true;
  clearMessage();
  render();

  try {
    await apiFetch(`./api/tasks/${taskId}`, { method: "DELETE" });
    state.tasks = state.tasks.filter((task) => task.id !== taskId);
    state.activeTaskId = null;
    state.sheetDraft = null;
    setMessage("任务已删除。");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.busy = false;
    render();
  }
}

function replaceGoal(goalId, nextGoal) {
  state.goals = state.goals.map((goal) => (goal.id === goalId ? nextGoal : goal));
}

async function handleGoalAdd(form) {
  state.busy = true;
  clearMessage();
  render();

  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const data = await apiFetch("./api/goals", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.goals = [data.goal, ...state.goals];
    form.reset();
    const select = document.getElementById("goal-area");
    if (select) {
      select.value = payload.area || "reading";
    }
    setMessage("目标已添加。");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function updateGoal(goalId, payload, successMessage = "目标已更新。") {
  state.busy = true;
  clearMessage();
  render();

  try {
    const data = await apiFetch(`./api/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    replaceGoal(goalId, data.goal);
    state.activeGoalId = null;
    state.goalSheetDraft = null;
    setMessage(successMessage);
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function adjustGoalProgress(goalId, delta) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal || state.pendingGoalIds.has(goalId)) {
    return;
  }

  const nextProgress = Math.max(0, Math.min(100, (goal.progress || 0) + delta));
  if (nextProgress === goal.progress) {
    return;
  }

  const previousGoal = { ...goal };
  state.pendingGoalIds.add(goalId);
  replaceGoal(goalId, { ...goal, progress: nextProgress, updated_at: new Date().toISOString() });
  render();

  try {
    const data = await apiFetch(`./api/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify({ progress: nextProgress })
    });
    replaceGoal(goalId, data.goal);
  } catch (error) {
    replaceGoal(goalId, previousGoal);
    setMessage(error.message, "error");
  } finally {
    state.pendingGoalIds.delete(goalId);
    render();
  }
}

async function deleteGoal(goalId) {
  if (!window.confirm("确定要删除这个目标吗？")) {
    return;
  }

  state.busy = true;
  clearMessage();
  render();

  try {
    await apiFetch(`./api/goals/${goalId}`, { method: "DELETE" });
    state.goals = state.goals.filter((goal) => goal.id !== goalId);
    state.activeGoalId = null;
    state.goalSheetDraft = null;
    setMessage("目标已删除。");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function logout() {
  state.busy = true;
  clearMessage();
  render();

  try {
    await apiFetch("./api/auth/logout", { method: "POST" });
    state.user = null;
    state.tasks = [];
    state.goals = [];
    state.activeTaskId = null;
    state.sheetDraft = null;
    state.activeGoalId = null;
    state.goalSheetDraft = null;
    setMessage("已退出登录。");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.busy = false;
    render();
  }
}

document.addEventListener("submit", async (event) => {
  const { target } = event;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  if (target.id === "login-form") {
    event.preventDefault();
    await handleAuthSubmit("login", target);
    return;
  }

  if (target.id === "register-form") {
    event.preventDefault();
    await handleAuthSubmit("register", target);
    return;
  }

  const quadAdd = target.getAttribute("data-quad-add");
  if (quadAdd) {
    event.preventDefault();
    const input = target.querySelector('input[name="title"]');
    if (input) {
      await addTaskInline(quadAdd, input);
    }
    return;
  }

  const areaAdd = target.getAttribute("data-area-add");
  if (areaAdd) {
    event.preventDefault();
    const input = target.querySelector('input[name="title"]');
    if (input) {
      await addGoalInline(areaAdd, input);
    }
    return;
  }

  if (target.id === "task-edit-form") {
    event.preventDefault();
    const taskId = target.dataset.taskId;
    const formData = new FormData(target);
    await updateTask(taskId, Object.fromEntries(formData.entries()), "任务改动已经保存。");
    return;
  }

  if (target.id === "goal-add-form") {
    event.preventDefault();
    await handleGoalAdd(target);
    return;
  }

  if (target.id === "goal-edit-form") {
    event.preventDefault();
    const goalId = target.dataset.goalId;
    const formData = new FormData(target);
    await updateGoal(goalId, Object.fromEntries(formData.entries()), "目标改动已经保存。");
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const authMode = target.closest("[data-auth-mode]")?.getAttribute("data-auth-mode");
  if (authMode) {
    state.authMode = authMode;
    clearMessage();
    render();
    return;
  }

  if (target.id === "logout-btn") {
    await logout();
    return;
  }

  const view = target.closest("[data-view]")?.getAttribute("data-view");
  if (view && view !== state.view) {
    state.view = view;
    state.activeTaskId = null;
    state.sheetDraft = null;
    state.activeGoalId = null;
    state.goalSheetDraft = null;
    clearMessage();
    render();
    return;
  }

  const openGoalId = target.closest("[data-open-goal]")?.getAttribute("data-open-goal");
  if (openGoalId) {
    state.activeGoalId = openGoalId;
    const goal = state.goals.find((item) => item.id === openGoalId);
    state.goalSheetDraft = goal
      ? {
          title: goal.title,
          description: goal.description || "",
          area: goal.area,
          status: goal.status,
          progress: goal.progress || 0,
          targetDate: goal.target_date || ""
        }
      : null;
    clearMessage();
    render();
    return;
  }

  const closeGoalSheet = target.closest("[data-close-goal-sheet]")?.getAttribute("data-close-goal-sheet");
  if (closeGoalSheet) {
    state.activeGoalId = null;
    state.goalSheetDraft = null;
    render();
    return;
  }

  const progressGoal = target.closest("[data-goal-progress]");
  if (progressGoal) {
    const goalId = progressGoal.getAttribute("data-goal-progress");
    const delta = Number(progressGoal.getAttribute("data-delta"));
    await adjustGoalProgress(goalId, delta);
    return;
  }

  const pickArea = target.closest("[data-pick-area]")?.getAttribute("data-pick-area");
  if (pickArea) {
    const input = document.querySelector('#goal-edit-form input[name="area"]');
    if (input) {
      input.value = pickArea;
      if (state.goalSheetDraft) {
        state.goalSheetDraft.area = pickArea;
      }
      render();
    }
    return;
  }

  const pickGoalStatus = target.closest("[data-pick-goal-status]")?.getAttribute("data-pick-goal-status");
  if (pickGoalStatus) {
    const input = document.querySelector('#goal-edit-form input[name="status"]');
    if (input) {
      input.value = pickGoalStatus;
      if (state.goalSheetDraft) {
        state.goalSheetDraft.status = pickGoalStatus;
      }
      render();
    }
    return;
  }

  const deleteGoalId = target.closest("[data-delete-goal]")?.getAttribute("data-delete-goal");
  if (deleteGoalId) {
    await deleteGoal(deleteGoalId);
    return;
  }

  const openTaskId = target.closest("[data-open-task]")?.getAttribute("data-open-task");
  if (openTaskId) {
    state.activeTaskId = openTaskId;
    const task = state.tasks.find((item) => item.id === openTaskId);
    state.sheetDraft = task
      ? {
          title: task.title,
          description: task.description || "",
          quadrant: task.quadrant,
          status: task.status
        }
      : null;
    clearMessage();
    render();
    return;
  }

  const closeSheet = target.closest("[data-close-sheet]")?.getAttribute("data-close-sheet");
  if (closeSheet) {
    state.activeTaskId = null;
    state.sheetDraft = null;
    render();
    return;
  }

  const toggleDoneTaskId = target.closest("[data-toggle-done]")?.getAttribute("data-toggle-done");
  if (toggleDoneTaskId) {
    await toggleTaskDone(toggleDoneTaskId);
    return;
  }

  const pickQuadrant = target.closest("[data-pick-quadrant]")?.getAttribute("data-pick-quadrant");
  if (pickQuadrant) {
    const input = document.querySelector('#task-edit-form input[name="quadrant"]');
    if (input) {
      input.value = pickQuadrant;
      if (state.sheetDraft) {
        state.sheetDraft.quadrant = pickQuadrant;
      }
      render();
    }
    return;
  }

  const pickStatus = target.closest("[data-pick-status]")?.getAttribute("data-pick-status");
  if (pickStatus) {
    const input = document.querySelector('#task-edit-form input[name="status"]');
    if (input) {
      input.value = pickStatus;
      if (state.sheetDraft) {
        state.sheetDraft.status = pickStatus;
      }
      render();
    }
    return;
  }

  const deleteTaskId = target.closest("[data-delete-task]")?.getAttribute("data-delete-task");
  if (deleteTaskId) {
    await deleteTask(deleteTaskId);
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  if (state.sheetDraft && target.closest("#task-edit-form")) {
    if (target.name === "title") {
      state.sheetDraft.title = target.value;
    }
    if (target.name === "description") {
      state.sheetDraft.description = target.value;
    }
    return;
  }

  if (state.goalSheetDraft && target.closest("#goal-edit-form")) {
    if (target.name === "title") {
      state.goalSheetDraft.title = target.value;
    }
    if (target.name === "description") {
      state.goalSheetDraft.description = target.value;
    }
    if (target.name === "targetDate") {
      state.goalSheetDraft.targetDate = target.value;
    }
    if (target.name === "progress") {
      state.goalSheetDraft.progress = Number(target.value);
      const label = document.querySelector('#goal-edit-form label[for="goal-edit-progress"]');
      if (label) {
        label.textContent = `进度：${target.value}%`;
      }
    }
  }
});

bootstrap();
