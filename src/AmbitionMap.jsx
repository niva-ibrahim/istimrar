import { useState, useEffect, useRef } from "react";
import { C, FONT_STACK } from "./theme";
import { useFinance, FinanceWidget, FinancePage } from "./Finance.jsx";

// مسار الأصول يتبع base في vite.config.js (مثال: "/istimrar/")
const ASSET_BASE = import.meta.env.BASE_URL;
const LOGO = `${ASSET_BASE}brand/logo.png`;

// خط ثمانية (Thomaniyah) أساسي مع Noto Naskh Arabic كبديل مقارب يعمل فوراً.
// ضع ملف الخط المتغيّر في public/fonts/Thomaniyah.otf (انظر public/fonts/README.md).
const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap');

  @font-face {
    font-family: 'Thomaniyah';
    src: url('${ASSET_BASE}fonts/Thomaniyah.otf') format('opentype');
    font-weight: 100 900;
    font-display: swap;
  }

  @keyframes toastSlideDown {
    from { opacity: 0; transform: translate(-50%, -16px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
`;

// لون شارة الدور حسب نوعه
const TYPE_ACCENT = {
  "أساسي": { color: "#31E6D7", tint: "rgba(49,230,215,0.10)" },
  "اختياري": { color: "#1E7FA8", tint: "rgba(30,127,168,0.16)" },
  "مساند": { color: "#24B5C0", tint: "rgba(36,181,192,0.14)" },
};

const roles = [
  {
    name: "المسلم المُلتزم",
    type: "أساسي",
    mpl: "أصلي كل فرض في وقته، وأراجع حفظي للقرآن ١٥ دقيقة يومياً",
    goal: "أحفظ جزءين جديدين وأُلقي محاضرة توعوية واحدة على الأقل",
  },
  {
    name: "متعلّم الإنجليزي",
    type: "أساسي",
    mpl: "أتعلّم الإنجليزي ٣٠ دقيقة يومياً",
    goal: "أصل لمستوى محادثة بطلاقة",
  },
  {
    name: "الابن البار",
    type: "أساسي",
    mpl: "أزور والديّ أو أتصل بهم ٣ مرات أسبوعياً على الأقل",
    goal: "أُخصص مبلغاً ثابتاً شهرياً لوالديّ من دخلي",
  },
  {
    name: "مدير تأسيس وتشغيل",
    type: "أساسي",
    mpl: "أُنجز مهامي اليومية وأراجع مؤشرات العلامة التجارية كل أسبوع",
    goal: "أُطلق العلامة التجارية رسمياً وأحقق أول ١٠٠ عميل فعلي",
  },
  {
    name: "رائد الأعمال الرقمي",
    type: "اختياري",
    mpl: "أُطبّق درساً واحداً من كورساتي أسبوعياً على مشروع حقيقي",
    goal: "أُطلق أول مشروع تجارة إلكترونية مستقل وأحقق أول بيعة",
  },
  {
    name: "المتعلم المستمر",
    type: "اختياري",
    mpl: "أُكمل ٣٠ دقيقة تعلم يومياً في التسويق الرقمي أو الإدارة",
    goal: "أُنهي كورسين كاملين وأحصل على شهادة معتمدة في مجاله",
  },
  {
    name: "المُعطي والمُتصدّق",
    type: "مساند",
    mpl: "أُخصص نسبة ثابتة من دخلي للصدقة والمساعدة شهرياً",
    goal: "أُساعد ٥ أشخاص محتاجين بشكل مباشر خلال ٢٠٢٦",
  },
];

const dailyTasks = [
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

function getArabicDate() {
  const now = new Date();
  return now.toLocaleDateString("ar-SA-u-ca-islamic", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const TOAST_MESSAGES = ["كفو! 🔥", "استمر يا وحش 🚀", "ماشاء الله 🌟"];

function getMotivationMessage(pct) {
  if (pct >= 100) return "كفو أنجزت كل شي 🏆";
  if (pct >= 90) return "قربت تخلّص 🚀";
  if (pct >= 60) return "نص الطريق 👏";
  if (pct >= 30) return "بداية موفقة كمّل يا وحش 🔥";
  return "يلا نبدأ";
}

// ترويسة قسم بنمط دليل الهوية: عنوان فيروزي صغير متباعد ثم عنوان كبير
function Eyebrow({ children }) {
  return (
    <p style={{ margin: 0, fontSize: 11, letterSpacing: 4, color: C.primary, fontWeight: 600 }}>
      {children}
    </p>
  );
}

const cardStyle = {
  background: C.card,
  borderRadius: 26,
  border: `1px solid ${C.borderSoft}`,
  padding: "22px 20px",
};

export default function AmbitionMap() {
  const [activeTab, setActiveTab] = useState(0);
  const [checked, setChecked] = useState({});
  const [toast, setToast] = useState(null);
  const [showFinance, setShowFinance] = useState(false);
  const toastTimer = useRef(null);
  const finance = useFinance();

  useEffect(() => {
    const saved = localStorage.getItem("ambition_checks");
    if (saved) setChecked(JSON.parse(saved));
  }, []);

  const showToast = () => {
    const msg = TOAST_MESSAGES[Math.floor(Math.random() * TOAST_MESSAGES.length)];
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const toggleCheck = (id) => {
    const isCompleting = !checked[id];
    const updated = { ...checked, [id]: !checked[id] };
    setChecked(updated);
    try { localStorage.setItem("ambition_checks", JSON.stringify(updated)); } catch {}
    if (isCompleting) showToast();
  };

  const resetAll = () => {
    setChecked({});
    try { localStorage.removeItem("ambition_checks"); } catch {}
  };

  const getProgress = (period) => {
    const items = dailyTasks.filter((t) => t.period === period);
    const done = items.filter((t) => checked[t.id]).length;
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
  };

  const tabs = ["الحلم الجريء", "أدواري", "قائمتي اليومية"];

  return (
    <div style={{ fontFamily: FONT_STACK, background: C.bg, minHeight: "100vh", direction: "rtl", color: C.text }}>
      <style>{FONT_STYLE}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: C.card,
          color: C.text,
          padding: "10px 22px",
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 700,
          border: `1px solid ${C.hairline}`,
          boxShadow: C.glow,
          zIndex: 1000,
          animation: "toastSlideDown 0.25s ease",
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}

      {showFinance ? (
        <FinancePage finance={finance} onBack={() => setShowFinance(false)} logo={LOGO} />
      ) : (
      <>
      {/* Header */}
      <div style={{
        background: "radial-gradient(circle at 50% 0%, rgba(49,230,215,0.12), transparent 60%), linear-gradient(160deg, #04121F, #02070B 72%)",
        padding: "26px 20px 22px",
        borderBottom: `1px solid ${C.borderSoft}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <img
            src={LOGO}
            alt="الشعار"
            style={{ width: 52, height: 52, filter: "drop-shadow(0 0 22px rgba(49,230,215,0.35))" }}
          />
          <div>
            <Eyebrow>خريطة الطموح</Eyebrow>
            <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, lineHeight: 1.35, color: C.text }}>
              طريقك للمليون ريال<br />والأثر الذي يُذكر
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {tabs.map((tab, i) => {
            const active = activeTab === i;
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                style={{
                  flex: 1,
                  padding: "10px 4px",
                  border: `1px solid ${active ? C.hairline : "transparent"}`,
                  borderRadius: 999,
                  background: active ? "rgba(49,230,215,0.12)" : "rgba(255,255,255,0.04)",
                  color: active ? C.primary : C.textMuted,
                  fontFamily: FONT_STACK,
                  fontWeight: active ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px 40px" }}>

        {/* TAB 1 — الحلم الجريء */}
        {activeTab === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Widget النظام المالي */}
            <FinanceWidget finance={finance} onOpen={() => setShowFinance(true)} />

            {/* فقرة الحلم */}
            <div style={{ ...cardStyle, padding: "24px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, right: 0, left: 0, height: 3, background: C.gradient }} />
              <div style={{ marginBottom: 10 }}><Eyebrow>◈ الحلم الجريء</Eyebrow></div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, fontWeight: 400, color: C.textSoft }}>
                في سن الثلاثين، أملك شركتي الخاصة وأجلس على كرسي الرئيس التنفيذي — لا موظفاً ولا تابعاً. دخلي الشهري يتجاوز المليون ريال، وأسرتي تعيش حياة كريمة بعيدة عن الضغط المادي. أُعين والديّ وعمومتي براتب ثابت كل شهر، وأساعد كل محتاج يطرق بابي.
                وفوق كل ذلك، أكون حافظاً لكتاب الله، وصوتاً يُوجّه الناس للخير في محاضراتي.
              </p>
            </div>

            {/* الرسالة */}
            <div style={{ ...cardStyle, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 4, background: C.gradient }} />
              <div style={{ marginBottom: 8 }}><Eyebrow>◈ رسالتي</Eyebrow></div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text, lineHeight: 1.7 }}>
                "أبني ثروة بضمير، وأُغيّر حياة الناس بالعلم والعطاء."
              </p>
            </div>

            {/* الأثر المجتمعي */}
            <div style={cardStyle}>
              <div style={{ marginBottom: 8 }}><Eyebrow>◈ الأثر المجتمعي</Eyebrow></div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, color: C.textMuted }}>
                موظفون يتكسبون من مشروعه، وعائلة كاملة تعيش بكرامة بسببه.
                <br />
                أناس يسمعون كلمة حق في محاضراته فتُغيّر مساراتهم.
              </p>
            </div>

            {/* النجمة الشمالية */}
            <div style={{
              borderRadius: 26,
              padding: "22px 20px",
              color: C.text,
              background: "radial-gradient(circle at 15% 0%, rgba(49,230,215,0.14), transparent 55%), linear-gradient(160deg, #081826, #02070B)",
              border: `1px solid ${C.hairline}`,
            }}>
              <div style={{ marginBottom: 8 }}><Eyebrow>◈ النجمة الشمالية — ٢٠٣٠</Eyebrow></div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, fontWeight: 400, color: C.textSoft }}>
                رئيس تنفيذي لشركته، متزوج ومستقر، حافظ لكتاب الله، ومحاضر معروف —
                يقول عنه الناس: <strong style={{ color: C.primary }}>"ما قصّر علينا وما نسي ربه."</strong>
              </p>
            </div>
          </div>
        )}

        {/* TAB 2 — الأدوار */}
        {activeTab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {roles.map((role, i) => {
              const accent = TYPE_ACCENT[role.type] || TYPE_ACCENT["أساسي"];
              return (
                <div key={i} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{role.name}</p>
                    <span style={{ background: accent.tint, color: accent.color, borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", marginRight: 8, border: `1px solid ${accent.color}33` }}>
                      {role.type}
                    </span>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: C.textMuted, fontWeight: 600 }}>الحد الأدنى للأداء</p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: C.textSoft }}>{role.mpl}</p>
                  </div>

                  <div style={{ background: accent.tint, borderRadius: 16, padding: "12px 14px", border: `1px solid ${C.borderSoft}` }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: accent.color, fontWeight: 700 }}>هدف ٢٠٢٦</p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: C.text }}>{role.goal}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3 — القائمة اليومية */}
        {activeTab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Date */}
            <div style={{ textAlign: "center", padding: "12px", background: "rgba(49,230,215,0.08)", borderRadius: 16, border: `1px solid ${C.borderSoft}` }}>
              <p style={{ margin: 0, fontSize: 13, color: C.primary, fontWeight: 600 }}>{getArabicDate()}</p>
            </div>

            {/* مؤشر تقدّمك اليوم */}
            {(() => {
              const todayProg = getProgress("daily");
              return (
                <div style={{
                  borderRadius: 26,
                  padding: "22px 20px",
                  color: C.text,
                  background: "radial-gradient(circle at 15% 0%, rgba(49,230,215,0.14), transparent 55%), linear-gradient(160deg, #081826, #02070B)",
                  border: `1px solid ${C.hairline}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textSoft }}>مؤشر تقدّمك اليوم</p>
                    <span style={{ fontSize: 22, fontWeight: 800, color: C.primary }}>{todayProg.pct}%</span>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 8, marginBottom: 14, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      background: C.gradient,
                      borderRadius: 999,
                      width: `${todayProg.pct}%`,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{getMotivationMessage(todayProg.pct)}</p>
                </div>
              );
            })()}

            {[
              { label: "اليومي", key: "daily", icon: "☀️" },
              { label: "الأسبوعي", key: "weekly", icon: "📅" },
              { label: "الشهري", key: "monthly", icon: "🌙" },
            ].map(({ label, key, icon }) => {
              const prog = getProgress(key);
              const complete = prog.pct === 100;
              return (
                <div key={key} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{icon} {label}</p>
                    <span style={{ fontSize: 12, color: complete ? C.primary : C.textMuted, fontWeight: 700 }}>{prog.done}/{prog.total}</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, height: 6, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      background: C.gradient,
                      borderRadius: 999,
                      width: `${prog.pct}%`,
                      boxShadow: complete ? C.glow : "none",
                      transition: "width 0.3s ease",
                    }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {dailyTasks.filter((t) => t.period === key).map((task) => {
                      const done = checked[task.id];
                      return (
                        <div
                          key={task.id}
                          onClick={() => toggleCheck(task.id)}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                            cursor: "pointer",
                            opacity: done ? 0.5 : 1,
                            transition: "opacity 0.2s",
                          }}
                        >
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: 7,
                            border: `2px solid ${done ? C.primary : C.border}`,
                            background: done ? C.primary : "transparent",
                            boxShadow: done ? C.glow : "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginTop: 1,
                            transition: "all 0.2s",
                          }}>
                            {done && <span style={{ color: C.bg, fontSize: 13, lineHeight: 1, fontWeight: 800 }}>✓</span>}
                          </div>
                          <p style={{
                            margin: 0,
                            fontSize: 14,
                            lineHeight: 1.6,
                            textDecoration: done ? "line-through" : "none",
                            color: done ? C.textMuted : C.textSoft,
                          }}>
                            {task.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Reset button */}
            <button
              onClick={resetAll}
              style={{
                background: C.gradient,
                border: "none",
                borderRadius: 999,
                padding: "14px",
                width: "100%",
                fontFamily: FONT_STACK,
                fontSize: 15,
                fontWeight: 800,
                color: C.bg,
                cursor: "pointer",
                boxShadow: C.glow,
                marginTop: 4,
              }}
            >
              يبدأ من جديد 🔄
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
