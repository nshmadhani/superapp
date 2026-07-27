"use client";

const SUGGESTIONS = [
  "Bridge 0.4 ETH to Base then lend on Morpho",
  "Set up a weekly DCA — $50 of ETH",
  "Technical analysis on ETH — long or short?",
  "Research Uniswap DAO recent governance",
];

export function ChatEmptyState({
  onSuggest,
  denser,
}: {
  onSuggest?: (text: string) => void;
  denser?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-center ${
        denser ? "h-[40vh]" : "h-[50vh]"
      }`}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
        Cipher
      </h1>
      <p className="max-w-sm text-sm text-zinc-500">
        Swap, bridge, and lend in one plan — or spawn an autonomous agent with
        its own wallet. Watch tools run as Cipher works.
      </p>
      {onSuggest && (
        <div className="mt-2 flex max-w-md flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggest(s)}
              className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
