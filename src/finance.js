// =========================================================
// نظام المالية — البيانات الثابتة + محرك الحسابات + التخزين
// كل البيانات محلية فقط (localStorage) ولا تُرسل لأي سيرفر.
// سهل التعديل: غيّر الأرقام هنا وتنعكس على كامل النظام.
// =========================================================

export const FINANCE = {
  monthlyIncome: 13500, // الراتب الشهري
  dailyLimit: 50,       // الحد الآمن اليومي
  daysInMonth: 30,      // أيام الشهر المعتمدة في الحساب
};

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// المهام الافتراضية لقائمة الطموح.
export const DEFAULT_TASKS = [
  { id: "d1", text: "صلاة الفجر في وقتها", period: "daily" },
  { id: "d2", text: "مراجعة حفظ القرآن ١٥ دقيقة", period: "daily" },
  { id: "d3", text: "متابعة مهام تأسيس العلامة التجارية", period: "daily" },
  { id: "d4", text: "٣٠ دقيقة تعلم (تسويق / إدارة / تجارة إلكترونية)", period: "daily" },
  { id: "d5", text: "٣٠ دقيقة تعلّم إنجليزي", period: "daily" },
  { id: "w1", text: "زيارة أو اتصال بالوالدين", period: "weekly" },
  { id: "w2", text: "مراجعة مؤشرات العلامة التجارية", period: "weekly" },
  { id: "w3", text: "تطبيق درس من الكورس على مشروع حقيقي", period: "weekly" },
  { id: "m1", text: "تخصيص الصدقة الشهرية ومساعدة محتاج", period: "monthly" },
  { id: "m2", text: "تقييم التقدم نحو الأهداف المهنية", period: "monthly" },
  { id: "m3", text: "مراجعة الميزانية الشخصية والادخار", period: "monthly" },
  { id: "m4", text: "تخصيص مبلغ ثابت للوالدين", period: "monthly" },
];

const TASK_PERIODS = new Set(["daily", "weekly", "monthly"]);

export function normalizeTasks(tasks, fallback = DEFAULT_TASKS) {
  const source = Array.isArray(tasks) ? tasks : fallback;
  const seen = new Set();
  return source.reduce((result, task) => {
    const id = String(task?.id || "").trim();
    const text = typeof task?.text === "string" ? task.text.trim() : "";
    if (!id || !text || !TASK_PERIODS.has(task?.period) || seen.has(id)) return result;
    seen.add(id);
    result.push({ id, text, period: task.period });
    return result;
  }, []);
}

export function normalizeTaskChecks(checks, tasks) {
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) return {};
  return (tasks || []).reduce((result, task) => {
    if (Object.prototype.hasOwnProperty.call(checks, task.id)) result[task.id] = Boolean(checks[task.id]);
    return result;
  }, {});
}

// سجل السلف مجمّع حسب الشخص، وكل مبلغ أو سداد عملية مستقلة بتاريخها.
// يحوّل هذا أيضاً السجلات القديمة المسطحة إلى الشكل الجديد عند أول تحميل.
export function normalizeLoans(records) {
  if (!Array.isArray(records)) return [];
  const people = new Map();
  records.forEach((record, index) => {
    const name = String(record?.name || "").trim();
    if (!name) return;
    const key = name.toLocaleLowerCase();
    let person = people.get(key);
    if (!person) {
      person = { id: String(record.id || `borrower-${index}-${Date.now().toString(36)}`), name, transactions: [] };
      people.set(key, person);
    }
    const rows = Array.isArray(record.transactions)
      ? record.transactions
      : (Number(record.amount) > 0 ? [{ id: `${record.id || index}-lent`, type: "lent", amount: record.amount, currency: record.currency, date: record.date }, ...(Number(record.repaid) > 0 ? [{ id: `${record.id || index}-repaid`, type: "repaid", amount: record.repaid, currency: record.currency, date: record.date }] : [])] : []);
    rows.forEach((transaction, txIndex) => {
      const amount = round2(transaction?.amount);
      const currency = transaction?.currency || record.currency || "SAR";
      const type = transaction?.type === "repaid" ? "repaid" : transaction?.type === "lent" ? "lent" : "";
      if (!(amount > 0) || !["SAR", "YER"].includes(currency) || !type) return;
      person.transactions.push({
        id: String(transaction.id || `${record.id || index}-tx-${txIndex}`),
        type,
        amount,
        currency,
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(transaction.date || "")) ? transaction.date : (record.date || todayKey()),
      });
    });
  });
  return [...people.values()].filter((person) => person.transactions.length > 0);
}

// الالتزامات الشهرية الافتراضية — مصفوفة ديناميكية قابلة للإضافة/التعديل/الحذف.
// (تُخزَّن في localStorage بعد أول تحميل، وتصبح مصدر الحساب.)
export const DEFAULT_COMMITMENTS = [
  { id: "1", name: "إيجار", amount: 1500 },
  { id: "2", name: "مصروف الوالدة", amount: 1000 },
  { id: "3", name: "مصروف الوالد", amount: 500 },
  { id: "4", name: "مصروف الأخ محمد", amount: 250 },
  { id: "5", name: "صدقة جارية", amount: 200 },
  { id: "6", name: "جوال وإنترنت", amount: 200 },
  { id: "7", name: "اشتراكات AI", amount: 130 },
  { id: "8", name: "مستلزمات أخرى", amount: 150 },
  { id: "9", name: "دورات شهرية", amount: 1500 },
  { id: "10", name: "سداد ديون", amount: 2110 },
  { id: "11", name: "تأمين السيارة", amount: 233.33 },
];

