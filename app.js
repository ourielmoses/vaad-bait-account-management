const STORAGE_KEY = "vaad-bait-report-v1";
const L = window.VaadLogic;

const ui = {
  year: sessionStorage.getItem("vaad-year") || "",
  tab: "payments",
  panel: "waiting",
  query: "",
  openCats: {},
  activeId: "",
  draft: null,
  editApt: "",
  message: "",
  error: "",
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return L.emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.apartments)) return L.emptyState();
    return Object.assign(L.emptyState(), parsed);
  } catch (err) {
    return L.emptyState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  sessionStorage.setItem("vaad-year", ui.year || "");
}

function persist() {
  saveState();
  render();
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value) {
  let n = L.roundMoney(value);
  if (Math.abs(n) < 0.005) n = 0;
  const whole = Math.abs(n - Math.round(n)) < 0.001;
  return n.toLocaleString("he-IL", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

function hebDate(iso) {
  const parts = String(iso || "").split("-");
  if (parts.length < 3) return iso || "";
  return parts[2] + "." + parts[1] + "." + parts[0];
}

function txLabel(tx) {
  if (L.isCheckDeposit(tx)) return "הפקדת צ׳קים";
  return tx.payer || tx.payee || tx.description || "תנועה";
}

function render() {
  const years = L.yearsOf(state);
  if (ui.year && years.indexOf(ui.year) === -1) ui.year = "";
  document.getElementById("app").innerHTML = `
    <div class="app">
      <header class="top">
        <div>
          <p class="eyebrow">דוחות ועד בית</p>
          <input class="building-name" id="building-name" value="${esc(state.buildingName)}" aria-label="שם הבניין" />
        </div>
        <div class="actions noprint">
          <label class="file-btn">טעינת תנועות (CSV)
            <input id="csv-file" type="file" accept=".csv,text/csv" />
          </label>
          <label class="file-btn">טעינת דוח (JSON)
            <input id="json-file" type="file" accept="application/json,.json" />
          </label>
          <button type="button" id="save-json" ${state.transactions.length ? "" : "disabled"}>שמירת דוח (JSON)</button>
          <button type="button" id="clear-data" class="danger ghost">מחיקת נתונים</button>
        </div>
      </header>
      <p class="flash ${ui.error ? "is-error" : ""}">${esc(ui.error || ui.message)}</p>
      <main id="main">${ui.year ? yearView() : homeView(years)}</main>
    </div>`;
}

function homeView(years) {
  if (!years.length) {
    return `<section class="empty">
      <h2>מתחילים מקובץ הבנק</h2>
      <p>טוענים ייצוא תנועות (CSV) מהשנתיים האחרונות. הדוחות נפתחים לפי שנה, ובכל שנה יש שני דוחות: תשלומי הדיירים, והוצאות והכנסות.</p>
      <p class="hint">כל דירה אמורה לשלם 200 ₪ בחודש. העברה עם שם משויכת אוטומטית. הפקדת צ׳ק נשארת בצד עד שבוחרים לאיזו דירה היא שייכת. אם ההפקדה גדולה מ-200 ₪ אפשר לשייך כמה דיירים.</p>
    </section>`;
  }
  return `<section>
    <h2>בחירת שנה</h2>
    <p class="hint">אחרי הטעינה נכנסים לשנה. כדאי להתחיל ב-2025 ולבדוק את השיוכים לפני השנה הנוכחית.</p>
    <div class="cards">${years.slice().reverse().map(yearCard).join("")}</div>
  </section>`;
}

function yearCard(year) {
  const balance = L.yearBalance(state, year);
  const waiting = L.unassignedIncomes(state, year).length;
  const checks = L.unclassifiedExpenses(state, year).length;
  return `<button class="card" data-year="${esc(year)}">
    <h2>${esc(year)}</h2>
    <p class="hint">${hebDate(balance.from)} – ${hebDate(balance.to)} · ${balance.count} תנועות</p>
    <p class="figure">${money(balance.closing)} ₪</p>
    <p class="hint">יתרת סגירה</p>
    <p class="hint">${balance.balanced ? "המאזן מאוזן" : "המאזן לא מאוזן"} · ${waiting} תקבולים ממתינים · ${checks} שיקים לסיווג</p>
  </button>`;
}

function yearView() {
  const year = ui.year;
  const balance = L.yearBalance(state, year);
  const partial = balance.from.slice(5) !== "01-01";
  return `
    <div class="row noprint" style="margin-bottom:10px">
      <button type="button" data-year="">כל השנים</button>
      <div class="tabs">
        <button type="button" class="tab ${ui.tab === "payments" ? "is-active" : ""}" data-tab="payments">תשלומי דיירים</button>
        <button type="button" class="tab ${ui.tab === "expenses" ? "is-active" : ""}" data-tab="expenses">הוצאות והכנסות</button>
      </div>
    </div>
    ${balanceBanner(balance, partial)}
    <div class="year-layout">
      <div class="report">${ui.tab === "payments" ? paymentsReport(year) : expensesReport(year)}</div>
      <aside class="side noprint">${ui.tab === "payments" ? incomePanel(year) : expensePanel(year)}</aside>
    </div>`;
}

function balanceLine(label, value) {
  return `<div><span>${label}</span><b class="num">${money(value)} ₪</b></div>`;
}

function balanceBanner(balance, partial) {
  const gap = L.roundMoney(balance.left - balance.right);
  return `<div class="banner ${balance.balanced ? "is-ok" : "is-bad"}">
    <div class="eq">
      <div>
        ${balanceLine("יתרת פתיחה", balance.opening)}
        ${balanceLine("הכנסות", balance.income)}
        ${balanceLine("פתיחה + הכנסות", balance.left)}
      </div>
      <div>
        ${balanceLine("יתרת סגירה", balance.closing)}
        ${balanceLine("הוצאות", balance.expenses)}
        ${balanceLine("סגירה + הוצאות", balance.right)}
      </div>
    </div>
    <div>${balance.balanced ? "המאזן מאוזן: יתרת הפתיחה ועוד ההכנסות שוות ליתרת הסגירה ועוד ההוצאות." : "יש פער של " + money(gap) + " ₪."} ${partial ? "הקובץ של השנה הזו מתחיל ב-" + hebDate(balance.from) + ", לכן יתרת הפתיחה היא היתרה שלפני התנועה הראשונה בקובץ." : ""}</div>
  </div>`;
}

function paymentsReport(year) {
  const rows = L.paymentGrid(state, year);
  const specials = state.specialsByYear[year] || [];
  const totals = rows.reduce(
    (sum, row) => {
      sum.paid += row.paid;
      sum.expected += row.expected;
      sum.debt += row.debt;
      L.MONTHS.forEach((_, index) => {
        sum.months[index + 1] += row.byMonth[index + 1];
      });
      return sum;
    },
    { paid: 0, expected: 0, debt: 0, months: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } }
  );
  return `
    <h2>תשלומי דיירים ${esc(year)}</h2>
    <p class="hint">כל דירה אמורה לשלם ${money(state.defaultMonthlyFee)} ₪ בחודש. הסכום בחודש הוא מה שנכנס בבנק באותו חודש, גם אם הוא מכסה כמה חודשים או גבייה מיוחדת. יתרה קודמת חיובית היא זכות, שלילית היא חוב.</p>
    ${specialsEditor(year, specials)}
    ${ui.editApt ? apartmentEditor(ui.editApt) : ""}
    <div class="stats">
      <div class="stat"><span>שולם השנה</span><b>${money(totals.paid)}</b></div>
      <div class="stat"><span>צפי</span><b>${money(totals.expected)}</b></div>
      <div class="stat"><span>חוב כולל</span><b>${money(totals.debt)}</b></div>
      <div class="stat"><span>ממתינים לשיוך</span><b>${L.unassignedIncomes(state, year).length}</b></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th class="name">דירה</th>
        <th>שולם</th><th>יתרה קודמת</th><th>צפי</th><th>חוב</th>
        ${L.MONTHS.map((name) => `<th>${name}</th>`).join("")}
      </tr></thead>
      <tbody>
        ${rows.map((row) => paymentRow(row, year)).join("")}
        <tr class="foot">
          <td class="name">סה״כ</td>
          <td class="num">${money(totals.paid)}</td>
          <td></td>
          <td class="num">${money(totals.expected)}</td>
          <td class="num">${money(totals.debt)}</td>
          ${L.MONTHS.map((_, index) => `<td class="num">${money(totals.months[index + 1])}</td>`).join("")}
        </tr>
      </tbody>
    </table></div>`;
}

function specialsEditor(year, specials) {
  return `<div class="row noprint" style="margin:8px 0">
    ${specials
      .map(
        (item) => `<label>גבייה מיוחדת<input data-special-name="${esc(item.id)}" value="${esc(item.name)}" /></label>
          <label>סכום לדירה<input data-special-amount="${esc(item.id)}" type="number" step="0.01" value="${esc(item.amount)}" /></label>
          <button type="button" data-remove-special="${esc(item.id)}">הסר</button>`
      )
      .join("")}
    <button type="button" id="add-special">הוספת גבייה מיוחדת</button>
  </div>`;
}

function monthClass(amount, apartment, year, month) {
  if (apartment.annualOverride != null && apartment.annualOverride !== "") return amount > 0 ? "partial" : "";
  const fee = Number(apartment.monthlyFee) || 0;
  if (amount > 0 && Math.abs(amount - fee) < 0.05) return "ok";
  if (amount > 0) return "partial";
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (Number(year) < y || (Number(year) === y && month < m)) return "missing";
  return "";
}

function paymentRow(row, year) {
  const apt = row.apartment;
  const debtClass = row.debt > 0.05 ? "debt" : row.debt < -0.05 ? "credit" : "";
  return `<tr>
    <td class="name">
      <button type="button" class="ghost" data-edit-apt="${esc(apt.id)}">${esc(apt.number)}. ${esc(apt.payer)}</button>
      <small>${esc(apt.owner)}${apt.paysByCheck ? " · צ׳ק" : ""}${apt.annualOverride != null && apt.annualOverride !== "" ? " · צפי " + money(apt.annualOverride) : ""}</small>
    </td>
    <td class="num">${money(row.paid)}</td>
    <td><input data-prior="${esc(apt.id)}" type="number" step="0.01" value="${esc(row.prior)}" style="width:84px" aria-label="יתרה קודמת" /></td>
    <td class="num">${money(row.expected)}</td>
    <td class="num ${debtClass}">${money(row.debt)}</td>
    ${L.MONTHS.map((_, index) => {
      const month = index + 1;
      const amount = row.byMonth[month];
      return `<td class="num cell ${monthClass(amount, apt, year, month)}">${amount ? money(amount) : ""}</td>`;
    }).join("")}
  </tr>`;
}

function apartmentEditor(id) {
  const apt = L.apartmentById(state, id);
  if (!apt) return "";
  return `<form class="editor" id="apt-form">
    <label>משלם<input name="payer" value="${esc(apt.payer)}" required /></label>
    <label>בעל דירה<input name="owner" value="${esc(apt.owner)}" /></label>
    <label>דמי חודש<input name="monthlyFee" type="number" step="0.01" value="${esc(apt.monthlyFee)}" /></label>
    <label>צפי שנתי קבוע<input name="annualOverride" type="number" step="0.01" value="${apt.annualOverride == null ? "" : esc(apt.annualOverride)}" placeholder="ריק = לפי חודש" /></label>
    <label>שמות לזיהוי מהבנק<input name="aliases" value="${esc((apt.aliases || []).join(", "))}" /></label>
    <label>צ׳ק<input name="paysByCheck" type="checkbox" ${apt.paysByCheck ? "checked" : ""} /></label>
    <div class="row">
      <button type="submit" class="primary">שמירת דירה</button>
      <button type="button" data-edit-apt="">סגירה</button>
    </div>
  </form>`;
}

function incomePanel(year) {
  const tx = state.transactions.find((item) => item.id === ui.activeId && L.txYear(item) === year && item.credit > 0);
  const list = creditsForPanel(year);
  return `
    <h3>${ui.panel === "waiting" ? "תקבולים ללא שיוך" : "כל התקבולים"}</h3>
    <div class="tabs">
      <button type="button" class="${ui.panel === "waiting" ? "is-active" : ""}" data-panel="waiting">ממתינים (${L.unassignedIncomes(state, year).length})</button>
      <button type="button" class="${ui.panel === "all" ? "is-active" : ""}" data-panel="all">הכול</button>
    </div>
    <input class="search" id="tx-search" placeholder="חיפוש לפי שם, סכום או אסמכתא" value="${esc(ui.query)}" />
    ${tx ? assignmentEditor(tx) : `<p class="hint">בוחרים תנועה ומשייכים לדירה. דירות שמשלמות בצ׳ק מופיעות לחיצה מהירה.</p>`}
    ${list.slice(0, 80).map(txButton).join("")}
    ${list.length > 80 ? `<p class="hint">מוצגות 80 מתוך ${list.length}. כדאי לצמצם בחיפוש.</p>` : ""}
    ${list.length ? "" : `<p class="hint">אין תנועות ברשימה הזו.</p>`}`;
}

function creditsForPanel(year) {
  const q = ui.query.trim();
  return L.txsInYear(state, year)
    .filter((tx) => tx.credit > 0)
    .filter((tx) => (ui.panel === "waiting" ? tx.role === "unassigned" : true))
    .filter((tx) => {
      if (!q) return true;
      const blob = [tx.payer, tx.description, tx.details, tx.reference, String(tx.credit), txLabel(tx)].join(" ");
      return blob.indexOf(q) !== -1;
    })
    .slice()
    .reverse();
}

function txButton(tx) {
  const who = tx.role === "vaad"
    ? (tx.apartmentSplits || [])
        .map((split) => {
          const apt = L.apartmentById(state, split.apartmentId);
          return (apt ? apt.payer : split.apartmentId) + " " + money(split.amount);
        })
        .join(" · ")
    : tx.role === "other-income"
      ? "הכנסה אחרת"
      : "לא שויך";
  return `<button type="button" class="tx ${tx.id === ui.activeId ? "is-active" : ""}" data-tx="${esc(tx.id)}">
    <b>${money(tx.credit)} ₪</b> · ${hebDate(tx.date)}<br />
    ${esc(txLabel(tx))}<br />
    <span class="hint">${esc(who)}${tx.reference ? " · אסמכתא " + esc(tx.reference) : ""}</span>
  </button>`;
}

function assignmentEditor(tx) {
  const draft = ui.draft || { lines: [], remember: false };
  const used = L.roundMoney(draft.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
  const remain = L.roundMoney(tx.credit - used);
  const checks = state.apartments.filter((apt) => apt.paysByCheck).sort((a, b) => a.number - b.number);
  const hint = String(tx.details || "").indexOf("156975") !== -1 ? "מספר החשבון בפרטים מוכר אצל רפאל יושעי, אבל הסכום עשוי לכלול כמה צ׳קים." : "";
  return `<div class="editor" style="display:block">
    <strong>${money(tx.credit)} ₪</strong>
    <div>${hebDate(tx.date)} · ${esc(tx.description)}</div>
    <div class="hint">${esc(tx.payer || tx.details || "")}</div>
    ${tx.credit > 200 ? `<p class="hint">הסכום גדול מ-200 ₪. אפשר לבחור כמה דיירים, למשל שני צ׳קים של 200.</p>` : ""}
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
    <p>דירות שמשלמות בצ׳ק</p>
    <div class="chips">${checks
      .map((apt) => `<button type="button" data-chip="${esc(apt.id)}">${esc(apt.number)}. ${esc(apt.payer)} +${money(Math.min(200, Math.max(remain, 0)) || 200)}</button>`)
      .join("")}</div>
    <div class="lines">${draft.lines
      .map(
        (line, index) => `<div class="line">
          <span>${esc(aptName(line.apartmentId))}</span>
          <input data-split-amount="${index}" type="number" min="0" step="0.01" value="${esc(line.amount)}" />
          <button type="button" data-remove-line="${index}">הסר</button>
        </div>`
      )
      .join("")}</div>
    <div class="row">
      <select id="any-apt">${state.apartments
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((apt) => `<option value="${esc(apt.id)}">${esc(apt.number)}. ${esc(apt.payer)}</option>`)
        .join("")}</select>
      <button type="button" id="add-apt">הוספה</button>
    </div>
    <p id="remain" class="${Math.abs(remain) < 0.05 ? "" : "debt"}">נשאר לשייך: ${money(remain)} ₪</p>
    ${tx.payer ? `<label class="row"><input id="remember-alias" type="checkbox" ${draft.remember ? "checked" : ""} /> זכור את השם לדירה שנבחרה</label>` : ""}
    <div class="row">
      <button type="button" data-assign="${esc(tx.id)}" class="primary">שיוך</button>
      <button type="button" data-other="${esc(tx.id)}">זו לא הכנסת ועד</button>
      ${tx.role !== "unassigned" ? `<button type="button" data-clear-tx="${esc(tx.id)}">ביטול שיוך</button>` : ""}
    </div>
  </div>`;
}

function aptName(id) {
  const apt = L.apartmentById(state, id);
  return apt ? apt.number + ". " + apt.payer : id;
}

function expensesReport(year) {
  const report = L.expenseReport(state, year);
  const balance = report.balance;
  const expenseRows = report.categories
    .map(
      (cat) => `<li><span>${esc(cat.name)}</span><span class="num">${money(cat.amount)} ₪</span></li>`
    )
    .join("");
  const expenseSum = L.roundMoney(report.categories.reduce((sum, cat) => sum + cat.amount, 0));
  return `
    <h2>דו״ח הוצאות והכנסות</h2>
    <p class="hint">לתקופה: שנת ${esc(year)} · ${esc(state.buildingName)}</p>
    <div class="statement">
      <section>
        <h3>הוצאות</h3>
        <ul>${expenseRows || `<li><span>אין הוצאות</span><span></span></li>`}</ul>
        <div class="cat-row total"><span>סה״כ הוצאות</span><span class="num">${money(expenseSum)} ₪</span></div>
      </section>
      <section>
        <h3>הכנסות</h3>
        <ul>
          <li><span>יתרה מתחילת השנה</span><span class="num">${money(balance.opening)} ₪</span></li>
          <li><span>דמי ועד ששויכו</span><span class="num">${money(report.vaad)} ₪</span></li>
          <li><span>תקבולים שטרם שויכו</span><span class="num">${money(report.unassigned)} ₪</span></li>
          <li><span>הכנסות אחרות</span><span class="num">${money(report.other)} ₪</span></li>
        </ul>
        <div class="cat-row total"><span>סה״כ הכנסות בלי יתרת פתיחה</span><span class="num">${money(balance.income)} ₪</span></div>
        <div class="cat-row total"><span>פתיחה + הכנסות</span><span class="num">${money(balance.left)} ₪</span></div>
      </section>
    </div>
    <p class="hint" style="margin-top:10px">יתרת סגירה ${money(balance.closing)} ₪. פתיחה + הכנסות צריכות להיות שוות לסגירה + הוצאות.</p>
    ${report.categories
      .map(
        (cat) => `<details ${ui.openCats[cat.name] ? "open" : ""} data-cat-name="${esc(cat.name)}">
          <summary>${esc(cat.name)} · ${money(cat.amount)} ₪</summary>
          <div class="table-wrap"><table>
            <thead><tr><th>תאריך</th><th>תיאור</th><th>אסמכתא</th><th>סכום</th><th class="noprint">סיווג</th></tr></thead>
            <tbody>${cat.items
              .map(
                (tx) => `<tr>
                  <td>${hebDate(tx.date)}</td>
                  <td>${esc(tx.payee || tx.description)}${tx.purpose ? " · " + esc(tx.purpose) : ""}</td>
                  <td>${esc(tx.reference || "")}</td>
                  <td class="num">${money(tx.debit)}</td>
                  <td class="noprint">${categorySelect(tx)}</td>
                </tr>`
              )
              .join("")}</tbody>
          </table></div>
        </details>`
      )
      .join("")}`;
}

function categorySelect(tx) {
  const options = [`<option value="">טרם סווג</option>`]
    .concat(L.EXPENSE_CATEGORIES.map((name) => `<option ${tx.expenseCategory === name ? "selected" : ""}>${esc(name)}</option>`))
    .join("");
  return `<select data-category="${esc(tx.id)}">${options}</select>`;
}

function expensePanel(year) {
  const list = L.unclassifiedExpenses(state, year);
  const sum = L.roundMoney(list.reduce((total, tx) => total + tx.debit, 0));
  return `
    <h3>שיקים והוצאות בלי סיווג</h3>
    <p class="hint">${list.length ? money(sum) + " ₪ עדיין בלי קטגוריה. המאזן כולל אותם, אבל הפירוט לא שלם עד שבוחרים קטגוריה." : "כל ההוצאות מסווגות."}</p>
    ${list
      .map(
        (tx) => `<div class="tx">
          <b>${money(tx.debit)} ₪</b> · ${hebDate(tx.date)} · אסמכתא ${esc(tx.reference || "—")}<br />
          ${esc(tx.description)}${tx.purpose ? " · " + esc(tx.purpose) : ""}
          <div class="row" style="margin-top:6px">${categorySelect(tx)}
            ${tx.description === "שיק" ? "" : `<label class="row"><input type="checkbox" data-remember-cat="${esc(tx.id)}" /> החל על דומים</label>`}
          </div>
        </div>`
      )
      .join("")}`;
}

function openTx(id) {
  const tx = state.transactions.find((item) => item.id === id);
  ui.activeId = id;
  ui.error = "";
  ui.draft = {
    lines: (tx && tx.apartmentSplits ? tx.apartmentSplits : []).map((split) => ({
      apartmentId: split.apartmentId,
      amount: split.amount,
    })),
    remember: false,
  };
  render();
}

function addChip(apartmentId) {
  const tx = state.transactions.find((item) => item.id === ui.activeId);
  if (!tx || !ui.draft) return;
  const used = L.roundMoney(ui.draft.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
  const remain = L.roundMoney(tx.credit - used);
  if (remain <= 0) return;
  const add = Math.min(200, remain);
  const line = ui.draft.lines.find((item) => item.apartmentId === apartmentId);
  if (line) line.amount = L.roundMoney(Number(line.amount) + add);
  else ui.draft.lines.push({ apartmentId, amount: add });
  render();
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "UTF-8");
  });
}

