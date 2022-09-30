#!/usr/bin/env node

const { ESLint } = require("eslint");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const process = require("process");
const path = require("path");

const extensionRegex = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;

async function main(argv) {
	const { dir, rule } = argv;

	const eslint = new ESLint({ cwd: dir });

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
			// yield from then i.e. refactor this to use the streaming API
			if (extensionRegex.test(trackedFile)) {
				const isPathIgnored = await eslint.isPathIgnored(trackedFile);
				if (!isPathIgnored) {
					yield trackedFile;
				}
			}
		}
	}

	async function lintFile(filePath) {
		const config = await eslint.calculateConfigForFile(filePath);

		// Remember, we only want to run a focused test of the rule
		// There's no point testing the rule on a file where that rule would never be enabled in the first place
		const ruleSeverity = config.rules[rule];
		if (ruleSeverity === undefined || ruleSeverity[0] === "off") {
			return;
		}
		const code = await fs.readFile(filePath, { encoding: "utf-8" });

		const baseConfig = {
			...config,
			rules: {
				[rule]: "error",
			},
		};
		const fileLinter = new ESLint({
			allowInlineConfig: false,
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
				console.info(`${filePath}:${message.line}:${message.column}`);
			});
		}
	}

	for await (const file of getLintFiles()) {
		await lintFile(file);
	}
}

const [dir, rule] = process.argv.slice(2);

main({ dir: path.resolve(dir), rule }).catch((reason) => {
	console.error(reason);
	process.exit(1);
});
