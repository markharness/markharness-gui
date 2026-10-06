/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { watch: { ignored: ["**/src-tauri/**"] } },
  test: { environment: "jsdom", setupFiles: ["./src/test-setup.ts"] },
});
