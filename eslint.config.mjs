import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // A copy of postgres.js, patched - kept as published (see its README.md).
    "src/vendor/**",
  ]),
  {
    // The application talks to Postgres only through the patched driver, which never pipelines.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.ts", "src/test/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "postgres",
              message: 'Use the patched driver: import postgres from "@/vendor/postgres" (see src/vendor/postgres/README.md). Type imports are fine.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