document.body.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.year !== undefined) {
    ui.year = target.dataset.year;
    ui.activeId = "";
    ui.editApt = "";
    ui.message = "";
    ui.error = "";
    persist();
    return;
  }
  if (target.dataset.tab) {
    ui.tab = target.dataset.tab;
    ui.error = "";
    render();
    return;
  }
  if (target.dataset.panel) {
    ui.panel = target.dataset.panel;
    render();
    return;
  }
  if (target.dataset.tx) {
    openTx(target.dataset.tx);
    return;
  }
  if (target.dataset.chip) {
    addChip(target.dataset.chip);
    return;
  }
  if (target.dataset.removeLine !== undefined && ui.draft) {
    ui.draft.lines.splice(Number(target.dataset.removeLine), 1);
    render();
    return;
  }
  if (target.id === "add-apt") {
    const select = document.getElementById("any-apt");
    if (select) addChip(select.value);
    return;
  }
  if (target.dataset.assign) {
    const result = L.assignIncome(state, target.dataset.assign, ui.draft ? ui.draft.lines : []);
    if (!result.ok) {
      ui.error = result.error;
      render();
      return;
    }
    const tx = state.transactions.find((item) => item.id === target.dataset.assign);
    if (ui.draft && ui.draft.remember && tx && tx.payer && ui.draft.lines.length === 1) {
      L.learnAlias(state, ui.draft.lines[0].apartmentId, tx.payer);
      state.transactions.forEach((other) => {
        if (other.splitsManual || other.credit <= 0 || other.payer !== tx.payer) return;
        const apt = L.matchApartment(other.payer, state.apartments);
        if (!apt) return;
        other.role = "vaad";
        other.apartmentSplits = [{ apartmentId: apt.id, amount: other.credit }];
      });
    }
    ui.message = "התנועה שויכה";
    ui.error = "";
    ui.activeId = "";
    persist();
    return;
  }
  if (target.dataset.other) {
    L.markOtherIncome(state, target.dataset.other);
    ui.activeId = "";
    ui.message = "סומן כהכנסה אחרת";
    persist();
    return;
  }
  if (target.dataset.clearTx) {
    L.clearAssignment(state, target.dataset.clearTx);
    ui.message = "השיוך בוטל";
    openTx(target.dataset.clearTx);
    saveState();
    return;
  }
  if (target.dataset.editApt !== undefined) {
    ui.editApt = target.dataset.editApt;
    render();
    return;
  }
  if (target.id === "add-special") {
    const year = ui.year;
    state.specialsByYear[year] = state.specialsByYear[year] || [];
    state.specialsByYear[year].push({ id: "s" + Date.now(), name: "גבייה", amount: 0 });
    persist();
    return;
  }
  if (target.dataset.removeSpecial) {
    const year = ui.year;
    state.specialsByYear[year] = (state.specialsByYear[year] || []).filter((item) => item.id !== target.dataset.removeSpecial);
    persist();
    return;
  }
  if (target.id === "save-json") {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vaad-bait-" + (ui.year || "report") + ".json";
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (target.id === "clear-data") {
    if (!confirm("למחוק את כל הנתונים מהדפדפן?")) return;
    state = L.emptyState();
    ui.year = "";
    ui.activeId = "";
    ui.message = "הנתונים נמחקו";
    persist();
  }
});

