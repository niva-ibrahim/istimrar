import { useState, useEffect } from "react";

const IBM_FONT = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap');
`;

const COLORS = {
  bg: "#FAFAFA",
  text: "#121717",
  primary: "#007F7D",
  action: "#FFCC00",
  purple: "#8338EC",
  card: "#FFFFFF",
  border: "#E8ECEC",
  lightTeal: "#E6F4F4",
  lightPurple: "#F0E8FD",
  lightYellow: "#FFF9E0",
};

const roles = [
  {
    name: "المسلم المُلتزم",
    type: "أساسي",
    color: COLORS.primary,
    bg: COLORS.lightTeal,
    mpl: "أصلي كل فرض في وقته، وأراجع حفظي للقرآن ١٥ دقيقة يومياً",
    goal: "أحفظ جزءين جديدين وأُلقي محاضرة توعوية واحدة على الأقل",
  },
  {
    name: "الخطيب / الزوج القادم",
    type: "أساسي",
    color: COLORS.purple,
    bg: COLORS.lightPurple,
    mpl: "أتواصل مع خطيبتي يومياً، وأُخطط للزواج بخطوة عملية كل أسبوع",
    goal: "أُكمل الزواج وأُؤمّن بيتاً مستقراً وميزانية واضحة للسنة الأولى",
  },
  {
    name: "الابن البار",
    type: "أساسي",
    color: COLORS.primary,
    bg: COLORS.lightTeal,
    mpl: "أزور والديّ أو أتصل بهم ٣ مرات أسبوعياً على الأقل",
    goal: "أُخصص مبلغاً ثابتاً شهرياً لوالديّ من دخلي",
  },
  {
    name: "الأخ الداعم",
    type: "أساسي",
    color: COLORS.primary,
    bg: COLORS.lightTeal,
    mpl: "أكون متاحاً لأخي وأختي عند الحاجة، وأسألهم عن أحوالهم أسبوعياً",
    goal: "أُساعد أحد أفراد عائلتي في هدف محدد خلال ٢٠٢٦",
  },
  {
    name: "مدير تأسيس وتشغيل",
    type: "أساسي",
    color: "#E8760A",
    bg: "#FFF3E8",
    mpl: "أُنجز مهامي اليومية وأراجع مؤشرات العلامة التجارية كل أسبوع",
    goal: "أُطلق العلامة التجارية رسمياً وأحقق أول ١٠٠ عميل فعلي",
  },
  {
    name: "رائد الأعمال الرقمي",
    type: "اختياري",
    color: COLORS.purple,
    bg: COLORS.lightPurple,
    mpl: "أُطبّق درساً واحداً من كورساتي أسبوعياً على مشروع حقيقي",
    goal: "أُطلق أول مشروع تجارة إلكترونية مستقل وأحقق أول بيعة",
  },
  {
    name: "المتعلم المستمر",
    type: "اختياري",
    color: COLORS.purple,
    bg: COLORS.lightPurple,
    mpl: "أُكمل ٣٠ دقيقة تعلم يومياً في التسويق الرقمي أو الإدارة",
    goal: "أُنهي كورسين كاملين وأحصل على شهادة معتمدة في مجاله",
  },
  {
    name: "المُعطي والمُتصدّق",
    type: "مساند",
    color: "#2DA44E",
    bg: "#E8F5EC",
    mpl: "أُخصص نسبة ثابتة من دخلي للصدقة والمساعدة شهرياً",
    goal: "أُساعد ٥ أشخاص محتاجين بشكل مباشر خلال ٢٠٢٦",
  },
];

const dailyTasks = [
  { id: "d1", text: "صلاة الفجر في وقتها", period: "daily" },
  { id: "d2", text: "مراجعة حفظ القرآن ١٥ دقيقة", period: "daily" },
  { id: "d3", text: "متابعة مهام تأسيس العلامة التجارية", period: "daily" },
  { id: "d4", text: "٣٠ دقيقة تعلم (تسويق / إدارة / تجارة إلكترونية)", period: "daily" },
  { id: "d5", text: "التواصل مع خطيبتي", period: "daily" },
  { id: "w1", text: "زيارة أو اتصال بالوالدين", period: "weekly" },
  { id: "w2", text: "مراجعة مؤشرات العلامة التجارية", period: "weekly" },
  { id: "w3", text: "تطبيق درس من الكورس على مشروع حقيقي", period: "weekly" },
  { id: "w4", text: "التواصل مع الأخ والأخت والاطمئنان عليهم", period: "weekly" },
  { id: "w5", text: "خطوة عملية نحو التحضير للزواج", period: "weekly" },
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

export default function AmbitionMap() {
  const [activeTab, setActiveTab] = useState(0);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem("ambition_checks");
    if (saved) setChecked(JSON.parse(saved));
  }, []);

  const toggleCheck = (id) => {
    const updated = { ...checked, [id]: !checked[id] };
    setChecked(updated);
    try { localStorage.setItem("ambition_checks", JSON.stringify(updated)); } catch {}
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
    <div style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", background: COLORS.bg, minHeight: "100vh", direction: "rtl", color: COLORS.text }}>
      <style>{IBM_FONT}</style>

      {/* Header */}
      <div style={{ background: COLORS.primary, padding: "24px 20px 0", color: "#fff" }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75, fontWeight: 400, marginBottom: 4 }}>خريطة الطموح</p>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 600, lineHeight: 1.4 }}>
          طريقك للمليون ريال<br />والأثر الذي يُذكر
        </h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{
                flex: 1,
                padding: "10px 4px",
                border: "none",
                borderRadius: "12px 12px 0 0",
                background: activeTab === i ? COLORS.bg : "rgba(255,255,255,0.15)",
                color: activeTab === i ? COLORS.primary : "#fff",
                fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                fontWeight: activeTab === i ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px 40px" }}>

        {/* TAB 1 — الحلم الجريء */}
        {activeTab === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* فقرة الحلم */}
            <div style={{ background: COLORS.card, borderRadius: 32, padding: "24px 20px", boxShadow: "0 2px 12px rgba(0,127,125,0.08)", border: `1px solid ${COLORS.border}` }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: COLORS.primary, fontWeight: 600, letterSpacing: 0.5 }}>◈ الحلم الجريء</p>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, fontWeight: 400, color: COLORS.text }}>
                في سن الثلاثين، أملك شركتي الخاصة وأجلس على كرسي الرئيس التنفيذي — لا موظفاً ولا تابعاً. دخلي الشهري يتجاوز المليون ريال، وأسرتي تعيش حياة كريمة بعيدة عن الضغط المادي. أُعين والديّ وعمومتي براتب ثابت كل شهر، وأساعد كل محتاج يطرق بابي.
                وفوق كل ذلك، أكون حافظاً لكتاب الله، وصوتاً يُوجّه الناس للخير في محاضراتي.
              </p>
            </div>

            {/* الرسالة */}
            <div style={{ background: COLORS.action, borderRadius: 32, padding: "20px", boxShadow: "0 2px 8px rgba(255,204,0,0.25)" }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#7A5E00", fontWeight: 600, letterSpacing: 0.5 }}>◈ رسالتي</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: COLORS.text, lineHeight: 1.6 }}>
                "أبني ثروة بضمير، وأُغيّر حياة الناس بالعلم والعطاء."
              </p>
            </div>

            {/* الأثر المجتمعي */}
            <div style={{ background: COLORS.card, borderRadius: 32, padding: "20px", border: `1px solid ${COLORS.border}` }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: COLORS.purple, fontWeight: 600, letterSpacing: 0.5 }}>◈ الأثر المجتمعي</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: COLORS.text }}>
                موظفون يتكسبون من مشروعه، وعائلة كاملة تعيش بكرامة بسببه.
                <br />
                أناس يسمعون كلمة حق في محاضراته فتُغيّر مساراتهم.
              </p>
            </div>

            {/* النجمة الشمالية */}
            <div style={{ background: COLORS.primary, borderRadius: 32, padding: "20px", color: "#fff" }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, opacity: 0.8 }}>◈ النجمة الشمالية — ٢٠٣٠</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, fontWeight: 400 }}>
                رئيس تنفيذي لشركته، متزوج ومستقر، حافظ لكتاب الله، ومحاضر معروف —
                يقول عنه الناس: <strong>"ما قصّر علينا وما نسي ربه."</strong>
              </p>
            </div>
          </div>
        )}

        {/* TAB 2 — الأدوار */}
        {activeTab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {roles.map((role, i) => (
              <div key={i} style={{ background: COLORS.card, borderRadius: 32, padding: "20px", border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: COLORS.text }}>{role.name}</p>
                  <span style={{ background: role.bg, color: role.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", marginRight: 8 }}>
                    {role.type}
                  </span>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: "#888", fontWeight: 600 }}>الحد الأدنى للأداء</p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.text }}>{role.mpl}</p>
                </div>

                <div style={{ background: role.bg, borderRadius: 16, padding: "12px 14px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: role.color, fontWeight: 600 }}>هدف ٢٠٢٦</p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.text }}>{role.goal}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3 — القائمة اليومية */}
        {activeTab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Date */}
            <div style={{ textAlign: "center", padding: "12px", background: COLORS.lightTeal, borderRadius: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: COLORS.primary, fontWeight: 600 }}>{getArabicDate()}</p>
            </div>

            {[
              { label: "اليومي", key: "daily", icon: "☀️" },
              { label: "الأسبوعي", key: "weekly", icon: "📅" },
              { label: "الشهري", key: "monthly", icon: "🌙" },
            ].map(({ label, key, icon }) => {
              const prog = getProgress(key);
              return (
                <div key={key} style={{ background: COLORS.card, borderRadius: 32, padding: "20px", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{icon} {label}</p>
                    <span style={{ fontSize: 12, color: COLORS.primary, fontWeight: 600 }}>{prog.done}/{prog.total}</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ background: COLORS.border, borderRadius: 8, height: 6, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      background: prog.pct === 100 ? "#2DA44E" : COLORS.primary,
                      borderRadius: 8,
                      width: `${prog.pct}%`,
                      transition: "width 0.3s ease"
                    }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {dailyTasks.filter((t) => t.period === key).map((task) => (
                      <div
                        key={task.id}
                        onClick={() => toggleCheck(task.id)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          cursor: "pointer",
                          opacity: checked[task.id] ? 0.55 : 1,
                          transition: "opacity 0.2s",
                        }}
                      >
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: 8,
                          border: `2px solid ${checked[task.id] ? COLORS.primary : COLORS.border}`,
                          background: checked[task.id] ? COLORS.primary : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 1,
                          transition: "all 0.2s",
                        }}>
                          {checked[task.id] && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
                        </div>
                        <p style={{
                          margin: 0,
                          fontSize: 14,
                          lineHeight: 1.6,
                          textDecoration: checked[task.id] ? "line-through" : "none",
                          color: COLORS.text,
                        }}>
                          {task.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Reset button */}
            <button
              onClick={resetAll}
              style={{
                background: COLORS.action,
                border: "none",
                borderRadius: 24,
                padding: "14px",
                width: "100%",
                fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                fontSize: 15,
                fontWeight: 600,
                color: COLORS.text,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(255,204,0,0.3)",
                marginTop: 4,
              }}
            >
              يبدأ من جديد 🔄
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
