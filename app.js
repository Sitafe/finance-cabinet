/* ===== Финансовый кабинет — логика ===== */

const STORAGE_KEY = "finance-cabinet-data-v1";

const state = {
  income: [],   // { id, date, category, title, amount }
  expense: [],  // { id, date, category, title, amount }
  assets: [],   // { id, date, type, title, amount }
};

const fmt = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const fmtMoney = (v) => fmt.format(Number(v) || 0);
const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

/* ---------- Хранилище ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.income = data.income || [];
    state.expense = data.expense || [];
    state.assets = data.assets || [];
  } catch (e) {
    console.error("Не удалось загрузить данные", e);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Навигация ---------- */
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-" + btn.dataset.view).classList.add("active");
    renderAll();
  });
});

/* ---------- Модальное окно ---------- */
const modal = document.getElementById("modal");
const form = document.getElementById("entry-form");
const formFields = {
  kind: document.getElementById("f-kind"),
  index: document.getElementById("f-index"),
  date: document.getElementById("f-date"),
  category: document.getElementById("f-category"),
  type: document.getElementById("f-type"),
  title: document.getElementById("f-title"),
  amount: document.getElementById("f-amount"),
};

const kindTitles = {
  income: "Новый доход",
  expense: "Новый расход",
  asset: "Новый актив",
};
const kindNouns = { income: "доход", expense: "расход", asset: "актив" };

function openForm(kind, index = null) {
  formFields.kind.value = kind;
  formFields.index.value = index === null ? "" : index;
  document.getElementById("modal-title").textContent =
    index === null ? kindTitles[kind] : "Изменить " + kindNouns[kind];

  const isAsset = kind === "asset";
  document.getElementById("f-category-wrap").style.display = isAsset ? "none" : "block";
  document.getElementById("f-type-wrap").style.display = isAsset ? "block" : "none";
  formFields.category.required = !isAsset;
  if (isAsset) formFields.category.value = "";
  formFields.title.placeholder = isAsset ? "Например: Квартира, депозит" : "Описание";

  const record = index !== null ? state[kind][index] : null;
  formFields.date.value = record ? record.date : new Date().toISOString().slice(0, 10);
  formFields.category.value = record ? record.category || "" : "";
  formFields.type.value = record ? record.type || "Деньги" : "Деньги";
  formFields.title.value = record ? record.title || "" : "";
  formFields.amount.value = record ? record.amount : "";

  modal.classList.remove("hidden");
  (isAsset ? formFields.title : formFields.category).focus();
}

function closeForm() {
  modal.classList.add("hidden");
  form.reset();
}

document.querySelectorAll("[data-open-form]").forEach((btn) => {
  btn.addEventListener("click", () => openForm(btn.dataset.openForm));
});

document.getElementById("modal-cancel").addEventListener("click", closeForm);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeForm();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeForm();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const kind = formFields.kind.value;
  const indexRaw = formFields.index.value;
  const index = indexRaw === "" ? null : Number(indexRaw);
  const isAsset = kind === "asset";

  const record = {
    id: index !== null ? state[kind][index].id : uid(),
    date: formFields.date.value,
    title: formFields.title.value.trim(),
    amount: Math.abs(Number(formFields.amount.value) || 0),
  };

  if (isAsset) {
    record.type = formFields.type.value;
  } else {
    record.category = formFields.category.value.trim() || "Прочее";
  }

  if (index !== null) {
    state[kind][index] = record;
  } else {
    state[kind].push(record);
  }

  save();
  closeForm();
  renderAll();
});

/* ---------- Удаление ---------- */
function deleteRecord(kind, id) {
  if (!confirm("Удалить эту запись?")) return;
  state[kind] = state[kind].filter((r) => r.id !== id);
  save();
  renderAll();
}

