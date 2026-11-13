import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, dailyExhibit, dailyHistory, dayIn, spacing, type DailyMember, type DailyWeights } from "./daily";
import { EXHIBITS, type Topic } from "./exhibits";

const DAY_MS = 86_400_000;
const after = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);

/** The days from the epoch on, `count` of them, with their exhibits. */
const run = (count: number, pool?: readonly DailyMember[], weights?: DailyWeights) =>
  dailyHistory(after(DAILY_EPOCH, count), count, pool, weights)
    .map((pick) => pick.exhibit)
    .reverse();

/** The draw with neither bonus nor malus: what the weights are measured against. */
const EVEN: DailyWeights = { bonusPerDay: 0, topicMalus: 1, pairMalus: 1 };

const built = EXHIBITS.filter((entry) => entry.path).map((entry) => entry.exhibit);

describe("the experiment of the day", () => {
  it("is the same exhibit whenever the same day is asked about", () => {
    expect(dailyExhibit("2027-03-14")).toBe(dailyExhibit("2027-03-14"));
  });

  it("gives every exhibit its turn before any has a second", () => {
    const days = run(built.length * 40);
    for (let round = 0; round < 40; round++) {
      const shown = days.slice(round * built.length, (round + 1) * built.length);
      expect(new Set(shown).size).toBe(built.length);
    }
  });

  it("brings an exhibit back no sooner than half a round later, across the end of a round too", () => {
    const days = run(built.length * 40);
    const gap = spacing(built.length);
    expect(gap).toBe(Math.ceil(built.length / 2));
    days.forEach((exhibit, i) => {
      const next = days.indexOf(exhibit, i + 1);
      if (next !== -1) expect(next - i).toBeGreaterThanOrEqual(gap);
    });
  });

  it("never shows one exhibit two days running, however few there are", () => {
    for (const count of [2, 3, 4]) {
      const pool = built.slice(0, count).map((exhibit) => ({ exhibit, since: DAILY_EPOCH }));
      const days = run(count * 30, pool);
      days.slice(1).forEach((exhibit, i) => expect(exhibit).not.toBe(days[i]));
    }
  });

  it("is drawn at random rather than a fixed rotation", () => {
    const days = run(built.length * 6);
    const rounds = new Set(
      Array.from({ length: 6 }, (_, r) => days.slice(r * built.length, (r + 1) * built.length).join()),
    );
    expect(rounds.size).toBeGreaterThan(1);
  });

  it("rarely follows one exhibit with another about the same thing (the malus)", () => {
    // Two of the eight are about flow, as the elephant and the smoke ring are;
    // every other one is about something of its own.
    const pool: DailyMember[] = built.map((exhibit, i) => ({
      exhibit,
      since: DAILY_EPOCH,
      topics: [i < 2 ? "flow" : (`own-${i}` as Topic)],
    }));
    const flow = new Set<string>(built.slice(0, 2));
    const together = (days: string[]) => days.slice(1).filter((e, i) => flow.has(e) && flow.has(days[i])).length;
    const leaned = together(run(built.length * 400, pool));
    const even = together(run(built.length * 400, pool, EVEN));
    expect(even).toBeGreaterThan(50);
    // Not a quarter as often, though the weight is a quarter: late in a round
    // there is often nothing else left to draw.
    expect(leaned).toBeLessThan(even * 0.7);
  });

  it("rarely repeats the round before's order, two by two (the other malus)", () => {
    const pool = built.map((exhibit) => ({ exhibit, since: DAILY_EPOCH }));
    /** How many days follow the day before as they did in the round before. */
    const again = (days: string[]) => {
      let count = 0;
      for (let start = built.length; start + built.length <= days.length; start += built.length) {
        const before = days.slice(start - built.length, start);
        const pairs = new Set(before.slice(1).map((e, i) => `${before[i]}>${e}`));
        days.slice(start + 1, start + built.length).forEach((e, i) => {
          if (pairs.has(`${days[start + i]}>${e}`)) count += 1;
        });
      }
      return count;
    };
    const leaned = again(run(built.length * 400, pool));
    const even = again(run(built.length * 400, pool, EVEN));
    expect(even).toBeGreaterThan(200);
    expect(leaned).toBeLessThan(even * 0.5);
  });

  it("brings an exhibit that has waited long sooner (the bonus)", () => {
    const pool = built.map((exhibit) => ({ exhibit, since: DAILY_EPOCH }));
    /** How many turns came after a wait of more than a round and two days. */
    const late = (days: string[]) =>
      days.filter((exhibit, i) => {
        // lastIndexOf from -1 would search from the end: the first day has none before it.
        const before = i > 0 ? days.lastIndexOf(exhibit, i - 1) : -1;
        return before !== -1 && i - before > built.length + 2;
      }).length;
    const leaned = late(run(built.length * 400, pool));
    const even = late(run(built.length * 400, pool, EVEN));
    expect(even).toBeGreaterThan(50);
    expect(leaned).toBeLessThan(even * 0.8);
  });

  it("takes a new exhibit in at the next round, leaving the days before it as they were", () => {
    const pool = built.map((exhibit) => ({ exhibit, since: DAILY_EPOCH }));
    const before = run(built.length * 4, pool);
    // Joins on the third day of the second round: the second round is as it
    // was, and the newcomer first appears in the third.
    const joined = [...pool, { exhibit: "newcomer" as never, since: after(DAILY_EPOCH, built.length + 2) }];
    const afterwards = run(built.length * 4, joined);
    expect(afterwards.slice(0, 2 * built.length)).toEqual(before.slice(0, 2 * built.length));
    const third = afterwards.slice(2 * built.length, 3 * built.length + 1);
    expect(third).toContain("newcomer");
  });

  it("lists the days before today, the most recent first, and nothing before the epoch", () => {
    const today = after(DAILY_EPOCH, 10);
    const week = dailyHistory(today, 7);
    expect(week.map((pick) => pick.day)).toEqual([9, 8, 7, 6, 5, 4, 3].map((n) => after(DAILY_EPOCH, n)));
    week.forEach((pick) => expect(pick.exhibit).toBe(dailyExhibit(pick.day)));
    expect(dailyHistory(after(DAILY_EPOCH, 2), 7).map((pick) => pick.day)).toEqual([
      after(DAILY_EPOCH, 1),
      DAILY_EPOCH,
    ]);
    expect(dailyHistory(DAILY_EPOCH, 7)).toEqual([]);
  });

  it("counts the day in Zurich, where it starts an hour before it does in UTC in November", () => {
    expect(dayIn(new Date("2026-11-12T22:30:00Z"))).toBe("2026-11-12");
    expect(dayIn(new Date("2026-11-12T23:30:00Z"))).toBe("2026-11-13");
    expect(dayIn(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
  });
});
