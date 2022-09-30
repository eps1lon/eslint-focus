module.exports = {
	env: {
		browser: true,
		commonjs: true,
		es2021: true,
	},
	settings: {
		react: {
			version: "18",
		},
	},
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
	overrides: [],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
	},
	plugins: [
		"@typescript-eslint",
		// just enabled to test eslint-focus with react/no-unstable-nested-components
		"react",
	],
	rules: {
		// silly rule
		"@typescript-eslint/no-var-requires": "off",
		// Prevent debugging stuff to slip through. allowed methods are directed at CLI user.
		"no-console": ["error", { allow: ["error", "info", "table", "warn"] }],
		"react/no-unstable-nested-components": ["warn", {}],
	},
};
