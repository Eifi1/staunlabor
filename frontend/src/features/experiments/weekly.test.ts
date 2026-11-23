import { describe, expect, it } from "vitest";
import {
  WEEKLY_EPOCH,
  dayIn,
  spacing,
  weekOf,
  weeklyExhibit,
  weeklyHistory,
  type WeeklyMember,
  type WeeklyWeights,
} from "./weekly";
import { EXHIBITS, type Topic } from "./exhibits";

const DAY_MS = 86_400_000;
const after = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);

/** The weeks from the epoch on, `count` of them, with their exhibits. */
const run = (count: number, pool?: readonly WeeklyMember[], weights?: WeeklyWeights) =>
  weeklyHistory(after(WEEKLY_EPOCH, 7 * count), count, pool, weights)
    .map((pick) => pick.exhibit)
    .reverse();

/** The draw with neither bonus nor malus: what the weights are measured against. */
const EVEN: WeeklyWeights = { topicMalus: 1, pairMalus: 1 };

const built = EXHIBITS.map((entry) => entry.exhibit);

/** Every exhibit in the draw from the epoch on, with its topics: the round the
 *  rules are about, whatever day each one ships. */
const everyone: WeeklyMember[] = EXHIBITS.map((entry) => ({
  exhibit: entry.exhibit,
  since: WEEKLY_EPOCH,
  topics: entry.topics,
}));

