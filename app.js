/* ===== Финансовый кабинет — логика ===== */

const STORAGE_KEY = "finance-cabinet-data-v1";

const DEFAULT_CATEGORIES = {
  income: ["Зарплата", "Аванс", "Премия", "Фриланс", "Подарок", "Прочее"],
  expense: ["Продукты", "Жильё", "Транспорт", "Развлечения", "Здоровье", "Подарки", "Прочее"],
};

const state = {
  income: [],   // { id, date, category, title, amount }
  expense: [],  // { id, date, category, title, amount }
  assets: [],   // { id, date, type, title, amount }
  categories: {
    income: [...DEFAULT_CATEGORIES.income],
    expense: [...DEFAULT_CATEGORIES.expense],
  },
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
    state.categories = {
      income: (data.categories && data.categories.income) || [...DEFAULT_CATEGORIES.income],
      expense: (data.categories && data.categories.expense) || [...DEFAULT_CATEGORIES.expense],
    };
  } catch (e) {
    console.error("Не удалось загрузить данные", e);
  }
}

function save() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  schedulePush();
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
  category: document.getElementById("f-category-value"),
  type: document.getElementById("f-type"),
  title: document.getElementById("f-title"),
  amount: document.getElementById("f-amount"),
};

const kindTitles = {
  income: "Новый доход",
  expense: "Новый расход",
  assets: "Новый актив",
};
const kindNouns = { income: "доход", expense: "расход", assets: "актив" };

function normalizeKind(kind) {
  return kind === "asset" ? "assets" : kind;
}

function openForm(kindRaw, index = null) {
  const kind = normalizeKind(kindRaw);
  formFields.kind.value = kind;
  formFields.index.value = index === null ? "" : index;
  document.getElementById("modal-title").textContent =
    index === null ? kindTitles[kind] : "Изменить " + (kindNouns[kind] || kind);

  const isAsset = kind === "assets";
  document.getElementById("f-category-wrap").style.display = isAsset ? "none" : "block";
  document.getElementById("f-type-wrap").style.display = isAsset ? "block" : "none";
  if (isAsset) formFields.category.value = "";
  formFields.title.placeholder = isAsset ? "Например: Квартира, депозит" : "Описание";

  const record = index !== null ? state[kind][index] : null;
  const now = new Date();
  formFields.date.value = record ? record.date : `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  formFields.category.value = record ? record.category || "" : "";
  formFields.type.value = record ? record.type || "Деньги" : "Деньги";
  formFields.title.value = record ? record.title || "" : "";
  formFields.amount.value = record ? record.amount : "";
  updateCategoryBtn();
  closeCategoryMenu();

  modal.classList.remove("hidden");
  formFields.title.focus();
}

function closeForm() {
  modal.classList.add("hidden");
  form.reset();
}

document.querySelectorAll("[data-open-form]").forEach((btn) => {
  btn.addEventListener("click", () => openForm(btn.dataset.openForm));
});

document.getElementById("modal-cancel").addEventListener("click", closeForm);
document.getElementById("modal-x").addEventListener("click", closeForm);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeForm();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!categoryMenu.classList.contains("hidden")) { closeCategoryMenu(); return; }
  if (!modal.classList.contains("hidden")) closeForm();
  if (!syncModal.classList.contains("hidden")) syncModal.classList.add("hidden");
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const kind = normalizeKind(formFields.kind.value);
  const indexRaw = formFields.index.value;
  const index = indexRaw === "" ? null : Number(indexRaw);
  const isAsset = kind === "assets";

  if (!formFields.date.value) {
    alert("Укажите дату.");
    formFields.date.focus();
    return;
  }
  if (!isAsset && !formFields.category.value.trim()) {
    alert("Выберите категорию.");
    openCategoryMenu();
    return;
  }
  if (!(Number(formFields.amount.value) > 0)) {
    alert("Укажите сумму больше нуля.");
    formFields.amount.focus();
    return;
  }

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
    ensureCategory(kind, record.category);
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
function deleteRecord(kindRaw, id) {
  const kind = normalizeKind(kindRaw);
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
    <td data-label="Дата">${fmtDate(r.date)}</td>
    <td data-label="Категория">${escapeHtml(r.category)}</td>
    <td data-label="Описание">${escapeHtml(r.title || "—")}</td>
    <td class="num positive" data-label="Сумма">+${fmtMoney(r.amount)}</td>`);
}

