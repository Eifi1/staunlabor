import { useEffect, useRef } from "react";

/**
 * Tones in the browser: one sine per voice, each as loud as the page says —
 * the block the sounding exhibits share (the resonance rods first).
 *
 * **Silent until asked.** Nothing sounds while `on` is false, and the audio
 * graph is not even built: a page never makes a noise by itself, and browsers
 * let an `AudioContext` start only after a gesture, which the switch that turns
 * `on` true is. Turned off, the context is closed, not merely muted, so a
 * forgotten tab holds no audio device.
 *
 * **Nothing leaves the browser and nothing is stored**: the tones are computed
 * here (Web Audio), the choice is a page's state, not a key in storage.
 *
 * Where there is no Web Audio (an old browser, the test runner), `available` is
 * false and the hook does nothing; the page says so beside its switch.
 */

/** All voices together at full level: a quiet background, not an alarm. */
const MASTER = 0.2;
/** How fast a voice follows its level, s: smooth enough not to click. */
const GLIDE_S = 0.05;

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextClass; webkitAudioContext?: AudioContextClass };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

interface Graph {
  context: AudioContext;
  gains: GainNode[];
}

export function useTones(on: boolean, pitchesHz: readonly number[], levels: readonly number[]): { available: boolean } {
  const graph = useRef<Graph | null>(null);
  const Context = audioContextClass();
  const pitchKey = pitchesHz.join(" ");

  useEffect(() => {
    if (!on || !Context) return;
    const context = new Context();
    const master = context.createGain();
    master.gain.value = MASTER / Math.max(1, pitchesHz.length);
    master.connect(context.destination);
    const oscillators: OscillatorNode[] = [];
    const gains = pitchesHz.map((hz) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = hz;
      const gain = context.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      oscillators.push(oscillator);
      return gain;
    });
    graph.current = { context, gains };
    return () => {
      graph.current = null;
      for (const oscillator of oscillators) oscillator.stop();
      void context.close();
    };
    // The pitches by value: a new array with the same tones keeps the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, Context, pitchKey]);

  useEffect(() => {
    const g = graph.current;
    if (!g) return;
    g.gains.forEach((gain, i) =>
      gain.gain.setTargetAtTime(Math.max(0, Math.min(1, levels[i] ?? 0)), g.context.currentTime, GLIDE_S),
    );
  }, [levels]);

  return { available: Context !== null };
}
