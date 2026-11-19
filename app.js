const STORAGE_KEY = "vaad-bait-accounts-v1";

const emptyState = () => ({
  building: { name: "Va'ad Bayit", address: "" },
  units: [],
  charges: [],
  payments: [],
  expenses: [],
});

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    return emptyState();
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return crypto.randomUUID();
}

function money(n) {
  const value = Number(n) || 0;
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function yearOf(date) {
  return String(date || "").slice(0, 4);
}

let state = load();

function unitById(id) {
  return state.units.find((u) => u.id === id);
}

function unitLabel(unit) {
  if (!unit) return "—";
  return `${unit.number} · ${unit.owner}`;
}

function charged(unitId) {
  return state.charges
    .filter((c) => c.unitId === unitId)
    .reduce((sum, c) => sum + Number(c.amount), 0);
}

function paid(unitId) {
  return state.payments
    .filter((p) => p.unitId === unitId)
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

function balance(unitId) {
  return charged(unitId) - paid(unitId);
}

function cashOnHand() {
  const inflows = state.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outflows = state.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  return inflows - outflows;
}

function outstanding() {
  return state.units.reduce((sum, u) => sum + Math.max(0, balance(u.id)), 0);
}

function yearSum(list, year) {
  return list
    .filter((item) => yearOf(item.date) === year)
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

function fillUnitSelects() {
  const options = state.units
    .slice()
    .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }))
    .map((u) => `<option value="${u.id}">${escapeHtml(unitLabel(u))}</option>`)
    .join("");
  document.querySelectorAll('select[name="unitId"]').forEach((select) => {
    select.innerHTML = options || `<option value="">Add a unit first</option>`;
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function table(headers, rows) {
  if (!rows.length) return `<p class="empty">Nothing here yet.</p>`;
  return `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function renderDashboard() {
  const year = String(new Date().getFullYear());
  document.getElementById("stat-cash").textContent = money(cashOnHand());
  document.getElementById("stat-debt").textContent = money(outstanding());
  document.getElementById("stat-in").textContent = money(yearSum(state.payments, year));
  document.getElementById("stat-out").textContent = money(yearSum(state.expenses, year));
  document.getElementById("stat-year-label").textContent = year;

  const debtors = state.units
    .map((u) => ({ ...u, due: balance(u.id) }))
    .filter((u) => u.due > 0.009)
    .sort((a, b) => b.due - a.due);

  document.getElementById("debt-table").innerHTML = table(
    ["Unit", "Resident", "Owes"],
    debtors.map(
      (u) =>
        `<tr><td>${escapeHtml(u.number)}</td><td>${escapeHtml(u.owner)}</td><td class="num">${money(u.due)}</td></tr>`
    )
  );

  const activity = [
    ...state.payments.map((p) => ({
      date: p.date,
      text: `Payment ${money(p.amount)} from ${unitLabel(unitById(p.unitId))}`,
    })),
    ...state.expenses.map((e) => ({
      date: e.date,
      text: `Expense ${money(e.amount)} · ${e.category}${e.vendor ? ` · ${e.vendor}` : ""}`,
    })),
    ...state.charges.map((c) => ({
      date: c.date,
      text: `Charge ${money(c.amount)} · ${unitLabel(unitById(c.unitId))}${c.note ? ` · ${c.note}` : ""}`,
    })),
  ]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 10);

  document.getElementById("activity").innerHTML = activity.length
    ? activity.map((item) => `<li><strong>${escapeHtml(item.date)}</strong> — ${escapeHtml(item.text)}</li>`).join("")
    : `<li class="empty">No activity yet.</li>`;
}

function renderUnits() {
  const rows = state.units
    .slice()
    .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }))
    .map((u) => {
      const due = balance(u.id);
      return `<tr>
        <td>${escapeHtml(u.number)}</td>
        <td>${escapeHtml(u.owner)}</td>
        <td class="num">${money(u.monthlyFee)}</td>
        <td class="num">${money(due)}</td>
        <td class="row-actions"><button data-delete-unit="${u.id}">Remove</button></td>
      </tr>`;
    });
  document.getElementById("units-table").innerHTML = table(
    ["Unit", "Resident", "Monthly fee", "Balance", ""],
    rows
  );
}

function renderCharges() {
  const rows = state.charges
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.date)}</td>
        <td>${escapeHtml(unitLabel(unitById(c.unitId)))}</td>
        <td>${escapeHtml(c.note || "")}</td>
        <td class="num">${money(c.amount)}</td>
        <td class="row-actions"><button data-delete-charge="${c.id}">Remove</button></td>
      </tr>`
    );
  document.getElementById("charges-table").innerHTML = table(
    ["Date", "Unit", "Note", "Amount", ""],
    rows
  );
}

function renderPayments() {
  const rows = state.payments
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(unitLabel(unitById(p.unitId)))}</td>
        <td>${escapeHtml(p.method || "")}</td>
        <td>${escapeHtml(p.note || "")}</td>
        <td class="num">${money(p.amount)}</td>
        <td class="row-actions"><button data-delete-payment="${p.id}">Remove</button></td>
      </tr>`
    );
  document.getElementById("payments-table").innerHTML = table(
    ["Date", "Unit", "Method", "Note", "Amount", ""],
    rows
  );
}

function renderExpenses() {
  const rows = state.expenses
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(
      (e) => `<tr>
        <td>${escapeHtml(e.date)}</td>
        <td>${escapeHtml(e.category)}</td>
        <td>${escapeHtml(e.vendor || "")}</td>
        <td>${escapeHtml(e.note || "")}</td>
        <td class="num">${money(e.amount)}</td>
        <td class="row-actions"><button data-delete-expense="${e.id}">Remove</button></td>
      </tr>`
    );
  document.getElementById("expenses-table").innerHTML = table(
    ["Date", "Category", "Vendor", "Note", "Amount", ""],
    rows
  );
}

function renderSettings() {
  const form = document.getElementById("form-building");
  form.name.value = state.building.name || "";
  form.address.value = state.building.address || "";
}

function render() {
  document.getElementById("building-name").textContent = state.building.name || "Va'ad Bayit";
  document.getElementById("building-address").textContent = state.building.address || "";
  fillUnitSelects();
  renderDashboard();
  renderUnits();
  renderCharges();
  renderPayments();
  renderExpenses();
  renderSettings();
}

function persist() {
  save(state);
  render();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("is-active");
  });
});

document.getElementById("form-unit").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  state.units.push({
    id: uid(),
    number: String(data.get("number")).trim(),
    owner: String(data.get("owner")).trim(),
    monthlyFee: Number(data.get("monthlyFee")),
  });
  event.target.reset();
  persist();
});

document.getElementById("form-charge-month").addEventListener("submit", (event) => {
  event.preventDefault();
  const period = new FormData(event.target).get("period");
  const date = `${period}-01`;
  let added = 0;
  state.units.forEach((unit) => {
    const already = state.charges.some((c) => c.unitId === unit.id && c.note === `Monthly ${period}`);
    if (already) return;
    state.charges.push({
      id: uid(),
      unitId: unit.id,
      amount: Number(unit.monthlyFee),
      date,
      note: `Monthly ${period}`,
    });
    added += 1;
  });
  persist();
  const hint = document.getElementById("charge-month-hint");
  if (hint) {
    hint.textContent = added
      ? `Issued ${added} charge(s) for ${period}.`
      : `Every unit is already charged for ${period}.`;
  }
});

document.getElementById("form-charge").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  const unitId = String(data.get("unitId"));
  if (!unitId) return;
  state.charges.push({
    id: uid(),
    unitId,
    amount: Number(data.get("amount")),
    date: String(data.get("date")),
    note: String(data.get("note") || "").trim(),
  });
  event.target.reset();
  event.target.date.value = today();
  persist();
});

document.getElementById("form-payment").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  const unitId = String(data.get("unitId"));
  if (!unitId) return;
  state.payments.push({
    id: uid(),
    unitId,
    amount: Number(data.get("amount")),
    date: String(data.get("date")),
    method: String(data.get("method")),
    note: String(data.get("note") || "").trim(),
  });
  event.target.reset();
  event.target.date.value = today();
  persist();
});

document.getElementById("form-expense").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  state.expenses.push({
    id: uid(),
    amount: Number(data.get("amount")),
    date: String(data.get("date")),
    category: String(data.get("category")),
    vendor: String(data.get("vendor") || "").trim(),
    note: String(data.get("note") || "").trim(),
  });
  event.target.reset();
  event.target.date.value = today();
  persist();
});

document.getElementById("form-building").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  state.building.name = String(data.get("name")).trim();
  state.building.address = String(data.get("address")).trim();
  persist();
});

document.body.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.deleteUnit) {
    if (!confirm("Remove this unit? Its charges and payments stay in history.")) return;
    state.units = state.units.filter((u) => u.id !== target.dataset.deleteUnit);
    persist();
  }
  if (target.dataset.deleteCharge) {
    state.charges = state.charges.filter((c) => c.id !== target.dataset.deleteCharge);
    persist();
  }
  if (target.dataset.deletePayment) {
    state.payments = state.payments.filter((p) => p.id !== target.dataset.deletePayment);
    persist();
  }
  if (target.dataset.deleteExpense) {
    state.expenses = state.expenses.filter((e) => e.id !== target.dataset.deleteExpense);
    persist();
  }
});

document.getElementById("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vaad-bait-accounts.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);
  state = { ...emptyState(), ...parsed };
  persist();
  event.target.value = "";
});

document.getElementById("btn-reset").addEventListener("click", () => {
  if (!confirm("Clear all building data in this browser?")) return;
  state = emptyState();
  persist();
});

document.getElementById("btn-sample").addEventListener("click", () => {
  if (state.units.length && !confirm("Replace current data with a sample building?")) return;
  const a = uid();
  const b = uid();
  const c = uid();
  state = {
    building: { name: "12 HaEmek St.", address: "Haifa" },
    units: [
      { id: a, number: "1", owner: "Levi", monthlyFee: 350 },
      { id: b, number: "2", owner: "Mizrahi", monthlyFee: 350 },
      { id: c, number: "3", owner: "Azulay", monthlyFee: 420 },
    ],
    charges: [
      { id: uid(), unitId: a, amount: 350, date: `${thisMonth()}-01`, note: `Monthly ${thisMonth()}` },
      { id: uid(), unitId: b, amount: 350, date: `${thisMonth()}-01`, note: `Monthly ${thisMonth()}` },
      { id: uid(), unitId: c, amount: 420, date: `${thisMonth()}-01`, note: `Monthly ${thisMonth()}` },
    ],
    payments: [
      { id: uid(), unitId: a, amount: 350, date: today(), method: "Bank transfer", note: "" },
      { id: uid(), unitId: b, amount: 200, date: today(), method: "Bit / PayBox", note: "partial" },
    ],
    expenses: [
      { id: uid(), amount: 480, date: today(), category: "Cleaning", vendor: "Niky", note: "March" },
      { id: uid(), amount: 190, date: today(), category: "Electricity", vendor: "IEC", note: "Lobby" },
    ],
  };
  persist();
});

document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.value = today();
});
document.querySelector('#form-charge-month input[name="period"]').value = thisMonth();

render();
