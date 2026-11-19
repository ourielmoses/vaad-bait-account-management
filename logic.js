/* global window */
(function (root) {
  const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

  const EXPENSE_CATEGORIES = [
    "חשמל",
    "מעליות",
    "ביטוחים",
    "ניקיון",
    "גינון",
    "עמלות בנק",
    "בזק",
    "תחזוקה",
    "כספי נאמנות",
    "שונות",
  ];

  function apt(number, payer, owner, extra) {
    return Object.assign(
      {
        id: String(number),
        number,
        payer,
        owner,
        paysByCheck: false,
        monthlyFee: 200,
        annualOverride: null,
        aliases: [],
      },
      extra || {}
    );
  }

  function seedApartments() {
    return [
      apt(1, "יצחק שניאור", "יצחק שניאור", { aliases: ["שנאור יצחק", "יצחק שניאור"] }),
      apt(2, "אלישה וגדעון שניידר", "פיני כהן", { aliases: ["שניידר", "ברדוגו"] }),
      apt(3, "רוני אהרוני", "רוני אהרוני", { paysByCheck: true, aliases: ["אהרוני"] }),
      apt(4, "צחי עמדי", "סוזן ויהודה אזואלוס", { aliases: ["עמדי", "אזואלוס"] }),
      apt(5, "ליאור רגב", "ליאור רגב", { aliases: ["צמח ענת", "רגב ליא", "ליאור רגב"] }),
      apt(6, "אוריאל הרשקו", "דני ויעל רייכנר", { aliases: ["הרשקו"] }),
      apt(7, "ישראל אבוחצירא", "ישראל אבוחצירא", { aliases: ["אבוחצירא", "אבו חצירא", "אביחצירא"] }),
      apt(8, "עמי לביא", "יגאל לביא", { aliases: ["יגאל לביא", "עמי לביא"] }),
      apt(9, "שולי כהן", "שושנה כהן", { paysByCheck: true, aliases: ["כהן שולמית", "שולמית", "כהן שושנה", "שושנה כהן", "שולי כהן"] }),
      apt(10, "ורדית זלינגר", "נתנאל אליהו", { aliases: ["זלינגר", "אליהו נתנאל"] }),
      apt(11, "ליאת וניסים אוחנה", "ליאת וניסים אוחנה", { aliases: ["אוחנא", "אוחנה"] }),
      apt(12, "ג'נט אדרי", "ג'נט אדרי", { aliases: ["אדרי"] }),
      apt(13, "גיל שיליאן", "דב צוובנר", { aliases: ["שיליאן", "צוובנר", "צובנר", "שטרנברג"] }),
      apt(14, "ישראל לוי", "ישראל לוי", { aliases: ["ישראל לוי", "לוי ישראל", "רוחמה"] }),
      apt(15, "רפאל יושעי", "רפאל יושעי", { paysByCheck: true, aliases: ["יושעי"] }),
      apt(16, "אוהד דומב", "אוהד דומב", { aliases: ["דומב"], annualOverride: 800 }),
      apt(17, "חבאני נתנאל", "רחל יבלוביץ", { aliases: ["חבאני", "יבלוביץ"] }),
      apt(18, "שושי שהם", "שושי שהם", { aliases: ["שהם"] }),
      apt(19, "יערית אשכנזי", "יערית אשכנזי", { aliases: ["אשכנזי", "אשכנ"] }),
      apt(20, "ישי וזוהר זוסמן", "עידית ארליכמן", { aliases: ["זוסמן"] }),
      apt(21, "משה נבון", "משה נבון", { aliases: ["נבון"] }),
      apt(22, "רונית הולובר", "זאק וענונו", { aliases: ["הולובר", "ורונית הול", "רונית הול"] }),
      apt(23, "לאה אמויאל ורווח רפאלה", "לאה אמויאל ורווח רפאלה", { aliases: ["אמויאל", "רווח רפאלה"] }),
      apt(24, "שטינמץ עמיחי", "אליעזר יפה", { aliases: ["שטינמץ", "יפה אליעזר"] }),
      apt(25, "אילן לוי", "אילן לוי", { aliases: ["לוי אילן", "אילן לוי"] }),
      apt(26, "אוריאל מוזס", "אוריאל מוזס", { aliases: ["מוזס"] }),
      apt(27, "אפרים וצביה זינגר", "אפרים וצביה זינגר", { paysByCheck: true, aliases: ["זינגר"] }),
      apt(28, "אבי גרינבאום", "אבי גרינבאום", { aliases: ["גרינבאו"] }),
      apt(29, "דני ויעל רייכנר", "דני ויעל רייכנר", { aliases: ["רייכנר"] }),
    ];
  }

  function emptyState() {
    return {
      version: 1,
      buildingName: "ועד בית פנקס 5 ירושלים",
      defaultMonthlyFee: 200,
      apartments: seedApartments(),
      specialsByYear: { "2025": [{ id: "tvia-2025", name: "תביעה", amount: 800 }] },
      priorByYear: {},
      transactions: [],
      categoryRules: [],
    };
  }

  function norm(text) {
    return String(text || "")
      .replace(/[׳'"״”“]/g, "")
      .replace(/[\\/|,.-]/g, " ")
      .replace(/[^\u0590-\u05FF0-9a-zA-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function roundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function parseAmount(value) {
    const cleaned = String(value || "").replace(/[₪,\s]/g, "").trim();
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? roundMoney(n) : 0;
  }

  function splitQuoted(line) {
    const row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cell += '"';
            i++;
          } else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else cell += ch;
    }
    row.push(cell);
    return row;
  }

  // Bank exports put raw quotation marks inside the description ("המרכז לבטיחות)
  // without quoting the field. Fall back to a plain comma split when that happens.
  function splitCsvLine(line, expected) {
    if (line.indexOf('"') === -1) return line.split(",");
    const quoted = splitQuoted(line);
    if (expected && quoted.length === expected) return quoted;
    return line.split(",");
  }

  function parseCsv(text) {
    const lines = String(text || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim());
    if (!lines.length) return [];
    const header = splitCsvLine(lines[0]);
    const width = header.length;
    return lines.map((line) => splitCsvLine(line, width));
  }

  function headerIndex(headers, names) {
    const trimmed = headers.map((h) => h.trim());
    return trimmed.findIndex((h) => names.indexOf(h) !== -1);
  }

  function isoDate(value) {
    const v = String(value || "").trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
    const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(v);
    if (dmy) return dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0");
    return "";
  }

  function extractParty(details) {
    const d = String(details || "").replace(/\s+/g, " ").trim();
    const payer = /המבצע:\s*(.+?)(?:\s+עבור:|$)/.exec(d);
    const payee = /לטובת:\s*(.+?)(?:\s+עבור:|$)/.exec(d);
    const purpose = /עבור:\s*(.+)$/.exec(d);
    const clean = (m) => (m ? m[1].trim() : "");
    return { payer: clean(payer), payee: clean(payee), purpose: clean(purpose) };
  }

  function fingerprint(tx, index) {
    return [tx.date, tx.description, tx.debit, tx.credit, tx.balance, tx.reference, index].join("|");
  }

  function parseBankCsv(text) {
    const table = parseCsv(text);
    if (!table.length) throw new Error("הקובץ ריק");
    const headers = table[0].map((h) => h.trim());
    const col = {
      date: headerIndex(headers, ["תאריך"]),
      description: headerIndex(headers, ["תיאור הפעולה", "הפעולה"]),
      details: headerIndex(headers, ["פרטים"]),
      reference: headerIndex(headers, ["אסמכתא"]),
      debit: headerIndex(headers, ["חובה"]),
      credit: headerIndex(headers, ["זכות"]),
      balance: headerIndex(headers, ["יתרה לאחר פעולה", "יתרה בש''ח", 'יתרה בש"ח', "יתרה בש״ח"]),
      valueDate: headerIndex(headers, ["תאריך ערך"]),
      account: headerIndex(headers, ["חשבון"]),
    };
    if (col.date < 0 || col.debit < 0 || col.credit < 0) {
      throw new Error("הקובץ לא נראה כמו ייצוא תנועות מהבנק. צריך עמודות תאריך, חובה וזכות.");
    }
    const at = (row, i) => (i < 0 ? "" : String(row[i] == null ? "" : row[i]).trim());
    const txs = [];
    table.slice(1).forEach((row) => {
      const date = isoDate(at(row, col.date));
      if (!date) return;
      const debit = parseAmount(at(row, col.debit));
      const credit = parseAmount(at(row, col.credit));
      if (!debit && !credit) return;
      const details = at(row, col.details);
      const party = extractParty(details);
      txs.push({
        date,
        valueDate: isoDate(at(row, col.valueDate)) || date,
        description: at(row, col.description),
        details,
        account: at(row, col.account),
        reference: at(row, col.reference).replace(/\.0$/, ""),
        debit,
        credit,
        balance: parseAmount(at(row, col.balance)),
        payer: party.payer,
        payee: party.payee,
        purpose: party.purpose,
      });
    });
    if (!txs.length) throw new Error("לא נמצאו תנועות בקובץ");
    if (txs[0].date > txs[txs.length - 1].date) txs.reverse();
    return txs.map((tx, index) => Object.assign({ id: fingerprint(tx, index) }, tx));
  }

  function matchApartment(name, apartments) {
    const n = norm(name);
    if (!n) return null;
    let best = [];
    let bestLen = 0;
    apartments.forEach((apartment) => {
      (apartment.aliases || []).concat([apartment.payer, apartment.owner]).forEach((alias) => {
        const a = norm(alias);
        if (a.length < 3) return;
        if (n.includes(a)) {
          if (a.length > bestLen) {
            best = [apartment];
            bestLen = a.length;
          } else if (a.length === bestLen && best.indexOf(apartment) === -1) best.push(apartment);
        }
      });
    });
    return best.length === 1 ? best[0] : null;
  }

  function isCheckDeposit(tx) {
    const d = tx.description || "";
    return d.indexOf("הפק.שיק") !== -1 || d.indexOf("הפקדת שיק") !== -1 || d.indexOf("הפק שיק") !== -1;
  }

  function isOutgoingCheck(tx) {
    const description = String(tx.description || "").trim();
    return tx.debit > 0 && (description === "שיק" || description.indexOf("שיק ") === 0 || description.indexOf("שיק-") === 0);
  }

  function isBounced(tx) {
    return (tx.description || "").indexOf("החזרת שיק") !== -1;
  }

  function guessExpenseCategory(tx) {
    const blob = [tx.description, tx.payee, tx.purpose, tx.details].join(" ");
    if (/חשמל/.test(blob)) return "חשמל";
    if (/בזק/.test(blob)) return "בזק";
    if (/מסלול מורחב|עמל/.test(blob)) return "עמלות בנק";
    if (/שינדלר|מעל|פלד רון|בטיחות/.test(blob)) return "מעליות";
    if (/נקיון|ניקיון|מנקה/.test(blob)) return "ניקיון";
    if (/גינון|גינה|פרחים|חרמש/.test(blob)) return "גינון";
    if (/ביטוח/.test(blob)) return "ביטוחים";
    if (/נאמנות|תמ/.test(blob)) return "כספי נאמנות";
    if (isBounced(tx)) return "שונות";
    if (isOutgoingCheck(tx)) return null;
    return "תחזוקה";
  }

  function ruleCategory(tx, rules) {
    const blob = [tx.description, tx.payee, tx.purpose].join(" ").trim();
    let found = null;
    (rules || []).forEach((rule) => {
      if (rule.pattern && blob.indexOf(rule.pattern) !== -1) found = rule.category;
    });
    return found;
  }

  function autoClassify(tx, state) {
    const next = Object.assign({}, tx, {
      role: "unassigned",
      apartmentSplits: [],
      splitsManual: false,
      expenseCategory: null,
      categoryManual: false,
    });
    if (tx.credit > 0) {
      if (isBounced(tx)) {
        next.role = "other-income";
        return next;
      }
      if (isCheckDeposit(tx) || !tx.payer) {
        next.role = "unassigned";
        return next;
      }
      const apartment = matchApartment(tx.payer, state.apartments);
      if (!apartment) {
        next.role = "unassigned";
        return next;
      }
      next.role = "vaad";
      next.apartmentSplits = [{ apartmentId: apartment.id, amount: tx.credit }];
      return next;
    }
    next.role = "expense";
    const ruled = ruleCategory(tx, state.categoryRules);
    next.expenseCategory = ruled || guessExpenseCategory(tx);
    next.categoryManual = Boolean(ruled);
    return next;
  }

  function importCsv(state, text) {
    const parsed = parseBankCsv(text);
    const previous = {};
    state.transactions.forEach((tx) => {
      previous[tx.id] = tx;
    });
    state.transactions = parsed.map((tx) => {
      const old = previous[tx.id];
      if (old && (old.splitsManual || old.categoryManual)) {
        return Object.assign(autoClassify(tx, state), {
          role: old.role,
          apartmentSplits: old.apartmentSplits || [],
          splitsManual: old.splitsManual,
          expenseCategory: old.expenseCategory,
          categoryManual: old.categoryManual,
        });
      }
      return autoClassify(tx, state);
    });
    return state;
  }

  function txYear(tx) {
    return String(tx.date || "").slice(0, 4);
  }

  function txsInYear(state, year) {
    return state.transactions.filter((tx) => txYear(tx) === String(year));
  }

  function yearsOf(state) {
    const set = {};
    state.transactions.forEach((tx) => {
      const y = txYear(tx);
      if (y) set[y] = true;
    });
    return Object.keys(set).sort();
  }

  function yearBalance(state, year) {
    const list = txsInYear(state, year);
    if (!list.length) return null;
    const first = list[0];
    const last = list[list.length - 1];
    const opening = roundMoney(first.balance - first.credit + first.debit);
    const closing = roundMoney(last.balance);
    const income = roundMoney(list.reduce((sum, tx) => sum + tx.credit, 0));
    const expenses = roundMoney(list.reduce((sum, tx) => sum + tx.debit, 0));
    const left = roundMoney(opening + income);
    const right = roundMoney(closing + expenses);
    return {
      opening,
      closing,
      income,
      expenses,
      left,
      right,
      balanced: Math.abs(left - right) < 0.05,
      from: first.date,
      to: last.date,
      count: list.length,
    };
  }

  function apartmentById(state, id) {
    return state.apartments.find((a) => a.id === String(id)) || null;
  }

  function expectedFor(state, apartment, year) {
    if (apartment.annualOverride != null && apartment.annualOverride !== "") return roundMoney(apartment.annualOverride);
    const specials = (state.specialsByYear[String(year)] || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return roundMoney(Number(apartment.monthlyFee) * 12 + specials);
  }

  function priorFor(state, year, apartmentId) {
    const bag = state.priorByYear[String(year)] || {};
    return roundMoney(bag[String(apartmentId)] || 0);
  }

  function monthKey(date) {
    return Number(String(date).slice(5, 7));
  }

  function paymentGrid(state, year) {
    const months = {};
    state.apartments.forEach((apartment) => {
      months[apartment.id] = {};
      for (let m = 1; m <= 12; m++) months[apartment.id][m] = 0;
    });
    txsInYear(state, year).forEach((tx) => {
      if (tx.role !== "vaad") return;
      const month = monthKey(tx.date);
      (tx.apartmentSplits || []).forEach((split) => {
        if (!months[split.apartmentId]) return;
        months[split.apartmentId][month] = roundMoney(months[split.apartmentId][month] + Number(split.amount));
      });
    });
    return state.apartments
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((apartment) => {
        const byMonth = months[apartment.id];
        const paid = roundMoney(Object.keys(byMonth).reduce((sum, m) => sum + byMonth[m], 0));
        const prior = priorFor(state, year, apartment.id);
        const expected = expectedFor(state, apartment, year);
        const total = roundMoney(prior + paid);
        const debt = roundMoney(expected - total);
        return { apartment, byMonth, paid, prior, expected, total, debt };
      });
  }

  function expenseReport(state, year) {
    const list = txsInYear(state, year);
    const categories = {};
    EXPENSE_CATEGORIES.forEach((name) => {
      categories[name] = { name, amount: 0, items: [] };
    });
    categories["טרם סווג"] = { name: "טרם סווג", amount: 0, items: [] };
    let vaad = 0;
    let unassigned = 0;
    let other = 0;
    list.forEach((tx) => {
      if (tx.credit > 0) {
        if (tx.role === "vaad") vaad += tx.credit;
        else if (tx.role === "other-income") other += tx.credit;
        else unassigned += tx.credit;
      }
      if (tx.debit > 0) {
        const name = tx.expenseCategory && categories[tx.expenseCategory] ? tx.expenseCategory : "טרם סווג";
        categories[name].amount = roundMoney(categories[name].amount + tx.debit);
        categories[name].items.push(tx);
      }
    });
    return {
      balance: yearBalance(state, year),
      vaad: roundMoney(vaad),
      unassigned: roundMoney(unassigned),
      other: roundMoney(other),
      categories: Object.keys(categories)
        .map((key) => categories[key])
        .filter((cat) => cat.amount > 0),
    };
  }

  function unassignedIncomes(state, year) {
    return txsInYear(state, year).filter((tx) => tx.credit > 0 && tx.role === "unassigned");
  }

  function unclassifiedExpenses(state, year) {
    return txsInYear(state, year).filter((tx) => tx.debit > 0 && !tx.expenseCategory);
  }

  function assignIncome(state, txId, splits) {
    const tx = state.transactions.find((item) => item.id === txId);
    if (!tx || !(tx.credit > 0)) return { ok: false, error: "התנועה לא נמצאה" };
    const clean = (splits || [])
      .map((split) => ({ apartmentId: String(split.apartmentId), amount: roundMoney(split.amount) }))
      .filter((split) => split.apartmentId && split.amount > 0);
    const sum = roundMoney(clean.reduce((total, split) => total + split.amount, 0));
    if (Math.abs(sum - tx.credit) > 0.05) {
      return { ok: false, error: "סכום השיוך צריך להיות בדיוק " + tx.credit };
    }
    tx.role = "vaad";
    tx.apartmentSplits = clean;
    tx.splitsManual = true;
    return { ok: true };
  }

  function clearAssignment(state, txId) {
    const tx = state.transactions.find((item) => item.id === txId);
    if (!tx) return;
    tx.role = "unassigned";
    tx.apartmentSplits = [];
    tx.splitsManual = true;
  }

  function markOtherIncome(state, txId) {
    const tx = state.transactions.find((item) => item.id === txId);
    if (!tx || !(tx.credit > 0)) return;
    tx.role = "other-income";
    tx.apartmentSplits = [];
    tx.splitsManual = true;
  }

  function setExpenseCategory(state, txId, category, remember) {
    const tx = state.transactions.find((item) => item.id === txId);
    if (!tx) return;
    tx.expenseCategory = category || null;
    tx.categoryManual = true;
    if (remember && category) {
      const pattern = (tx.payee || tx.description || "").trim();
      if (pattern && pattern !== "שיק") {
        state.categoryRules = state.categoryRules.filter((rule) => rule.pattern !== pattern);
        state.categoryRules.push({ pattern, category });
        state.transactions.forEach((other) => {
          if (other.debit > 0 && !other.categoryManual && ruleCategory(other, [{ pattern, category }])) {
            other.expenseCategory = category;
          }
        });
      }
    }
  }

  function learnAlias(state, apartmentId, name) {
    const apartment = apartmentById(state, apartmentId);
    const alias = String(name || "").trim();
    if (!apartment || alias.length < 3) return;
    if (apartment.aliases.indexOf(alias) === -1) apartment.aliases.push(alias);
  }

  const api = {
    MONTHS,
    EXPENSE_CATEGORIES,
    emptyState,
    seedApartments,
    parseBankCsv,
    importCsv,
    matchApartment,
    isCheckDeposit,
    isOutgoingCheck,
    yearsOf,
    txsInYear,
    yearBalance,
    paymentGrid,
    expenseReport,
    unassignedIncomes,
    unclassifiedExpenses,
    assignIncome,
    clearAssignment,
    markOtherIncome,
    setExpenseCategory,
    learnAlias,
    apartmentById,
    expectedFor,
    priorFor,
    roundMoney,
    norm,
    txYear,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.VaadLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
