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

// الالتزامات الثابتة الشهرية (للعرض والحساب)
export const FIXED_COMMITMENTS = [
  { name: "إيجار", amount: 1500 },
  { name: "دورات شهرية", amount: 1500 },
  { name: "سداد ديون", amount: 2110 },
  { name: "مصروف الوالدة", amount: 1000 },
  { name: "مصروف الوالد", amount: 500 },
  { name: "مصروف الأخ محمد", amount: 250 },
  { name: "صدقة جارية", amount: 200 },
  { name: "جوال وإنترنت", amount: 200 },
  { name: "اشتراكات AI", amount: 130 },
  { name: "مستلزمات أخرى", amount: 150 },
  { name: "تأمين السيارة (سنوي ÷ ١٢)", amount: 233.33 },
];

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// إجمالي الالتزامات الثابتة = 7773.33
export const FIXED_TOTAL = round2(
  FIXED_COMMITMENTS.reduce((s, c) => s + c.amount, 0)
);

// محرك الحسابات — الخطوات الأربع
export function computeSteps() {
  const income = FINANCE.monthlyIncome;                              // 13500
  const afterCommitments = round2(income - FIXED_TOTAL);             // 5726.67
  const monthlyDailyExpenses = FINANCE.dailyLimit * FINANCE.daysInMonth; // 1500
  const baseAvailable = round2(afterCommitments - monthlyDailyExpenses); // 4226.67
  return { income, afterCommitments, monthlyDailyExpenses, baseAvailable };
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
  if (!data || typeof data !== "object") {
    data = { dailyExpenses: [], emergencyExpenses: [], history: [], lastReset: todayKey() };
  }
  data.dailyExpenses = data.dailyExpenses || [];
  data.emergencyExpenses = data.emergencyExpenses || [];
  data.history = data.history || [];
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
