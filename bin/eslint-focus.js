#!/usr/bin/env node

const { ESLint } = require("eslint");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const { constants: fsConstants } = require("fs");
const process = require("process");
const path = require("path");
const { hideBin } = require("yargs/helpers");
const Yargs = require("yargs/yargs");
const { terminalWidth } = require("yargs");

const extensionRegex = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;

/**
 * @param {string} dir
 */
async function* getTrackedFiles(dir) {
	const gitProcess = spawn("git", ["ls-tree", "-r", "HEAD", "--name-only"], {
		cwd: dir,
	});

	gitProcess.stderr.setEncoding("utf-8");
	gitProcess.stdout.setEncoding("utf-8");

	gitProcess.stderr.on("data", (errorOutput) => {
		throw new Error(errorOutput);
	});

	let buffer = "";
	for await (const partialChunk of gitProcess.stdout) {
		const chunk = buffer + partialChunk;
		const lines = chunk.split("\n");
		for (let i = 0; i < lines.length - 1; i += 1) {
			yield path.join(dir, lines[i]);
		}
		buffer = lines[lines.length - 1];
	}

	if (buffer !== "") {
		yield path.join(dir, buffer);
	}
}

/**
 * @param {object} argv
 * @param {boolean} argv.allowInlineConfig
 * @param {string[]} argv.relativeOrAbsolutePaths
 * @param {string} argv.ruleOrRulePattern
 * @param {boolean} argv.fix
 * @param {NonNullable<NonNullable<import('eslint').ESLint.Options['fixTypes']>[0]>[] | undefined} argv.fixType
 */
async function main(argv) {
	const {
		allowInlineConfig,
		relativeOrAbsolutePaths,
		fix,
		fixType,
		ruleOrRulePattern,
	} = argv;

	let consideredFilesTally = 0;
	let skippedFilesTally = 0;
	let filesWithIssuesTally = 0;
	let failedFilesTally = 0;
	let issuesTally = 0;

	/**
	 * @param {ESLint} eslint
	 * @param {string} dir
	 */
	async function* getLintFiles(eslint, dir) {
		for await (const trackedFile of getTrackedFiles(dir)) {
			consideredFilesTally += 1;

			// yield from then i.e. refactor this to use the streaming API
			if (extensionRegex.test(trackedFile)) {
				try {
					const isPathIgnored = await eslint.isPathIgnored(trackedFile);
					if (!isPathIgnored) {
						yield trackedFile;
					} else {
						skippedFilesTally += 1;
					}
				} catch (error) {
					failedFilesTally += 1;
					console.warn(`${trackedFile}: ${error}`);
					return;
				}
			}
		}
	}

	/**
	 * @param {ESLint} eslint
	 * @param {string} filePath
	 */
	async function lintFile(eslint, filePath) {
		const config = await eslint.calculateConfigForFile(filePath);

		/**
		 * @type {Record<string, [import("eslint").Linter.StringSeverity]>}
		 */
		const rules = {};
		const mayLintMultipleRules = ruleOrRulePattern.startsWith("/");
		if (ruleOrRulePattern.startsWith("/")) {
			const ruleRegExp = new RegExp(ruleOrRulePattern.slice(1, -1));
			for (const rule of Object.keys(config.rules)) {
				if (ruleRegExp.test(rule)) {
					rules[rule] = config.rules[rule];
				}
			}
		} else {
			rules[ruleOrRulePattern] = config.rules[ruleOrRulePattern];
		}

		// Remember, we only want to run a focused test of the rule
		// There's no point testing the rule on a file where that rule would never be enabled in the first place
		const hasEnabledRules = Object.values(rules).some((ruleSeverity) => {
			return ruleSeverity !== undefined && ruleSeverity[0] !== "off";
		});
		if (!hasEnabledRules) {
			return;
		}
		const code = await fs.readFile(filePath, { encoding: "utf-8" });

		const baseConfig = {
			...config,
			rules,
		};
		const fileLinter = new ESLint({
			allowInlineConfig,
			baseConfig,
			cwd: path.dirname(filePath),
			fix,
			fixTypes: fixType,
			useEslintrc: false,
		});

		const results = await fileLinter.lintText(code, { filePath });

		// TODO: If the file is ignored, no results are returned.
		// But it should've been already be caught by `eslint.isPathIgnored`
		if (results.length > 0) {
			const [{ messages }] = results;
			messages.forEach((message) => {
				console.info(
					`${filePath}:${message.line}:${message.column}${
						mayLintMultipleRules ? ` (${message.ruleId})` : ""
					}`
				);
			});

			await ESLint.outputFixes(results);

			issuesTally += messages.length;
			if (messages.length > 0) {
				filesWithIssuesTally += 1;
			}
		}
	}

	for (const relativeOrAbsolutePath of relativeOrAbsolutePaths) {
		const dir = path.resolve(relativeOrAbsolutePath);

		// check if directory exists and is readable
		await fs.access(dir, fsConstants.R_OK);

		const eslint = new ESLint({ cwd: dir });

		for await (const file of getLintFiles(eslint, dir)) {
			await lintFile(eslint, file);
		}
	}

	console.table({
		"Considered files": consideredFilesTally,
		"Skipped files": skippedFilesTally,
		"Files failed to lint": failedFilesTally,
		"Files with issues": filesWithIssuesTally,
		Issues: issuesTally,
	});
}

Yargs(hideBin(process.argv))
	.scriptName("eslint-focus")
	.command(
		"$0 <ruleOrRulePattern> <relativeOrAbsolutePaths..>",
		"Run ESLint with a single rule or rules matching a pattern on a given directory.",
		(builder) => {
			return builder
				.positional("ruleOrRulePattern", {
					describe: "A single rule or pattern",
					type: "string",
					demandOption: true,
				})
				.positional("relativeOrAbsolutePaths", {
					describe:
						"An absolute path or a path relative to the current working directory.",
					type: "string",
					demandOption: true,
					array: true,
				})
				.option("allowInlineConfig", {
					describe: "Respects eslint-disable directives.",
					type: "boolean",
					default: false,
				})
				.option("fix", {
					describe:
						"Same as `eslint --fix`: https://eslint.org/docs/latest/use/command-line-interface#--fix",
					type: "boolean",
					default: false,
				})
				.option("fix-type", {
					describe:
						"Same as `eslint --fix-type`: https://eslint.org/docs/latest/use/command-line-interface#--fix-type",
					array: true,
					type: "string",
					choices: /** @type {const} */ (["problem", "suggestion", "layout"]),
				});
		},
		(argv) => {
			return main(argv);
		}
	)
	.example(
		"npx $0 react-hooks/rules-of-hooks .",
		"Run `react-hooks/rules-of-hooks` on every file inside the current directory."
	)
	.example(
		"npx $1 /jest\\// .",
		"Run all Jest rules on every file inside the current directory."
	)
	.example(
		"npx $0 react-hooks/exhaustive-deps . --fix --fix-type suggestion",
		"Fixes all `react-hooks/exhaustive-deps` issues inside the current directory."
	)
	.example(
		"npx $0 import/order packages/features/pf-*",
		"(Relies on Bash globbing) Run `import/order` on every folder matching 'packages/features/pf-*'."
	)
	.example(
		"npx $0 import/order packages/core packages/traits",
		"(Relies on Bash globbing) Run `import/order` on every file inside 'packages/core' OR 'packages/traits'."
	)
	.wrap(Math.min(120, terminalWidth()))
	.version()
	.strict(true)
	.help()
	.parse();
