"use strict";
const S = require("./strategy-engine.js");

function exactAction(n) { return n > 0 ? "ride" : n < 0 ? "pull" : "indifferent"; }

function combinations(n, k, callback) {
  const a = Array.from({ length: k }, (_, i) => i);
  while (true) {
    callback(a.slice());
    let i = k - 1;
    while (i >= 0 && a[i] === n - k + i) i -= 1;
    if (i < 0) break;
    a[i] += 1;
    for (let j = i + 1; j < k; j += 1) a[j] = a[j - 1] + 1;
  }
}

function verifyStage(k) {
  const keys = new Map();
  let physical = 0;
  let mismatches = 0;
  combinations(52, k, cards => {
    physical += 1;
    const rule = k === 3 ? S.firstDecision(cards).action : S.secondDecision(cards).action;
    const numerator = k === 3 ? S.firstDecisionNumerator(cards) : S.secondDecisionNumerator(cards);
    const exact = exactAction(numerator);
    if (rule !== exact) {
      mismatches += 1;
      if (mismatches <= 5) console.error("Mismatch", k, cards, rule, exact, numerator);
    }
    const key = S.canonicalKey(cards);
    if (!keys.has(key)) keys.set(key, exact);
    else if (keys.get(key) !== exact) throw new Error(`Canonical conflict for ${key}`);
  });
  const counts = {};
  for (const action of keys.values()) counts[action] = (counts[action] || 0) + 1;
  return { stageCards: k, physical, canonical: keys.size, canonicalDecisionCounts: counts, mismatches };
}

const stage1 = verifyStage(3);
console.log(JSON.stringify(stage1));
const stage2 = verifyStage(4);
console.log(JSON.stringify(stage2));

const expected = {
  stage1: { physical: 22100, canonical: 1755, counts: { ride: 162, pull: 1593 }, mismatches: 0 },
  stage2: { physical: 270725, canonical: 16432, counts: { ride: 3310, indifferent: 126, pull: 12996 }, mismatches: 0 }
};
function sameCounts(a, b) { return Object.keys(b).every(k => a[k] === b[k]) && Object.keys(a).every(k => a[k] === b[k]); }
const success = stage1.physical === expected.stage1.physical && stage1.canonical === expected.stage1.canonical && sameCounts(stage1.canonicalDecisionCounts, expected.stage1.counts) && stage1.mismatches === 0 && stage2.physical === expected.stage2.physical && stage2.canonical === expected.stage2.canonical && sameCounts(stage2.canonicalDecisionCounts, expected.stage2.counts) && stage2.mismatches === 0;
console.log(JSON.stringify({ success }));
process.exit(success ? 0 : 1);
