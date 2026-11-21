/**
 * The cheat sheet, after lesson 6: the course on one printable page.
 *
 * The recipe, every lesson's formulas with a link to the lesson that lets them
 * be tried, the table of analogies, the traps a test rig sets, and a few lines
 * of Python for when the reader is back at a notebook. Formulas and code are
 * language-neutral and stay in the source; everything said about them is in
 * the catalogues.
 *
 * Printing: a style that exists only while this page is mounted hides
 * everything but the sheet on paper — the site's header and footer — so
 * "Print" gives the sheet and not a screenshot of the site.
 *
 * Kurvenschmiede's sheet had three more blocks, for its lessons 7, 9 and 10
 * (the reduction, the vacuum, the valve); those lessons stayed there, and a
 * block here links only to a lesson here.
 */

import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Printer } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@eifi1/ui-kit";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import type { Lesson } from "@/shared/types";
import { LessonNavigation, useLesson } from "./lesson-frame";
import { lessonEntry } from "./lessons";
import { Tex } from "@/shared/ui/tex";

const PRINT_ONLY_SHEET = `@media print {
  body * { visibility: hidden !important; }
  #cheat-sheet, #cheat-sheet * { visibility: visible !important; }
  #cheat-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; }
  #cheat-sheet .no-print { display: none !important; }
  @page { size: A4; margin: 12mm; }
}`;

/** Each block of formulas and the lesson it belongs to. */
const SECTIONS: { key: string; lesson: Lesson; tex: string[] }[] = [
  {
    key: "first_order",
    lesson: "first_order",
    tex: [
      "\\tau\\,\\dot y + y = K\\,u",
      "y(t) = y_\\infty + (y_0 - y_\\infty)\\,e^{-t/\\tau}",
      "\\tau: 63\\,\\%,\\quad 3\\tau: 95\\,\\%,\\quad 5\\tau: 99.3\\,\\%",
    ],
  },
  {
    key: "second_order",
    lesson: "second_order",
    tex: [
      "m\\ddot x + d\\dot x + c x = F,\\quad \\omega_0 = \\sqrt{c/m},\\quad D = \\frac{d}{2\\sqrt{cm}}",
      "\\frac{x_\\text{max} - x_\\infty}{x_\\infty} = e^{-\\pi D/\\sqrt{1-D^2}},\\quad t_\\text{max} = \\frac{\\pi}{\\omega_d},\\quad t_s \\approx \\frac{4}{D\\omega_0}",
      "V(\\eta) = \\frac{1}{\\sqrt{(1-\\eta^2)^2 + (2D\\eta)^2}}",
      "\\Lambda = \\ln\\frac{x_n}{x_{n+1}},\\quad D = \\frac{\\Lambda}{\\sqrt{4\\pi^2 + \\Lambda^2}}",
    ],
  },
  {
    key: "eigenvalues",
    lesson: "eigenvalues",
    tex: [
      "\\det(A - \\lambda I) = 0",
      "\\lambda = \\sigma \\pm j\\omega_d = \\omega_0\\left(-D \\pm \\sqrt{D^2 - 1}\\right)",
    ],
  },
  {
    key: "laplace",
    lesson: "laplace",
    tex: [
      "\\mathcal L\\{\\dot y\\} = sY - y(0),\\qquad y_\\infty = G(0)\\,u_0",
      "G_\\text{PT1} = \\frac{K}{\\tau s + 1},\\qquad G_\\text{PT2} = \\frac{K\\omega_0^2}{s^2 + 2D\\omega_0 s + \\omega_0^2}",
      "\\varphi_\\text{PT1} = -\\arctan(\\omega\\tau),\\qquad \\Delta t = \\frac{-\\varphi}{360^\\circ f}",
    ],
  },
  {
    key: "numerics",
    lesson: "numerics",
    tex: [
      "\\text{Euler: } O(h),\\quad |1 + h\\lambda| \\le 1",
      "\\text{PT1: } h < 2\\tau,\\qquad \\text{PT2: } h\\,\\omega_0 < 2D",
      "\\text{RK4: } O(h^4),\\quad h \\le T_\\text{min}/20",
    ],
  },
  {
    key: "two_mass",
    lesson: "two_mass",
    tex: [
      "(K - \\omega^2 M + j\\omega C)\\,\\hat{\\boldsymbol\\varphi} = \\hat{\\mathbf F}",
      "\\frac{M_W}{M_T} \\approx 1 - \\left(\\frac{f}{f_a}\\right)^2,\\qquad f_a = \\frac{1}{2\\pi}\\sqrt{\\frac{c_2}{J_2}}",
    ],
  },
];

