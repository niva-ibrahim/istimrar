import { useState, useEffect, useRef } from "react";
import { C, FONT_STACK, FIN, ON_GRADIENT } from "./theme";
import { subscribeSync, pushSync, genSyncCode } from "./firebaseSync";
import {
  FINANCE,
  computeSteps,
  round2,
  fmt,
  parseNum,
  todayKey,
  monthKey,
  sumAmounts,
  rolloverIfNeeded,
  balanceStatus,
  loadFinance,
  saveFinance,
} from "./finance";

// لون شريط المصروف اليومي حسب النسبة (أخضر < برتقالي > أحمر)
function barColor(pct) {
  if (pct <= 30) return FIN.success;
  if (pct <= 70) return FIN.warning;
  return FIN.danger;
}

function fmtTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// خطّاف مشترك: حالة المالية + الاشتقاقات + العمليات (يُرفع لأعلى ليتشارك
// الـ widget والصفحة نفس البيانات لحظياً).
export function useFinance() {
  const [state, setState] = useState(() => loadFinance());

  useEffect(() => {
    saveFinance(state);
  }, [state]);

  // أرشفة اليوم المنصرم + التصفير عند عودة التركيز أو كل دقيقة
  useEffect(() => {
    const check = () => setState((s) => rolloverIfNeeded(s));
    const id = setInterval(check, 60 * 1000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, []);

  // ============ المزامنة السحابية (Firebase) ============
  const SYNC_KEY = "istimrar_sync_id";
  const STAMP_KEY = "istimrar_sync_stamp";
  const stateRef = useRef(state);
  stateRef.current = state;
  const [syncCode, setSyncCode] = useState(() => {
    try { return localStorage.getItem(SYNC_KEY) || ""; } catch { return ""; }
  });
  const [syncStatus, setSyncStatus] = useState("off"); // off | connecting | live | error
  const syncCodeRef = useRef(syncCode);
  syncCodeRef.current = syncCode;
  const applyingRemote = useRef(false);
  const localStamp = useRef((() => { try { return Number(localStorage.getItem(STAMP_KEY)) || 0; } catch { return 0; } })());
  const readyToPush = useRef(false);
  const pushTimer = useRef(null);

  const persistStamp = (t) => {
    localStamp.current = t;
    try { localStorage.setItem(STAMP_KEY, String(t)); } catch {}
  };
  const buildPayload = (s) => ({
    commitments: s.commitments || [],
    dailyExpenses: s.dailyExpenses || [],
    emergencyExpenses: s.emergencyExpenses || [],
    history: s.history || [],
    dailyLimit: s.dailyLimit || FINANCE.dailyLimit,
    salaryStepsExpanded: !!s.salaryStepsExpanded,
    lastReset: s.lastReset || todayKey(),
  });
  const doPush = (stamp) => {
    const code = syncCodeRef.current;
    if (!code) return;
    const t = stamp || Date.now();
    persistStamp(t);
    pushSync(code, { ...buildPayload(stateRef.current), updatedAt: t })
      .then(() => setSyncStatus("live"))
      .catch(() => setSyncStatus("error"));
  };

  // الاشتراك في المزامنة عند وجود رمز
  useEffect(() => {
    if (!syncCode) { setSyncStatus("off"); readyToPush.current = false; return; }
    setSyncStatus("connecting");
    readyToPush.current = false;
    let unsub;
    try {
      unsub = subscribeSync(
        syncCode,
        (data, meta) => {
          if (meta && meta.hasPendingWrites) return; // تجاهل صدى كتابتنا
          const remoteStamp = data && typeof data.updatedAt === "number" ? data.updatedAt : 0;
          if (remoteStamp > localStamp.current) {
            applyingRemote.current = true;
            persistStamp(remoteStamp);
            setState((prev) => rolloverIfNeeded({ ...prev, ...buildPayload(data) }));
          } else if (localStamp.current > remoteStamp) {
            doPush(localStamp.current); // بياناتنا أحدث (أو المستند غير موجود) → ارفعها
          }
          readyToPush.current = true;
          setSyncStatus("live");
        },
        () => setSyncStatus("error")
      );
    } catch {
      setSyncStatus("error");
    }
    return () => unsub && unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncCode]);

  // دفع التغييرات المحلية (debounce)
  useEffect(() => {
    if (!syncCode) return;
    if (applyingRemote.current) { applyingRemote.current = false; return; }
    if (!readyToPush.current) return;
    const stamp = Date.now();
    persistStamp(stamp);
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => doPush(stamp), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.commitments, state.dailyExpenses, state.emergencyExpenses, state.history, state.dailyLimit, state.salaryStepsExpanded, state.lastReset]);

  const enableSync = () => {
    const code = genSyncCode();
    try { localStorage.setItem(SYNC_KEY, code); } catch {}
    persistStamp(Date.now()); // بياناتنا الحالية هي الأحدث → ستُرفع
    setSyncCode(code);
  };
  const linkSync = (code) => {
    const c = String(code || "").trim();
    if (!c) return false;
    try { localStorage.setItem(SYNC_KEY, c); } catch {}
    persistStamp(0); // نتبنّى بيانات السحابة
    setSyncCode(c);
    return true;
  };
  const disableSync = () => {
    try { localStorage.removeItem(SYNC_KEY); } catch {}
    setSyncCode("");
    setSyncStatus("off");
  };

  const commitments = state.commitments || [];
  const fixedTotal = sumAmounts(commitments);
  const dailyLimit = state.dailyLimit || FINANCE.dailyLimit;
  const steps = computeSteps(fixedTotal, dailyLimit);
  const todayExpense = sumAmounts(state.dailyExpenses);
  const remainingToday = round2(dailyLimit - todayExpense);
  const emergencyTotal = sumAmounts(state.emergencyExpenses);
  const availableBalance = round2(steps.baseAvailable - emergencyTotal);
  const status = balanceStatus(availableBalance);

  // ملخص الشهر الحالي (تراكمي)
  const month = monthKey();
  const dayMap = {};
  (state.history || []).forEach((h) => {
    if (h.date && monthKey(h.date) === month) dayMap[h.date] = round2((dayMap[h.date] || 0) + h.total);
  });
  if (todayExpense > 0) dayMap[todayKey()] = round2((dayMap[todayKey()] || 0) + todayExpense);
  const monthDays = Object.entries(dayMap)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const monthlyDailyTotal = round2(monthDays.reduce((s, d) => s + d.total, 0));
  const monthlyEmergencyTotal = sumAmounts(
    (state.emergencyExpenses || []).filter((e) => monthKey(e.date) === month)
  );
  const monthlyTotal = round2(monthlyDailyTotal + monthlyEmergencyTotal);

  const addDaily = (amount) =>
    setState((s) => ({
      ...s,
      dailyExpenses: [...s.dailyExpenses, { amount: round2(amount), ts: Date.now() }],
    }));
  const resetDaily = () =>
    setState((s) => ({ ...s, dailyExpenses: [], lastReset: todayKey() }));
  const addEmergency = (amount, desc) =>
    setState((s) => ({
      ...s,
      emergencyExpenses: [
        { amount: round2(amount), desc: desc || "", date: todayKey(), ts: Date.now() },
        ...s.emergencyExpenses,
      ],
    }));
  const removeEmergency = (ts) =>
    setState((s) => ({
      ...s,
      emergencyExpenses: s.emergencyExpenses.filter((e) => e.ts !== ts),
    }));
  const removeDaily = (ts) =>
    setState((s) => ({
      ...s,
      dailyExpenses: s.dailyExpenses.filter((e) => e.ts !== ts),
    }));

  // إدارة الالتزامات — أي تغيير يعيد حساب كل الأرقام فوراً
  const addCommitment = (name, amount) =>
    setState((s) => ({
      ...s,
      commitments: [...(s.commitments || []), { id: `c${Date.now()}`, name: String(name).trim(), amount: round2(amount) }],
    }));
  const updateCommitment = (id, name, amount) =>
    setState((s) => ({
      ...s,
      commitments: (s.commitments || []).map((c) =>
        c.id === id ? { ...c, name: String(name).trim(), amount: round2(amount) } : c
      ),
    }));
  const removeCommitment = (id) =>
    setState((s) => ({ ...s, commitments: (s.commitments || []).filter((c) => c.id !== id) }));

  // تعديل الحد الآمن اليومي — يعيد حساب الخطوات والرصيد فوراً
  const setDailyLimit = (n) => {
    const v = round2(n);
    if (!(v > 0)) return false;
    setState((s) => ({ ...s, dailyLimit: v }));
    return true;
  };

  // حالة طيّ قسم خطوات الحساب (محفوظة بين الجلسات)
  const setSalaryStepsExpanded = (val) =>
    setState((s) => ({ ...s, salaryStepsExpanded: typeof val === "function" ? val(!!s.salaryStepsExpanded) : !!val }));

  // نسخة احتياطية للتصدير/الاستيراد
  const exportState = () => ({
    _app: "istimrar-finance",
    _version: 1,
    _exportedAt: new Date().toISOString(),
    commitments: state.commitments || [],
    dailyExpenses: state.dailyExpenses,
    emergencyExpenses: state.emergencyExpenses,
    history: state.history || [],
    dailyLimit: state.dailyLimit || FINANCE.dailyLimit,
    salaryStepsExpanded: !!state.salaryStepsExpanded,
    lastReset: state.lastReset,
  });
  const importState = (obj) => {
    if (!obj || typeof obj !== "object") return false;
    if (!Array.isArray(obj.dailyExpenses) && !Array.isArray(obj.emergencyExpenses) && !Array.isArray(obj.commitments)) return false;
    setState((s) =>
      rolloverIfNeeded({
        commitments: Array.isArray(obj.commitments) ? obj.commitments : (s.commitments || []),
        dailyExpenses: Array.isArray(obj.dailyExpenses) ? obj.dailyExpenses : [],
        emergencyExpenses: Array.isArray(obj.emergencyExpenses) ? obj.emergencyExpenses : [],
        history: Array.isArray(obj.history) ? obj.history : [],
        dailyLimit: Number.isFinite(obj.dailyLimit) && obj.dailyLimit > 0 ? obj.dailyLimit : (s.dailyLimit || FINANCE.dailyLimit),
        salaryStepsExpanded: !!obj.salaryStepsExpanded,
        lastReset: obj.lastReset || todayKey(),
      })
    );
    return true;
  };

  return {
    steps,
    dailyLimit,
    setDailyLimit,
    todayExpense,
    remainingToday,
    emergencyTotal,
    availableBalance,
    status,
    monthDays,
    monthlyDailyTotal,
    monthlyEmergencyTotal,
    monthlyTotal,
    commitments,
    fixedTotal,
    salaryStepsExpanded: !!state.salaryStepsExpanded,
    dailyExpenses: state.dailyExpenses,
    emergencyExpenses: state.emergencyExpenses,
    addDaily,
    resetDaily,
    addEmergency,
    removeEmergency,
    removeDaily,
    addCommitment,
    updateCommitment,
    removeCommitment,
    setSalaryStepsExpanded,
    exportState,
    importState,
    syncCode,
    syncStatus,
    enableSync,
    linkSync,
    disableSync,
  };
}

// ============ Widget الشاشة الرئيسية ============
export function FinanceWidget({ finance, onOpen }) {
  const { availableBalance, todayExpense, dailyLimit, status } = finance;
  const pct = Math.min(100, Math.round((todayExpense / dailyLimit) * 100));
  const balanceColor = status.level === "empty" ? FIN.danger : status.level === "low" ? FIN.warning : FIN.success;
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      style={{
        background: C.gradWidget,
        borderRadius: 26,
        border: `1px solid ${C.hairline}`,
        padding: "20px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>💰 نظام المالية</span>
        <span style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>التفاصيل ←</span>
      </div>

      <div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>الرصيد المتاح للادخار</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: balanceColor, lineHeight: 1 }}>
          {fmt(availableBalance)} <span style={{ fontSize: 15, fontWeight: 600 }}>ر.س</span>
        </div>
        {status.level !== "ok" && (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: balanceColor }}>⚠️ {status.text}</div>
        )}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: FIN.info, fontWeight: 600 }}>المصروف اليوم</span>
          <span style={{ fontSize: 13, color: C.textSoft }}>
            {fmt(todayExpense)} / {dailyLimit} ر.س
          </span>
        </div>
        <div style={{ background: C.trackBg, borderRadius: 999, height: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor(pct), borderRadius: 999, transition: "width 0.35s ease, background 0.35s ease" }} />
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, textAlign: "center" }}>اضغط لفتح التفاصيل</div>
      </div>
    </div>
  );
}

