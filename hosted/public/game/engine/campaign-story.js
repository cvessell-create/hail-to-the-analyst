// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
// Fictional campaign writing and tactical intent; gameplay rules live elsewhere.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailCampaignStory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var OPENING = 'In this speculative future, mobile cities survive by stripping smaller settlements for fuel, metal and water. Their rulers call the policy <b>MUNICIPAL DARWINISM</b>. A fictional civic intelligence apparatus routes questions from city councils to separate collection crews, record processors and analyst desks, then sends assessments back to human decision-makers. The system is meant to inform decisions, not make them; its tasking, source handling and oversight are now contested. Jack Slade, a shy salvage apprentice whose home was consumed, begins by wanting revenge. A trail of conflicting manifests leads toward St. Louis and a buried weapons archive. The records are leads, not proof: scarcity, sabotage and deliberate predation can look alike until sources are compared.';
  var MISSIONS = [
    {
      name: 'THE ARCHIVE',
      district: "LACLEDE'S LANDING",
      apparatus: { stage: 'DIRECTION', note: 'Who set the requirement, what question did they ask, and whose needs were left out?' },
      story: 'Shy apprentice Jack slips into a riverfront records depot to find the missing settlement roster. A stamped harvest order points toward a city convoy, but its copied manifest has no independent source. He is too guarded to tell the archivist why he came.',
      tactics: 'Read the lanes before crossing, use the walls to break drone sightlines, and collect RED CLEARANCE before opening the exit.',
      after: 'The roster names Jack’s home, but not who approved its harvest. He chooses to keep looking instead of treating the first name as a verdict.'
    },
    {
      name: 'FABRICATION PLANT',
      district: 'OLD BRICK WORKS',
      apparatus: { stage: 'COLLECTION', note: 'Compare worker accounts, production ledgers and route telemetry; trace source lineage instead of counting copies as witnesses.' },
      story: 'A production floor is converting salvaged town machinery into mobile-city parts. The Fabricators’ production logs may show a planned harvest—or emergency repairs after a route failure. Jack starts asking workers what the ledger leaves out.',
      tactics: 'Use the pillars as cover, clear the controller’s line of sight, and conserve shells for the boss. BLUE CLEARANCE alone does not stop the controller.',
      after: 'A maintenance note contradicts the harvest ledger. Jack records both rather than hiding the inconvenient copy.'
    },
    {
      name: 'FROST YARD',
      district: 'NORTH CITY TRANSFER',
      apparatus: { stage: 'PROCESSING', note: 'Keep original timestamps and provenance while sorting damaged route records; cleaned data is not yet a validated conclusion.' },
      story: 'A frozen transfer yard holds fuel intended for a smaller settlement. Stalker machines patrol the stockpiles, but their old route markers may still be maintenance signals rather than orders from the city.',
      tactics: 'Avoid letting ICE PIG DROIDS pin you in a lane. Take fuel only when it opens a route; jetpack fuel does not regenerate.',
      after: 'Jack leaves enough heat cells for the stranded crew. It costs him time, but the crew shares a route map no convoy ledger contained.'
    },
    {
      name: 'STARLIGHT BOULEVARD',
      district: 'DELMAR LOOP',
      apparatus: { stage: 'EXPLOITATION & ANALYSIS', note: 'Interpret the processed broadcasts, compare alternatives and state uncertainty, assumptions and disconfirming evidence.' },
      story: 'A neon street carries two evacuation broadcasts with different timestamps. One may be a decoy; the other may be an outdated warning. Jack remembers how easily a frightened crowd can be redirected.',
      tactics: 'Do not chase a signal blindly. Break drone sightlines, check side streets for clearance and supplies, and use the rooftops only when you have fuel to land safely.',
      after: 'Jack confirms the broadcasts share one relay, so they are not independent corroboration. He tells the neighborhood what is still unknown.'
    },
    {
      name: 'GLACIER DOCK',
      district: 'MISSISSIPPI FREIGHT',
      apparatus: { stage: 'DISSEMINATION', note: 'Share a timely, audience-fit briefing with dock crews, including what is unknown; a report informs their choice but does not authorize seizure or force.' },
      story: 'Two moving cities contest the same dock. A red-zone alarm could mark an active threat, a diversion, or a failing flood-control system. The dock crews are caught between all three possibilities.',
      tactics: 'Use the freight walls as cover, watch for ranged fire at your altitude, and clear the controller before crossing the exposed extraction lane.',
      after: 'Jack delays both convoys long enough for dock workers to evacuate. Neither city’s account of the incident is accepted without checking the other.'
    },
    {
      name: 'SKYLINE DISTRICT',
      district: 'DOWNTOWN GRID',
      apparatus: { stage: 'EVALUATION & OVERSIGHT', note: 'Compare earlier judgments with outcomes, preserve dissent and correct the record without rewriting what was previously released.' },
      story: 'Above the numbered streets, a relay tower stores route evidence from settlements absorbed by the city. Its rooftop caches can expose the chain of custody, but a broken record can implicate the wrong crew.',
      tactics: 'Use doors to enter buildings and jet over rooftop walls. Drones can aim upward; land behind cover before engaging.',
      after: 'Jack now speaks up in the crew briefing. He separates what the relay proves from what it merely suggests.'
    },
    {
      name: 'SHADOW DOSSIER',
      district: 'BURIED RIVERFRONT VAULT',
      apparatus: { stage: 'HUMAN REVIEW & DECISION', note: 'The Stalker guards access codes to the fictional ODNI system. Defeating it secures evidence, not authority: Jack leaves activation to a separate, informed human decision.' },
      story: 'The central vault contains an artifact holding access codes for ODNI, a fictional weapons system in this story. A mechanical guardian called the STALKER protects it under an old city command key. The dossier calls the codes a firing key; a maintenance record calls them a dormant defense lock. Neither record settles intent or who had authority to activate the system.',
      tactics: 'Let the Stalker commit to its telegraphed volley, move out of the spread, then counterattack during its recovery. Keep cover between you and its line of fire.',
      after: 'Jack secures the artifact without activating the system. Defeating the guardian does not validate the dossier or confer authority. Revenge no longer answers the question by itself: the surviving settlements must review the conflicting records and decide what to do.'
    }
  ];
  var FOOTPRINT_SIDE_QUEST = {
    name: 'FOOTPRINT PURGE',
    district: 'GATEWAY SPRAWL',
    apparatus: { stage: 'OPTIONAL SOURCE HYGIENE', note: 'This fictional exercise distinguishes collection, containment and verified removal; it is not connected to a real scanner or account.' },
    story: 'At a quiet signal exchange, Jack finds fictional exposure records left by the convoy network. He checks what can be contained, what may be removable and what remains uncertain. This optional exercise does not change the main campaign.',
    tactics: 'Handle the critical nodes before leaving. Hard nodes require a stationary hold; LOCKED DOWN means containment in this simulation, not deletion.',
    after: 'The exercise records a fictional training outcome only. No account, service or real-world record was contacted or changed.'
  };

  function mission(name) {
    return MISSIONS.find(function (row) { return row.name === name; }) || null;
  }

  function sideQuest(name) {
    return name === FOOTPRINT_SIDE_QUEST.name ? FOOTPRINT_SIDE_QUEST : null;
  }

  function campaignLength() {
    return MISSIONS.length;
  }

  return {
    OPENING: OPENING,
    MISSIONS: MISSIONS,
    FOOTPRINT_SIDE_QUEST: FOOTPRINT_SIDE_QUEST,
    mission: mission,
    sideQuest: sideQuest,
    campaignLength: campaignLength
  };
});
