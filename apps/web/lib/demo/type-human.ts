/** Human-ish typing: pauses, occasional typos, then backspace fixes. */

export type TypeHumanOptions = {
  signal: AbortSignal;
  /** Chance 0..1 of introducing a typo on a letter */
  typoRate?: number;
  /** 1 = normal human pace; higher = faster (good for longer assistant text) */
  speed?: number;
  onUpdate: (text: string) => void;
};

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(() => resolve(), ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function nearbyKey(ch: string): string {
  const map: Record<string, string> = {
    a: "s",
    s: "a",
    d: "f",
    e: "w",
    r: "t",
    t: "r",
    h: "g",
    n: "m",
    o: "p",
    p: "o",
    l: "k",
    i: "u",
    c: "v",
    m: "n",
    y: "u",
  };
  const lower = ch.toLowerCase();
  const repl = map[lower];
  if (!repl) return ch === " " ? " " : "x";
  return ch === ch.toUpperCase() ? repl.toUpperCase() : repl;
}

export async function typeHuman(
  finalText: string,
  { signal, typoRate = 0.045, speed = 1, onUpdate }: TypeHumanOptions,
) {
  const pace = Math.max(speed, 0.35);
  let shown = "";
  onUpdate("");

  for (let i = 0; i < finalText.length; i++) {
    const ch = finalText[i]!;

    // Thinking pause at start of a clause
    if (i > 0 && (finalText[i - 1] === "." || finalText[i - 1] === "?")) {
      await sleep((280 + Math.random() * 420) / pace, signal);
    } else if (ch === " " && Math.random() < 0.08) {
      await sleep((120 + Math.random() * 220) / pace, signal);
    }

    const canTypo =
      /[a-zA-Z]/.test(ch) &&
      i > 2 &&
      i < finalText.length - 2 &&
      Math.random() < typoRate;

    if (canTypo) {
      const wrong = nearbyKey(ch);
      shown += wrong;
      onUpdate(shown);
      await sleep((55 + Math.random() * 50) / pace, signal);
      // notice beat
      await sleep((180 + Math.random() * 260) / pace, signal);
      shown = shown.slice(0, -1);
      onUpdate(shown);
      await sleep((70 + Math.random() * 60) / pace, signal);
      // sometimes backspace one more if we "overshot"
      if (Math.random() < 0.25 && shown.length > 0) {
        shown = shown.slice(0, -1);
        onUpdate(shown);
        await sleep((60 + Math.random() * 40) / pace, signal);
        const prev = finalText[i - 1];
        if (prev) {
          shown += prev;
          onUpdate(shown);
          await sleep((50 + Math.random() * 40) / pace, signal);
        }
      }
    }

    shown += ch;
    onUpdate(shown);
    const delay =
      ch === " "
        ? 45 + Math.random() * 55
        : ch === "," || ch === "." || ch === "?"
          ? 160 + Math.random() * 200
          : 48 + Math.random() * 55;
    await sleep(delay / pace, signal);
  }
}
