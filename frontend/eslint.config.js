import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import uiKit from "@eifi1/ui-kit/eslint";

/** `min-[2400px]:`, `max-[767.5px]:` — an arbitrary px media variant in a class string. */
const ARBITRARY_PX_MEDIA = String.raw`/(^|[\s:])(min|max)-\[[0-9.]+px\]:/`;
const ARBITRARY_PX_MEDIA_MESSAGE =
  "An arbitrary px media variant does not follow the text size (§10.4). Use a named breakpoint (sm … 3xl) or useBreakpoint().";
/** `text-[11px]`, `sm:text-[10px]`, `text-[length:13px]` — a px font size in a class string. */
const PX_FONT_SIZE = String.raw`/(^|[\s:!])text-\[(length:)?[0-9.]+px\]/`;
const PX_FONT_SIZE_MESSAGE =
  "A px font size does not follow the text size (§3.2). Use text-micro (0.625rem), text-caption (0.6875rem) or Tailwind's text-xs … sizes; a size between them in rem.";

// No eslint-config-prettier: none of these rules is about layout, so none
// fights Prettier, which owns the formatting (.prettierrc.json). Its checker
// found only `no-unexpected-multiline` (2026-10-29), which it lists as safe to
// keep beside Prettier. Add it, last, if a config extended here ever brings
// layout rules.
export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Off for the same reason the design system's own repo has it off: barrels
      // deliberately export helpers beside components, and the rule only affects
      // Fast Refresh, not correctness.
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // The design system's two rules from 0.32 (its text-size contract §3.2,
      // §10.4), copied as its adoption note recommends: a px font size stays
      // that size at 150 % beside text that grew, and an arbitrary px media
      // variant is the one breakpoint that cannot follow the text size. Class
      // strings only — a comment may still name one. An SVG label sized in its
      // viewBox's units says so as a `fontSize` attribute instead.
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${ARBITRARY_PX_MEDIA}]`, message: ARBITRARY_PX_MEDIA_MESSAGE },
        { selector: `TemplateElement[value.raw=${ARBITRARY_PX_MEDIA}]`, message: ARBITRARY_PX_MEDIA_MESSAGE },
        { selector: `Literal[value=${PX_FONT_SIZE}]`, message: PX_FONT_SIZE_MESSAGE },
        { selector: `TemplateElement[value.raw=${PX_FONT_SIZE}]`, message: PX_FONT_SIZE_MESSAGE },
      ],
    },
  },
  // The design system's `role-utilities` rule (ui-kit 0.35, which this app
  // asked for as Q6): a colour written `[var(--role)]` where the role has a
  // utility (`text-[var(--text-muted)]` for `text-muted`) is an error, and
  // `--fix` writes the utility. The 0.33 adoption rewrote 242 such classes by
  // a sed table, and until this rule only review kept new ones out. Last, as
  // the kit asks; tests are excluded by the config itself, because a test may
  // assert a kit class in its old form.
  uiKit.configs.recommended,
);
