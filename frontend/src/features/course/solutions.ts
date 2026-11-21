/**
 * Each exercise's worked solution as a formula: the general form, then the
 * question's numbers put in, then the engine's answer.
 *
 * The numbers are the exercise's own `inputs` and `answers` as the engine sent
 * them — nothing is computed here but their formatting, so the formula shown is
 * the one the answer was checked against, and an input corrected in
 * `domain/course/exercises.py` is corrected here too. The prose beside each
 * formula is in the catalogues; a formula has no language.
 */

import type { Exercise } from "@/shared/types";
import { texNumber } from "@/shared/ui/tex";

type Writer = (n: (key: string, digits?: number) => string, a: (index: number, digits?: number) => string) => string;

const WRITERS: Record<string, Writer> = {
  pt1_reading: (n, a) =>
    `y(t) = y_\\infty + (y_0 - y_\\infty)\\,e^{-t/\\tau} = ${n("final")} + (${n("start")} - ${n("final")})\\,e^{-${n("t")}/${n("tau")}} = ${a(0, 2)}\\,\\text{°C}`,
  decrement: (n, a) =>
    `\\Lambda = \\ln\\frac{x_n}{x_{n+1}} = \\ln\\frac{${n("first")}}{${n("second")}},\\qquad D = \\frac{\\Lambda}{\\sqrt{4\\pi^2 + \\Lambda^2}} = ${a(0, 4)}`,
  double_frequency: (n, a) =>
    `f_0 = \\frac{1}{2\\pi}\\sqrt{\\frac{c}{J}} \\;\\Rightarrow\\; \\frac{c'}{c} = \\left(\\frac{f_0'}{f_0}\\right)^2 = ${n("factor")}^2 = ${a(0, 0)}`,
  filter_delay: (n, a) =>
    `\\varphi = -\\arctan\\frac{f}{f_E} = -\\arctan\\frac{${n("f")}}{${n("corner")}},\\qquad \\Delta t = \\frac{-\\varphi}{360^\\circ}\\cdot\\frac{1}{f} = ${a(0, 2)}\\,\\text{ms}`,
  filter_phase: (n, a) =>
    `\\varphi = -\\arctan\\frac{${n("f")}}{${n("corner")}} = ${a(0, 2)}^\\circ,\\qquad \\Delta t = \\frac{-\\varphi}{360^\\circ}\\cdot\\frac{1}{${n("f")}\\,\\text{Hz}} = ${a(1, 2)}\\,\\text{ms}`,
  euler_steps: (n, a) =>
    `y_{k+1} = y_k + h\\,\\frac{y_\\infty - y_k}{\\tau},\\quad y_0 = ${n("start")},\\; h = ${n("h")},\\; \\tau = ${n("tau")} \\;\\Rightarrow\\; y_{${n("steps", 0)}} = ${a(0, 2)}\\,\\text{°C}`,
  euler_gain: (n, a) =>
    `|1 + h\\lambda| = |1 + j\\,h\\omega_0| = \\sqrt{1 + (h\\omega_0)^2} = \\sqrt{1 + ${n("ratio")}^2} = ${a(0, 4)}`,
  hand_estimate: (n, a) =>
    `c = \\frac{c_1 c_2}{c_1 + c_2} = \\frac{${n("c1")}\\cdot${n("c2")}}{${n("c1")} + ${n("c2")}},\\qquad f = \\frac{1}{2\\pi}\\sqrt{\\frac{c}{J_1 + J_2}} = ${a(0, 2)}\\,\\text{Hz}`,
  light_adapter: (n, a) =>
    `f_a = \\frac{1}{2\\pi}\\sqrt{\\frac{c_2}{J_2}} = \\frac{1}{2\\pi}\\sqrt{\\frac{${n("c2")}}{${n("j2")}}},\\qquad 1 - \\frac{M_W}{M_T} = \\left(\\frac{f}{f_a}\\right)^2 = ${a(0, 1)}\\,\\%`,
};

export function solutionTex(exercise: Exercise, locale: string): string {
  const write = WRITERS[exercise.key];
  if (!write) return "";
  const n = (key: string, digits?: number) => {
    const value = exercise.inputs[key];
    return texNumber(value, digits ?? decimals(value), locale);
  };
  const a = (index: number, digits = 2) => texNumber(exercise.answers[index].value, digits, locale);
  return write(n, a);
}

/** As many decimals as a stated input has, up to four. */
function decimals(value: number): number {
  for (let d = 0; d <= 4; d++) {
    if (Math.abs(value * 10 ** d - Math.round(value * 10 ** d)) < 1e-9) return d;
  }
  return 4;
}