/** The analogy table: each role's symbol in each domain, and the word for it. */
const ROLES = ["drive", "flow", "resistance", "store", "inert", "tau"] as const;
const DOMAINS = ["electrical", "mechanical", "thermal", "vacuum"] as const;
const CELLS: Record<(typeof ROLES)[number], Record<(typeof DOMAINS)[number], string>> = {
  drive: { electrical: "U", mechanical: "F", thermal: "\\Delta T", vacuum: "p" },
  flow: { electrical: "I", mechanical: "v", thermal: "P", vacuum: "Q" },
  resistance: { electrical: "R", mechanical: "d", thermal: "1/k", vacuum: "1/C,\\;1/S" },
  store: { electrical: "C", mechanical: "1/c", thermal: "C_\\text{th}", vacuum: "V" },
  inert: { electrical: "L", mechanical: "m", thermal: "\\text{–}", vacuum: "\\text{–}" },
  tau: { electrical: "R\\,C", mechanical: "d/c", thermal: "C_\\text{th}/k", vacuum: "V/S" },
};

/** The traps that belong to these lessons; the location of the angle, the
 *  gear's efficiency and the motor's inertia were lessons 7 and 8's, which
 *  stayed in Kurvenschmiede. */
const TRAPS = ["inertia", "filter"] as const;

const PYTHON = [
  `from scipy.integrate import solve_ivp
sol = solve_ivp(lambda t, y: [(80 - y[0]) / 4], (0, 20), [20], max_step=0.1)
print(sol.y[0][-1])`,
  `import numpy as np, scipy.linalg as la
M = np.diag([0.01, 0.05])
K = np.array([[500, -500], [-500, 615]])
w2, shapes = la.eigh(K, M)
print(np.sqrt(w2) / (2 * np.pi))`,
  `import numpy as np
from scipy import signal
w0, D, fE = 100, 0.05, 5
G = signal.TransferFunction([w0**2], np.polymul([1, 2*D*w0, w0**2], [1/(2*np.pi*fE), 1]))
w, mag, phase = signal.bode(G, w=2*np.pi*np.logspace(-1, 3, 400))`,
];

export function CheatSheetPage() {
  const { t } = useTranslation();
  useLesson("cheat_sheet");
  return (
    <div className={PAGE_SHELL}>
      <style>{PRINT_ONLY_SHEET}</style>
      <div id="cheat-sheet" className="space-y-4">
        <PageHeader
          size="sm"
          title={t("course.lessons.cheat_sheet.title")}
          description={t("course.lessons.cheat_sheet.summary")}
          actions={
            <Button variant="secondary" className="no-print" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              {t("course.cheat.print")}
            </Button>
          }
        />
        <Card padding="md" density="compact" className="space-y-2">
          <CardHeader>
            <CardTitle as="h2">{t("course.recipe.title")}</CardTitle>
          </CardHeader>
          <ol className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-secondary sm:grid-cols-2">
            {(
              ["question", "boundary", "coordinate", "balance", "normalise", "solve", "check", "interpret"] as const
            ).map((step, i) => (
              <li key={step}>
                <span className="font-medium text-primary">
                  {i + 1}. {t(`course.recipe.steps.${step}.title`)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {SECTIONS.map((section) => {
            const entry = lessonEntry(section.lesson);
            return (
              <Card key={section.key} padding="md" density="compact" className="space-y-1 break-inside-avoid">
                <CardHeader>
                  <CardTitle as="h2">
                    <Link to={entry.path} className="hover:underline">
                      {entry.number} · {t(`course.lessons.${section.lesson}.title`)}
                    </Link>
                  </CardTitle>
                </CardHeader>
                {section.tex.map((tex) => (
                  <Tex key={tex} block tex={tex} />
                ))}
              </Card>
            );
          })}
        </div>
        <Card padding="md" density="compact" className="space-y-2 break-inside-avoid">
          <CardHeader>
            <CardTitle as="h2">{t("course.cheat.analogies")}</CardTitle>
          </CardHeader>
          <Table density="compact" stack="phone">
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("course.cheat.role")}</TableHeaderCell>
                {DOMAINS.map((domain) => (
                  <TableHeaderCell key={domain}>{t(`course.cheat.domains.${domain}`)}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {ROLES.map((role) => (
                <TableRow key={role}>
                  <TableCell className="font-medium text-primary">{t(`course.cheat.roles.${role}`)}</TableCell>
                  {DOMAINS.map((domain) => (
                    <TableCell key={domain}>
                      <Tex tex={CELLS[role][domain]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card padding="md" density="compact" className="space-y-2 break-inside-avoid">
          <CardHeader>
            <CardTitle as="h2">{t("course.cheat.traps")}</CardTitle>
          </CardHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">
            {TRAPS.map((trap) => (
              <li key={trap}>{t(`course.cheat.trap.${trap}`)}</li>
            ))}
          </ul>
        </Card>
        <Card padding="md" density="compact" className="space-y-2">
          <CardHeader>
            <CardTitle as="h2">{t("course.cheat.python")}</CardTitle>
          </CardHeader>
          {PYTHON.map((code) => (
            <pre key={code} className="overflow-x-auto rounded-md border border-subtle bg-hover p-3 text-xs">
              <code>{code}</code>
            </pre>
          ))}
        </Card>
      </div>
      <div className="no-print print:hidden">
        <LessonNavigation lesson="cheat_sheet" />
      </div>
    </div>
  );
}
