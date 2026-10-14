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
  assert.match(Story.OPENING, /fictional civic intelligence apparatus/i);
  assert.match(Story.OPENING, /leads, not proof/i);
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
  assert.match(Story.mission('SHADOW DOSSIER').story, /fictional weapons system/i);
  assert.match(Story.mission('SHADOW DOSSIER').story, /STALKER/);
  assert.match(Story.mission('SHADOW DOSSIER').tactics, /telegraphed volley/i);
  assert.match(Story.mission('SHADOW DOSSIER').apparatus.note, /not authority/i);
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
