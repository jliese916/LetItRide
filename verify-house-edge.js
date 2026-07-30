"use strict";
const S = require("./strategy-engine.js");

function combinations(n, k, callback) {
  const a = Array.from({ length: k }, (_, i) => i);
  while (true) {
    callback(a);
    let i = k - 1;
    while (i >= 0 && a[i] === n - k + i) i -= 1;
    if (i < 0) break;
    a[i] += 1;
    for (let j = i + 1; j < k; j += 1) a[j] = a[j - 1] + 1;
  }
}

let mandatoryAndFirst = 0;
let startingHands = 0;
combinations(52, 3, cards => {
  const hand = cards.slice();
  const numerator = S.firstDecisionNumerator(hand);
  const rides = S.firstDecision(hand).action === "ride";
  mandatoryAndFirst += 2 * numerator; // compulsory base bet; unordered pairs become ordered community cards
  if (rides) mandatoryAndFirst += 2 * numerator;
  startingHands += 1;
});

let secondBet = 0;
let fourCardSets = 0;
combinations(52, 4, cards => {
  const hand = cards.slice();
  const numerator = S.secondDecisionNumerator(hand);
  if (S.secondDecision(hand).action === "ride") secondBet += 4 * numerator;
  // Each four-card set occurs four ways: any one of its cards can be the revealed community card.
  fourCardSets += 1;
});

const totalProfit = mandatoryAndFirst + secondBet;
const denominator = startingHands * 49 * 48;
const result = {
  success: totalProfit === -1822224 && denominator === 51979200,
  startingHands,
  fourCardSets,
  orderedCommunityOutcomes: denominator,
  totalProfitNumerator: totalProfit,
  reducedOverallNetEVPerHand: "-37963/1082900",
  conventionalHouseEdgePercent: 100 * 37963 / 1082900,
  edgeAsPercentOfThreeUnitsInitiallyPlaced: 100 * 37963 / 3248700
};
console.log(JSON.stringify(result));
process.exit(result.success ? 0 : 1);
