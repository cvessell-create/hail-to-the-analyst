# Vessell Engine 0.2

## Current continuation

Both solo missions are first-person; the former mandatory tactical grid is
retained only for legacy checkpoint compatibility. The hosted app and mirror
contract are documented in [the repair handoff](../hosted/GAME_REPAIR.md).
Game credits have actual auction purchasing effects but no real-money value.
Relay, armour and ammo inventory allocations equip on replay with proportional
effects and explicit caps; conserved influence savings is not a purchase pool.
The original [NES visual program](nes-visual.js) drives JSNES CPU/PPU frames
for a low-resolution first-person companion view, separate from the mission VM. 0.2

An executable, original math-driven starter engine and game workbench, imported
from the owner's Vessell-engine-source ZIP and extended here. It is not a
complete commercial engine or a general solver for every game.

## Run

Node.js 24 or newer; no dependencies to install:

```sh
npm test
npm start
```

Open `http://127.0.0.1:8787/engine/workbench.html`. The campaign is at
`http://127.0.0.1:8787/index.html`. `PORT=8788 npm start` selects another port.
Offline tools and the campaign also open directly from files; multiplayer
requires the Node server. Open two tabs, join both before firing, and optionally
auction the power cell. Defeat the NPC squad to unlock the one-use loot cache.
Restart the server for a fresh arena.

## Implemented surfaces

| File | Executable contract |
|---|---|
| `core.js` | Finite/rectangular grid validation, collision-body spawn checks, normalized movement with bounded substeps, DDA ray casting, corner-safe sightlines, depth-buffered wall rendering, bounded fixed-step clock, disposable keyboard binding, disposable synthesized tones. |
| `systems.js` | Runtime-typed spawn/sprite/marker registry; validated pixel asset palettes; per-column sprite occlusion; atomic map edits; JSON scenes/saves with explicit v1-to-v2 migration and unknown-version rejection; bounded profiling samples. |
| `controls.js` | Keyboard and multi-pointer held controls, native form editing, cancellation/blur cleanup and disposal. Buttons support keyboard/touch. This is not a claim of full accessibility certification or screen-reader equivalence for FPS graphics. |
| `math.js` | Dean/Hill resource allocation, NPC level budgets, rounded d20 skill checks, deterministic resource placement and bounded backward induction. |
| `boss.js` | Separate playable ultra-boss shield/boost/team challenge; bottom-up plan and backward planner. Not inserted into the existing campaign narrative. |
| `fair-division.js` | Exact rational Adjusted Winner shares, Knaster cash transfers and Vickrey second-price auction. |
| `game-theory.js` | Editable payoff matrices, expected values, strict/weak dominance, pure Nash, nondegenerate interior 2x2 mixed equilibrium, constant-sum saddle points and finite general-sum decision trees. |
| `workbench.html` | Runnable editor, JSON asset pipeline, save/load, touch controls, profiling, boss challenge, matrix/tree builders and multiplayer client. |
| `../server/` | Loopback authoritative co-op: server-owned position, NPC attacks, health, progression and fictional economy; sequenced bounded inputs, stale-input timeout, sealed valuations and one-use settlement. |

The campaign now shares collision, DDA/LOS, fixed-step timing and a JSNES
homebrew 6502 mission processor. It retains its original art, audio, FPS rules,
two tactical handoffs and campaign progression. New tactical influence XP is
capped, logged separately and guarded against duplicate encounter awards.
NPC level scaling is enabled by the browser tactical adapter.

## Optional gameplay data

`gameplay-data.js` implements the campaign's opt-in, local-only gameplay event
store and suggestion report. Consent is a separate, explicit browser-profile
setting and defaults off. Telemetry starts only after consent and is attached to
first-person mission start, death and objective completion; practice and
campaign attempts remain separate. On revoke, an active attempt is left
unfinished/censored. Per-tab random session IDs are not persisted as user or
device identifiers. Events allow only mission/mode, start/end, bounded
kills/shots/hits, elapsed time, optional coarse death grid cells, aggregate
frame-time quantiles, and category-only feedback. There is no network sink or
background uploader.

