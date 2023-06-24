import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { URL } from "node:url";
import { beforeAll, expect, test } from "@jest/globals";
import { temporaryDirectory } from "tempy";

let fixtureRootPath;
beforeAll(() => {
	fixtureRootPath = temporaryDirectory({
		prefix: "eslint-focus-fixtures",
	});
});

async function setupFixture(fixtureName) {
	const fixtureSourcePath = new URL(
		`../__fixtures__/${fixtureName}`,
		import.meta.url
	).pathname;
	const fixtureDestinationPath = path.join(fixtureRootPath, fixtureName);

	await fs.cp(fixtureSourcePath, fixtureDestinationPath, { recursive: true });

	execSync("git init", { cwd: fixtureDestinationPath });
	execSync("git add -A . ", { cwd: fixtureDestinationPath });
	execSync(
		"git commit --author='Jest <jest@example.com>' -m 'Initial commit'",
		{ cwd: fixtureDestinationPath }
	);
	execSync("npm i", { cwd: fixtureDestinationPath });

	return fixtureDestinationPath;
}

function runSync(args = [], cwd) {
	const error = new Error();

	const bin = new URL("../eslint-focus.js", import.meta.url).pathname;
	const command = [bin, ...args].join(" ");
	try {
		return execSync(command, { cwd, encoding: "utf-8" });
	} catch (binError) {
		error.message = `${command}:\n ${binError.output.join("")}`;
		throw error;
	}
}

test("usage", () => {
	expect(runSync(["--help"])).toMatchInlineSnapshot(`
		"eslint-focus <ruleOrRulePattern> <relativeOrAbsolutePaths..>

		Run ESLint with a single rule or rules matching a pattern on a given directory.

		Positionals:
		  ruleOrRulePattern        A single rule or pattern  [string]
		  relativeOrAbsolutePaths  An absolute path or a path relative to the current working directory.  [string]

		Options:
		  --version            Show version number  [boolean]
		  --help               Show help  [boolean]
		  --allowInlineConfig  Respects eslint-disable directives.  [boolean] [default: false]
		  --fix                Same as \`eslint --fix\`: https://eslint.org/docs/latest/use/command-line-interface#--fix  [boolean] [default: false]
		  --fix-type           Same as \`eslint --fix-type\` (https://eslint.org/docs/latest/use/command-line-interface#--fix-type) with an additional 'add-disable-directive' option to ignore the violation instead with an \`eslint-disable-next-line\` directive. 'add-disable-directive' only adds \`//\` comments i.e. it will likely produce syntax errors if lint violations are found inside JSX.  [array] [choices: "problem", "suggestion", "layout", "add-disable-directive"] [default: []]

		Examples:
		  npx eslint-focus react-hooks/rules-of-hooks .                                                           Run \`react-hooks/rules-of-hooks\` on every file inside the current directory.
		  npx $1 /jest\\// .                                                                                       Run all Jest rules on every file inside the current directory.
		  npx eslint-focus react-hooks/exhaustive-deps . --fix --fix-type suggestion                              Fixes all \`react-hooks/exhaustive-deps\` issues inside the current directory.
		  npx eslint-focus import/order packages/features/pf-*                                                    (Relies on Bash globbing) Run \`import/order\` on every folder matching 'packages/features/pf-*'.
		  npx eslint-focus import/order packages/core packages/traits                                             (Relies on Bash globbing) Run \`import/order\` on every file inside 'packages/core' OR 'packages/traits'.
		  npx eslint-focus import/order packages/core --allowInlineConfig --fix --fix-type add-disable-directive  Adds eslint-disable-next-line directives to ignore all \`import/order\` violations inside 'packages/core'.
		"
	`);
});

test("--fix --fix-type add-disable-directive", async () => {
	const fixturePath = await setupFixture("add-disable-directive");
	// console.log({ fixturePath });

	expect(
		runSync(
			[
				"'/.*/'",
				".",
				"--allowInlineConfig",
				"--fix",
				"--fix-type",
				"add-disable-directive",
			],

			fixturePath
		)
	).toMatchInlineSnapshot(`
		"┌──────────────────────┬────────┐
		│       (index)        │ Values │
		├──────────────────────┼────────┤
		│   Considered files   │   3    │
		│    Skipped files     │   0    │
		│ Files failed to lint │   0    │
		│  Files with issues   │   0    │
		│        Issues        │   0    │
		└──────────────────────┴────────┘
		"
	`);

	await expect(
		fs.readFile(path.join(fixturePath, "missing-disable-directive.js"), {
			encoding: "utf-8",
		})
	).resolves.toMatchInlineSnapshot(`
		"// eslint-disable-next-line eqeqeq
		if (Math.random() == 1) {
		// eslint-disable-next-line capitalized-comments
			// one branch
		}
		// eslint-disable-next-line  no-constant-condition, eqeqeq -- 1
		if (1 == 1) {
		// eslint-disable-next-line capitalized-comments
			// two branch
		}
		"
	`);
});