function renderExpenses() {
  renderTable("expense", "expense-tbody", "expense-empty", (r) => `
    <td data-label="Дата">${fmtDate(r.date)}</td>
    <td data-label="Категория">${escapeHtml(r.category)}</td>
    <td data-label="Описание">${escapeHtml(r.title || "—")}</td>
    <td class="num negative" data-label="Сумма">−${fmtMoney(r.amount)}</td>`);
}

function renderAssets() {
  renderTable("assets", "asset-tbody", "asset-empty", (r) => `
    <td data-label="Название">${escapeHtml(r.title || "—")}</td>
    <td data-label="Тип">${escapeHtml(r.type)}</td>
    <td data-label="Дата">${fmtDate(r.date)}</td>
    <td class="num" data-label="Стоимость">${fmtMoney(r.amount)}</td>`);
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
  const now = localMonthKey(new Date());
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function localMonthKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function lastMonths(n) {
  const result = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push({
      key: localMonthKey(m),
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

/* ---------- Синхронизация (Supabase) ---------- */
const SUPABASE_URL = "https://slorzxlnsyfnyamxgcch.supabase.co";
const SUPABASE_KEY = "sb_publishable_uMutZU_Q1pIhva7HT7J9-g_gDaj_z8R";
const SYNC_KEY_STORAGE = "finance-cabinet-sync-key";

let pushTimer = null;

const syncModal = document.getElementById("sync-modal");
const syncStatus = document.getElementById("sync-status");

function getSyncKey() {
  return localStorage.getItem(SYNC_KEY_STORAGE) || "";
}

function apiHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
  };
}

async function fetchRemote() {
  const key = getSyncKey();
  const url = `${SUPABASE_URL}/rest/v1/sync_data?sync_key=eq.${encodeURIComponent(key)}&select=payload,updated_at`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error("не удалось получить данные (" + res.status + ")");
  const rows = await res.json();
  return rows.length ? rows[0] : null;
}

async function pushRemote() {
  const key = getSyncKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_data?on_conflict=sync_key`, {
    method: "POST",
    headers: { ...apiHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      sync_key: key,
      payload: {
        income: state.income,
        expense: state.expense,
        assets: state.assets,
        updatedAt: state.updatedAt || new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error("не удалось отправить данные (" + res.status + ")");
}

function schedulePush() {
  if (!getSyncKey()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncNow().catch(() => setSyncStatus("Нет связи — изменения сохранены локально", true)), 2000);
}

async function syncNow() {
  const key = getSyncKey();
  if (!key) return;
  setSyncStatus("Синхронизация…");
  const remote = await fetchRemote();
  const remoteAt = remote && remote.payload && remote.payload.updatedAt ? remote.payload.updatedAt : "";
  const localAt = state.updatedAt || "";

  if (remoteAt > localAt) {
    state.income = remote.payload.income || [];
    state.expense = remote.payload.expense || [];
    state.assets = remote.payload.assets || [];
    state.updatedAt = remoteAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    setSyncStatus("Данные получены с сервера", "ok");
  } else {
    await pushRemote();
    setSyncStatus("Синхронизировано", "ok");
  }
}

async function connectSync(key) {
  const clean = key.trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,}$/.test(clean)) {
    setSyncStatus("Код: 6+ символов, латиница, цифры, дефис", true);
    return;
  }
  localStorage.setItem(SYNC_KEY_STORAGE, clean);
  renderSyncModal();
  try {
    await syncNow();
  } catch (e) {
    setSyncStatus("Ошибка: " + e.message, true);
  }
}

function disconnectSync() {
  if (!confirm("Отключить синхронизацию? Данные останутся в этом браузере, но перестанут обновляться между устройствами.")) return;
  localStorage.removeItem(SYNC_KEY_STORAGE);
  clearTimeout(pushTimer);
  renderSyncModal();
  setSyncStatus("");
}

function generateSyncKey() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const part = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => abc[b % abc.length]).join("");
  return part(4) + "-" + part(4);
}

function setSyncStatus(text, kind) {
  syncStatus.textContent = text;
  syncStatus.className = "sync-status" + (kind ? " " + kind : "");
}

function renderSyncModal() {
  const key = getSyncKey();
  document.getElementById("sync-connected").style.display = key ? "block" : "none";
  document.getElementById("sync-setup").style.display = key ? "none" : "block";
  if (key) document.getElementById("sync-key-display").textContent = key;
}

document.getElementById("syncBtn").addEventListener("click", () => {
  renderSyncModal();
  setSyncStatus("");
  syncModal.classList.remove("hidden");
});

syncModal.addEventListener("click", (e) => {
  if (e.target === syncModal) syncModal.classList.add("hidden");
});

document.getElementById("sync-connect").addEventListener("click", () => {
  connectSync(document.getElementById("sync-key-input").value);
});

document.getElementById("sync-key-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    connectSync(e.target.value);
  }
});

document.getElementById("sync-generate").addEventListener("click", () => {
  connectSync(generateSyncKey());
});

document.getElementById("sync-now").addEventListener("click", () => {
  syncNow().catch((e) => setSyncStatus("Ошибка: " + e.message, true));
});

document.getElementById("sync-disconnect").addEventListener("click", disconnectSync);

if (getSyncKey()) syncNow().catch(() => setSyncStatus("Нет связи — показаны локальные данные", true));

/* ---------- Инициализация ---------- */
function renderAll() {
  renderIncome();
  renderExpenses();
  renderAssets();
  renderDashboard();
}

/* ---------- Категории: выпадающий список ---------- */
const categoryBtn = document.getElementById("category-btn");
const categoryBtnText = document.getElementById("category-btn-text");
const categoryMenu = document.getElementById("category-menu");

function ensureCategory(kind, cat) {
  const list = state.categories[kind] || (state.categories[kind] = []);
  if (!list.includes(cat)) list.push(cat);
}

function updateCategoryBtn() {
  const v = formFields.category.value;
  categoryBtnText.textContent = v || "Выберите категорию";
  categoryBtn.classList.toggle("placeholder", !v);
}

function renderCategoryMenu() {
  const cats = state.categories[formFields.kind.value] || [];
  categoryMenu.innerHTML = "";
  cats.forEach((c) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "dropdown-item" + (c === formFields.category.value ? " selected" : "");
    item.textContent = c;
    item.addEventListener("click", () => {
      formFields.category.value = c;
      updateCategoryBtn();
      closeCategoryMenu();
    });
    categoryMenu.appendChild(item);
  });
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "dropdown-item add";
  addBtn.textContent = "＋ Новая категория";
  addBtn.addEventListener("click", showCategoryInput);
  categoryMenu.appendChild(addBtn);
}

function openCategoryMenu() {
  renderCategoryMenu();
  categoryMenu.classList.remove("hidden");
}

function closeCategoryMenu() {
  categoryMenu.classList.add("hidden");
}

function showCategoryInput() {
  categoryMenu.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "dropdown-add";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Название категории";
  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = "btn btn-primary btn-small";
  ok.textContent = "Добавить";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-ghost btn-small";
  cancel.textContent = "Отмена";
  cancel.addEventListener("click", renderCategoryMenu);
  const commit = () => {
    const v = input.value.trim();
    if (!v) return;
    ensureCategory(formFields.kind.value, v);
    save();
    formFields.category.value = v;
    updateCategoryBtn();
    closeCategoryMenu();
  };
  ok.addEventListener("click", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  });
  wrap.appendChild(input);
  const row = document.createElement("div");
  row.className = "dropdown-add-actions";
  row.appendChild(cancel);
  row.appendChild(ok);
  wrap.appendChild(row);
  categoryMenu.appendChild(wrap);
  input.focus();
}

categoryBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (categoryMenu.classList.contains("hidden")) openCategoryMenu();
  else closeCategoryMenu();
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("category-dropdown").contains(e.target)) closeCategoryMenu();
});

load();
renderAll();
