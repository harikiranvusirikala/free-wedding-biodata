import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Links into /editor are plain <a> on purpose: a full page load, so analytics on the public pages can't
      // follow into the editor (BUILD_PLAN Part B rule 3, VISION D22).
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**", "docs/**", ".claude/worktrees/**"]),
]);

export default eslintConfig;