// إجمالي الالتزامات الافتراضية = 7773.33
export const DEFAULT_TOTAL = round2(
  DEFAULT_COMMITMENTS.reduce((s, c) => s + c.amount, 0)
);

// محرك الحسابات — الخطوات الأربع. يعتمد على إجمالي الالتزامات الحالي
// والحد الآمن اليومي (كلاهما يُمرَّر من الحالة) فيُعاد الحساب فوراً عند أي تعديل.
export function computeSteps(fixedTotal, dailyLimit, monthlyIncome) {
  const income = monthlyIncome != null ? monthlyIncome : FINANCE.monthlyIncome; // 13500
  const total = round2(fixedTotal != null ? fixedTotal : DEFAULT_TOTAL); // 7773.33
  const limit = dailyLimit != null ? dailyLimit : FINANCE.dailyLimit;    // 50
  const afterCommitments = round2(income - total);                      // 5726.67
  const monthlyDailyExpenses = round2(limit * FINANCE.daysInMonth);      // 1500
  const baseAvailable = round2(afterCommitments - monthlyDailyExpenses); // 4226.67
  return { income, fixedTotal: total, afterCommitments, monthlyDailyExpenses, baseAvailable };
}

// تنسيق رقم بفواصل الآلاف وخانتين عشريتين
export function fmt(n) {
  return (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// تحويل الأرقام العربية إلى إنجليزية وإزالة الفواصل ثم التحليل
export function parseNum(str) {
  if (str == null) return NaN;
  const western = String(str)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[،,\s]/g, "")
    .trim();
  return parseFloat(western);
}

// مفتاح اليوم المحلي (YYYY-MM-DD) لتصفير المصروف مع منتصف الليل
export function todayKey() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sumAmounts(list) {
  return round2((list || []).reduce((s, e) => s + (Number(e.amount) || 0), 0));
}

// مفتاح الشهر الحالي (YYYY-MM)
export function monthKey(dateStr) {
  return (dateStr || todayKey()).slice(0, 7);
}

// عند تغيّر اليوم: نؤرشف إجمالي مصروف اليوم المنصرم في السجل الشهري ثم نصفّر
export function rolloverIfNeeded(data) {
  const today = todayKey();
  if (data.lastReset === today) return data;
  const prevTotal = sumAmounts(data.dailyExpenses);
  const history = Array.isArray(data.history) ? data.history.slice() : [];
  if (prevTotal > 0 && data.lastReset) {
    history.push({ date: data.lastReset, total: prevTotal });
  }
  return { ...data, history, dailyExpenses: [], lastReset: today };
}

// حد التنبيه لقرب نفاد الرصيد المتاح (قابل للتعديل)
export const LOW_BALANCE_THRESHOLD = 500;

export function balanceStatus(available) {
  if (available <= 0)
    return { level: "empty", text: "نفد الرصيد المتاح! يُفضّل عدم إضافة مصروفات طارئة جديدة." };
  if (available <= LOW_BALANCE_THRESHOLD)
    return { level: "low", text: `تنبيه: رصيدك المتاح أوشك على النفاد — ${fmt(available)} ر.س فقط.` };
  return { level: "ok", text: "" };
}

const KEY = "istimrar_finance";

export function loadFinance() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(KEY));
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object") data = {};
  data.dailyExpenses = data.dailyExpenses || [];
  data.emergencyExpenses = data.emergencyExpenses || [];
  data.loans = normalizeLoans(data.loans);
  data.history = data.history || [];
  // نبذر الالتزامات الافتراضية فقط إن لم تُضبط من قبل (لا نعيد بذرها لو أفرغها المستخدم)
  data.commitments = Array.isArray(data.commitments) ? data.commitments : DEFAULT_COMMITMENTS;
  data.tasks = normalizeTasks(Array.isArray(data.tasks) ? data.tasks : DEFAULT_TASKS);
  let taskChecks = data.taskChecks;
  if (!taskChecks || typeof taskChecks !== "object" || Array.isArray(taskChecks)) {
    try { taskChecks = JSON.parse(localStorage.getItem("ambition_checks") || "{}"); } catch { taskChecks = {}; }
  }
  data.taskChecks = normalizeTaskChecks(taskChecks, data.tasks);
  data.monthlyIncome = Number.isFinite(data.monthlyIncome) && data.monthlyIncome > 0 ? data.monthlyIncome : FINANCE.monthlyIncome;
  data.dailyLimit = Number.isFinite(data.dailyLimit) && data.dailyLimit > 0 ? data.dailyLimit : FINANCE.dailyLimit;
  data.salaryStepsExpanded = !!data.salaryStepsExpanded;
  if (!data.lastReset) data.lastReset = todayKey();
  // أرشفة اليوم المنصرم + تصفير المصروف اليومي تلقائياً مع اليوم الجديد
  return rolloverIfNeeded(data);
}

export function saveFinance(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* التخزين غير متاح — نتجاهل بهدوء */
  }
}
