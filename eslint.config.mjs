import globals from "globals";
import pluginJs from "@eslint/js";
import tseslintParser from "@typescript-eslint/parser";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import pluginImport from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  { ignores: ["dist/**", "node_modules/**", "*.config.js", "*.config.ts"] },
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { parser: tseslintParser, parserOptions: { project: "./tsconfig.json" } } },
  { languageOptions: { globals: { ...globals.browser, ...globals.node, chrome: "readonly" } } },
  pluginJs.configs.recommended,
  ...tseslintPlugin.configs["flat/recommended"],
  {
    plugins: { import: pluginImport },
    rules: {
      "import/order": ["error", { groups: [["builtin", "external"], ["internal", "parent", "sibling"], ["index"]], "newlines-between": "always", alphabetize: { order: "asc" } }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
    },
  },
  eslintConfigPrettier,
];