// ============ عناصر مساعدة للصفحة ============
const inputStyle = {
  flex: 1,
  minWidth: 0,
  background: C.inputBg,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: "12px 14px",
  color: C.text,
  fontFamily: FONT_STACK,
  fontSize: 15,
  outline: "none",
};

function PrimaryButton({ children, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: color || C.gradient,
        border: "none",
        borderRadius: 12,
        padding: "12px 18px",
        color: ON_GRADIENT,
        fontFamily: FONT_STACK,
        fontSize: 15,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Msg({ msg }) {
  if (!msg) return null;
  const color = msg.type === "success" ? FIN.success : msg.type === "warning" ? FIN.warning : FIN.danger;
  return (
    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color, background: `${color}1A`, border: `1px solid ${color}44`, borderRadius: 12, padding: "10px 12px" }}>
      {msg.text}
    </div>
  );
}

const sectionCard = {
  background: C.card,
  borderRadius: 24,
  border: `1px solid ${C.borderSoft}`,
  padding: "20px 18px",
};

function SectionTitle({ children }) {
  return <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: C.text }}>{children}</h2>;
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: C.overlay1, borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{fmt(value)}</div>
      <div style={{ fontSize: 10, color: C.textMuted }}>ر.س</div>
    </div>
  );
}

// قسم قابل للطي بحركة height سلسة (grid-template-rows 0fr→1fr)
function Section({ title, open, onToggle, children }) {
  return (
    <div style={{ background: C.card, borderRadius: 24, border: `1px solid ${C.borderSoft}`, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "transparent", border: "none", cursor: "pointer", padding: "18px", fontFamily: FONT_STACK, textAlign: "right" }}
      >
        <span style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{title}</span>
        <span style={{ display: "inline-flex", flexShrink: 0, transition: "transform 300ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", color: C.primary, fontSize: 13 }}>▼</span>
      </button>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 300ms ease" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ padding: "0 18px 18px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// القسم D — إدارة الالتزامات الشهرية (إضافة / تعديل / حذف inline)
function CommitmentsSection({ commitments, fixedTotal, addCommitment, updateCommitment, removeCommitment }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [err, setErr] = useState(null);

  const smallInput = { ...inputStyle, padding: "9px 11px", fontSize: 14 };
  const iconBtn = { background: "transparent", border: "none", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 4 };
  const okBtn = { ...iconBtn, color: FIN.success, fontWeight: 800, fontSize: 19 };
  const noBtn = { ...iconBtn, color: FIN.danger, fontWeight: 800, fontSize: 19 };

  const startAdd = () => { setAdding(true); setNewName(""); setNewAmount(""); setErr(null); };
  const saveAdd = () => {
    const n = parseNum(newAmount);
    if (!newName.trim() || !(n > 0)) { setErr("أدخل اسماً ومبلغاً صحيحاً"); return; }
    addCommitment(newName, n); setAdding(false); setErr(null);
  };
  const startEdit = (c) => { setEditId(c.id); setEditName(c.name); setEditAmount(String(c.amount)); setConfirmId(null); setErr(null); };
  const saveEdit = () => {
    const n = parseNum(editAmount);
    if (!editName.trim() || !(n > 0)) { setErr("أدخل اسماً ومبلغاً صحيحاً"); return; }
    updateCommitment(editId, editName, n); setEditId(null); setErr(null);
  };

  return (
    <>
      {!adding && (
        <button onClick={startAdd} style={{ marginBottom: 16, background: C.tint, border: `1px solid ${C.hairline}`, color: C.primary, borderRadius: 999, padding: "8px 16px", fontFamily: FONT_STACK, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ إضافة التزام جديد</button>
      )}

      {adding && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم الالتزام" style={{ ...smallInput, flexBasis: "100%" }} />
          <input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveAdd()} inputMode="decimal" placeholder="المبلغ" style={smallInput} />
          <button onClick={saveAdd} style={okBtn} aria-label="حفظ">✓</button>
          <button onClick={() => { setAdding(false); setErr(null); }} style={noBtn} aria-label="إلغاء">✗</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {commitments.length === 0 && !adding && (
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>لا توجد التزامات. أضِف واحداً بالزر أعلاه.</p>
        )}
        {commitments.map((c) => {
          if (editId === c.id) {
            return (
              <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...smallInput, flexBasis: "100%" }} />
                <input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit()} inputMode="decimal" style={smallInput} />
                <button onClick={saveEdit} style={okBtn} aria-label="حفظ">✓</button>
                <button onClick={() => { setEditId(null); setErr(null); }} style={noBtn} aria-label="إلغاء">✗</button>
              </div>
            );
          }
          if (confirmId === c.id) {
            return (
              <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", background: `${FIN.danger}14`, border: `1px solid ${FIN.danger}44`, borderRadius: 12, padding: "8px 12px" }}>
                <span style={{ fontSize: 13, color: FIN.danger, fontWeight: 700 }}>حذف "{c.name}"؟</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { removeCommitment(c.id); setConfirmId(null); }} style={{ background: FIN.danger, border: "none", color: "#fff", borderRadius: 8, padding: "5px 14px", fontFamily: FONT_STACK, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>نعم</button>
                  <button onClick={() => setConfirmId(null)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSoft, borderRadius: 8, padding: "5px 14px", fontFamily: FONT_STACK, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>لا</button>
                </div>
              </div>
            );
          }
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: C.textSoft }}>{c.name}</span>
              <span style={{ flex: 1, borderBottom: `1px dotted ${C.border}`, transform: "translateY(-4px)" }} />
              <span style={{ fontSize: 14, color: C.text, fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(c.amount)}</span>
              <button onClick={() => startEdit(c)} style={iconBtn} aria-label="تعديل">✏️</button>
              <button onClick={() => { setConfirmId(c.id); setEditId(null); }} style={iconBtn} aria-label="حذف">🗑️</button>
            </div>
          );
        })}
      </div>

      {err && <Msg msg={{ type: "danger", text: err }} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.hairline}` }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>الإجمالي</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{fmt(fixedTotal)} ر.س</span>
      </div>
    </>
  );
}

// القسم — المزامنة السحابية بين الأجهزة
function SyncSection({ syncCode, syncStatus, enableSync, linkSync, disableSync, onToast }) {
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const statusMap = {
    off: { text: "غير مفعّلة", color: C.textMuted },
    connecting: { text: "جارٍ الاتصال…", color: FIN.warning },
    live: { text: "متصل ✓", color: FIN.success },
    error: { text: "تعذّر الاتصال", color: FIN.danger },
  };
  const st = statusMap[syncStatus] || statusMap.off;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(syncCode);
      setCopied(true);
      onToast && onToast("تم نسخ الرمز ✓");
      setTimeout(() => setCopied(false), 1500);
    } catch { /* الحافظة غير متاحة */ }
  };
  const onLink = () => {
    if (linkSync(codeInput)) { onToast && onToast("تم الربط ✓"); setCodeInput(""); }
  };

  return (
    <>
      {syncCode && (
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: st.color, whiteSpace: "nowrap" }}>● {st.text}</span>
        </div>
      )}

      {!syncCode ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
            فعّل المزامنة على هذا الجهاز لإنشاء رمز، أو الصق رمزاً من جهاز آخر لربطهما. أي تعديل يظهر على كل الأجهزة مباشرة.
          </p>
          <PrimaryButton onClick={enableSync}>تفعيل المزامنة على هذا الجهاز</PrimaryButton>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: C.borderSoft }} /> أو لديك رمز؟ <span style={{ flex: 1, height: 1, background: C.borderSoft }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="الصق رمز المزامنة" style={{ ...inputStyle, direction: "ltr", textAlign: "left" }} />
            <PrimaryButton onClick={onLink} color={FIN.info}>ربط</PrimaryButton>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
            على جهازك الآخر: افتح التطبيق ← قسم المزامنة ← والصق هذا الرمز في خانة «الصق رمز المزامنة».
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontFamily: "monospace", fontSize: 13, color: C.primary, wordBreak: "break-all", direction: "ltr", textAlign: "left" }}>{syncCode}</div>
            <PrimaryButton onClick={copyCode}>{copied ? "✓" : "نسخ"}</PrimaryButton>
          </div>
          <button onClick={disableSync} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSoft, borderRadius: 12, padding: "11px", fontFamily: FONT_STACK, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            إيقاف المزامنة على هذا الجهاز
          </button>
        </div>
      )}
    </>
  );
}

// ============ Bottom Sheet يصعد من الأسفل (300ms) ============
export function FinanceSheet({ open, finance, onClose, logo }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let raf, t;
    if (open) {
      setMounted(true);
      raf = requestAnimationFrame(() => setShown(true));
    } else {
      setShown(false);
      t = setTimeout(() => setMounted(false), 300);
    }
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [open]);

  if (!mounted) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, direction: "rtl", fontFamily: FONT_STACK }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", opacity: shown ? 1 : 0, transition: "opacity 300ms ease" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "94vh", background: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, border: `1px solid ${C.borderSoft}`, boxShadow: "0 -20px 60px rgba(0,0,0,0.55)", transform: shown ? "translateY(0)" : "translateY(100%)", transition: "transform 300ms cubic-bezier(0.32,0.72,0,1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px", flexShrink: 0 }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: C.border }} />
        </div>
        <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
          <FinancePage finance={finance} onBack={onClose} logo={logo} />
        </div>
      </div>
    </div>
  );
}

// ============ صفحة النظام المالي الكاملة ============
export function FinancePage({ finance, onBack, logo }) {
  const { steps, dailyLimit, setDailyLimit, todayExpense, remainingToday, availableBalance, status, monthDays, monthlyDailyTotal, monthlyEmergencyTotal, monthlyTotal, commitments, fixedTotal, dailyExpenses, emergencyExpenses, addDaily, resetDaily, addEmergency, removeEmergency, removeDaily, addCommitment, updateCommitment, removeCommitment, exportState, importState, syncCode, syncStatus, enableSync, linkSync, disableSync } = finance;

  const todayLabel = (() => {
    try {
      return new Date().toLocaleDateString("ar-SA-u-ca-islamic", { weekday: "long", day: "numeric", month: "long" });
    } catch {
      return todayKey();
    }
  })();

  const [dailyInput, setDailyInput] = useState("");
  const [emAmount, setEmAmount] = useState("");
  const [emDesc, setEmDesc] = useState("");
  const [dailyMsg, setDailyMsg] = useState(null);
  const [emMsg, setEmMsg] = useState(null);
  const [backupMsg, setBackupMsg] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const fileRef = useRef(null);
  const balanceColor = status.level === "empty" ? FIN.danger : status.level === "low" ? FIN.warning : FIN.success;

  // حالة طيّ/فتح كل قسم (محفوظة بين الجلسات)
  const OPEN_KEY = "istimrar_fin_open";
  const [openMap, setOpenMap] = useState(() => {
    const defaults = { steps: false, daily: true, monthly: false, commitments: true, emergency: true, sync: false, backup: false };
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(OPEN_KEY) || "{}")) }; }
    catch { return defaults; }
  });
  const toggleSection = (id) =>
    setOpenMap((m) => {
      const next = { ...m, [id]: !m[id] };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

  // تعديل الحد الآمن اليومي
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const saveLimit = () => {
    const n = parseNum(limitInput);
    if (!(n > 0)) { setDailyMsg({ type: "danger", text: "أدخل حداً صحيحاً أكبر من صفر" }); return; }
    setDailyLimit(n);
    setEditingLimit(false);
    showToast("تم تحديث الحد الآمن ✓");
  };

  const showToast = (text) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const pct = Math.min(100, Math.round((todayExpense / dailyLimit) * 100));

  const onAddDaily = () => {
    const n = parseNum(dailyInput);
    if (!(n > 0)) { setDailyMsg({ type: "danger", text: "أدخل مبلغاً صحيحاً أكبر من صفر" }); return; }
    addDaily(n);
    const newTotal = round2(todayExpense + n);
    if (newTotal > dailyLimit) {
      setDailyMsg({ type: "danger", text: `تجاوزت الحد الآمن! تخطّيت بمقدار ${fmt(round2(newTotal - dailyLimit))} ريال` });
    } else {
      setDailyMsg({ type: "success", text: `تمت الإضافة ✓ — المتبقي اليوم ${fmt(round2(dailyLimit - newTotal))} ريال` });
    }
    setDailyInput("");
    showToast("تمت الإضافة بنجاح ✓");
  };

  const onResetDaily = () => {
    resetDaily();
    setDailyMsg({ type: "success", text: "تم تصفير مصروف اليوم ✓" });
  };

  const onAddEmergency = () => {
    const n = parseNum(emAmount);
    if (!(n > 0)) { setEmMsg({ type: "danger", text: "أدخل مبلغاً صحيحاً أكبر من صفر" }); return; }
    if (n > availableBalance) {
      setEmMsg({ type: "danger", text: `المبلغ يتجاوز الرصيد المتاح (${fmt(availableBalance)} ريال)` });
      return;
    }
    addEmergency(n, emDesc);
    setEmMsg({ type: "success", text: "تمت الإضافة بنجاح ✓" });
    setEmAmount(""); setEmDesc("");
    showToast("تمت الإضافة بنجاح ✓");
  };

  const doExport = () => {
    try {
      const blob = new Blob([JSON.stringify(exportState(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `istimrar-finance-${todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMsg({ type: "success", text: "تم تصدير نسخة احتياطية ✓" });
      showToast("تم تصدير نسخة احتياطية ✓");
    } catch {
      setBackupMsg({ type: "danger", text: "تعذّر التصدير" });
    }
  };

  const doImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (importState(obj)) {
          setBackupMsg({ type: "success", text: "تم استيراد البيانات بنجاح ✓" });
          showToast("تم الاستيراد ✓");
        } else {
          setBackupMsg({ type: "danger", text: "الملف لا يحتوي بيانات مالية صالحة" });
        }
      } catch {
        setBackupMsg({ type: "danger", text: "تعذّر قراءة الملف (JSON غير صالح)" });
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // للسماح باستيراد نفس الملف مجدداً
  };

  const StepRow = ({ label, value, formula, final }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingRight: 14, borderRight: `2px solid ${final ? FIN.success : C.hairline}` }}>
      <span style={{ fontSize: 13, color: final ? FIN.success : C.primary, fontWeight: 700 }}>{label}</span>
      {formula && <span style={{ fontSize: 13, color: C.textMuted }}>{formula}</span>}
      <span style={{ fontSize: final ? 22 : 18, fontWeight: 800, color: C.text }}>{value} <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>ر.س</span></span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: C.card, color: FIN.success, padding: "10px 22px", borderRadius: 999, fontSize: 14, fontWeight: 800, border: `1px solid ${FIN.success}55`, boxShadow: "0 0 40px rgba(16,185,129,0.25)", zIndex: 1000, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: C.inputBg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 12, padding: "8px 14px", fontFamily: FONT_STACK, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          → رجوع
        </button>
        {logo && <img src={logo} alt="" style={{ width: 34, height: 34, filter: "drop-shadow(0 0 16px rgba(49,230,215,0.35))" }} />}
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>💰 نظام المالية</h1>
      </div>

      {/* تنبيه ذكي عند قرب نفاد الرصيد */}
      {status.level !== "ok" && (() => {
        const col = status.level === "empty" ? FIN.danger : FIN.warning;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: `${col}1A`, border: `1px solid ${col}55`, borderRadius: 16, padding: "14px 16px" }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: col }}>{status.text}</span>
          </div>
        );
      })()}

      {/* ملخص علوي */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ ...sectionCard, padding: "16px 16px" }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>الرصيد المتاح</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: balanceColor }}>{fmt(availableBalance)}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>ر.س</div>
        </div>
        <div style={{ ...sectionCard, padding: "16px 16px" }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>متبقّي اليوم</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: remainingToday < 0 ? FIN.danger : FIN.info }}>{fmt(remainingToday)}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>من {dailyLimit} ر.س</div>
        </div>
      </div>

      {/* القسم B: خطوات الحساب (قابل للطي — مغلق افتراضياً) */}
      <Section title="🧮 خطوات حساب الراتب" open={!!openMap.steps} onToggle={() => toggleSection("steps")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StepRow label="الخطوة ١: الراتب الكامل" value={fmt(steps.income)} />
          <StepRow label="الخطوة ٢: بعد الالتزامات" formula={`${fmt(steps.income)} − ${fmt(steps.fixedTotal)}`} value={fmt(steps.afterCommitments)} />
          <StepRow label="الخطوة ٣: بعد المصروفات اليومية" formula={`${dailyLimit} × ٣٠ = ${fmt(steps.monthlyDailyExpenses)}  ·  ${fmt(steps.afterCommitments)} − ${fmt(steps.monthlyDailyExpenses)}`} value={fmt(steps.baseAvailable)} />
          <StepRow label="✅ الرصيد النهائي (للادخار والطوارئ)" value={fmt(steps.baseAvailable)} final />
        </div>
      </Section>

      {/* القسم C: تتبع المصروف اليومي */}
      <Section title="📅 تتبع المصروف اليومي" open={!!openMap.daily} onToggle={() => toggleSection("daily")}>
        <div style={{ fontSize: 12, color: C.primary, fontWeight: 600, marginBottom: 16 }}>{todayLabel}</div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12, fontSize: 13 }}>
          <span style={{ color: C.textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}>
            الحد الآمن: <b style={{ color: C.text }}>{dailyLimit} ر.س</b>
            <button onClick={() => { setLimitInput(String(dailyLimit)); setEditingLimit(true); }} aria-label="تعديل الحد الآمن" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>✏️</button>
          </span>
          <span style={{ color: C.textMuted }}>المصروف: <b style={{ color: FIN.info }}>{fmt(todayExpense)} ر.س</b></span>
          <span style={{ color: C.textMuted }}>المتبقّي: <b style={{ color: remainingToday < 0 ? FIN.danger : FIN.success }}>{fmt(remainingToday)} ر.س</b></span>
        </div>
        {editingLimit && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <input value={limitInput} onChange={(e) => setLimitInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveLimit()} inputMode="decimal" placeholder="الحد الآمن اليومي" style={{ ...inputStyle, padding: "9px 11px", fontSize: 14 }} />
            <PrimaryButton onClick={saveLimit}>حفظ</PrimaryButton>
            <button onClick={() => setEditingLimit(false)} aria-label="إلغاء" style={{ background: "transparent", border: "none", color: FIN.danger, cursor: "pointer", fontSize: 19, fontWeight: 800 }}>✗</button>
          </div>
        )}
        <div style={{ background: C.trackBg, borderRadius: 999, height: 10, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor(pct), borderRadius: 999, transition: "width 0.35s ease, background 0.35s ease" }} />
        </div>
        <div style={{ textAlign: "left", fontSize: 12, color: C.textMuted, marginBottom: 14 }}>{pct}%</div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={dailyInput}
            onChange={(e) => setDailyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddDaily()}
            inputMode="decimal"
            placeholder="مبلغ المصروف"
            style={inputStyle}
          />
          <PrimaryButton onClick={onAddDaily}>إضافة</PrimaryButton>
        </div>
        <Msg msg={dailyMsg} />

        <button onClick={onResetDaily} style={{ marginTop: 12, width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textSoft, borderRadius: 12, padding: "11px", fontFamily: FONT_STACK, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          إعادة تعيين لليوم الجديد 🔄
        </button>

        {dailyExpenses.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700 }}>سجل مصروفات اليوم</div>
            {dailyExpenses.slice().reverse().map((e) => (
              <div key={e.ts} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                <span style={{ color: C.textMuted, fontSize: 11 }}>{fmtTime(e.ts)}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: FIN.info, fontWeight: 700 }}>{fmt(e.amount)} ر.س</span>
                <button onClick={() => removeDaily(e.ts)} aria-label="حذف" style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ملخص الشهر التراكمي */}
      <Section title="📈 ملخص هذا الشهر" open={!!openMap.monthly} onToggle={() => toggleSection("monthly")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: monthDays.length ? 18 : 0 }}>
          <MiniStat label="مصروف يومي" value={monthlyDailyTotal} color={FIN.info} />
          <MiniStat label="طوارئ" value={monthlyEmergencyTotal} color={FIN.warning} />
          <MiniStat label="الإجمالي" value={monthlyTotal} color={C.primary} />
        </div>
        {monthDays.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>لا توجد مصروفات مسجّلة هذا الشهر بعد.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700 }}>المصروف اليومي يوماً بيوم</div>
            {monthDays.map((d) => {
              const over = d.total > dailyLimit;
              const w = Math.min(100, Math.round((d.total / dailyLimit) * 100));
              const isToday = d.date === todayKey();
              return (
                <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <span style={{ color: isToday ? C.primary : C.textMuted, width: 78, flexShrink: 0 }}>
                    {d.date.slice(5)}{isToday ? " • اليوم" : ""}
                  </span>
                  <div style={{ flex: 1, background: C.trackBg, borderRadius: 999, height: 7, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${w}%`, background: over ? FIN.danger : FIN.info, borderRadius: 999 }} />
                  </div>
                  <span style={{ color: over ? FIN.danger : C.textSoft, fontWeight: 700, width: 62, textAlign: "left", flexShrink: 0 }}>{fmt(d.total)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* القسم D: إدارة الالتزامات الشهرية (إضافة/تعديل/حذف — إعادة حساب فورية) */}
      <Section title="📌 الالتزامات الشهرية" open={!!openMap.commitments} onToggle={() => toggleSection("commitments")}>
        <CommitmentsSection
          commitments={commitments}
          fixedTotal={fixedTotal}
          addCommitment={addCommitment}
          updateCommitment={updateCommitment}
          removeCommitment={removeCommitment}
        />
      </Section>

      {/* القسم E: المصروفات الطارئة */}
      <Section title="🚨 المصروفات الطارئة" open={!!openMap.emergency} onToggle={() => toggleSection("emergency")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={emAmount} onChange={(e) => setEmAmount(e.target.value)} inputMode="decimal" placeholder="المبلغ" style={inputStyle} />
            <PrimaryButton onClick={onAddEmergency} color={FIN.warning}>إضافة طارئ</PrimaryButton>
          </div>
          <input value={emDesc} onChange={(e) => setEmDesc(e.target.value)} placeholder="الوصف (اختياري)" style={inputStyle} />
        </div>
        <Msg msg={emMsg} />

        <div style={{ marginTop: 14, fontSize: 13, color: C.textMuted }}>
          الرصيد المتاح حالياً: <b style={{ color: FIN.success }}>{fmt(availableBalance)} ر.س</b>
        </div>

        {emergencyExpenses.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700 }}>سجل المصروفات الطارئة</div>
            {emergencyExpenses.map((e) => (
              <div key={e.ts} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                <span style={{ color: C.textMuted, fontSize: 11 }}>{e.date}</span>
                <span style={{ color: C.textSoft, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.desc || "—"}</span>
                <span style={{ color: FIN.warning, fontWeight: 700 }}>{fmt(e.amount)} ر.س</span>
                <button onClick={() => removeEmergency(e.ts)} aria-label="حذف" style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* القسم: المزامنة السحابية بين الأجهزة */}
      <Section title="☁️ المزامنة بين الأجهزة" open={!!openMap.sync} onToggle={() => toggleSection("sync")}>
        <SyncSection
          syncCode={syncCode}
          syncStatus={syncStatus}
          enableSync={enableSync}
          linkSync={linkSync}
          disableSync={disableSync}
          onToast={showToast}
        />
      </Section>

      {/* القسم: النسخ الاحتياطي */}
      <Section title="💾 النسخ الاحتياطي" open={!!openMap.backup} onToggle={() => toggleSection("backup")}>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
          احفظ نسخة من بياناتك (المصروفات اليومية والطارئة) كملف على جهازك، واسترجعها وقت الحاجة أو على جهاز آخر. لا تُرفع بياناتك لأي سيرفر.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <PrimaryButton onClick={doExport}>⬇️ تصدير نسخة</PrimaryButton>
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSoft, borderRadius: 12, padding: "12px 18px", fontFamily: FONT_STACK, fontSize: 15, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ⬆️ استيراد نسخة
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImportFile} style={{ display: "none" }} />
        </div>
        <Msg msg={backupMsg} />
      </Section>
    </div>
  );
}
