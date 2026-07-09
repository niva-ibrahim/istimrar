// نظام الألوان والخط المشترك — يُقرأ من tokens.css مع قيم احتياطية.
export const FONT_STACK = "'Thomaniyah', 'Noto Naskh Arabic', 'Segoe UI', serif";

// ألوان هوية ابراهيم العريفي (الثيم الداكن الفيروزي)
export const C = {
  bg: "var(--color-bg, #02070B)",
  bgDeep: "var(--color-bg-deep, #04121F)",
  card: "var(--color-card, #0A1622)",
  card2: "var(--color-card-2, #0B2A4A)",
  primary: "var(--color-primary, #31E6D7)",
  primaryHover: "var(--color-primary-hover, #5EF0E4)",
  ocean: "var(--color-ocean, #123A5C)",
  steel: "var(--color-steel, #1E7FA8)",
  teal: "var(--color-teal, #24B5C0)",
  text: "var(--color-text, #EAF6F7)",
  textSoft: "var(--color-text-soft, #B9E9EC)",
  textMuted: "var(--color-text-muted, #8FA6B2)",
  border: "var(--color-border, #1B2A36)",
  borderSoft: "var(--color-border-soft, rgba(255,255,255,0.06))",
  hairline: "var(--color-hairline, rgba(49,230,215,0.14))",
  gradient: "var(--gradient-brand, linear-gradient(90deg,#0B2A4A,#123A5C,#1E7FA8,#24B5C0,#31E6D7))",
  glow: "var(--glow, 0 0 40px rgba(49,230,215,0.18))",
};

// ألوان حالة النظام المالي (نجاح/معلومة/تحذير/خطر)
export const FIN = {
  success: "#10B981",
  info: "#3B82F6",
  warning: "#F59E0B",
  danger: "#EF4444",
};
