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
 * @param {import("child_process").ChildProcessWithoutNullStreams} childProcess
 */
async function* getLinesFromProcess(childProcess) {
	childProcess.stderr.setEncoding("utf-8");
	childProcess.stdout.setEncoding("utf-8");

	childProcess.stderr.on("data", (errorOutput) => {
		throw new Error(errorOutput);
	});

	let buffer = "";
	for await (const partialChunk of childProcess.stdout) {
		const chunk = buffer + partialChunk;
		const lines = chunk.split("\n");
		for (let i = 0; i < lines.length - 1; i += 1) {
			yield lines[i];
		}
		buffer = lines[lines.length - 1];
	}

	if (buffer !== "") {
		yield buffer;
	}
}

/**
 * @param {string} dir
 */
async function* getTrackedFiles(dir) {
	const gitProcess = spawn("git", ["ls-tree", "-r", "HEAD", "--name-only"], {
		cwd: dir,
	});

	for await (const file of getLinesFromProcess(gitProcess)) {
		yield path.join(dir, file);
	}
}

/**
 * @param {string} dir
 * @param {string} diffOptions -- https://git-scm.com/docs/git-diff#_description
 */
async function* getTrackedFilesInDiff(dir, diffOptions) {
	const args = ["diff", "--name-only", "--relative"];
	if (diffOptions !== "") {
		args.push(...diffOptions.split(" "));
	}
	args.push("--", ".");

	const gitProcess = spawn("git", args, {
		cwd: dir,
	});

	for await (const file of getLinesFromProcess(gitProcess)) {
		yield path.join(dir, file);
	}
}

/**
 * @typedef {NonNullable<NonNullable<import('eslint').ESLint.Options['fixTypes']>[0]>} ESLintFixType
 * @typedef {ESLintFixType | "add-disable-directive"} ESLintFocusFixType
 */

/**
 * @param {object} argv
 * @param {boolean} argv.allowInlineConfig
 * @param {string} [argv.diff]
 * @param {string[]} argv.relativeOrAbsolutePaths
 * @param {string} argv.ruleOrRulePattern
 * @param {boolean} argv.fix
 * @param {ESLintFocusFixType[]} argv.fixType
 */
