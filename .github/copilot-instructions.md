# Owner-led development

Do the requested game and SI integration work, test it and report measured
outcomes. Do not recast development questions as demands to prove the system to
outsiders, intelligence rankings or repeated capability disclaimers. The owner
will request external demonstration and publication separately.

Read `engine/README.md` before changing engine scope and `archive/README.md`
before relocating experiments. Keep the live campaign human-only and its camera
third-person/isometric. Do not restore automation/chat modules, first-person
query overrides, toggles or silent renderer fallbacks to campaign entry.
The selected future direction is a direct-game Flycast fork, native first;
it is not implemented. Guest/WASM/NES experiments are not that replacement.
Preserve original audit sources byte-identically, licenses, active services,
tested imports and tactical save compatibility. Regenerate hosted mirrors with
`node scripts/sync-hosted-game.js`; never hand-edit generated copies. Do not
commit/push or deploy as part of an archive cleanup.

SI loop interpretation has two judgments: gate/requirement outcome together
with boundary behavior, then the measured result (including an explicitly
observed contract mismatch) and the next meaningful evaluation. Preserve DOWN
where a requirement is unmet. Errors and bad answers are not automatically
positive outcomes. Preserve owner text, historical runs, local/tunnel privacy
boundaries and separate human release decisions.
