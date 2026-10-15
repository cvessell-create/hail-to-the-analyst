'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Story = require('../engine/campaign-story.js');
const levels = [
  { name: 'THE ARCHIVE' },
  { name: 'FABRICATION PLANT' },
  ...require('../engine/solo-expansion.js').levels(),
];

test('the main campaign has a source-cautious character arc for every mission', () => {
  assert.equal(Story.campaignLength(), 7);
  assert.equal(levels.length, Story.campaignLength());
  assert.match(Story.OPENING, /Municipal Darwinism/i);
  assert.match(Story.OPENING, /A civic intelligence apparatus/);
  assert.doesNotMatch(Story.OPENING, /\bmobile\b|\bfictional\b|The system is meant|shy salvage apprentice|not proof/);
  assert.deepEqual(Story.MISSIONS.map(row => row.apparatus.stage), [
    'DIRECTION', 'COLLECTION', 'PROCESSING', 'EXPLOITATION & ANALYSIS',
    'DISSEMINATION', 'EVALUATION & OVERSIGHT', 'HUMAN REVIEW & DECISION'
  ]);
  for (const level of levels) {
    const beat = Story.mission(level.name);
    assert.ok(beat, `${level.name} has a story beat`);
    assert.ok(beat.district);
    assert.ok(beat.story);
    assert.ok(beat.tactics);
    assert.ok(beat.after);
  }
  assert.match(Story.mission('THE ARCHIVE').story, /shy/i);
  assert.match(Story.mission('SHADOW DOSSIER').story, /ODNI, a weapons system/);
  assert.match(Story.mission('SHADOW DOSSIER').story, /STALKER/);
  assert.match(Story.mission('SHADOW DOSSIER').tactics, /telegraphed volley/i);
  assert.equal(Story.mission('SHADOW DOSSIER').apparatus.note, 'The Stalker guards access codes to the ODNI system. Defeating it secures evidence.');
  assert.doesNotMatch(Story.OPENING, /St\. Louis/);
  assert.match(Story.OPENING, /toward the city/);
  assert.doesNotMatch(JSON.stringify(levels), /mobile|moving-city|fictional cyberpunk|Delmar|No real accounts|in this story/i);
});

test('footprint purge is framed as a fictional optional side quest', () => {
  const quest = Story.sideQuest('FOOTPRINT PURGE');
  assert.equal(quest.district, 'GATEWAY SPRAWL');
  assert.match(quest.story, /optional/i);
  assert.match(quest.apparatus.note, /not connected to a real scanner/i);
  assert.match(quest.tactics, /not deletion/i);
  assert.match(quest.after, /No account, service or real-world record/i);
  assert.equal(Story.sideQuest('THE ARCHIVE'), null);
});
