import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Reading the browser (saved settings, the URL, media queries) once a page mounts is setState in an effect by
      // design: it can't run during the server render. Flagged, not failed.
      "react-hooks/set-state-in-effect": "warn",
      // three.js works by changing its objects in place (positions, materials, cameras each frame).
      "react-hooks/immutability": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