/* ---------- Рендер таблиц ---------- */
function renderTable(kind, tbodyId, emptyId, columns) {
  const tbody = document.getElementById(tbodyId);
  const empty = document.getElementById(emptyId);
  const rows = [...state[kind]].sort((a, b) => b.date.localeCompare(a.date));

  tbody.innerHTML = "";
  empty.style.display = rows.length ? "none" : "block";

  rows.forEach((r) => {
    const realIndex = state[kind].findIndex((x) => x.id === r.id);
    const tr = document.createElement("tr");
    tr.innerHTML = columns(r) + `
      <td class="actions">
        <button class="btn btn-ghost btn-small" data-edit="${kind}:${realIndex}">✏️</button>
        <button class="btn btn-danger btn-small" data-del="${kind}:${r.id}">✕</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderIncome() {
  renderTable("income", "income-tbody", "income-empty", (r) => `
    <td>${fmtDate(r.date)}</td>
    <td>${escapeHtml(r.category)}</td>
    <td>${escapeHtml(r.title || "—")}</td>
    <td class="num positive">+${fmtMoney(r.amount)}</td>`);
}

function renderExpenses() {
  renderTable("expense", "expense-tbody", "expense-empty", (r) => `
    <td>${fmtDate(r.date)}</td>
    <td>${escapeHtml(r.category)}</td>
    <td>${escapeHtml(r.title || "—")}</td>
    <td class="num negative">−${fmtMoney(r.amount)}</td>`);
}

function renderAssets() {
  renderTable("assets", "asset-tbody", "asset-empty", (r) => `
    <td>${escapeHtml(r.title || "—")}</td>
    <td>${escapeHtml(r.type)}</td>
    <td>${fmtDate(r.date)}</td>
    <td class="num">${fmtMoney(r.amount)}</td>`);
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

document.addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (del) {
    const [kind, id] = del.dataset.del.split(":");
    deleteRecord(kind, id);
    return;
  }
  const edit = e.target.closest("[data-edit]");
  if (edit) {
    const [kind, index] = edit.dataset.edit.split(":");
    openForm(kind, Number(index));
  }
});

/* ---------- Обзор ---------- */
function monthKey(iso) {
  return iso.slice(0, 7);
}

function renderDashboard() {
  const now = new Date().toISOString().slice(0, 7);
  const totalIncome = state.income.reduce((s, r) => s + r.amount, 0);
  const totalExpense = state.expense.reduce((s, r) => s + r.amount, 0);
  const totalAssets = state.assets.reduce((s, r) => s + r.amount, 0);
  const monthIncome = state.income.filter((r) => monthKey(r.date) === now).reduce((s, r) => s + r.amount, 0);
  const monthExpense = state.expense.filter((r) => monthKey(r.date) === now).reduce((s, r) => s + r.amount, 0);

  document.getElementById("stat-balance").textContent = fmtMoney(totalIncome - totalExpense + totalAssets);
  document.getElementById("stat-income").textContent = fmtMoney(monthIncome);
  document.getElementById("stat-expenses").textContent = fmtMoney(monthExpense);
  document.getElementById("stat-assets").textContent = fmtMoney(totalAssets);

  const recent = [
    ...state.income.map((r) => ({ ...r, kind: "income" })),
    ...state.expense.map((r) => ({ ...r, kind: "expense" })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const list = document.getElementById("recent-list");
  list.innerHTML = "";
  if (!recent.length) {
    list.innerHTML = '<p class="empty">Нет операций.</p>';
  } else {
    recent.forEach((r) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div>
          <div>${escapeHtml(r.category || r.title || "—")}</div>
          <div class="meta">${fmtDate(r.date)}</div>
        </div>
        <div class="${r.kind === "income" ? "positive" : "negative"}">
          ${r.kind === "income" ? "+" : "−"}${fmtMoney(r.amount)}
        </div>`;
      list.appendChild(div);
    });
  }

  drawMonthlyChart();
  drawCategoryChart();
  drawAssetsChart();
}

/* ---------- Графики ---------- */
const charts = {};

function makeChart(id, config) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext("2d");
  Chart.defaults.color = "#8b95ad";
  Chart.defaults.borderColor = "#26304a";
  charts[id] = new Chart(ctx, config);
}

function lastMonths(n) {
  const result = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push({
      key: m.toISOString().slice(0, 7),
      label: m.toLocaleString("ru-RU", { month: "short", year: "2-digit" }),
    });
  }
  return result;
}

function drawMonthlyChart() {
  const months = lastMonths(6);
  const income = months.map((m) =>
    state.income.filter((r) => monthKey(r.date) === m.key).reduce((s, r) => s + r.amount, 0)
  );
  const expense = months.map((m) =>
    state.expense.filter((r) => monthKey(r.date) === m.key).reduce((s, r) => s + r.amount, 0)
  );

  makeChart("chart-monthly", {
    type: "bar",
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        { label: "Доходы", data: income, backgroundColor: "#2ecc8f", borderRadius: 6 },
        { label: "Расходы", data: expense, backgroundColor: "#ff5c7a", borderRadius: 6 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { ticks: { callback: (v) => (v >= 1000 ? v / 1000 + "к" : v) } } },
    },
  });
}

function drawCategoryChart() {
  const byCategory = {};
  state.expense.forEach((r) => {
    byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
  });
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const palette = ["#4f7cff", "#7c4dff", "#2ecc8f", "#f5a623", "#ff5c7a", "#00c2d1", "#c0c7d6", "#9b6dff"];

  makeChart("chart-categories", {
    type: "doughnut",
    data: {
      labels: entries.map(([c]) => c),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map((_, i) => palette[i % palette.length]),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtMoney(c.parsed)}` } },
      },
    },
  });
}

function drawAssetsChart() {
  const byType = {};
  state.assets.forEach((r) => {
    byType[r.type] = (byType[r.type] || 0) + r.amount;
  });
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const palette = ["#4f7cff", "#2ecc8f", "#f5a623", "#7c4dff", "#00c2d1"];

  makeChart("chart-assets", {
    type: "polarArea",
    data: {
      labels: entries.map(([t]) => t),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map((_, i) => palette[i % palette.length] + "cc"),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtMoney(c.parsed.r ?? c.parsed)}` } },
      },
      scales: { r: { ticks: { display: false } } },
    },
  });
}

/* ---------- Экспорт ---------- */
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- Инициализация ---------- */
function renderAll() {
  renderIncome();
  renderExpenses();
  renderAssets();
  renderDashboard();
}

function fillCategoryDatalist() {
  const list = document.getElementById("category-list");
  const cats = new Set([
    ...state.income.map((r) => r.category),
    ...state.expense.map((r) => r.category),
  ].filter(Boolean));
  list.innerHTML = [...cats].map((c) => `<option value="${escapeHtml(c)}">`).join("");
}

const origRenderAll = renderAll;
renderAll = function () {
  origRenderAll();
  fillCategoryDatalist();
};

load();
renderAll();
