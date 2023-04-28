#!/usr/bin/env node

const { ESLint } = require("eslint");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const { constants: fsConstants } = require("fs");
const process = require("process");
const path = require("path");
const { hideBin } = require("yargs/helpers");
const Yargs = require("yargs/yargs");

const extensionRegex = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;

/**
 * @param {object} argv
 * @param {boolean} argv.allowInlineConfig
 * @param {string} argv.dir
 * @param {string} argv.ruleOrRulePattern
 */
async function main(argv) {
	const { allowInlineConfig, dir, ruleOrRulePattern } = argv;
	// check if directory exists and is readable
	await fs.access(dir, fsConstants.R_OK);

	const eslint = new ESLint({ cwd: dir });

	let consideredFilesTally = 0;
	let skippedFilesTally = 0;
	let filesWithIssuesTally = 0;
	let failedFilesTally = 0;
	let issuesTally = 0;

	async function* getTrackedFiles() {
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

	async function* getLintFiles() {
		for await (const trackedFile of getTrackedFiles()) {
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

	async function lintFile(filePath) {
		const config = await eslint.calculateConfigForFile(filePath);

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

			issuesTally += messages.length;
			if (messages.length > 0) {
				filesWithIssuesTally += 1;
			}
		}
	}

	for await (const file of getLintFiles()) {
		await lintFile(file);
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
		"$0 <ruleOrRulePattern> <dir>",
		"Run ESLint on files that match the rule or rule pattern",
		(builder) => {
			return builder
				.positional("ruleOrRulePattern", { type: "string" })
				.positional("dir", { type: "string" })
				.option("allowInlineConfig", { type: "boolean", default: false });
		},
		(argv) => {
			return main(argv);
		}
	)
	.version()
	.strict(true)
	.help()
	.parse();
