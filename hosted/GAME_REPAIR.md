# Hosted game repair and deployment handoff

The canonical game source is the parent repository. Run
`node scripts/sync-hosted-game.js` from that root after game edits; it verifies
both `hosted/lib/game` (server imports) and `hosted/public/game` (browser assets).
The hosted library keeps its CommonJS package boundary. The app itself is ESM.
`game-source-hashes.json` identifies the current mirrors; supplied historical
manifests in the game audit remain historical records, not current hashes.

## Corrected defects

- Catch-up ticks now advance a simulation clock from the persisted room time,
  rather than using request-end time for every step. Input expiration remains
  250 ms, but input is not prematurely stale for its whole valid interval.
- Short keyboard/touch fire presses are latched until the next sample.
- All five solo missions enter first-person play directly; legacy tactical
  checkpoint restoration remains supported, not a required new-game stage.
- Victory loot equips next-encounter combat effects on host replay:
  full relay share reduces cooldown by 0.1 s (minimum 0.1 s); armour share
  supplies 30 absorbable damage (cap 100); ammo share adds 5 damage
  (cap +15). Fractional AW allocations equip proportional effects.
  Power cells persist and add 5 damage; inventory no longer has only labels.
- In-game credits buy the precombat power cell through a genuine second-price
  allocation. They have no real-money value. Savings/available XP remains
  conserved bookkeeping and is not spent, converted or minted.
- Solo adds larger Frost Yard, Starlight Boulevard and Glacier Dock arenas.
  The original Hollywood-inspired district has neon theaters, palms and a
  hillside sign. Ice pig droids are fictional icy robotic melee enemies.
  Bright door frames, handles, clearance signs and exit markers aid navigation.
- Solo jetpacks use hold-to-fly J / mobile JET and finite fuel (16/s).
  Equipment adds 60 fuel; canisters add 35, capped at 100, never regenerating.
  Altitude evades ground melee, not walls or aimed ranged shots. Supply
  collection requires landing. Existing state logs/save replay include flight.
  Explicit practice selection does not count as completing the campaign.
  These are solo mechanics, not new multiplayer flight or NPC rules.

## Deployment

Restore dependencies with `npm ci`, then `npm run build`.
The D1 binding and supplied `rooms` migration are required for `/api/arena`.
`npm start` runs the built Worker locally, not on the ChatGPT-hosted site.
Publishing GitHub source does not update that separate hosted deployment.
Use its owner-authorized hosting workflow to redeploy this source export.

The uploaded source archive is preserved separately under Downloads;
changes here do not modify it. Third-party notices and preferred source remain.
The original NROM visual program uses JSNES CPU/PPU output for a low-resolution
first-person companion display; gameplay authority stays in the game engine.
No commercial ROM, Capcom game assets or unverified texture library is included.

## Research boundaries

The in-game story is an original civilian training simulation, not a
real-world political allegation. Strategic models declare utilities and
information structure; they do not certify a player's intelligence or motives.
Owner audit fixtures, match observations, historical claims and blockchain
proposals are distinct. No payment, chain transaction, hash-earned reward or
contest submission is performed by these repairs.
