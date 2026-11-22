/**
 * An exercise: the question with its numbers, an estimate first where the
 * exercise asks for one, then the answer, held to the engine's.
 *
 * **The answer is the engine's**, computed from the same inputs the question
 * shows (`domain/course/exercises.py`) and served with the defaults, so the
 * sentence and the number it is checked against cannot drift apart. The reader's
 * entry is compared in the browser — it is their number against ours, and a
 * round trip to subtract two numbers would only make the page slower.
 *
 * **Estimate first.** An exercise marked so hides the answer field until the
 * reader has committed to a guess. A guess more than half off is kept as a
 * surprise on the overview page: the list of things that were not what one
 * expected is the most useful page of notes a course can leave behind.
 *
 * Entry accepts a decimal point and a decimal comma alike, and an empty or
 * unreadable entry is answered inline rather than counted as an attempt.
 */

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, Input, SectionLabel } from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatSig } from "@/shared/lib/format";
import type { Answer, Exercise } from "@/shared/types";
import { SURPRISE_SHARE, useCourseProgress } from "./progress";
import { Tex } from "@/shared/ui/tex";
import { solutionTex } from "./solutions";

/** What the reader typed, as a number — a decimal comma read as a point, a
 *  thousands apostrophe or space dropped — or `null` if it is not one. */
export function parseEntry(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/[\s'’]/g, "")
    .replace(",", ".")
    .replace(/^−/, "-");
  if (cleaned === "" || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function withinTolerance(entry: number, answer: Answer): boolean {
  const slack = Math.max(answer.absolute ?? 0, (answer.relative ?? 0) * Math.abs(answer.value));
  return Math.abs(entry - answer.value) <= slack + 1e-12;
}

/** An answer field's label: numbered where there are several, with the unit
 *  in brackets where there is one — never an empty pair of brackets. */
function answerLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  n: number | null,
  unit: string,
): string {
  if (n === null) return unit ? t("course.exercise.answer", { unit }) : t("course.exercise.answer_bare");
  return unit ? t("course.exercise.answer_n", { n, unit }) : t("course.exercise.answer_n_bare", { n });
}

/** The two hints every exercise has, revealed one at a time. */
const HINTS = ["hint1", "hint2"] as const;

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const record = useCourseProgress((s) => s.exercises[exercise.key]);
  const attempt = useCourseProgress((s) => s.attempt);
  const estimate = useCourseProgress((s) => s.estimate);
  const [estimateText, setEstimateText] = useState("");
  const [estimateError, setEstimateError] = useState(false);
  const [entries, setEntries] = useState<string[]>(exercise.answers.map(() => ""));
  const [entryError, setEntryError] = useState(false);
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);
  const [hints, setHints] = useState(0);
  const [solution, setSolution] = useState(false);

  const words = Object.fromEntries(Object.entries(exercise.inputs).map(([k, v]) => [k, formatSig(v, locale)]));
  const answers = Object.fromEntries(exercise.answers.map((a, i) => [`a${i + 1}`, formatSig(a.value, locale, 3)]));
  const gated = exercise.estimate_first && record?.estimate == null;
  const first = exercise.answers[0];

  const submitEstimate = (event: FormEvent) => {
    event.preventDefault();
    const value = parseEntry(estimateText);
    if (value === null) {
      setEstimateError(true);
      return;
    }
    setEstimateError(false);
    estimate(exercise.key, value, first.value, first.unit);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const values = entries.map(parseEntry);
    if (values.some((v) => v === null)) {
      setEntryError(true);
      return;
    }
    setEntryError(false);
    const right = exercise.answers.every((answer, i) => withinTolerance(values[i] as number, answer));
    attempt(exercise.key, right);
    setVerdict(right ? "right" : "wrong");
  };

  const offBy =
    record?.estimate != null && first.value !== 0
      ? Math.abs(record.estimate - first.value) / Math.abs(first.value)
      : null;

  return (
    <Card padding="md" density="compact" className="space-y-3">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle as="h3">{t(`course.exercises.${exercise.key}.title`)}</CardTitle>
          {record?.solved && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              {t("course.exercise.solved")}
            </span>
          )}
        </div>
      </CardHeader>
      <p className="text-sm text-secondary">{t(`course.exercises.${exercise.key}.prompt`, words)}</p>

      {gated ? (
        <form onSubmit={submitEstimate} className="flex flex-wrap items-end gap-2">
          <Input
            label={
              first.unit
                ? t("course.exercise.estimate_label", { unit: first.unit })
                : t("course.exercise.estimate_bare")
            }
            value={estimateText}
            inputMode="decimal"
            onChange={(e) => setEstimateText(e.target.value)}
            error={estimateError ? t("course.exercise.empty") : undefined}
            className="w-48"
          />
          <Button type="submit" variant="secondary">
            {t("course.exercise.estimate_submit")}
          </Button>
          <p className="w-full text-xs text-muted">{t("course.exercise.estimate_why")}</p>
        </form>
      ) : (
        <>
          {record?.estimate != null && (
            <p className="text-xs text-muted">
              {t("course.exercise.your_estimate", { value: formatSig(record.estimate, locale), unit: first.unit })}
            </p>
          )}
          <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
            {exercise.answers.map((answer, i) => (
              <Input
                key={i}
                label={answerLabel(t, exercise.answers.length > 1 ? i + 1 : null, answer.unit)}
                value={entries[i]}
                inputMode="decimal"
                onChange={(e) => setEntries(entries.map((old, j) => (j === i ? e.target.value : old)))}
                className="w-48"
              />
            ))}
            <Button type="submit" variant="accent">
              {t("course.exercise.check")}
            </Button>
          </form>
          {entryError && <p className="text-sm text-danger">{t("course.exercise.empty")}</p>}
          {verdict === "right" && (
            <p className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              {t("course.exercise.right")}
            </p>
          )}
          {verdict === "wrong" && (
            <p className="flex items-center gap-1 text-sm text-danger">
              <XCircle className="size-4" aria-hidden />
              {t("course.exercise.wrong")}
            </p>
          )}
          {verdict !== null && offBy !== null && (
            <p className="text-xs text-muted">
              {offBy > SURPRISE_SHARE
                ? t("course.exercise.surprise", { pct: formatSig(offBy * 100, locale, 2) })
                : t("course.exercise.estimate_close", { pct: formatSig(offBy * 100, locale, 2) })}
            </p>
          )}
        </>
      )}

      <div className="space-y-2">
        {HINTS.slice(0, hints).map((hint) => (
          <p key={hint} className="flex gap-2 rounded-md bg-hover p-2 text-sm text-secondary">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {t(`course.exercises.${exercise.key}.${hint}`, words)}
          </p>
        ))}
        <div className="flex flex-wrap gap-2">
          {hints < HINTS.length && (
            <Button size="sm" variant="ghost" onClick={() => setHints(hints + 1)}>
              {t("course.exercise.hint")}
            </Button>
          )}
          {!gated && (
            <Button size="sm" variant="ghost" onClick={() => setSolution(!solution)}>
              {solution ? t("course.exercise.hide_solution") : t("course.exercise.show_solution")}
            </Button>
          )}
        </div>
        {solution && !gated && (
          <div className="space-y-1 rounded-md border border-subtle p-3">
            <SectionLabel as="h4">{t("course.exercise.solution")}</SectionLabel>
            <p className="text-sm text-secondary">
              {t(`course.exercises.${exercise.key}.solution`, { ...words, ...answers })}
            </p>
            <Tex block tex={solutionTex(exercise, locale)} />
          </div>
        )}
      </div>
    </Card>
  );
}
