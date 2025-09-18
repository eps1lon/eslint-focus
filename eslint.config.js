const js = require("@eslint/js");
const reactPlugin = require("eslint-plugin-react");
const globals = require("globals");
const typescriptParser = require("typescript-eslint").parser;
const typescriptEslint = require("typescript-eslint");

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
	{
		files: ["**/*.js", "**/*.mjs", "**/*.ts", "**/*.tsx"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "commonjs",
			parser: typescriptParser,
			parserOptions: {
				ecmaVersion: "latest",
			},
			globals: {
				...globals.browser,
				...globals.commonjs,
				...globals.es2021,
				...globals.node,
			},
		},
		plugins: {
			react: reactPlugin,
		},
		settings: {
			react: {
				version: "18",
			},
		},
		rules: {
			...js.configs.recommended.rules,
			...typescriptEslint.configs.recommended.rules,
			// Custom rules
			"@typescript-eslint/no-var-requires": "off",
			"no-console": ["error", { allow: ["error", "info", "table", "warn"] }],
			"react/no-unstable-nested-components": ["warn", {}],
		},
	},
];