document.body.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.id === "building-name") {
    state.buildingName = target.value.trim() || state.buildingName;
    persist();
    return;
  }
  if (target.id === "csv-file") {
    const file = target.files && target.files[0];
    if (!file) return;
    if (state.transactions.length && !confirm("להחליף את התנועות? שיוך ידני לאותה תנועה יישמר.")) {
      target.value = "";
      return;
    }
    try {
      L.importCsv(state, await readFile(file));
      ui.year = "";
      ui.message = "נטענו " + state.transactions.length + " תנועות. בחרו שנה.";
      ui.error = "";
      persist();
    } catch (err) {
      ui.error = err.message || "טעינת הקובץ נכשלה";
      render();
    }
    return;
  }
  if (target.id === "json-file") {
    const file = target.files && target.files[0];
    if (!file) return;
    if (state.transactions.length && !confirm("להחליף את הדוח השמור בדוח מהקובץ?")) return;
    try {
      const parsed = JSON.parse(await readFile(file));
      if (!parsed || !Array.isArray(parsed.apartments) || !Array.isArray(parsed.transactions)) {
        throw new Error("קובץ ה-JSON לא נראה כמו דוח של האפליקציה");
      }
      state = Object.assign(L.emptyState(), parsed);
      ui.year = "";
      ui.message = "הדוח נטען";
      ui.error = "";
      persist();
    } catch (err) {
      ui.error = err.message || "טעינת JSON נכשלה";
      render();
    }
    return;
  }
  if (target.dataset.prior) {
    const year = ui.year;
    state.priorByYear[year] = state.priorByYear[year] || {};
    state.priorByYear[year][target.dataset.prior] = L.roundMoney(target.value);
    persist();
    return;
  }
  if (target.dataset.specialName) {
    const item = (state.specialsByYear[ui.year] || []).find((special) => special.id === target.dataset.specialName);
    if (item) item.name = target.value.trim() || item.name;
    persist();
    return;
  }
  if (target.dataset.specialAmount) {
    const item = (state.specialsByYear[ui.year] || []).find((special) => special.id === target.dataset.specialAmount);
    if (item) item.amount = L.roundMoney(target.value);
    persist();
    return;
  }
  if (target.dataset.splitAmount !== undefined && ui.draft) {
    ui.draft.lines[Number(target.dataset.splitAmount)].amount = L.roundMoney(target.value);
    const tx = state.transactions.find((item) => item.id === ui.activeId);
    const used = L.roundMoney(ui.draft.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
    const remain = document.getElementById("remain");
    if (remain && tx) {
      const left = L.roundMoney(tx.credit - used);
      remain.textContent = "נשאר לשייך: " + money(left) + " ₪";
      remain.className = Math.abs(left) < 0.05 ? "" : "debt";
    }
    return;
  }
  if (target.id === "remember-alias" && ui.draft) {
    ui.draft.remember = target.checked;
    return;
  }
  if (target.dataset.category) {
    const remember = document.querySelector(`[data-remember-cat="${CSS.escape(target.dataset.category)}"]`);
    L.setExpenseCategory(state, target.dataset.category, target.value, Boolean(remember && remember.checked));
    ui.message = "הסיווג עודכן";
    persist();
  }
});

