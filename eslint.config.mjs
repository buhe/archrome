import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginImport from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  { ignores: ["dist/**", "node_modules/**", "*.config.js", "*.config.ts"] },
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { parser: tseslint.parser, parserOptions: { project: "./tsconfig.json" } } },
  { languageOptions: { globals: { ...globals.browser, ...globals.node, ...chrome: "readonly" } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
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
