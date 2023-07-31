# eslint-focus

## 1.5.0

### Minor Changes

- [#30](https://github.com/eps1lon/eslint-focus/pull/30) [`abed6ed`](https://github.com/eps1lon/eslint-focus/commit/abed6edcb84b15553d6a76515ab3923c8099dd55) Thanks [@eps1lon](https://github.com/eps1lon)! - Add number of checked rules to tally

- [#29](https://github.com/eps1lon/eslint-focus/pull/29) [`b39fbd2`](https://github.com/eps1lon/eslint-focus/commit/b39fbd2da44de6e68006240ce21bf92f64a0e5aa) Thanks [@eps1lon](https://github.com/eps1lon)! - Add support for only including files that are also part of git-diff by adding `--diff [gitDiffOptions]`.

## 1.4.0

### Minor Changes

- [#27](https://github.com/eps1lon/eslint-focus/pull/27) [`03ae11f`](https://github.com/eps1lon/eslint-focus/commit/03ae11f94b82198d111bd72bf122dc1a4a508219) Thanks [@eps1lon](https://github.com/eps1lon)! - Add support for automatically adding eslint-disable-next-line directives

  Specify `--fix-type add-disable-directive` to silence rules if they can't be autofixed: `npx eslint-focus import/order packages/core --allowInlineConfig --fix --fix-type add-disable-directive`

## 1.3.0

### Minor Changes

- [#25](https://github.com/eps1lon/eslint-focus/pull/25) [`84c1819`](https://github.com/eps1lon/eslint-focus/commit/84c18195d5c00b334cb18aaf214e9f4d2c9deff9) Thanks [@eps1lon](https://github.com/eps1lon)! - Allow linting multiple paths

  Example 1 (relying on [Bash globbing](https://tldp.org/LDP/abs/html/globbingref.html)): `npx eslint-focus import/order packages/features/pf-*`

  Example 2: `npx eslint-focus import/order packages/core packages/traits`

## 1.2.0

### Minor Changes

- [#21](https://github.com/eps1lon/eslint-focus/pull/21) [`8a3765c`](https://github.com/eps1lon/eslint-focus/commit/8a3765cfa4559d7e4de8ab98f1b3d35586c71b31) Thanks [@eps1lon](https://github.com/eps1lon)! - Add support for running in auto-fix mode

## 1.1.0

### Minor Changes

- [#18](https://github.com/eps1lon/eslint-focus/pull/18) [`6202294`](https://github.com/eps1lon/eslint-focus/commit/6202294bab7403e39fe0a9ab100a62d779d7b5f4) Thanks [@eps1lon](https://github.com/eps1lon)! - Allow running on rules matching a pattern

- [#16](https://github.com/eps1lon/eslint-focus/pull/16) [`d8fbf61`](https://github.com/eps1lon/eslint-focus/commit/d8fbf6172ecede4a4eebf4dff145c0689ed979ee) Thanks [@eps1lon](https://github.com/eps1lon)! - Add support for ESLint directives via `--allowInlineConfig`

## 1.0.0

### Major Changes

- [#13](https://github.com/eps1lon/eslint-focus/pull/13) [`e33ebc9`](https://github.com/eps1lon/eslint-focus/commit/e33ebc92f22f90f0dbd5b92e5f3ca1f81bcf99fb) Thanks [@eps1lon](https://github.com/eps1lon)! - Switch order of positional arguments.

  I ended up iterating over folders more often (to focus down on an issue) than switching the rule.
  It's more convenient to have the argument you change often last.

### Minor Changes

- [#11](https://github.com/eps1lon/eslint-focus/pull/11) [`e433aa8`](https://github.com/eps1lon/eslint-focus/commit/e433aa81e2b17428e27fa5932f61ee5fc4487822) Thanks [@eps1lon](https://github.com/eps1lon)! - Continue with a warning if ESLint crashes

## 0.1.0

### Minor Changes

- [#10](https://github.com/eps1lon/eslint-focus/pull/10) [`279b119`](https://github.com/eps1lon/eslint-focus/commit/279b119f8b385a5b6691f07c6ca02b00ed8d4e45) Thanks [@eps1lon](https://github.com/eps1lon)! - Add summary of run

### Patch Changes

- [#8](https://github.com/eps1lon/eslint-focus/pull/8) [`5a33e82`](https://github.com/eps1lon/eslint-focus/commit/5a33e82047a134f0efaf884f4d66079c13ec3491) Thanks [@eps1lon](https://github.com/eps1lon)! - Fix files with warnings not being logged

## 0.0.3

### Patch Changes

- [#7](https://github.com/eps1lon/eslint-focus/pull/7) [`2deac17`](https://github.com/eps1lon/eslint-focus/commit/2deac17fbc6d2ab51ef172845587a0f78351a17d) Thanks [@eps1lon](https://github.com/eps1lon)! - Don't lint ignored files

- [#5](https://github.com/eps1lon/eslint-focus/pull/5) [`4c8a932`](https://github.com/eps1lon/eslint-focus/commit/4c8a932b920112115e81f778e3c9f1992cd3a51a) Thanks [@eps1lon](https://github.com/eps1lon)! - Ensure plugins can be resolved correctly

## 0.0.2

### Patch Changes

- [#2](https://github.com/eps1lon/eslint-focus/pull/2) [`5f02d7a`](https://github.com/eps1lon/eslint-focus/commit/5f02d7a3dad4c21a79a79291647653b8edd30754) Thanks [@eps1lon](https://github.com/eps1lon)! - Initial release
