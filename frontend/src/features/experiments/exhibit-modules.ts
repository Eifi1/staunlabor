/**
 * Each exhibit's page module and what the site takes from it: the page, its
 * preview (`preview-mode.tsx`) and the icon its card wears. One table, typed by
 * `Exhibit`: the routes (`app/routes.tsx`), the previews
 * (`exhibit-preview.tsx`), the cards (`exhibit-cards.tsx`) and the header's
 * search (`site-search.tsx`) all read it, where each kept a list of its own and
 * a new exhibit was three edits.
 *
 * Not in `exhibits.ts`, which the build reads (`vite.config.ts`) and which so
 * stays free of React and of the pages. Each module is imported lazily, by a
 * literal path, so each page stays its own chunk: its page and its preview are
 * two components of one module, so the preview's fetch is the chunk the
 * reader's click needs, fetched a little early, and the overview, in the first
 * wave, carries none of the simulations.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  Anchor,
  Armchair,
  AudioWaveform,
  BellRing,
  ChevronsDown,
  ChevronsUp,
  CircuitBoard,
  CloudSun,
  Columns3,
  Cylinder,
  Contrast,
  Diamond,
  Dices,
  Disc3,
  Droplets,
  Ellipsis,
  Flashlight,
  GlassWater,
  Globe,
  Grid3x3,
  Hourglass,
  InfinityIcon,
  Landmark,
  Layers,
  LifeBuoy,
  Link2,
  Magnet,
  Metronome,
  Orbit,
  PenTool,
  Rainbow,
  RefreshCcw,
  Rotate3d,
  RotateCw,
  Ship,
  Shuffle,
  Target,
  TestTube,
  Timer,
  Torus,
  UnfoldVertical,
  Vibrate,
  Volleyball,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Exhibit } from "./exhibits";
import type { PreviewProps } from "./preview-mode";

export interface ExhibitModule {
  Page: LazyExoticComponent<ComponentType>;
  Preview: LazyExoticComponent<ComponentType<PreviewProps>>;
  icon: LucideIcon;
}

/** A page module's `<Name>Page` and `<Name>Preview`, each loaded as it is
 *  needed, and the icon. The names are checked against the module's exports. */
function exhibitModule<Name extends string>(
  load: () => Promise<Record<`${Name}Page`, ComponentType> & Record<`${Name}Preview`, ComponentType<PreviewProps>>>,
  name: Name,
  icon: LucideIcon,
): ExhibitModule {
  const page = `${name}Page` as const;
  const preview = `${name}Preview` as const;
  return {
    Page: lazy(() => load().then((m: Record<`${Name}Page`, ComponentType>) => ({ default: m[page] }))),
    Preview: lazy(() =>
      load().then((m: Record<`${Name}Preview`, ComponentType<PreviewProps>>) => ({ default: m[preview] })),
    ),
    icon,
  };
}

export const EXHIBIT_MODULES: Record<Exhibit, ExhibitModule> = {
  chair: exhibitModule(() => import("./chair-page"), "Chair", Armchair),
  coil: exhibitModule(() => import("./coil-page"), "Coil", Magnet),
  sphere: exhibitModule(() => import("./sphere-page"), "Sphere", Orbit),
  platform: exhibitModule(() => import("./platform-page"), "Platform", RotateCw),
  race: exhibitModule(() => import("./race-page"), "Race", Timer),
  elephant: exhibitModule(() => import("./elephant-page"), "Elephant", Wind),
  smoke: exhibitModule(() => import("./smoke-page"), "Smoke", Torus),
  cannon: exhibitModule(() => import("./cannon-page"), "Cannon", ChevronsUp),
  wave: exhibitModule(() => import("./wave-page"), "Wave", Waves),
  harmonograph: exhibitModule(() => import("./harmonograph-page"), "Harmonograph", PenTool),
  cone: exhibitModule(() => import("./cone-page"), "Cone", Diamond),
  parabola: exhibitModule(() => import("./parabola-page"), "Parabola", GlassWater),
  coupled: exhibitModule(() => import("./coupled-page"), "Coupled", Link2),
  peg: exhibitModule(() => import("./peg-page"), "Peg", Anchor),
  maxwell: exhibitModule(() => import("./maxwell-page"), "Maxwell", Disc3),
  chaos: exhibitModule(() => import("./chaos-page"), "Chaos", Shuffle),
  waterwheel: exhibitModule(() => import("./waterwheel-page"), "Waterwheel", Droplets),
  foucault: exhibitModule(() => import("./foucault-page"), "Foucault", Globe),
  coriolis: exhibitModule(() => import("./coriolis-page"), "Coriolis", RefreshCcw),
  cradle: exhibitModule(() => import("./cradle-page"), "Cradle", Ellipsis),
  well: exhibitModule(() => import("./well-page"), "Well", Target),
  resonance: exhibitModule(() => import("./resonance-page"), "Resonance", AudioWaveform),
  gyroscope: exhibitModule(() => import("./gyroscope-page"), "Gyroscope", LifeBuoy),
  arch: exhibitModule(() => import("./arch-page"), "Arch", Landmark),
  chladni: exhibitModule(() => import("./chladni-page"), "Chladni", Grid3x3),
  levitation: exhibitModule(() => import("./levitation-page"), "Levitation", Rotate3d),
  circuit: exhibitModule(() => import("./circuit-page"), "Circuit", CircuitBoard),
  plates: exhibitModule(() => import("./plates-page"), "Plates", ChevronsDown),
  vessel: exhibitModule(() => import("./vessel-page"), "Vessel", Hourglass),
  bounce: exhibitModule(() => import("./bounce-page"), "Bounce", Volleyball),
  overhang: exhibitModule(() => import("./overhang-page"), "Overhang", Layers),
  film: exhibitModule(() => import("./film-page"), "Film", Cylinder),
  diver: exhibitModule(() => import("./diver-page"), "Diver", TestTube),
  ship: exhibitModule(() => import("./ship-page"), "Ship", Ship),
  rainbow: exhibitModule(() => import("./rainbow-page"), "Rainbow", Rainbow),
  sky: exhibitModule(() => import("./sky-page"), "Sky", CloudSun),
  slits: exhibitModule(() => import("./slits-page"), "Slits", Columns3),
  beats: exhibitModule(() => import("./beats-page"), "Beats", BellRing),
  string: exhibitModule(() => import("./string-page"), "String", InfinityIcon),
  spring: exhibitModule(() => import("./spring-page"), "Spring", UnfoldVertical),
  kapitza: exhibitModule(() => import("./kapitza-page"), "Kapitza", Vibrate),
  galton: exhibitModule(() => import("./galton-page"), "Galton", Dices),
  polarizer: exhibitModule(() => import("./polarizer-page"), "Polarizer", Contrast),
  jet: exhibitModule(() => import("./jet-page"), "Jet", Flashlight),
  metronomes: exhibitModule(() => import("./metronomes-page"), "Metronomes", Metronome),
};