describe("the experiment of the week", () => {
  it("starts on a Monday", () => {
    expect(new Date(`${WEEKLY_EPOCH}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(weekOf(WEEKLY_EPOCH)).toBe(WEEKLY_EPOCH);
  });

  it("is one exhibit from Monday to Sunday, and the next week's from the Monday after", () => {
    const monday = after(WEEKLY_EPOCH, 7 * 20);
    const week = [0, 1, 2, 3, 4, 5, 6].map((n) => weeklyExhibit(after(monday, n)));
    expect(new Set(week).size).toBe(1);
    expect(weeklyExhibit(after(monday, 7))).not.toBe(week[0]);
    expect(weekOf(after(monday, 6))).toBe(monday);
    expect(weekOf(after(monday, 7))).toBe(after(monday, 7));
  });

  it("shows the first week's exhibit on the days before the epoch", () => {
    expect(weeklyExhibit(after(WEEKLY_EPOCH, -3))).toBe(weeklyExhibit(WEEKLY_EPOCH));
    expect(weeklyExhibit(after(WEEKLY_EPOCH, -30))).toBe(weeklyExhibit(WEEKLY_EPOCH));
  });

  it("gives every exhibit its turn before any has a second", () => {
    const weeks = run(built.length * 40, everyone);
    for (let round = 0; round < 40; round++) {
      const shown = weeks.slice(round * built.length, (round + 1) * built.length);
      expect(new Set(shown).size).toBe(built.length);
    }
  });

  it("brings an exhibit back no sooner than half a round later, across the end of a round too", () => {
    const weeks = run(built.length * 40, everyone);
    const gap = spacing(built.length);
    expect(gap).toBe(Math.ceil(built.length / 2));
    weeks.forEach((exhibit, i) => {
      const next = weeks.indexOf(exhibit, i + 1);
      if (next !== -1) expect(next - i).toBeGreaterThanOrEqual(gap);
    });
  });

  it("never shows one exhibit two weeks running, however few there are", () => {
    for (const count of [2, 3, 4]) {
      const pool = built.slice(0, count).map((exhibit) => ({ exhibit, since: WEEKLY_EPOCH }));
      const weeks = run(count * 30, pool);
      weeks.slice(1).forEach((exhibit, i) => expect(exhibit).not.toBe(weeks[i]));
    }
  });

  it("is drawn at random rather than a fixed rotation", () => {
    const weeks = run(built.length * 6);
    const rounds = new Set(
      Array.from({ length: 6 }, (_, r) => weeks.slice(r * built.length, (r + 1) * built.length).join()),
    );
    expect(rounds.size).toBeGreaterThan(1);
  });

  it("rarely follows one exhibit with another about the same thing (the malus)", () => {
    // Two of the eight are about flow, as the elephant and the smoke ring are;
    // every other one is about something of its own.
    const pool: WeeklyMember[] = built.map((exhibit, i) => ({
      exhibit,
      since: WEEKLY_EPOCH,
      topics: [i < 2 ? "flow" : (`own-${i}` as Topic)],
    }));
    const flow = new Set<string>(built.slice(0, 2));
    const together = (weeks: string[]) => weeks.slice(1).filter((e, i) => flow.has(e) && flow.has(weeks[i])).length;
    // 1200 rounds: with 35 exhibits the two meet some 25 times in 400, too few
    // to tell a half from a whole.
    const leaned = together(run(built.length * 1200, pool));
    const even = together(run(built.length * 1200, pool, EVEN));
    // An even round puts the two side by side 2/n of the time: 1200 rounds of
    // 35, about sixty-nine. A fixed bound held only while there were few exhibits.
    expect(even).toBeGreaterThan(((2 * 1200) / built.length) * 0.7);
    // The malus is a half (the first eight's was a quarter): 40 against 74
    // with 35 exhibits, not half as often, since late in a round there is
    // often nothing else left to draw.
    expect(leaned).toBeLessThan(even * 0.85);
  });

  it("rarely repeats the round before's order, two by two (the other malus)", () => {
    const pool = built.map((exhibit) => ({ exhibit, since: WEEKLY_EPOCH }));
    /** How many weeks follow the week before as they did in the round before. */
    const again = (weeks: string[]) => {
      let count = 0;
      for (let start = built.length; start + built.length <= weeks.length; start += built.length) {
        const before = weeks.slice(start - built.length, start);
        const pairs = new Set(before.slice(1).map((e, i) => `${before[i]}>${e}`));
        weeks.slice(start + 1, start + built.length).forEach((e, i) => {
          if (pairs.has(`${weeks[start + i]}>${e}`)) count += 1;
        });
      }
      return count;
    };
    const leaned = again(run(built.length * 400, pool));
    const even = again(run(built.length * 400, pool, EVEN));
    expect(even).toBeGreaterThan(200);
    expect(leaned).toBeLessThan(even * 0.5);
  });

  it("keeps the first round as drawn: what the live site will have shown", () => {
    // Every exhibit once, from the epoch on. Once it ships, a change to the
    // draw, to `EXHIBITS`' order or to an exhibit's topics or `since` that
    // moves one of these weeks fails here, and must not ship; a new exhibit
    // joins a later round and moves none of them. Moving the epoch moves only
    // the dates: a round is seeded with its number.
    const firstRound = [
      "cradle waterwheel wave coriolis sky chladni peg foucault plates maxwell coil resonance",
      "well arch slits diver cone beats parabola levitation circuit race chair chaos",
      "bounce platform coupled smoke rainbow cannon harmonograph overhang sphere elephant gyroscope",
    ]
      .join(" ")
      .split(" ");
    const shown = weeklyHistory(after(WEEKLY_EPOCH, 7 * firstRound.length), firstRound.length).reverse();
    expect(shown[0].week).toBe(WEEKLY_EPOCH);
    expect(shown.map((pick) => pick.exhibit)).toEqual(firstRound);
  });

  it("takes a new exhibit in at the next round, leaving the weeks before it as they were", () => {
    const pool = built.map((exhibit) => ({ exhibit, since: WEEKLY_EPOCH }));
    const before = run(built.length * 4, pool);
    // Ships on the Wednesday of the second round's third week: the second
    // round is as it was, and the newcomer first appears in the third.
    const joined = [...pool, { exhibit: "newcomer" as never, since: after(WEEKLY_EPOCH, 7 * (built.length + 2) + 2) }];
    const afterwards = run(built.length * 4, joined);
    expect(afterwards.slice(0, 2 * built.length)).toEqual(before.slice(0, 2 * built.length));
    expect(afterwards.slice(2 * built.length, 3 * built.length + 1)).toContain("newcomer");
  });

  it("lists the weeks before this one by their Mondays, the most recent first, and nothing before the epoch", () => {
    // A Thursday in the epoch's eleventh week.
    const today = after(WEEKLY_EPOCH, 7 * 10 + 3);
    const weeks = weeklyHistory(today, 7);
    expect(weeks.map((pick) => pick.week)).toEqual([9, 8, 7, 6, 5, 4, 3].map((n) => after(WEEKLY_EPOCH, 7 * n)));
    weeks.forEach((pick) => expect(pick.exhibit).toBe(weeklyExhibit(after(pick.week, 4))));
    expect(weeklyHistory(after(WEEKLY_EPOCH, 7 * 2 + 6), 7).map((pick) => pick.week)).toEqual([
      after(WEEKLY_EPOCH, 7),
      WEEKLY_EPOCH,
    ]);
    expect(weeklyHistory(after(WEEKLY_EPOCH, 6), 7)).toEqual([]);
    expect(weeklyHistory(after(WEEKLY_EPOCH, -10), 7)).toEqual([]);
  });

  it("turns the week at midnight in Zurich, an hour before it does in UTC in November", () => {
    expect(dayIn(new Date("2026-11-12T22:30:00Z"))).toBe("2026-11-12");
    expect(dayIn(new Date("2026-11-12T23:30:00Z"))).toBe("2026-11-13");
    expect(dayIn(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
    // Sunday 29 November, 23:30 in Zurich, is Monday's week there.
    expect(weekOf(dayIn(new Date("2026-11-29T22:30:00Z")))).toBe("2026-11-23");
    expect(weekOf(dayIn(new Date("2026-11-29T23:30:00Z")))).toBe("2026-11-30");
  });
});
