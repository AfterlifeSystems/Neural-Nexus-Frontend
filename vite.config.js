import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    watch : {
      usePolling: true,
    },
  },
  plugins: [react(), tailwindcss()],
    build: {
    target: 'es2022',  // or 'esnext' – supports top-level await (ES2022+)
    sourcemap: true,
  }
});
