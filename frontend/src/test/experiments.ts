import { fireEvent, screen } from "@testing-library/react";
import en from "@/shared/i18n/locales/en.json";
import { checkCases } from "@/features/experiments/checks";
import { EXHIBITS } from "@/features/experiments/exhibits";
import fixtures from "@/features/experiments/test-fixtures.json";
import { mockApi } from "./api-mock";

/** The exhibits' English words, as the screen shows them. */
export const E = en.experiments;

/** No exhibit checked yet: what the server answers until an admin checks one.
 *  The exhibits with cases are the ones `checks.json` holds cases for, as the
 *  server lists them, so an exhibit that gains or loses its cases needs no
 *  edit here. */
export const UNCHECKED = {
  with_cases: EXHIBITS.map((entry) => entry.exhibit)
    .filter((exhibit) => checkCases(exhibit).length > 0)
    .sort(),
  checked: [] as { exhibit: string; checked_on: string }[],
};

/** The engine's answers (`test-fixtures.json`, the API's answers to the
 *  defaults, written by `scripts/write-test-fixtures.py`), at the routes the
 *  backend serves them on; nothing checked yet. */
export function mockExperiments() {
  mockApi({
    "GET /experiments/checks": UNCHECKED,
    "GET /experiments/chair": fixtures.chair,
    "GET /experiments/chladni": fixtures.chladni,
    "GET /experiments/defaults": fixtures.defaults,
    "POST /experiments/coil": fixtures.coil,
    "POST /experiments/sphere": fixtures.sphere,
    "POST /experiments/platform": fixtures.platform,
    "POST /experiments/race": fixtures.race,
    "POST /experiments/elephant": fixtures.elephant,
    "POST /experiments/smoke": fixtures.smoke,
    "POST /experiments/cannon": fixtures.cannon,
    "POST /experiments/wave": fixtures.wave,
  });
}

/** Asks a play card for the answer it holds back until the exhibit is tried
 *  (`held.tsx`). */
export const showAnswer = () => fireEvent.click(screen.getByRole("button", { name: E.frame.show }));

/** What a slider says it is set to: its `aria-valuetext`, value and unit. */
export const sliderText = (name: string) => screen.getByRole("slider", { name }).getAttribute("aria-valuetext");

/** Moves a slider to `value`, as a reader's drag ends there. */
export const setSlider = (name: string, value: string | number) =>
  fireEvent.change(screen.getByRole("slider", { name }), { target: { value: String(value) } });

/** Every equation's legend on the page: each `Equation` has one, so the count
 *  says how many equations are drawn. */
export const legends = () => screen.getAllByLabelText(E.equation.symbols);
