"use client";

import Link from "next/link";
import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";
import { ErvoLogo } from "@/components/ervo-logo";

const CAPABILITIES = [
  "Research any protocol, position, or market",
  "See portfolios across wallets and chains",
  "Move and swap funds with confirm-gated plans",
  "Set up agents that keep running — DCA, TA, research",
] as const;

const WHY_NOW = [
  {
    title: "Wallets matured",
    body: "Programmable wallets can hold and move funds without ever exposing keys — including to the agent.",
  },
  {
    title: "Agents can route intent",
    body: "They're good at research, ambiguity across chains, and picking the right tool — as long as money moves stay confirm-gated.",
  },
  {
    title: "No consolidation layer yet",
    body: "The gap is still open: one trusted home over fragmented apps, venues, and chains.",
  },
] as const;

export function LandingPage() {
  const { authState, session, handleLogin } = useTurnkey();
  const loggedIn = authState === AuthState.Authenticated && !!session;
  const router = useRouter();

  async function onPrimary() {
    if (loggedIn) {
      router.push("/app");
      return;
    }
    try {
      await handleLogin();
      router.push("/app");
    } catch {
      /* user dismissed login */
    }
  }

  const ctaLabel = loggedIn ? "Open app" : "Log in";

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-zinc-950 text-zinc-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99, 70, 255, 0.22), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(0, 200, 255, 0.12), transparent 50%), radial-gradient(ellipse 50% 35% at 15% 40%, rgba(120, 40, 200, 0.1), transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-10 flex h-14 items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <ErvoLogo size="sm" className="size-5 object-contain" priority />
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            Ervo
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void onPrimary()}
          className="rounded-lg bg-zinc-100 px-3.5 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-white"
        >
          {ctaLabel}
        </button>
      </header>

      <main className="relative z-10">
        <section className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-6 pb-24 pt-8 text-center">
          <div className="animate-ervo-fade-up flex flex-col items-center">
            <ErvoLogo
              size="xl"
              className="size-20 object-contain sm:size-24"
              priority
            />
            <h1 className="mt-8 text-5xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
              Ervo
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
              The consolidation layer crypto doesn&apos;t have yet — one home for
              trust, understanding, and onboarding.
            </p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-500 sm:text-base">
              Say what you want. An agent figures out where things live and does
              it — across wallets, chains, and venues that are already vetted.
            </p>
            <button
              type="button"
              onClick={() => void onPrimary()}
              className="mt-9 rounded-xl bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white"
            >
              {ctaLabel}
            </button>
          </div>
        </section>

        <section className="mx-auto max-w-2xl px-6 pb-24">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
            The problem
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Crypto is fragmented — and not just its liquidity.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Different apps to invest through, venues to trade on, chains to hold
            assets on, UIs to learn, accounts to trust. Power users tolerate it.
            Everyone else looks at the sprawl and never onboards. It isn&apos;t
            that crypto is too hard to understand — there&apos;s no single place
            to stand while you try.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
            One app changes that: see everything, research anything, move money,
            and set up automations. Onboarding becomes &ldquo;open one,&rdquo; not
            &ldquo;learn ten.&rdquo; And when a venue is integrated, that&apos;s
            a trust signal — curated access, so you aren&apos;t evaluating every
            protocol alone.
          </p>
        </section>

        <section className="mx-auto max-w-2xl px-6 pb-24">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
            What it does
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Ask once. Act across wallets, chains, and venues.
          </h2>
          <ul className="mt-8 divide-y divide-zinc-800/80 border-y border-zinc-800/80">
            {CAPABILITIES.map((item) => (
              <li
                key={item}
                className="py-4 text-sm leading-relaxed text-zinc-300 sm:text-base"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-zinc-500">
            The point isn&apos;t a fixed feature list — it&apos;s breadth. If
            it&apos;s a legitimate crypto task, you should be able to ask Ervo
            to handle it.
          </p>
        </section>

        <section className="mx-auto max-w-2xl px-6 pb-24">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
            Why now
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            The stack finally caught up to the idea.
          </h2>
          <ul className="mt-8 space-y-8">
            {WHY_NOW.map((item) => (
              <li key={item.title}>
                <h3 className="text-sm font-semibold text-zinc-200">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-2xl px-6 pb-24">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
            Who it&apos;s for
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            People who want to use crypto — not become ten apps deep.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Active traders tired of juggling tabs, and people just getting in who
            need one place to start. Not built for institutional desks living in
            terminals — that&apos;s a different job.
          </p>
          <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
            What Ervo is not
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Not another trading tab competing for browser real estate. Ervo is
            the home for interacting with crypto — the one place you go,
            regardless of what you need done. Done right, it shouldn&apos;t feel
            like &ldquo;using a crypto app.&rdquo; It should feel like getting
            the thing you asked for done.
          </p>
        </section>

        <section className="flex flex-col items-center gap-4 px-6 pb-28 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Open Ervo
          </h2>
          <p className="max-w-sm text-sm text-zinc-500">
            One place to research, move money, and run agents across your
            wallets.
          </p>
          <button
            type="button"
            onClick={() => void onPrimary()}
            className="rounded-xl bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            {ctaLabel}
          </button>
        </section>
      </main>
    </div>
  );
}
