import { useCallback, useEffect, useRef } from "react";
import { audioContextClass } from "./use-tones";

/**
 * Clicks in the browser: a short knock for each strike, as loud and as high as
 * the page says — the bouncing ball's, where the rhythm is the exhibit.
 *
 * **Silent until asked**, by the same rules as `useTones`: while `on` is false
 * no audio graph is built and `click` does nothing; turned off, the context is
 * closed, so a forgotten tab holds no audio device; nothing leaves the browser
 * and nothing is stored. Where there is no Web Audio, `available` is false.
 */

/** Every knock at full level: a tap, not a bang. */
const MASTER = 0.3;
/** How long a knock rings, s: short enough that the fastest strikes stay apart. */
const KNOCK_S = 0.03;
/** An exponential fade cannot start or end at zero. */
const SILENT = 1e-4;

export function useClicks(on: boolean): { available: boolean; click: (level: number, pitchHz: number) => void } {
  const graph = useRef<{ context: AudioContext; master: GainNode } | null>(null);
  const Context = audioContextClass();

  useEffect(() => {
    if (!on || !Context) return;
    const context = new Context();
    const master = context.createGain();
    master.gain.value = MASTER;
    master.connect(context.destination);
    graph.current = { context, master };
    return () => {
      graph.current = null;
      void context.close();
    };
  }, [on, Context]);

  const click = useCallback((level: number, pitchHz: number) => {
    const g = graph.current;
    if (!g) return;
    const now = g.context.currentTime;
    const knock = g.context.createOscillator();
    knock.type = "triangle";
    knock.frequency.value = pitchHz;
    const gain = g.context.createGain();
    gain.gain.setValueAtTime(Math.max(SILENT, Math.min(1, level)), now);
    gain.gain.exponentialRampToValueAtTime(SILENT, now + KNOCK_S);
    knock.connect(gain);
    gain.connect(g.master);
    knock.start(now);
    knock.stop(now + KNOCK_S);
  }, []);

  return { available: Context !== null, click };
}
