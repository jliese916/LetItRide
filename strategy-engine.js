"use strict";

(function initLetItRideStrategy(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LetItRideStrategy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildStrategy() {
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const SUITS = ["♥", "♦", "♣", "♠"];
  const STRAIGHT_WINDOWS = [
    [12, 0, 1, 2, 3],
    [0, 1, 2, 3, 4],
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 6],
    [3, 4, 5, 6, 7],
    [4, 5, 6, 7, 8],
    [5, 6, 7, 8, 9],
    [6, 7, 8, 9, 10],
    [7, 8, 9, 10, 11],
    [8, 9, 10, 11, 12]
  ];

  const rankOf = card => card % 13;
  const suitOf = card => Math.floor(card / 13);
  const label = card => RANKS[rankOf(card)] + SUITS[suitOf(card)];

  function validateCards(cards, expectedLength) {
    return Array.isArray(cards) &&
      cards.length === expectedLength &&
      new Set(cards).size === cards.length &&
      cards.every(card => Number.isInteger(card) && card >= 0 && card < 52);
  }

  function rankCounts(cards) {
    const counts = Array(13).fill(0);
    cards.forEach(card => { counts[rankOf(card)] += 1; });
    return counts;
  }

  function suitCounts(cards) {
    const counts = Array(4).fill(0);
    cards.forEach(card => { counts[suitOf(card)] += 1; });
    return counts;
  }

  function distinctRanks(cards) {
    return [...new Set(cards.map(rankOf))].sort((a, b) => a - b);
  }

  function evaluateFive(cards) {
    if (!validateCards(cards, 5)) throw new Error("evaluateFive requires five distinct cards.");

    const countsByRank = rankCounts(cards);
    const groups = countsByRank
      .map((count, rank) => ({ rank, count }))
      .filter(group => group.count > 0)
      .sort((a, b) => b.count - a.count || b.rank - a.rank);
    const ranks = groups.map(group => group.rank).sort((a, b) => a - b);
    const flush = suitCounts(cards).includes(5);
    const wheel = ranks.join(",") === "0,1,2,3,12";
    const ordinaryStraight = ranks.length === 5 && ranks[4] - ranks[0] === 4;
    const straight = wheel || ordinaryStraight;
    const royal = flush && ranks.join(",") === "8,9,10,11,12";

    let name = "High Card";
    let payout = -1;

    if (royal) { name = "Royal Flush"; payout = 1000; }
    else if (straight && flush) { name = "Straight Flush"; payout = 200; }
    else if (groups[0].count === 4) { name = "Four of a Kind"; payout = 50; }
    else if (groups[0].count === 3 && groups[1].count === 2) { name = "Full House"; payout = 11; }
    else if (flush) { name = "Flush"; payout = 8; }
    else if (straight) { name = "Straight"; payout = 5; }
    else if (groups[0].count === 3) { name = "Three of a Kind"; payout = 3; }
    else if (groups[0].count === 2 && groups[1].count === 2) { name = "Two Pair"; payout = 2; }
    else if (groups[0].count === 2 && groups[0].rank >= 8) {
      name = "Pair of Tens or Better";
      payout = 1;
    } else if (groups[0].count === 2) {
      name = "Low Pair";
    }

    return { name, payout };
  }

  function straightWindowCount(ranks) {
    return STRAIGHT_WINDOWS.filter(window => ranks.every(rank => window.includes(rank))).length;
  }

  function firstDecision(cards) {
    if (!validateCards(cards, 3)) throw new Error("firstDecision requires three distinct cards.");

    const counts = rankCounts(cards);
    const pairRank = counts.findIndex(count => count === 2);
    const trips = counts.includes(3);

    if (trips) {
      return { action: "ride", reason: "You already have three of a kind." };
    }

    if (pairRank >= 8) {
      return { action: "ride", reason: `You already have a paying pair of ${RANKS[pairRank]}s.` };
    }

    if (pairRank >= 0) {
      return { action: "pull", reason: `A pair of ${RANKS[pairRank]}s is below the paying threshold.` };
    }

    const ranks = distinctRanks(cards);
    const suited = new Set(cards.map(suitOf)).size === 1;
    const windows = straightWindowCount(ranks);
    const highCards = ranks.filter(rank => rank >= 8).length;

    if (suited && windows + highCards >= 3) {
      return {
        action: "ride",
        reason: `This qualifying three-card straight flush draw satisfies the s + h ≥ 3 rule (s = ${windows}, h = ${highCards}).`
      };
    }

    return {
      action: "pull",
      reason: suited
        ? `This is not a qualifying three-card straight flush draw because it does not satisfy the s + h ≥ 3 rule (s = ${windows}, h = ${highCards}).`
        : "This hand is not three of a kind, a pair of tens or better, or a qualifying three-card straight flush draw."
    };
  }

  function fourCardMadePaying(cards) {
    const counts = rankCounts(cards);
    const pairs = counts.map((count, rank) => ({ count, rank })).filter(item => item.count === 2);
    return counts.includes(4) || counts.includes(3) || pairs.length === 2 || pairs.some(pair => pair.rank >= 8);
  }

  function straightCompletionRanks(cards) {
    const ranks = distinctRanks(cards);
    if (ranks.length !== 4) return [];
    const missing = new Set();
    STRAIGHT_WINDOWS.forEach(window => {
      if (ranks.every(rank => window.includes(rank))) {
        window.filter(rank => !ranks.includes(rank)).forEach(rank => missing.add(rank));
      }
    });
    return [...missing].sort((a, b) => a - b);
  }

  function secondDecision(cards) {
    if (!validateCards(cards, 4)) throw new Error("secondDecision requires four distinct cards.");

    if (fourCardMadePaying(cards)) {
      return { action: "ride", reason: "This is a guaranteed winner: a pair of tens or better, two pair, three of a kind, or four of a kind." };
    }

    if (Math.max(...suitCounts(cards)) === 4) {
      return { action: "ride", reason: "You have a four-card flush draw." };
    }

    const completions = straightCompletionRanks(cards);
    if (completions.length > 0) {
      const highCards = distinctRanks(cards).filter(rank => rank >= 8).length;
      const score = 4 * completions.length + highCards;
      if (score > 8) {
        return { action: "ride", reason: "This is an open-ended straight draw containing a ten or higher." };
      }
      if (score === 8 && completions.length === 2) {
        return { action: "indifferent", reason: "This is a lower open-ended straight draw; all four cards are 9 or lower." };
      }
      if (score === 8) {
        return { action: "indifferent", reason: "This is an inside Broadway draw." };
      }
      return { action: "pull", reason: "This straight draw does not match a Ride or Either category." };
    }

    return { action: "pull", reason: "This hand does not match a Ride or Either category." };
  }

  function secondDecisionNumerator(cards) {
    if (!validateCards(cards, 4)) throw new Error("secondDecisionNumerator requires four distinct cards.");
    const visible = new Set(cards);
    let total = 0;
    for (let card = 0; card < 52; card += 1) {
      if (!visible.has(card)) total += evaluateFive([...cards, card]).payout;
    }
    return total;
  }

  function firstDecisionNumerator(cards) {
    if (!validateCards(cards, 3)) throw new Error("firstDecisionNumerator requires three distinct cards.");
    const visible = new Set(cards);
    const unseen = [];
    for (let card = 0; card < 52; card += 1) if (!visible.has(card)) unseen.push(card);
    let total = 0;
    for (let i = 0; i < unseen.length - 1; i += 1) {
      for (let j = i + 1; j < unseen.length; j += 1) {
        total += evaluateFive([...cards, unseen[i], unseen[j]]).payout;
      }
    }
    return total;
  }

  function canonicalRows(cards) {
    const masks = [0, 0, 0, 0];
    cards.forEach(card => { masks[suitOf(card)] += 2 ** (12 - rankOf(card)); });
    return masks.sort((a, b) => a - b);
  }

  function canonicalKey(cards) {
    return canonicalRows(cards).join("-");
  }

  return {
    RANKS,
    SUITS,
    STRAIGHT_WINDOWS,
    rankOf,
    suitOf,
    label,
    evaluateFive,
    firstDecision,
    secondDecision,
    firstDecisionNumerator,
    secondDecisionNumerator,
    straightWindowCount,
    straightCompletionRanks,
    canonicalRows,
    canonicalKey
  };
});
