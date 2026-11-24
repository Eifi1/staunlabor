/**
 * The exhibit page's parts as a bar under the site's header, held there while
 * the page scrolls (Marcel, 2026-11-24): every page has the same parts, so a
 * reader who knows one page can jump to the trick or the checks of any other,
 * and sees where in the page they are. The part being read is marked, by the
 * kit's `useScrollSpy`.
 *
 * Its own bar rather than the kit's `PageContents`: that is a rail beside the
 * page from `xl` up and a fold under the title below it, where this is one
 * row at every width, scrolling sideways on a phone. It does not number the
 * parts or hide one that a page lacks: the frame passes only the parts the
 * page has.
 */

import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useScrollSpy } from "@eifi1/ui-kit";

export interface ExhibitPart {
  /** The id of the element the part's link scrolls to. */
  id: string;
  label: string;
}

/** Where a part's heading lands under the two bars: the header's 3.5 rem,
 *  the bar's some 2.7 rem, and room for the card's own top above its heading,
 *  which at 7 rem stood flush under the bar (seen at 360 px and 1440 px).
 *  Every part's heading carries it. */
export const PART_TARGET = "scroll-mt-32";

/** A reader whose system asks for less motion is moved at once. */
function motion(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function ExhibitNav({ parts }: { parts: ExhibitPart[] }) {
  const { t } = useTranslation();
  // Keyed by the ids' text: the frame builds `parts` anew on every render, and
  // a new array each time would set the spy up again each time.
  const key = parts.map((part) => part.id).join(" ");
  const ids = useMemo(() => key.split(" "), [key]);
  // The reading line a fifth down the window: below the two bars on a phone
  // (some 100 px of some 640), so a part counts as read once its heading has
  // gone under them.
  const active = useScrollSpy(ids, { line: 0.2 });
  const strip = useRef<HTMLUListElement>(null);

  // On a phone the row is wider than the screen: the marked part is brought
  // into the strip's middle, or the reader would see a mark on a part
  // scrolled out of the row.
  useEffect(() => {
    const row = strip.current;
    const item = row?.querySelector<HTMLElement>(`[data-part="${active}"]`);
    if (!row || !item || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2, behavior: motion() });
  }, [active]);

  // Scrolled here, not by the `#id` the link carries: an anchor link would
  // put an entry in the history for every jump, so the back button would walk
  // through the parts before it left the page. The `href` stays for a new tab
  // and for copying the link.
  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: motion(), block: "start" });
    // The keyboard follows: the next Tab goes on inside the part, not along the bar.
    target.focus({ preventScroll: true });
  };

  return (
    <nav
      aria-label={t("experiments.frame.parts")}
      className="sticky top-14 z-20 -mx-3 border-b border-subtle bg-page px-3 md:-mx-6 md:px-6 print:hidden"
    >
      <ul ref={strip} className="relative flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {parts.map((part) => {
          const current = part.id === active;
          return (
            <li key={part.id} data-part={part.id} className="shrink-0">
              <a
                href={`#${part.id}`}
                onClick={(event) => go(event, part.id)}
                aria-current={current ? "location" : undefined}
                className={`block border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                  current
                    ? "border-brand font-medium text-primary"
                    : "border-transparent text-secondary hover:text-primary"
                }`}
              >
                {part.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
