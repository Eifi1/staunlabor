import { act } from "@testing-library/react";

/**
 * Waits, inside act(), until the page has stopped changing: until the DOM has
 * been still for two turns of the event loop, and at most twenty turns.
 *
 * A mocked request answers a few microtasks after it is made, TanStack Query
 * hands the answer on one `setTimeout(0)` later, and one answer may start the
 * next request. A test that asserts before all of that has landed asserts on a
 * page that is still loading. For a test that something is *absent* ("says
 * nothing of sign-out"), that is a test that cannot fail. And
 * what lands afterwards lands outside act(), which React reports on the
 * console.
 *
 * A test that waits for something it can name should name it (`findBy*`,
 * `waitFor`). This is for the rest: after a render whose requests decide what
 * the test then checks is *not* there, and at the end of every test
 * (`src/test/setup.ts`). It needs real timers.
 */
export async function settled() {
  let changes = 0;
  const observer = new MutationObserver((records) => (changes += records.length));
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  try {
    await act(async () => {
      for (let turn = 0, quiet = 0; turn < 20 && quiet < 2; turn += 1) {
        const before = changes;
        await new Promise((resolve) => setTimeout(resolve, 0));
        quiet = changes === before ? quiet + 1 : 0;
      }
    });
  } finally {
    observer.disconnect();
  }
}
