/**
 * The experiment of the day: random, but with a memory.
 *
 * Every exhibit has its turn before any has a second one. The days from
 * {@link DAILY_EPOCH} on are cut into **rounds**, one day per exhibit, and each
 * round is the exhibits in a random order, drawn by a generator seeded with
 * the day the round starts. So:
 *
 * - **the same for everybody, and on every reload**: the pick is a function of
 *   the date, worked out in the browser, with no server, no table and nothing
 *   anyone has to do;
 * - **no repeat until all have been**, and **none soon after**: a round is
 *   drawn day by day from the exhibits whose last turn is at least
 *   {@link spacing} days back — four, with eight exhibits. A shuffle alone
 *   guards only its own round: the chair could end one and start the next two
 *   days later, and the overview's week showed it twice (seen on the page);
 * - **a bonus and two maluses** among those, so that like exhibits are less
 *   likely to follow each other ({@link DAILY_WEIGHTS}): a little more chance for
 *   every day an exhibit has waited beyond the spacing; half of it for one
 *   about a topic yesterday's was about too (the elephant after the smoke
 *   ring, both flow); a quarter for one that followed yesterday's in the round
 *   before, so that the same two do not come in the same order round after
 *   round. Weights, not rules: the round and the spacing are the guarantees,
 *   and these only lean the draw within them. The first series' rounds were
 *   drawn with a quarter and a tenth, and keep them, so the days the live site
 *   has shown keep their exhibit; the halved maluses draw from
 *   {@link SECOND_SERIES} on (Marcel, 2026-11-15: they should count less).
 *
 *   **Measured, not guessed** (400 rounds of all 31 exhibits; a plain shuffle
 *   per round, then the first series' weights, in brackets): a pair of the
 *   round before again in the same order 0.47 times a round (1.21; 0.29), a
 *   triple 0.003 (0.043; 0.003), two neighbours sharing a topic 20.6 days in a
 *   hundred (28.9; 15.0), a wait of more than a round and two days 34.3 % of
 *   turns (35.7 %; 33.8 %); with 30, before the Cartesian diver, they were
 *   0.46, 22.6 and 33.8 %, with 29, before the overhang, 0.46, 23.9 and
 *   33.6 %. With the first eight the first series' weights cut
 *   the repeated pairs from 0.90 a round to 0.27 and the topic neighbours from
 *   14.5 days in a hundred to 7.9. The very first version spaced turns by six
 *   days with a full bonus per day, and that is a rotation in disguise: it
 *   repeated triples 0.65 times a round, five times as often as a shuffle —
 *   the history showed the chair, the platform and the cannon in that order
 *   two rounds running;
 * - **the history is the rule run backwards**, so it needs no record either,
 *   and the overview can show the past days without having kept them.
 *
 * The day is Zurich's (`Europe/Zurich`), not the reader's: the museum whose
 * exhibits inspired these stands in Winterthur, and one day's exhibit should
 * be one exhibit, whoever asks.
 *
 * **A new exhibit joins at the next round** that starts on or after its
 * `since` day (`exhibits.ts`), not in the middle of one: a round's order is
 * shuffled from its members, and a member added mid-round would reshuffle days
 * already shown. That is also why `since` is the day the exhibit **ships**,
 * not the day it was written: a date in the past would put it into a round
 * that has already begun on the live site, and change what that round showed.
 *
 * What it deliberately does not do: pick from what this reader has tried. The
 * day's exhibit is one for everybody, so that "today's" means the same thing
 * to two people.
 */

import { EXHIBITS, SECOND_SERIES, type Exhibit, type Topic } from "./exhibits";

/** The first day of the first round. Nothing before it has an exhibit. */
export const DAILY_EPOCH = "2026-11-12";

/** Whose calendar a day is. */
export const DAILY_ZONE = "Europe/Zurich";

const DAY_MS = 86_400_000;

/** One exhibit in the rotation, the day it joins, and what it is about. */
export interface DailyMember {
  exhibit: Exhibit;
  since: string;
  topics?: readonly Topic[];
}

/** How the draw leans, within a round and the spacing. */
export interface DailyWeights {
  /** Added to an exhibit's weight of 1 for every day it has waited beyond the
   *  spacing (at most a round's worth): one long waiting comes sooner. Kept
   *  small: a large one draws the longest-waiting first, which is a rotation. */
  bonusPerDay: number;
  /** What an exhibit's weight is multiplied by when it shares a topic with
   *  yesterday's. */
  topicMalus: number;
  /** … and when it came right after yesterday's in the round before. */
  pairMalus: number;
}

/** The first series' weights, which drew every round before {@link SECOND_SERIES}:
 *  kept for those rounds, so the days the live site has shown keep their exhibit. */
const FIRST_WEIGHTS: DailyWeights = { bonusPerDay: 0.25, topicMalus: 0.25, pairMalus: 0.1 };

/** From the second series on, the maluses at half their strength (Marcel,
 *  2026-11-15: "Tagesminus sollte weniger zählen"): a half for a shared topic,
 *  a quarter for yesterday's follower. With 31 exhibits, eleven of them about
 *  energy, nine about oscillation and eight about angular momentum, the
 *  quarter held a topic back on most days. */
export const DAILY_WEIGHTS: DailyWeights = { bonusPerDay: 0.25, topicMalus: 0.5, pairMalus: 0.25 };

/** The weights that draw the round starting on day `start` (a day number). */
function scheduled(start: number): DailyWeights {
  return start < dayNumber(SECOND_SERIES) ? FIRST_WEIGHTS : DAILY_WEIGHTS;
}