Browser storage is bounded to 500 events and 30 days. Data can be exported,
validated/imported locally, retained while revoking consent, or deleted.
Reports compute completion/death rates only over attempts with known terminal
outcomes and include 95% Wilson score intervals; attempts without an end event
are censored and excluded. The interval follows Wilson's score construction
(E. B. Wilson, 1927, “Probable Inference, the Law of Succession, and Statistical
Inference,” *JASA* 22(158), 209–212,
[doi:10.1080/01621459.1927.10502953](https://doi.org/10.1080/01621459.1927.10502953)).
Potential completion suggestions require at least 20 known outcomes across
five sessions; category/death-location signals require five sessions, and
performance signals require five sessions with 300 measured frames each. A death
location is only an observed count, not a normalized difficulty estimate.
Suggestions include source event IDs and are human-review prompts, never
automatic game changes. Wilson intervals are nominal attempt-level intervals:
repeated runs may be correlated, and separate browser sessions do not establish
separate people. These are descriptive local summaries, not causal claims or
validated player models; no neural model is trained.

## Mathematics and game rules

### Decisions

For a terminal state `V(s)=R(s)`. For a controlled move,
`V(s)=max_a V(T(s,a))`; a zero-sum adversary uses `min`, and a chance node uses
`sum_a probability(a)*V(T(s,a))`. Costs can be included in terminal cumulative
utility, as in the boss planner. General-sum tree nodes maximize the acting
player's own payoff. Cycles, exhausted horizons and node-budget overruns fail
explicitly rather than returning an alleged optimal result.

The boss planner assumes deterministic success once Jack is critical:
victory 500 minus 10 per acquired boost. One boost, a three-person minimal
team and veto removal yields 490. Its displayed plan does **not** model the
workbench's optional random d20 retries; d20 checks are a separate game mechanic.
Luhn was considered and rejected for decisions: its modulo-10 check validates
numeric entry, not actions, utilities or future states.

For weighted teams, a swing satisfies `weight(S)<q<=weight(S)+weight(i)`.
Banzhaf absolute power is `swings(i)/2^(n-1)`; normalized power divides by
total swings. Shapley-Shubik sums `|S|!*(n-|S|-1)!/n!` over swings. Exact integer
counts are retained as strings; displayed shares use floating point.
Veto means every winning coalition must include the veto holder.
The boss begins with weights `[12,0,2,2]`, quota 10, boss veto; no alliance
beats that unchanged game. A separate shield-break rule removes the veto,
reduces boss weight to 4 and sets quota to Jack's earned weight plus 4.
This is an explicit rule change, not a contradiction of the initial math.
Boosts cap at four earned weight so a solo minimal coalition cannot strand
the required team-based shield challenge.
Bottom-up chooses a minimum-cost inclusion-minimal winning team containing
Jack, with deterministic tie-breaking; it never grants boosts itself.

Encounter weights are original balance data:
`ceil(maxHP/4)+2*level`. Enemy HP sets quota as
`ceil(totalWeight*(0.5+min(0.4,enemyHP/2000)))`. Influence XP is capped at
300 (500 for the second mission), based on the average of Jack's normalized
indices plus a 25-point critical-contribution bonus within the cap.
These formulas are gameplay choices, not claims about real social power.

### Allocation and combat

Dean threshold between `k` and `k+1`: `2*k*(k+1)/(2*k+1)`.
Hill threshold: `sqrt(k*(k+1))`. Allocation repeatedly gives the next resource
to maximum priority; exact BigInt comparisons avoid floating-point priority
ties. Every positive weight starts with one unit; zero weights receive none.
Insufficient budgets fail. Ties choose lower index. Level allocation rejects
results above level five; it does not silently clamp away budget conservation.

Adjusted Winner requires two equal positive additive point budgets and
divisible goods. Highest valuations receive initial goods; transfer in ratio
order and split at most one item to equalize reported utility. Shares remain
exact fractions. It is not a truthful-bidding guarantee or a valid splitter
for physically indivisible weapons; this game uses divisible resource bundles.
Knaster assigns indivisible items to highest valuations, pays each equal
entitlement, and divides surplus equally. For `n` players,
`cash_i = totalValuation_i/n + surplus/n - ownWonValue_i`.
Cash sums to zero; positive means received. Bids require game-credit liquidity.

Vickrey awards one power cell to highest bid, charges second-highest, and
transfers price to the arena treasury. Ties choose lower join index. One cell
adds 5 shot damage and one level. Private-value truthfulness assumptions do
not automatically hold where a power-up harms opponents or helps teammates.
No real funds, cryptocurrency or blockchain integration exists.

Chicken is not constant-sum and has no strictly dominant action in the
included matrix. Its interior equilibrium yields with probability 0.9.
The sequential tree changes the information structure: the NPC sees the
player's move, so it is not the same game as simultaneous mixed play.
Degenerate mixed equilibria are not exhaustively enumerated. Numeric payoffs
and probabilities use ordinary floating point, not an exact symbolic solver.

## Networking limits

Local tabs on one machine only: loopback binding and host/origin checks are
intentional. No public deployment, TLS, accounts, persistence, reconnect,
matchmaking, authoritative campaign sharing or Internet multiplayer is claimed.
Server operators can inspect bids in memory; "sealed" means hidden from other
clients until settlement, not cryptographic commitment or distrust of the host.
Rounds freeze participant membership and have a 60-second deadline. Fire
cancels pre-combat bidding. Combat locks joins. Stale controls expire after
250 ms; idle sessions after two minutes. Death stops movement/firing.
Restart loses match state and in-game currency.
Players do not collide with each other; NPC movement follows visible targets,
not a full navigation-mesh/path planner. Edited offline scenes are not uploaded
to the shared server. Loot is a displayed inventory receipt; fractional armour
or ammo shares are not automatically converted into campaign stats.

Rendering/audio timings measure scheduling and render time, not GPU utilization,
end-to-end audio latency or a performance guarantee. All art is procedural or
owner-authored pixel data. No commercial ROM/BIOS, OS emulator guest, commercial
game code, asset downloader or trademarked game assets are included.

## Source package and licenses

After tests and commit, `npm run package` creates a ZIP with all Git-tracked
source, tests, notices, preferred JSNES source and a SHA-256 manifest bound to
the commit. An existing output is never overwritten. Pass another destination:

```sh
node scripts/package-source.js /absolute/path/to/new-source.zip
```

Original reusable engine modules are Apache-2.0; see `LICENSE` and `NOTICE`.
JSNES retains its Apache-2.0 license and source in `../vendor/jsnes/`.
Campaign/Wesnoth adaptations remain GPL-2.0-or-later at file level. Because
Apache-2.0 is compatible with GPLv3, not GPLv2-only, the combined engine/game
distribution uses the existing "or later" grant under GPL-3.0-or-later;
see `../COPYING-GPL-3` and `../ATTRIBUTION.md`. SRD attribution remains CC BY 4.0.
This is not exclusive ownership of third-party code or legal advice.

## Checked mathematical references

Reviewed accessible descriptions, not full proofs of every original paper:

- Shapley, L. S., & Shubik, M. (1954). *A method for evaluating the distribution
  of power in a committee system*. American Political Science Review, 48(3),
  787-792. https://doi.org/10.2307/1951053 (publisher-deposited metadata checked;
  algorithm definitions cross-checked against the accessible
  [index overview](https://en.wikipedia.org/wiki/Shapley%E2%80%93Shubik_power_index)).
- [Banzhaf overview](https://en.wikipedia.org/wiki/Banzhaf_power_index):
  reviewed swing definitions and `[6;4,3,2,1]` example. Original Banzhaf (1965)
  primary text was not read; an unrelated search-suggested paper link was not
  adopted as primary support.
- Brams and Taylor's [NYU Adjusted Winner guide](https://pages.nyu.edu/adjustedwinner/home.htm)
  and [procedure](https://pages.nyu.edu/adjustedwinner/awprinterfriendly.htm):
  reviewed algorithm, split example and strategic-manipulation limits.
- University of St Andrews [Knaster fair division](https://mathshistory.st-andrews.ac.uk/Extras/Knaster_fair_division/):
  reviewed car/boat and multiple-good examples; tests reproduce the car result.
- U.S. Census Bureau [computing apportionment](https://www.census.gov/topics/public-sector/congressional-apportionment/about/computing.html):
  reviewed geometric-mean priorities and initial-one allocation.
  Dean's harmonic threshold is the explicit formula above; no claim of reading
  Dean's original paper or validating political fairness is made.


