/**
 * The experiment of the week: random, but with a memory.
 *
 * One exhibit a week, Monday to Sunday (Marcel, 2026-11-20: "Stelle auf
 * Experiment of the week um"; it was one a day before). The weeks from
 * {@link WEEKLY_EPOCH} on are cut into **rounds**, one week per exhibit, and
 * each round is the exhibits in a random order, drawn by a generator seeded
 * with the round's number. So:
 *
 * - **the same for everybody, and on every reload**: the pick is a function of
 *   the date, worked out in the browser, with no server, no table and nothing
 *   anyone has to do;
 * - **no repeat until all have been**, and **none soon after**: a round is
 *   drawn week by week from the exhibits whose last turn is at least
 *   {@link spacing} weeks back — half a round. A shuffle alone guards only its
 *   own round: the chair could end one and start the next two turns later
 *   (seen on the page, when the pick was a day's);
 * - **a bonus and two maluses** among those, so that like exhibits are less
 *   likely to follow each other ({@link WEEKLY_WEIGHTS}): a little more chance
 *   for every week an exhibit has waited beyond the spacing; half of it for
 *   one about a topic last week's was about too (the elephant after the smoke
 *   ring, both flow); a quarter for one that followed last week's in the round
 *   before, so that the same two do not come in the same order round after
 *   round. Weights, not rules: the round and the spacing are the guarantees,
 *   and these only lean the draw within them. The maluses are at half the
 *   strength the first eight exhibits were drawn with (Marcel, 2026-11-15:
 *   they should count less).
 *
 *   **Measured, not guessed** (400 rounds of all 35 exhibits; a plain shuffle
 *   per round in brackets): a pair of the round before again in the same
 *   order 0.45 times a round (1.20), a triple 0.013 (0.023), two neighbours
 *   sharing a topic 17.4 weeks in a hundred (24.7), a wait of more than a
 *   round and two weeks 35.7 % of turns (36.6 %). The very first version, on
 *   days, spaced turns by six with a full bonus each, and that is a rotation
 *   in disguise: it repeated triples 0.65 times a round, five times as often
 *   as a shuffle — the history showed the chair, the platform and the cannon
 *   in that order two rounds running;
 * - **the past weeks are the rule run backwards** ({@link weeklyHistory}), so
 *   they need no record either. The overview lists none since 2026-11-20 (its
 *   way on is the list of every exhibit); the tests walk them.
 *
 * The week is Zurich's (`Europe/Zurich`), not the reader's: the museum whose
 * exhibits inspired these stands in Winterthur, and one week's exhibit should
 * be one exhibit, whoever asks. It turns at midnight between Sunday and
 * Monday there.
 *
 * **A new exhibit joins at the next round** that starts on or after its
 * `since` day (`exhibits.ts`), not in the middle of one: a round's order is
 * drawn from its members, and a member added mid-round would redraw weeks
 * already shown. That is also why `since` is the day the exhibit **ships**,
 * not the day it was written: a date in the past would put it into a round
 * that has already begun on the live site. A round of 35 weeks is most of a
 * year, so a new exhibit is first seen in the list of all of them
 * (`/exhibits`) and among the front page's six drawn at random (`sampled`),
 * not by this pick.
 *
 * What it deliberately does not do: pick from what this reader has tried. The
 * week's exhibit is one for everybody, so that "this week's" means the same
 * thing to two people.
 */

import { EXHIBITS, type Exhibit, type Topic } from "./exhibits";

/**
 * The first Monday of the first round. Nothing before it has an exhibit of its
 * own: a day before it shows this week's. It must not move once it has
 * shipped: the week's exhibit would change under the readers. Moving it moves
 * no round's order, only its dates: a round is seeded with its number, not
 * its first day. Before it shipped it needed no care, as no page lists past
 * weeks the site never showed (Marcel dropped the dialog of earlier weeks).
 */
export const WEEKLY_EPOCH = "2026-11-23";

/** Whose calendar a week is. */
export const WEEKLY_ZONE = "Europe/Zurich";

const DAY_MS = 86_400_000;

/** One exhibit in the rotation, the day it joins, and what it is about. */
export interface WeeklyMember {
  exhibit: Exhibit;
  since: string;
  topics?: readonly Topic[];
}

/** How the draw leans, within a round and the spacing. */
export interface WeeklyWeights {
  /** Added to an exhibit's weight of 1 for every week it has waited beyond the
   *  spacing (at most a round's worth): one long waiting comes sooner. Kept
   *  small: a large one draws the longest-waiting first, which is a rotation. */
  bonusPerWeek: number;
  /** What an exhibit's weight is multiplied by when it shares a topic with
   *  last week's. */
  topicMalus: number;
  /** … and when it came right after last week's in the round before. */
  pairMalus: number;
}

/** A half for a shared topic, a quarter for last week's follower: half the
 *  strength the first eight were drawn with (Marcel, 2026-11-15:
 *  "Tagesminus sollte weniger zählen"). With 35 exhibits, eleven of them about
 *  energy, ten about oscillation and eight about angular momentum, the
 *  stronger maluses held a topic back on most turns. */
export const WEEKLY_WEIGHTS: WeeklyWeights = { bonusPerWeek: 0.25, topicMalus: 0.5, pairMalus: 0.25 };

/** A week, by its Monday, and the exhibit it had. */
export interface WeeklyPick {
  week: string;
  exhibit: Exhibit;
}

/** Every exhibit, from the day it ships. */
const POOL: readonly WeeklyMember[] = EXHIBITS.map(({ exhibit, since, topics }) => ({ exhibit, since, topics }));

