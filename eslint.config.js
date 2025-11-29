module.exports = {
  settings: {
    "import/resolver": {
      typescript: {},
    },
  },
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
    "plugin:drizzle/recommended",
    "plugin:vitest-globals/recommended",
  ],
  env: {
    node: true,
    "vitest-globals/env": true,
  },
  plugins: ["import", "@typescript-eslint", "drizzle"],
  rules: {
    "object-shorthand": ["error", "always"],
    "no-alert": "warn",
    "no-unused-vars": "off",
    "no-console": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        prefer: "type-imports",
        fixStyle: "separate-type-imports",
      },
    ],
    "import/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
          "unknown",
        ],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
        warnOnUnassignedImports: true,
        pathGroupsExcludedImportTypes: ["builtin"],
      },
    ],
  },
};