async function main(argv) {
	const {
		allowInlineConfig,
		diff,
		relativeOrAbsolutePaths,
		fix,
		fixType,
		ruleOrRulePattern,
	} = argv;

	const eslintFixTypes = fixType.filter(
		/**
		 * @param {ESLintFocusFixType} type
		 * @returns {type is ESLintFixType}
		 */
		(type) => {
			return type !== "add-disable-directive";
		}
	);

	let consideredFilesTally = 0;
	let checkedRulesTally = 0;
	let skippedFilesTally = 0;
	let filesWithIssuesTally = 0;
	let failedFilesTally = 0;
	let issuesTally = 0;

	/**
	 * @param {ESLint} eslint
	 * @param {AsyncGenerator<string, void, unknown>} files
	 */
	async function* getLintFiles(eslint, files) {
		for await (const trackedFile of files) {
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
		const enabledRules = Object.values(rules).filter((ruleSeverity) => {
			return ruleSeverity !== undefined && ruleSeverity[0] !== "off";
		});
		const hasEnabledRules = enabledRules.length > 0;
		if (!hasEnabledRules) {
			return;
		}
		checkedRulesTally += enabledRules.length;
		const code = await fs.readFile(filePath, { encoding: "utf-8" });

		const baseConfig = {
			...config,
			rules,
		};
		const fileLinter = new ESLint({
			allowInlineConfig,
			baseConfig,
			cwd: path.dirname(filePath),
			fix: fix && eslintFixTypes.length > 0,
			fixTypes: eslintFixTypes,
			useEslintrc: false,
		});

		const results = await fileLinter.lintText(code, { filePath });

		// TODO: If the file is ignored, no results are returned.
		// But it should've been already be caught by `eslint.isPathIgnored`
		if (results.length > 0) {
			await ESLint.outputFixes(results);

			const [{ messages, output, source }] = results;

			if (messages.length > 0 && fixType.includes("add-disable-directive")) {
				// If ESLint fixed, we get `output`
				// If it didn't fix, we get `source`
				// We just want the code after linting
				const code = /** @type {string} */ (output ?? source);
				let lineSeparator = code.match(/\r?\n/)?.[0];
				if (lineSeparator === undefined) {
					lineSeparator = "\n";
				}
				/**
				 * Insertion order is matching keys in ascending order i.e.
				 * the line numbers are in ascending order
				 * @type {Record<number, string[]>}
				 */
				const violationsByLine = {};
				messages.sort((a, b) => {
					return a.line - b.line;
				});
				for (const message of messages) {
					const { line, ruleId } = message;
					if (ruleId !== null) {
						if (violationsByLine[line] === undefined) {
							violationsByLine[line] = [];
						}
						violationsByLine[line].push(ruleId);
					}
				}

				const lines = code.split(lineSeparator);
				let insertedEslintDisableDirective = 0;
				for (const [lineKey, violatedRules] of Object.entries(
					violationsByLine
				)) {
					// This should be an exact object but TS doesn't know that.
					const line = /** @type {number} */ (/** @type {unknown} */ (lineKey));
					// TODO: We don't indent this comment properly since Prettier is capable of doing that
					let disableDirective = `// eslint-disable-next-line ${violatedRules.join(
						","
					)}`;
					if (line > 1) {
						// lines is 1-based
						const insertionPosition = line - 2 + insertedEslintDisableDirective;
						const previousLine = lines[insertionPosition];
						const existingDisableDirective = previousLine.match(
							/^\s*\/\/ eslint-disable-next-line(.*)?$/
						);
						if (existingDisableDirective !== null) {
							// "eslint-disable-next-line rule1, rule2"
							// "eslint-disable-next-line rule1, rule2 -- reason1"
							const [rules, reasons] = existingDisableDirective[1].split(" --");
							disableDirective = `// eslint-disable-next-line ${[
								rules,
								...violatedRules,
							].join(", ")}`;
							if (reasons) {
								disableDirective += ` --${reasons}`;
							}
							lines[insertionPosition] = disableDirective;
						} else {
							lines.splice(insertionPosition + 1, 0, disableDirective);
							insertedEslintDisableDirective += 1;
						}
					} else {
						lines.splice(0, 0, disableDirective);
						insertedEslintDisableDirective += 1;
					}
				}

				const fixedCode = lines.join(lineSeparator);
				await fs.writeFile(filePath, fixedCode, { encoding: "utf-8" });
			} else {
				messages.forEach((message) => {
					console.info(
						`${path.relative(process.cwd(), filePath)}:${message.line}:${
							message.column
						}${mayLintMultipleRules ? ` (${message.ruleId})` : ""}`
					);
				});

				issuesTally += messages.length;
				if (messages.length > 0) {
					filesWithIssuesTally += 1;
				}
			}
		}
	}

	for (const relativeOrAbsolutePath of relativeOrAbsolutePaths) {
		const dir = path.resolve(relativeOrAbsolutePath);

		// check if directory exists and is readable
		await fs.access(dir, fsConstants.R_OK);

		const files =
			diff !== undefined
				? getTrackedFilesInDiff(dir, diff)
				: getTrackedFiles(dir);

		const eslint = new ESLint({ cwd: dir });

		for await (const file of getLintFiles(eslint, files)) {
			await lintFile(eslint, file);
		}
	}

	console.table({
		"Considered files": consideredFilesTally,
		"Checked rules": checkedRulesTally,
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
				.option("diff", {
					describe:
						"Only includes file that are also part of git-diff. See git-diff docs for possible values.",
					type: "string",
				})
				.option("fix", {
					describe:
						"Same as `eslint --fix`: https://eslint.org/docs/latest/use/command-line-interface#--fix",
					type: "boolean",
					default: false,
				})
				.option("fix-type", {
					describe:
						"Same as `eslint --fix-type` (https://eslint.org/docs/latest/use/command-line-interface#--fix-type) with an additional 'add-disable-directive' option to ignore the violation instead with an `eslint-disable-next-line` directive. " +
						"'add-disable-directive' only adds `//` comments i.e. it will likely produce syntax errors if lint violations are found inside JSX.",
					array: true,
					default: [],
					type: "string",
					choices: /** @type {const} */ ([
						"problem",
						"suggestion",
						"layout",
						"add-disable-directive",
					]),
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
	.example(
		"npx $0 import/order packages/core --allowInlineConfig --fix --fix-type add-disable-directive",
		"Adds eslint-disable-next-line directives to ignore all `import/order` violations inside 'packages/core'."
	)
	.wrap(Math.min(120, terminalWidth()))
	.version()
	.strict(true)
	.help()
	.parse();
