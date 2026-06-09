import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import tsParser from "@typescript-eslint/parser";
import boundaries from "eslint-plugin-boundaries";
import neverthrow from "eslint-plugin-neverthrow";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const webBoundariesSettings = {
  "boundaries/root-path": "apps/web/src",
  "boundaries/include": ["**/*.{ts,tsx}"],
  "boundaries/ignore": ["**/*.css"],
  "boundaries/elements": [
    {
      type: "shared",
      pattern: "shared/*",
    },
    {
      type: "feature",
      pattern: "features/(*)",
      capture: ["featureName"],
    },
    {
      type: "app",
      pattern: "app/**",
    },
    {
      type: "never-import",
      pattern: "proxy.ts",
      mode: "full",
    },
    {
      type: "never-import",
      pattern: "tasks/*",
    },
  ],
};

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/prisma/generated/**",
    "refs/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: {
      neverthrow: fixupPluginRules(neverthrow),
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        2,
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "neverthrow/must-use-result": 2,
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: {
      boundaries,
    },
    settings: webBoundariesSettings,
    rules: {
      "boundaries/no-unknown": 2,
      "boundaries/no-unknown-files": 2,
      "boundaries/dependencies": [
        2,
        {
          default: "disallow",
          rules: [
            {
              from: { type: "shared" },
              allow: { to: { type: "shared" } },
            },
            {
              from: { type: "feature" },
              allow: {
                to: [
                  { type: "shared" },
                  { type: "feature", captured: { featureName: "{{from.featureName}}" } },
                ],
              },
            },
            {
              from: { type: "app" },
              allow: { to: { type: ["shared", "feature"] } },
            },
            {
              from: { type: "never-import" },
              allow: { to: { type: ["shared", "feature"] } },
            },
          ],
        },
      ],
    },
  },
]);
