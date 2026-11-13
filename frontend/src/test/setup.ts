import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import { settled } from "./settle";

/**
 * The end of every test, in this order: what is still on its way lands inside
 * act(), the page is unmounted, and the document is put back.
 *
 * A test that asserts and returns does not stop the page. A mocked request
 * answers a few microtasks later, TanStack Query hands it on one
 * `setTimeout(0)` after that, and an answer may start another request (the
 * defaults, then a build's figures). Each such update after the last `await`
 * lands outside act(), and React says so on the console — in tests that all
 * pass. Local runs never show it, because vitest prints a passing test's
 * console only on CI.
 *
 * So the teardown waits, inside act(), until the DOM has been still for two
 * turns of the event loop (`settled`, at most twenty turns), and only then
 * unmounts. That covers what a test never looked at after its last assertion. An update
 * *between* an action and an assertion is the test's own to wait for, with a
 * `findBy*` or `waitFor`, and `failOnActWarnings` below holds every test to it.
 *
 * Under fake timers a `setTimeout` would never fire, so the teardown unmounts
 * at once there. It runs before a test file's own `afterEach`
 * (`sequence.hooks: "list"` in `vite.config.ts`), so a file that resets a store
 * or restores its mocks does it to an unmounted page.
 */
afterEach(async () => {
  if (!vi.isFakeTimers()) await settled();
  cleanup();
  // A test that reads the page at a text size sets the attribute before it
  // renders; putting it back is here, after the unmount, because removing it
  // while the page is mounted re-renders every component that reads the size,
  // and each of those re-renders warns outside act().
  document.documentElement.removeAttribute("data-text-size");
});

/**
 * An update outside act() fails the test it happened in (`failOnActWarnings`).
 *
 * React's warning is only a line on the console, and a passing test's console
 * is printed on CI alone, so such warnings go unread. Each is a test reading a
 * page that had not finished updating: harmless after its last assertion,
 * which the teardown above now absorbs, and a race before one. So the warning
 * is collected here and the test fails on it, naming the component.
 *
 * The fix is in the test, never here: wait for what the update shows
 * (`findBy*`, `waitFor`), click through Testing Library rather than the DOM's
 * own `.click()`, call `settled()` before checking that something is absent,
 * and reset a store in a file-level `afterEach`, which runs after the unmount.
 */
const actWarnings: string[] = [];
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  // React passes the component's name as the format's first argument.
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act(")) actWarnings.push(String(args[1]));
  consoleError(...args);
};
afterEach(function failOnActWarnings() {
  const components = actWarnings.splice(0);
  if (components.length > 0) {
    throw new Error(
      `React updated ${[...new Set(components)].join(", ")} outside act() in this test: the test read the page ` +
        "before it had finished updating. Wait for what the update shows (findBy*, waitFor), or call settled() " +
        "(src/test/settle.ts) before checking that something is absent.",
    );
  }
});

// How long a `findBy*` waits before giving up. **This is not `testTimeout`**:
// `vite.config.ts` gives a test thirty seconds, but every async query in it
// would still give up after Testing Library's own default second, and a test
// allowed thirty seconds whose first `findByText` fails at one is a test with
// a one-second budget.
//
// The symptom is the shape a flake takes: a full run under v8 coverage fails
// two or three files, a different two or three each time, and every one of
// them passes on its own in well under a second. What decides it is which
// worker happens to be competing for a core. A `findBy` inside a heavy page's
// test waits against exactly that contention; one second and five were both
// tried and both flaked, on a different file each run, and ten holds.
//
// It stays well under the thirty-second test budget on purpose. A query that
// will *never* resolve should fail as a query, with the DOM printed and the
// text it was looking for named, rather than as a bare test timeout that says
// only that the file ran out of clock.
configure({ asyncUtilTimeout: 10_000 });

// jsdom has no ResizeObserver, which recharts' ResponsiveContainer needs — stub
// it so a chart-bearing page can mount at all.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom implements no scrolling, so this method simply does not exist; a
// component that scrolls something into view on mount would throw rather than
// fail an assertion.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no canvas either, and says so on the console every time something
// asks for a context. A null is the "no canvas" any caller must handle anyway,
// so answer it quietly rather than with a stack trace per render.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Object URLs, should a test attach a picture. jsdom ≥ 30.1 ships its own
// `URL.createObjectURL`, which reads jsdom's internal Blob storage and throws
// ("reading '_buffer'") on the File a test builds — that one is Node's, which
// vitest leaves in place. Before 30.1 Node's own implementation answered and
// accepted it. No test reads a preview's bytes, only that one is shown, so a
// counter stands in for the URL.
let objectUrls = 0;
URL.createObjectURL = () => `blob:test/${++objectUrls}`;
URL.revokeObjectURL = () => {};
