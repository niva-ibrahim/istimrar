import { useState, useEffect, useRef } from "react";
import { C, FONT_STACK, FIN } from "./theme";
import {
  FINANCE,
  FIXED_COMMITMENTS,
  FIXED_TOTAL,
  computeSteps,
  round2,
  fmt,
  parseNum,
  todayKey,
  sumAmounts,
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

  // إعادة فحص التصفير اليومي عند عودة التركيز أو كل دقيقة
  useEffect(() => {
    const check = () =>
      setState((s) =>
        s.lastReset !== todayKey()
          ? { ...s, dailyExpenses: [], lastReset: todayKey() }
          : s
      );
    const id = setInterval(check, 60 * 1000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, []);

  const steps = computeSteps();
  const todayExpense = sumAmounts(state.dailyExpenses);
  const remainingToday = round2(FINANCE.dailyLimit - todayExpense);
  const emergencyTotal = sumAmounts(state.emergencyExpenses);
  const availableBalance = round2(steps.baseAvailable - emergencyTotal);

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

  // نسخة احتياطية للتصدير/الاستيراد
  const exportState = () => ({
    _app: "istimrar-finance",
    _version: 1,
    _exportedAt: new Date().toISOString(),
    dailyExpenses: state.dailyExpenses,
    emergencyExpenses: state.emergencyExpenses,
    lastReset: state.lastReset,
  });
  const importState = (obj) => {
    if (!obj || typeof obj !== "object") return false;
    if (!Array.isArray(obj.dailyExpenses) && !Array.isArray(obj.emergencyExpenses)) return false;
    setState({
      dailyExpenses: Array.isArray(obj.dailyExpenses) ? obj.dailyExpenses : [],
      emergencyExpenses: Array.isArray(obj.emergencyExpenses) ? obj.emergencyExpenses : [],
      lastReset: obj.lastReset || todayKey(),
    });
    return true;
  };

  return {
    steps,
    dailyLimit: FINANCE.dailyLimit,
    todayExpense,
    remainingToday,
    emergencyTotal,
    availableBalance,
    dailyExpenses: state.dailyExpenses,
    emergencyExpenses: state.emergencyExpenses,
    addDaily,
    resetDaily,
    addEmergency,
    removeEmergency,
    removeDaily,
    exportState,
    importState,
  };
}

// ============ Widget الشاشة الرئيسية ============
export function FinanceWidget({ finance, onOpen }) {
  const { availableBalance, todayExpense, dailyLimit } = finance;
  const pct = Math.min(100, Math.round((todayExpense / dailyLimit) * 100));
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      style={{
        background: "radial-gradient(circle at 12% 0%, rgba(49,230,215,0.10), transparent 55%), var(--color-card, #0A1622)",
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
        <div style={{ fontSize: 30, fontWeight: 800, color: FIN.success, lineHeight: 1 }}>
          {fmt(availableBalance)} <span style={{ fontSize: 15, fontWeight: 600 }}>ر.س</span>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: FIN.info, fontWeight: 600 }}>المصروف اليوم</span>
          <span style={{ fontSize: 13, color: C.textSoft }}>
            {fmt(todayExpense)} / {dailyLimit} ر.س
          </span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 999, height: 8, overflow: "hidden" }}>
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
  background: "rgba(255,255,255,0.05)",
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
        color: C.bg,
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

// ============ صفحة النظام المالي الكاملة ============
export function FinancePage({ finance, onBack, logo }) {
  const { steps, dailyLimit, todayExpense, remainingToday, availableBalance, dailyExpenses, emergencyExpenses, addDaily, resetDaily, addEmergency, removeEmergency, removeDaily, exportState, importState } = finance;

  const [dailyInput, setDailyInput] = useState("");
  const [emAmount, setEmAmount] = useState("");
  const [emDesc, setEmDesc] = useState("");
  const [dailyMsg, setDailyMsg] = useState(null);
  const [emMsg, setEmMsg] = useState(null);
  const [backupMsg, setBackupMsg] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const fileRef = useRef(null);

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
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, color: C.text, borderRadius: 12, padding: "8px 14px", fontFamily: FONT_STACK, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          → رجوع
        </button>
        {logo && <img src={logo} alt="" style={{ width: 34, height: 34, filter: "drop-shadow(0 0 16px rgba(49,230,215,0.35))" }} />}
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>💰 نظام المالية</h1>
      </div>

      {/* ملخص علوي */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ ...sectionCard, padding: "16px 16px" }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>الرصيد المتاح</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: FIN.success }}>{fmt(availableBalance)}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>ر.س</div>
        </div>
        <div style={{ ...sectionCard, padding: "16px 16px" }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>متبقّي اليوم</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: remainingToday < 0 ? FIN.danger : FIN.info }}>{fmt(remainingToday)}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>من {dailyLimit} ر.س</div>
        </div>
      </div>

      {/* القسم 1: خطوات الحساب */}
      <div style={sectionCard}>
        <SectionTitle>📊 خطوات حساب الراتب</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StepRow label="الخطوة ١: الراتب الكامل" value={fmt(steps.income)} />
          <StepRow label="الخطوة ٢: بعد الالتزامات" formula={`${fmt(steps.income)} − ${fmt(FIXED_TOTAL)}`} value={fmt(steps.afterCommitments)} />
          <StepRow label="الخطوة ٣: بعد المصروفات اليومية" formula={`${dailyLimit} × ٣٠ = ${fmt(steps.monthlyDailyExpenses)}  ·  ${fmt(steps.afterCommitments)} − ${fmt(steps.monthlyDailyExpenses)}`} value={fmt(steps.baseAvailable)} />
          <StepRow label="✅ الرصيد النهائي (للادخار والطوارئ)" value={fmt(steps.baseAvailable)} final />
        </div>
      </div>

      {/* القسم 2: تتبع المصروف اليومي */}
      <div style={sectionCard}>
        <SectionTitle>📅 تتبع المصروف اليومي</SectionTitle>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12, fontSize: 13 }}>
          <span style={{ color: C.textMuted }}>الحد الآمن: <b style={{ color: C.text }}>{dailyLimit} ر.س</b></span>
          <span style={{ color: C.textMuted }}>المصروف: <b style={{ color: FIN.info }}>{fmt(todayExpense)} ر.س</b></span>
          <span style={{ color: C.textMuted }}>المتبقّي: <b style={{ color: remainingToday < 0 ? FIN.danger : FIN.success }}>{fmt(remainingToday)} ر.س</b></span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 999, height: 10, overflow: "hidden", marginBottom: 8 }}>
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
      </div>

      {/* القسم 3: المصروفات الطارئة */}
      <div style={sectionCard}>
        <SectionTitle>🚨 إضافة مصروف طارئ</SectionTitle>
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
      </div>

      {/* القسم 4: الالتزامات الثابتة */}
      <div style={sectionCard}>
        <SectionTitle>📌 الالتزامات الثابتة الشهرية</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FIXED_COMMITMENTS.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 14, color: C.textSoft }}>{c.name}</span>
              <span style={{ flex: 1, borderBottom: `1px dotted ${C.border}`, transform: "translateY(-4px)" }} />
              <span style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{fmt(c.amount)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.hairline}` }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>الإجمالي</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{fmt(FIXED_TOTAL)} ر.س</span>
        </div>
      </div>

      {/* القسم 5: النسخ الاحتياطي */}
      <div style={sectionCard}>
        <SectionTitle>💾 النسخ الاحتياطي</SectionTitle>
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
      </div>
    </div>
  );
}