/** A day and the exhibit it had. */
export interface DailyPick {
  day: string;
  exhibit: Exhibit;
}

/** Every built exhibit, from the day it ships. */
const POOL: readonly DailyMember[] = EXHIBITS.flatMap((entry) =>
  entry.path ? [{ exhibit: entry.exhibit, since: entry.since, topics: entry.topics }] : [],
);

/** A calendar day, `YYYY-MM-DD`, as days since 1970-01-01. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function dayString(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** The calendar day it is in `zone` at `now`, `YYYY-MM-DD`. Read from the
 *  formatter's parts, not from a locale's format of the whole date, which is
 *  a convention ICU may change. */
export function dayIn(now: Date = new Date(), zone: string = DAILY_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** mulberry32: small, fast, and the same numbers in every browser, which is
 *  all a shuffle shown to everybody needs. `Math.random` cannot be seeded. */
function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The fewest days between two turns of one exhibit, in a round of `n`: half
 *  a round, so a round's first day still has half the exhibits to choose from,
 *  and never fewer than two, so no exhibit is shown two days running while
 *  there is another. More is a rotation: six of eight left the first days of
 *  a round three exhibits, the last ones of the round before. */
export function spacing(n: number): number {
  return Math.max(2, Math.ceil(n / 2));
}

/** One of `items`, drawn with a chance proportional to its weight. */
function drawn<T>(items: readonly T[], weight: (item: T) => number, random: () => number): T {
  const weights = items.map(weight);
  let at = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < items.length; i++) {
    at -= weights[i];
    if (at < 0) return items[i];
  }
  return items[items.length - 1];
}

/** A round's order: each day drawn from the exhibits not yet shown in it whose
 *  last turn (in `previous`, the round before) is far enough back, weighed by
 *  `weights`. Should none be far enough back — only when exhibits have been
 *  withdrawn — the one longest ago. */
function ordered(
  members: readonly Exhibit[],
  previous: readonly Exhibit[],
  topicsOf: ReadonlyMap<Exhibit, readonly Topic[]>,
  weights: DailyWeights,
  random: () => number,
): Exhibit[] {
  const n = members.length;
  const gap = spacing(n);
  // Each exhibit's last day, counted from the new round's first: -1 for the
  // last day of the round before.
  const last = new Map(previous.map((exhibit, i) => [exhibit, i - previous.length]));
  // Who came right after whom in the round before.
  const followed = new Set(previous.slice(1).map((exhibit, i) => `${previous[i]}>${exhibit}`));
  const left = [...members];
  const out: Exhibit[] = [];
  for (let day = 0; left.length > 0; day++) {
    const since = (exhibit: Exhibit) => day - (last.get(exhibit) ?? -Infinity);
    const yesterday: Exhibit | undefined = out[day - 1] ?? previous[previous.length - 1];
    const about = (yesterday && topicsOf.get(yesterday)) || [];
    const weight = (exhibit: Exhibit) =>
      (1 + weights.bonusPerDay * Math.min(since(exhibit) - gap, n)) *
      ((topicsOf.get(exhibit) ?? []).some((topic) => about.includes(topic)) ? weights.topicMalus : 1) *
      (followed.has(`${yesterday}>${exhibit}`) ? weights.pairMalus : 1);
    const ready = left.filter((exhibit) => since(exhibit) >= gap);
    const pick = ready.length ? drawn(ready, weight, random) : left.reduce((a, b) => (since(b) > since(a) ? b : a));
    out.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}

/** The exhibits of the days `first` to `last` (day numbers, both included),
 *  walking the rounds from the epoch: a few hundred draws of eight for a
 *  decade, so nothing is cached. */
function picks(first: number, last: number, pool: readonly DailyMember[], weights?: DailyWeights): Exhibit[] {
  const topicsOf = new Map(pool.map((m) => [m.exhibit, m.topics ?? []]));
  const out: Exhibit[] = [];
  let start = dayNumber(DAILY_EPOCH);
  let previous: Exhibit[] = [];
  while (start <= last) {
    const members = pool.filter((m) => dayNumber(m.since) <= start).map((m) => m.exhibit);
    if (members.length === 0) {
      start += 1;
      continue;
    }
    const order = ordered(
      members,
      previous,
      topicsOf,
      weights ?? scheduled(start),
      generator(Math.imul(start, 0x9e3779b1)),
    );
    order.forEach((exhibit, i) => {
      if (start + i >= first && start + i <= last) out.push(exhibit);
    });
    previous = order;
    start += order.length;
  }
  return out;
}

/** The exhibit of `day` (`YYYY-MM-DD`); a day before the epoch has the
 *  epoch's. `weights` for every round, or left out for the site's: the first
 *  series' before {@link SECOND_SERIES}, {@link DAILY_WEIGHTS} from it on. */
export function dailyExhibit(day: string, pool: readonly DailyMember[] = POOL, weights?: DailyWeights): Exhibit {
  const n = Math.max(dayNumber(day), dayNumber(DAILY_EPOCH));
  return picks(n, n, pool, weights)[0];
}

/** The `count` days before `day`, the most recent first, none before the
 *  epoch; `weights` as for {@link dailyExhibit}. */
export function dailyHistory(
  day: string,
  count: number,
  pool: readonly DailyMember[] = POOL,
  weights?: DailyWeights,
): DailyPick[] {
  const last = dayNumber(day) - 1;
  const first = Math.max(last - count + 1, dayNumber(DAILY_EPOCH));
  if (first > last) return [];
  return picks(first, last, pool, weights)
    .map((exhibit, i) => ({ day: dayString(first + i), exhibit }))
    .reverse();
}
