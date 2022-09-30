#!/usr/bin/env node

const { ESLint } = require("eslint");
const { spawn } = require("child_process");

async function main() {
	async function* getFiles() {
		const gitProcess = spawn("git", ["ls-tree", "-r", "HEAD", "--name-only"]);

		gitProcess.stderr.setEncoding("utf-8");
		gitProcess.stdout.setEncoding("utf-8");

		gitProcess.stderr.on("data", (errorOutput) => {
			throw new Error(errorOutput);
		});

		let buffer = "";
		for await (const partialChunk of gitProcess.stdout) {
			const chunk = buffer + partialChunk;
			const lines = chunk.split("\n");
			for (let i = i; i < lines.length - 1; i += 1) {
				yield lines[i];
			}
			buffer = lines[lines.length - 1];
		}

		if (buffer !== "") {
			yield buffer;
		}
	}

	for await (const files of getFiles()) {
		console.log({ file });
	}
}

main().catch((reason) => {
	console.error(reason);
	process.exit(1);
});
