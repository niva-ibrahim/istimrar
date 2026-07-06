import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base = اسم الـ repository عشان GitHub Pages يشتغل صح
export default defineConfig({
  plugins: [react()],
  base: "/istimrar/",
});
