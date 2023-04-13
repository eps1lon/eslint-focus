# eslint-focus

Allows running ESLint on a directory with a single rule.
The rule MUST be enabled in your ESLint config for the files you want it to run on (e.g. enable it in your root `.eslintrc.js`).

```bash
$ npx eslint-focus react/no-unstable-nested-components .
/Users/sebastian.silbermann/repo/BottomSheet.native.tsx:106:29
/Users/sebastian.silbermann/repo/BottomSheet.native.tsx:145:15
/Users/sebastian.silbermann/repo/CardExpirationWarning.tsx:51:23
┌──────────────────────┬────────┐
│       (index)        │ Values │
├──────────────────────┼────────┤
│   Considered files   │ 71671  │
│    Skipped files     │  181   │
│ Files failed to lint │   1    │
│  Files with issues   │  216   │
│        Issues        │  308   │
└──────────────────────┴────────┘
Done in 386.08s.
```

By default, `allowInlineConfig` is disabled i.e. `eslint-disable` directives are ignored.
You can run with `--allowInlineConfig` to enable these directives: `npx eslint-focus react/no-unstable-nested-components . --allowInlineConfig`

## Missing

Configure extensions. By default it runs on everything that's TypeScript or JavaScript i.e. `/\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/`.

## Why?

- eslint-nibbler is slow
- ESLint formatters still execute every rule
- ESLint `--no-eslintrc` means I have to know the parser options up front
- ESLint has no built-in support to stream results
