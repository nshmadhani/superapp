# Cipher — Vision

**Date:** 2026-07-25
**Status:** Draft
**Working name:** Cipher

See also: full design spec — [`docs/superpowers/specs/2026-07-25-ai-crypto-wallet-design.md`](docs/superpowers/specs/2026-07-25-ai-crypto-wallet-design.md) · open items — [`TODO.md`](TODO.md)

---

## The problem

Crypto is fragmented — and not just its liquidity. It's fragmented in attention. Different apps to invest through, different venues to trade on, different chains to hold assets on, different UIs to learn, different accounts to trust. Power users push through it anyway; they've built up the muscle memory to tolerate the fragmentation. Everyone else looks at that sprawl and simply doesn't onboard. It's not that crypto is too hard to understand — it's that there's no single place to stand while you try to understand it.

If instead there were one app — one place to see everything, research anything, move money, and set up automations — onboarding stops being "learn ten apps" and becomes "open one." And that one place can absorb something else users currently have to figure out for themselves: trust. If a provider has already integrated an app, protocol, or venue, that's a signal it's been vetted — the user isn't left evaluating every new protocol's risk on their own. Not everyone gets access to everything from day one; what's exposed is curated. The platform carries that trust decision so the user doesn't have to.

## The vision

**Cipher is the consolidation layer crypto doesn't have yet: one home where trust, understanding, and onboarding all live in the same place.**

You say what you want — research something, check your portfolio, move funds, set up something recurring — and an agent figures out where things actually live and does it, across wallets, chains, and venues, through integrations that have already been vetted. No app-hopping, no separately trusting a dozen protocols, no relearning a new UI for every new thing you want to do.

## Why now

- Wallet infrastructure (programmable wallets, account abstraction, relayers/paymasters) has matured enough to hold and move funds without ever exposing keys — including to the agent itself.
- Agents are now good at exactly this kind of work: open-ended research, resolving ambiguity across chains and assets, and routing intent to the right tool — as long as anything that moves money stays confirm-gated.
- No one has built the single consolidated, trusted layer over this fragmentation yet. The gap is open.

## Who it's for

Everybody trying to actually use crypto, not just watch it. Active retail traders and power users who are tired of juggling apps, and people just getting into crypto who need one place to understand how to onboard at all. It's not built for professional/institutional traders who live in charts and terminals — that's a different job. Beyond that, it's intentionally broad: anyone who wants to hold, move, or grow crypto without becoming an expert in ten different apps first.

## What it does

Cipher is given enough tools and access to do whatever a user asks of it — research, portfolio visibility, moving money, trading, automations — and to do it seamlessly, without the user needing to know which underlying app or venue is doing the work. The point isn't a fixed feature list; it's breadth: research a position, swap an asset, catch an opportunity across venues, park funds somewhere safe, set up something to run on its own later. If it's a legitimate crypto task, it should be something you can just ask Cipher to handle.

## What Cipher is not

Cipher is not another place to trade — it's not one more app competing for a tab in your browser. Cipher is meant to be the home for interacting with crypto: the one place you go, regardless of what you actually need to do. Done right, it shouldn't feel like "using a crypto app" at all — it should just feel like getting the thing you asked for done.