/** A calendar day, `YYYY-MM-DD`, as days since 1970-01-01. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function dayString(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday on or before day `n` (a day number). 1970-01-01, day 0, was a
 *  Thursday, so Mondays are the days with (n + 3) a multiple of seven. */
function mondayOf(n: number): number {
  return n - ((((n + 3) % 7) + 7) % 7);
}

/** The Monday of the week `day` (`YYYY-MM-DD`) is in. */
export function weekOf(day: string): string {
  return dayString(mondayOf(dayNumber(day)));
}

/** The calendar day it is in `zone` at `now`, `YYYY-MM-DD`. Read from the
 *  formatter's parts, not from a locale's format of the whole date, which is
 *  a convention ICU may change. */
export function dayIn(now: Date = new Date(), zone: string = WEEKLY_ZONE): string {
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

/** The fewest weeks between two turns of one exhibit, in a round of `n`: half
 *  a round, so a round's first week still has half the exhibits to choose
 *  from, and never fewer than two, so no exhibit is shown two weeks running
 *  while there is another. More is a rotation: six of eight left the first
 *  turns of a round three exhibits, the last ones of the round before. */
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

/** A round's order: each week drawn from the exhibits not yet shown in it whose
 *  last turn (in `previous`, the round before) is far enough back, weighed by
 *  `weights`. Should none be far enough back — only when exhibits have been
 *  withdrawn — the one longest ago. */
function ordered(
  members: readonly Exhibit[],
  previous: readonly Exhibit[],
  topicsOf: ReadonlyMap<Exhibit, readonly Topic[]>,
  weights: WeeklyWeights,
  random: () => number,
): Exhibit[] {
  const n = members.length;
  const gap = spacing(n);
  // Each exhibit's last week, counted from the new round's first: -1 for the
  // last week of the round before.
  const last = new Map(previous.map((exhibit, i) => [exhibit, i - previous.length]));
  // Who came right after whom in the round before.
  const followed = new Set(previous.slice(1).map((exhibit, i) => `${previous[i]}>${exhibit}`));
  const left = [...members];
  const out: Exhibit[] = [];
  for (let week = 0; left.length > 0; week++) {
    const since = (exhibit: Exhibit) => week - (last.get(exhibit) ?? -Infinity);
    const before: Exhibit | undefined = out[week - 1] ?? previous[previous.length - 1];
    const about = (before && topicsOf.get(before)) || [];
    const weight = (exhibit: Exhibit) =>
      (1 + weights.bonusPerWeek * Math.min(since(exhibit) - gap, n)) *
      ((topicsOf.get(exhibit) ?? []).some((topic) => about.includes(topic)) ? weights.topicMalus : 1) *
      (followed.has(`${before}>${exhibit}`) ? weights.pairMalus : 1);
    const ready = left.filter((exhibit) => since(exhibit) >= gap);
    const pick = ready.length ? drawn(ready, weight, random) : left.reduce((a, b) => (since(b) > since(a) ? b : a));
    out.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}

/** The exhibits of the weeks `first` to `last` (counted from the epoch's, both
 *  included), walking the rounds from the epoch: a few dozen draws for a
 *  decade, so nothing is cached. */
function picks(first: number, last: number, pool: readonly WeeklyMember[], weights: WeeklyWeights): Exhibit[] {
  const topicsOf = new Map(pool.map((m) => [m.exhibit, m.topics ?? []]));
  const epoch = dayNumber(WEEKLY_EPOCH);
  const out: Exhibit[] = [];
  let start = 0;
  let round = 0;
  let previous: Exhibit[] = [];
  while (start <= last) {
    const monday = epoch + 7 * start;
    const members = pool.filter((m) => dayNumber(m.since) <= monday).map((m) => m.exhibit);
    if (members.length === 0) {
      start += 1;
      continue;
    }
    const order = ordered(members, previous, topicsOf, weights, generator(Math.imul(round + 1, 0x9e3779b1)));
    order.forEach((exhibit, i) => {
      if (start + i >= first && start + i <= last) out.push(exhibit);
    });
    previous = order;
    start += order.length;
    round += 1;
  }
  return out;
}

/** The week `day` is in, counted from the epoch's (0), and never before it. */
function weekNumber(day: string): number {
  return Math.max(0, (mondayOf(dayNumber(day)) - dayNumber(WEEKLY_EPOCH)) / 7);
}

/** The exhibit of the week `day` (`YYYY-MM-DD`) is in; a day before the epoch
 *  has the epoch's week's. `weights` for every round, or left out for the
 *  site's. */
export function weeklyExhibit(
  day: string,
  pool: readonly WeeklyMember[] = POOL,
  weights: WeeklyWeights = WEEKLY_WEIGHTS,
): Exhibit {
  const n = weekNumber(day);
  return picks(n, n, pool, weights)[0];
}

/** The `count` weeks before the one `day` is in, the most recent first, none
 *  before the epoch's; `weights` as for {@link weeklyExhibit}. */
export function weeklyHistory(
  day: string,
  count: number,
  pool: readonly WeeklyMember[] = POOL,
  weights: WeeklyWeights = WEEKLY_WEIGHTS,
): WeeklyPick[] {
  const epoch = dayNumber(WEEKLY_EPOCH);
  const last = (mondayOf(dayNumber(day)) - epoch) / 7 - 1;
  const first = Math.max(last - count + 1, 0);
  if (first > last) return [];
  return picks(first, last, pool, weights)
    .map((exhibit, i) => ({ week: dayString(epoch + 7 * (first + i)), exhibit }))
    .reverse();
}