document.body.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "tx-search") {
    ui.query = target.value;
    const caret = target.selectionStart;
    render();
    const field = document.getElementById("tx-search");
    if (field) {
      field.focus();
      field.setSelectionRange(caret, caret);
    }
    return;
  }
  if (target.dataset.splitAmount !== undefined && ui.draft) {
    ui.draft.lines[Number(target.dataset.splitAmount)].amount = L.roundMoney(target.value);
    const tx = state.transactions.find((item) => item.id === ui.activeId);
    const used = L.roundMoney(ui.draft.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
    const remain = document.getElementById("remain");
    if (remain && tx) {
      const left = L.roundMoney(tx.credit - used);
      remain.textContent = "נשאר לשייך: " + money(left) + " ₪";
      remain.className = Math.abs(left) < 0.05 ? "" : "debt";
    }
  }
});

document.body.addEventListener("toggle", (event) => {
  const details = event.target;
  if (!details || details.tagName !== "DETAILS" || !details.dataset.catName) return;
  ui.openCats[details.dataset.catName] = details.open;
}, true);

document.body.addEventListener("submit", (event) => {
  if (event.target.id !== "apt-form") return;
  event.preventDefault();
  const apt = L.apartmentById(state, ui.editApt);
  if (!apt) return;
  const data = new FormData(event.target);
  apt.payer = String(data.get("payer") || "").trim() || apt.payer;
  apt.owner = String(data.get("owner") || "").trim();
  apt.monthlyFee = L.roundMoney(data.get("monthlyFee"));
  const override = String(data.get("annualOverride") || "").trim();
  apt.annualOverride = override === "" ? null : L.roundMoney(override);
  apt.paysByCheck = event.target.paysByCheck.checked;
  apt.aliases = String(data.get("aliases") || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  ui.message = "הדירה נשמרה";
  persist();
});

render();
