import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    includeSource: ["src/**/*.{js,ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    environment: "jsdom",
  },
  plugins: [tsconfigPaths()],
});
