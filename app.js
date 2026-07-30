"use strict";

(() => {
  const S = window.LetItRideStrategy;
  if (!S) throw new Error("LetItRideStrategy did not load.");

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const SUIT_CLASSES = ["suit-hearts", "suit-diamonds", "suit-clubs", "suit-spades"];
  const STORAGE_KEY = "casaLetItRidePlayV3";
  const CHALLENGE_HANDS = 200;
  const CHALLENGE_PASSING_HANDS = 196;
  const DECISION_TRANSITION_LOCK_MS = 120;

  const el = {
    tabs: $$(".mode-tab"),
    panels: { play: $("#playPanel"), train: $("#trainPanel"), lookup: $("#lookupPanel") },
    modeTabs: $("#modeTabs"),
    challengeLaunch: $("#challengeLaunch"),
    challengePanel: $("#challengePanel"),
    challengeGame: $("#challengeGame"),
    challengeSummary: $("#challengeSummary"),
    challengeProgress: $("#challengeProgress"),
    challengeCommunity: $("#challengeCommunity"),
    challengePlayer: $("#challengePlayer"),
    challengeBets: $("#challengeBets"),
    challengeExit: $("#challengeExit"),

    playBalance: $("#playBalance"),
    playAccuracy: $("#playAccuracy"),
    playCommunity: $("#playCommunity"),
    playPlayer: $("#playPlayer"),
    playBets: $("#playBets"),
    playMessage: $("#playMessage"),
    playDeal: $("#playDeal"),
    playChart: $("#playBalanceChart"),
    playChartSummary: $("#playChartSummary"),
    playDeltaSummary: $("#playDeltaSummary"),
    playMistakeCount: $("#playMistakeCount"),
    playMistakeList: $("#playMistakeList"),
    resetPlay: $("#resetPlay"),

    trainCommunity: $("#trainCommunity"),
    trainPlayer: $("#trainPlayer"),
    trainBets: $("#trainBets"),
    trainFeedback: $("#trainFeedback"),
    trainNew: $("#trainNew"),
    trainScore: $("#trainScore"),
    trainPercent: $("#trainPercent"),
    resetTrain: $("#resetTrain"),

    lookupPlayerHand: $("#lookupPlayerHand"),
    lookupCommunityHand: $("#lookupCommunityHand"),
    lookupPrompt: $("#lookupPrompt"),
    rankPicker: $("#rankPicker"),
    suitPicker: $("#suitPicker"),
    clearLookup: $("#clearLookup"),
    findStrategy: $("#findStrategy"),
    lookupFeedback: $("#lookupFeedback")
  };

  const state = {
    mode: "play",
    play: loadPlay(),
    train: { round: null, hands: 0, correct: 0 },
    lookup: { cards: [], pendingRank: null },
    challenge: { active: false, number: 0, correct: 0, round: null, misses: [] }
  };

  function emptyPlay() {
    return {
      balance: 0,
      optimalBalance: 0,
      balanceHistory: [0],
      optimalHistory: [0],
      hands: 0,
      accurateHands: 0,
      mistakes: [],
      round: null
    };
  }

  function loadPlay() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return emptyPlay();
      return {
        ...emptyPlay(),
        balance: Number(saved.balance) || 0,
        optimalBalance: Number(saved.optimalBalance) || 0,
        balanceHistory: Array.isArray(saved.balanceHistory) && saved.balanceHistory.length ? saved.balanceHistory : [0],
        optimalHistory: Array.isArray(saved.optimalHistory) && saved.optimalHistory.length ? saved.optimalHistory : [0],
        hands: Number(saved.hands) || 0,
        accurateHands: Number(saved.accurateHands) || 0,
        mistakes: Array.isArray(saved.mistakes) ? saved.mistakes.slice(-100) : []
      };
    } catch (error) {
      console.warn("Could not load Let It Ride session.", error);
      return emptyPlay();
    }
  }

  function savePlay() {
    const p = state.play;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        balance: p.balance,
        optimalBalance: p.optimalBalance,
        balanceHistory: p.balanceHistory,
        optimalHistory: p.optimalHistory,
        hands: p.hands,
        accurateHands: p.accurateHands,
        mistakes: p.mistakes
      }));
    } catch (error) {
      console.warn("Could not save Let It Ride session.", error);
    }
  }

  function shuffledDeck() {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function newRound() {
    return {
      cards: shuffledDeck().slice(0, 5),
      stage: 1,
      actualActive: [true, true, true],
      optimalActive: [true, true, true],
      correctness: [],
      decisions: [],
      completed: false,
      actionLockedUntil: 0
    };
  }

  function cardElement(card, { back = false, small = false, removable = false, onClick = null, placeholder = false } = {}) {
    const node = document.createElement(removable || onClick ? "button" : "div");
    if (node.tagName === "BUTTON") node.type = "button";
    node.className = `card${small ? " small" : ""}${back ? " card-back" : ""}${placeholder ? " placeholder" : ""}`;

    if (placeholder) {
      node.textContent = "+";
      node.setAttribute("aria-label", "Empty card slot");
    } else if (back) {
      node.setAttribute("aria-label", "Face-down card");
    } else {
      const suitClass = SUIT_CLASSES[S.suitOf(card)];
      node.classList.add(suitClass);
      node.innerHTML = `
        <span class="card-suit card-suit-top ${suitClass}">${S.SUITS[S.suitOf(card)]}</span>
        <span class="card-rank ${suitClass}">${S.RANKS[S.rankOf(card)]}</span>
        <span class="card-suit card-suit-bottom ${suitClass}">${S.SUITS[S.suitOf(card)]}</span>`;
      node.setAttribute("aria-label", S.label(card));
    }

    if (onClick) node.addEventListener("click", onClick);
    return node;
  }

  function renderCards(container, cards, options = {}) {
    container.replaceChildren();
    cards.forEach((card, index) => {
      const back = options.backFrom !== undefined && index >= options.backFrom;
      container.append(cardElement(card, { back, small: options.small }));
    });
  }

  function actionText(action) {
    if (action === "ride") return "Let It Ride";
    if (action === "pull") return "Pull Back";
    return "Either Action";
  }

  function strategyFor(round) {
    return round.stage === 1
      ? S.firstDecision(round.cards.slice(0, 3))
      : S.secondDecision(round.cards.slice(0, 4));
  }

  function visibleCardsForStage(round, stage = round.stage) {
    return stage === 1 ? round.cards.slice(0, 3) : round.cards.slice(0, 4);
  }

  function decisionCorrect(userAction, optimalAction) {
    return optimalAction === "indifferent" || userAction === optimalAction;
  }

  // The physical table is labeled $, 2, 1 from left to right.
  // Decision 1 acts on the right-hand 1 wager; Decision 2 acts on the middle 2 wager.
  function betIndexForStage(stage) {
    if (stage === 1) return 2;
    if (stage === 2) return 1;
    return -1;
  }

  function alignBetGridToMiddleCard(container) {
    if (!container) return;
    const table = container.closest(".lir-table");
    const playerCards = table ? table.querySelectorAll(".player-zone .card") : [];
    const middleSpot = container.querySelector(".bet-column:nth-child(2) .bet-spot");
    if (playerCards.length < 3 || !middleSpot) return;

    // Measure from an unshifted rail, then anchor the center chip to the
    // center of the player's middle card in the current browser layout.
    container.style.setProperty("--bet-align-x", "0px");
    const cardRect = playerCards[1].getBoundingClientRect();
    const spotRect = middleSpot.getBoundingClientRect();
    if (!cardRect.width || !spotRect.width) return;

    const cardCenter = cardRect.left + cardRect.width / 2;
    const spotCenter = spotRect.left + spotRect.width / 2;
    container.style.setProperty("--bet-align-x", `${(cardCenter - spotCenter).toFixed(2)}px`);
  }

  function alignAllBetGrids() {
    [el.playBets, el.trainBets, el.challengeBets].forEach(container => {
      if (container && container.offsetParent !== null) alignBetGridToMiddleCard(container);
    });
  }

  function renderBetGrid(container, round, handler, { showActions = true } = {}) {
    container.replaceChildren();
    const spotLabels = ["$", "2", "1"];
    const activeIndex = round && !round.completed ? betIndexForStage(round.stage) : -1;
    const actionsActive = Boolean(round && showActions && activeIndex >= 1 && activeIndex <= 2);

    for (let i = 0; i < 3; i += 1) {
      const column = document.createElement("div");
      column.className = "bet-column";
      if (actionsActive && activeIndex === i) column.classList.add("active-decision");

      const top = document.createElement("div");
      top.className = "bet-top";
      const spot = document.createElement("div");
      spot.className = "bet-spot";
      spot.dataset.spotLabel = spotLabels[i];

      if (round && round.actualActive[i]) {
        const chip = document.createElement("div");
        chip.className = "bet-chip";
        spot.append(chip);
      }

      top.append(spot);
      column.append(top);
      container.append(column);
    }

    const cue = document.createElement("div");
    cue.className = "bet-decision-cue";
    if (!actionsActive) cue.classList.add("inactive");
    cue.style.gridColumn = actionsActive ? String(activeIndex + 1) : "2";

    const arrow = document.createElement("span");
    arrow.className = "bet-decision-arrow";
    arrow.textContent = "↑";
    arrow.setAttribute("aria-hidden", "true");

    const cueText = document.createElement("span");
    cueText.className = "bet-decision-text";
    cueText.textContent = actionsActive ? `Choose Decision ${round.stage}` : "Choose Decision";
    cue.append(arrow, cueText);

    const actions = document.createElement("div");
    actions.className = "lir-decision-actions";
    actions.setAttribute("aria-label", actionsActive ? `Decision ${round.stage} actions` : "Decision actions");
    if (!actionsActive) actions.classList.add("inactive");

    const makeButton = (action, label, keyText) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `lir-decision-button ${action}-button`;
      button.setAttribute("aria-label", label);

      const key = document.createElement("span");
      key.className = `lir-action-key strategy-${action}`;
      key.textContent = keyText;
      key.setAttribute("aria-hidden", "true");

      const buttonLabel = document.createElement("span");
      buttonLabel.className = "lir-action-label";
      buttonLabel.textContent = label;
      buttonLabel.setAttribute("aria-hidden", "true");

      button.append(key, buttonLabel);
      if (actionsActive) button.addEventListener("click", () => handler(action));
      else {
        button.disabled = true;
        button.tabIndex = -1;
      }
      return button;
    };

    actions.append(
      makeButton("pull", "Pull Back", "P"),
      makeButton("ride", "Let It Ride", "R")
    );

    container.append(cue, actions);
    requestAnimationFrame(() => alignBetGridToMiddleCard(container));
  }

  function renderRoundCards(round, communityContainer, playerContainer, { playerBacksWhenEmpty = false } = {}) {
    if (!round) {
      communityContainer.replaceChildren(cardElement(0, { back: true }), cardElement(0, { back: true }));
      playerContainer.replaceChildren();
      for (let i = 0; i < 3; i += 1) {
        playerContainer.append(cardElement(0, playerBacksWhenEmpty ? { back: true } : { placeholder: true }));
      }
      return;
    }
    renderCards(playerContainer, round.cards.slice(0, 3));
    communityContainer.replaceChildren();
    communityContainer.append(cardElement(round.cards[3], { back: round.stage === 1 }));
    communityContainer.append(cardElement(round.cards[4], { back: round.stage < 3 }));
  }

  function setPlayMessage(text, tone = "neutral") {
    el.playMessage.textContent = text;
    el.playMessage.classList.remove("win", "loss");
    if (tone === "win" || tone === "loss") el.playMessage.classList.add(tone);
  }

  function startPlayHand() {
    if (state.play.round && !state.play.round.completed) return;
    const round = newRound();
    round.balanceBefore = state.play.balance;
    round.optimalBefore = state.play.optimalBalance;
    state.play.balance -= 3;
    state.play.optimalBalance -= 3;
    state.play.round = round;
    setPlayMessage("");
    renderPlay();
  }

  function answerPlay(action) {
    const p = state.play;
    const round = p.round;
    if (!round || round.completed) return;
    if (performance.now() < (round.actionLockedUntil || 0)) return;

    const stage = round.stage;
    const strategy = strategyFor(round);
    const correct = decisionCorrect(action, strategy.action);
    const betIndex = betIndexForStage(stage);
    const visible = visibleCardsForStage(round, stage);

    if (action === "pull") {
      round.actualActive[betIndex] = false;
      p.balance += 1;
    }

    const optimalAction = strategy.action === "indifferent" ? action : strategy.action;
    if (optimalAction === "pull") {
      round.optimalActive[betIndex] = false;
      p.optimalBalance += 1;
    }

    round.correctness.push(correct);
    round.decisions.push({ stage, action, optimal: strategy.action, reason: strategy.reason });

    if (!correct) {
      p.mistakes.push({
        stage,
        cards: visible,
        choice: action,
        optimal: strategy.action,
        reason: strategy.reason,
        handNumber: p.hands + 1
      });
      p.mistakes = p.mistakes.slice(-100);
    }

    if (stage === 1) {
      round.actionLockedUntil = performance.now() + DECISION_TRANSITION_LOCK_MS;
      round.stage = 2;
      setPlayMessage("");
    } else {
      round.stage = 3;
      settlePlayRound();
    }
    renderPlay();
  }

  function settlePlayRound() {
    const p = state.play;
    const round = p.round;
    const result = S.evaluateFive(round.cards);
    const returnedPerActiveBet = result.payout >= 0 ? result.payout + 1 : 0;
    const actualActiveCount = round.actualActive.filter(Boolean).length;
    const optimalActiveCount = round.optimalActive.filter(Boolean).length;

    p.balance += actualActiveCount * returnedPerActiveBet;
    p.optimalBalance += optimalActiveCount * returnedPerActiveBet;
    p.balance = roundTo(p.balance, 6);
    p.optimalBalance = roundTo(p.optimalBalance, 6);
    p.hands += 1;
    if (round.correctness.every(Boolean)) p.accurateHands += 1;
    p.balanceHistory.push(p.balance);
    p.optimalHistory.push(p.optimalBalance);
    round.completed = true;

    const net = roundTo(p.balance - round.balanceBefore, 6);
    const sign = net > 0 ? "+" : "";
    setPlayMessage(
      `${result.name}: ${sign}${formatUnits(net)} on the hand with ${actualActiveCount} bet${actualActiveCount === 1 ? "" : "s"} riding.`,
      net > 0 ? "win" : net < 0 ? "loss" : "neutral"
    );
    savePlay();
  }

  function renderPlay() {
    const p = state.play;
    renderRoundCards(p.round, el.playCommunity, el.playPlayer, { playerBacksWhenEmpty: true });
    renderBetGrid(el.playBets, p.round, answerPlay, { showActions: true });
    el.playBalance.textContent = formatUnits(p.balance);
    el.playBalance.classList.toggle("positive", p.balance > 0);
    el.playBalance.classList.toggle("negative", p.balance < 0);
    el.playAccuracy.textContent = p.hands ? `${(100 * p.accurateHands / p.hands).toFixed(1)}%` : "0.0%";
    el.playDeal.disabled = Boolean(p.round && !p.round.completed);
    el.playDeal.textContent = p.round && p.round.completed ? "New Hand" : "Deal";
    el.playChartSummary.textContent = `${p.hands} completed hand${p.hands === 1 ? "" : "s"}`;
    const delta = roundTo(p.optimalBalance - p.balance, 6);
    el.playDeltaSummary.textContent = `Optimal − you: ${formatUnits(delta)}`;
    renderMistakes();
    drawBalanceChart();
  }

  function renderMistakes() {
    const mistakes = state.play.mistakes;
    el.playMistakeCount.textContent = mistakes.length;
    el.playMistakeList.replaceChildren();
    if (!mistakes.length) {
      const empty = document.createElement("p");
      empty.className = "play-missed-empty";
      empty.textContent = "No incorrect decisions yet.";
      el.playMistakeList.append(empty);
      return;
    }

    [...mistakes].reverse().forEach(mistake => {
      const card = document.createElement("article");
      card.className = "mistake-card";
      const title = document.createElement("strong");
      title.textContent = `Hand ${mistake.handNumber} · Decision ${mistake.stage}`;
      const hand = document.createElement("div");
      hand.className = "hand";
      mistake.cards.forEach(c => hand.append(cardElement(c, { small: true })));
      const text = document.createElement("p");
      text.textContent = `You chose ${actionText(mistake.choice)}. Optimal: ${actionText(mistake.optimal)}. ${mistake.reason}`;
      card.append(title, hand, text);
      el.playMistakeList.append(card);
    });
  }

  function drawBalanceChart() {
    const canvas = el.playChart;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.round(rect.width || 600));
    const height = 230;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);

    const actual = state.play.balanceHistory;
    const optimal = state.play.optimalHistory;
    const values = [...actual, ...optimal, 0];
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const pad = { left: 38, right: 12, top: 14, bottom: 26 };
    const graphW = width - pad.left - pad.right;
    const graphH = height - pad.top - pad.bottom;
    const maxCount = Math.max(actual.length, optimal.length, 2);
    const x = i => pad.left + (i / (maxCount - 1)) * graphW;
    const y = value => pad.top + (max - value) / (max - min) * graphH;

    ctx.strokeStyle = "rgba(60,75,68,.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const yy = pad.top + i * graphH / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(width - pad.right, yy); ctx.stroke();
    }
    ctx.fillStyle = "#617168";
    ctx.font = "11px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(formatNumber(max), pad.left - 5, pad.top + 4);
    ctx.fillText(formatNumber(min), pad.left - 5, pad.top + graphH);

    function line(series, strokeStyle, dashed) {
      if (!series.length) return;
      ctx.save();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 2.5;
      ctx.setLineDash(dashed ? [6, 5] : []);
      ctx.beginPath();
      series.forEach((value, i) => i ? ctx.lineTo(x(i), y(value)) : ctx.moveTo(x(i), y(value)));
      ctx.stroke();
      ctx.restore();
    }
    line(actual, "#174a35", false);
    line(optimal, "#9a7213", true);
  }

  function startTrainHand() {
    state.train.round = newRound();
    el.trainFeedback.textContent = "";
    el.trainFeedback.className = "feedback lir-message";
    renderTrain();
  }

  function answerTrain(action) {
    const round = state.train.round;
    if (!round || round.completed) return;
    if (performance.now() < (round.actionLockedUntil || 0)) return;
    const strategy = strategyFor(round);
    const correct = decisionCorrect(action, strategy.action);
    const index = betIndexForStage(round.stage);
    if (action === "pull") round.actualActive[index] = false;
    round.correctness.push(correct);
    round.decisions.push({ stage: round.stage, action, optimal: strategy.action, reason: strategy.reason });

    el.trainFeedback.textContent = correct ? "Correct!" : "Incorrect!";
    el.trainFeedback.className = `feedback lir-message ${correct ? "correct" : "incorrect"}`;

    if (round.stage === 1) {
      round.actionLockedUntil = performance.now() + DECISION_TRANSITION_LOCK_MS;
      round.stage = 2;
    } else {
      round.stage = 3;
      round.completed = true;
      const handCorrect = round.correctness.every(Boolean);
      state.train.hands += 1;
      if (handCorrect) state.train.correct += 1;
    }
    renderTrain();
  }

  function renderTrain() {
    renderRoundCards(state.train.round, el.trainCommunity, el.trainPlayer);
    renderBetGrid(el.trainBets, state.train.round, answerTrain, { showActions: true });
    el.trainNew.disabled = Boolean(state.train.round && !state.train.round.completed);
    el.trainNew.textContent = "New Hand";
    el.trainScore.textContent = `${state.train.correct} / ${state.train.hands}`;
    el.trainPercent.textContent = state.train.hands ? `${(100 * state.train.correct / state.train.hands).toFixed(1)}%` : "0.0%";
  }

  function buildPickers() {
    el.rankPicker.replaceChildren();
    S.RANKS.forEach((rank, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "picker-button rank-button";
      button.textContent = rank;
      button.addEventListener("click", () => {
        state.lookup.pendingRank = index;
        renderLookup();
      });
      el.rankPicker.append(button);
    });

    el.suitPicker.replaceChildren();
    S.SUITS.forEach((suit, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `picker-button suit-button ${SUIT_CLASSES[index]}`;
      button.textContent = suit;
      button.addEventListener("click", () => addLookupCard(index));
      el.suitPicker.append(button);
    });
  }

  function addLookupCard(suit) {
    const lookup = state.lookup;
    if (lookup.pendingRank === null || lookup.cards.length >= 4) return;
    const card = 13 * suit + lookup.pendingRank;
    if (lookup.cards.includes(card)) {
      el.lookupPrompt.textContent = `${S.label(card)} is already entered. Choose another suit.`;
      return;
    }
    lookup.cards.push(card);
    lookup.pendingRank = null;
    el.lookupFeedback.replaceChildren();
    renderLookup();
  }

  function removeLookupCard(index) {
    state.lookup.cards.splice(index, 1);
    state.lookup.pendingRank = null;
    el.lookupFeedback.replaceChildren();
    renderLookup();
  }

  function renderLookup() {
    const lookup = state.lookup;
    el.lookupPlayerHand.replaceChildren();
    for (let i = 0; i < 3; i += 1) {
      if (i < lookup.cards.length) {
        el.lookupPlayerHand.append(cardElement(lookup.cards[i], { removable: true, onClick: () => removeLookupCard(i) }));
      } else {
        el.lookupPlayerHand.append(cardElement(0, { placeholder: true }));
      }
    }

    el.lookupCommunityHand.replaceChildren();
    if (lookup.cards.length === 4) {
      el.lookupCommunityHand.append(cardElement(lookup.cards[3], { removable: true, onClick: () => removeLookupCard(3) }));
    } else {
      el.lookupCommunityHand.append(cardElement(0, { placeholder: true }));
    }

    $$("#rankPicker .picker-button").forEach((button, index) => {
      button.classList.toggle("active", lookup.pendingRank === index);
      button.disabled = lookup.cards.length >= 4;
    });
    $$("#suitPicker .picker-button").forEach(button => {
      button.disabled = lookup.pendingRank === null || lookup.cards.length >= 4;
    });

    if (lookup.cards.length < 3) {
      el.lookupPrompt.textContent = lookup.pendingRank === null
        ? `Choose a rank for player card ${lookup.cards.length + 1}`
        : `Choose the suit for ${S.RANKS[lookup.pendingRank]}`;
    } else if (lookup.cards.length === 3) {
      el.lookupPrompt.textContent = lookup.pendingRank === null
        ? "Three-card lookup is ready. Find Strategy now, or add the revealed community card."
        : `Choose the suit for the community ${S.RANKS[lookup.pendingRank]}`;
    } else {
      el.lookupPrompt.textContent = "Four-card lookup is ready. Tap any card to remove it.";
    }
    el.findStrategy.disabled = lookup.cards.length < 3;
  }

  function findLookupStrategy() {
    const cards = state.lookup.cards;
    if (cards.length < 3) return;
    const stage = cards.length === 3 ? 1 : 2;
    const strategy = stage === 1 ? S.firstDecision(cards) : S.secondDecision(cards);

    el.lookupFeedback.replaceChildren();
    const result = document.createElement("article");
    result.className = "lookup-result-card";

    const heading = document.createElement("div");
    heading.className = "lookup-result-heading";
    const bubble = document.createElement("span");
    const bubbleType = strategy.action === "indifferent" ? "either" : strategy.action;
    bubble.className = `lookup-decision-bubble ${bubbleType}`;
    bubble.textContent = strategy.action === "indifferent" ? "EITHER" : strategy.action.toUpperCase();
    const stageLabel = document.createElement("span");
    stageLabel.className = "lookup-stage-label";
    stageLabel.textContent = stage === 1 ? "First decision" : "Second decision";
    heading.append(bubble, stageLabel);

    const reason = document.createElement("div");
    reason.className = "lookup-result-reason";
    reason.textContent = strategy.reason;
    result.append(heading, reason);
    el.lookupFeedback.append(result);
  }

  function startChallenge() {
    state.challenge = { active: true, number: 1, correct: 0, round: newRound(), misses: [] };
    el.challengeLaunch.classList.add("hidden");
    el.modeTabs.classList.add("hidden");
    Object.values(el.panels).forEach(panel => panel.classList.add("hidden"));
    el.challengePanel.classList.remove("hidden");
    el.challengeGame.classList.remove("hidden");
    el.challengeSummary.classList.add("hidden");
    renderChallenge();
  }

  function answerChallenge(action) {
    const c = state.challenge;
    const round = c.round;
    if (!c.active || !round || round.completed) return;
    if (performance.now() < (round.actionLockedUntil || 0)) return;
    const strategy = strategyFor(round);
    const correct = decisionCorrect(action, strategy.action);
    if (action === "pull") round.actualActive[betIndexForStage(round.stage)] = false;
    round.correctness.push(correct);
    round.decisions.push({ stage: round.stage, action, optimal: strategy.action, reason: strategy.reason, cards: visibleCardsForStage(round) });

    if (round.stage === 1) {
      round.actionLockedUntil = performance.now() + DECISION_TRANSITION_LOCK_MS;
      round.stage = 2;
      renderChallenge();
      return;
    }

    round.stage = 3;
    round.completed = true;
    const handCorrect = round.correctness.every(Boolean);
    if (handCorrect) c.correct += 1;
    else c.misses.push({ number: c.number, decisions: round.decisions.filter((_, i) => !round.correctness[i]) });

    if (c.number >= CHALLENGE_HANDS) finishChallenge();
    else {
      c.number += 1;
      c.round = newRound();
      renderChallenge();
    }
  }

  function renderChallenge() {
    const c = state.challenge;
    el.challengeProgress.textContent = `Hand ${c.number} of ${CHALLENGE_HANDS}`;
    renderRoundCards(c.round, el.challengeCommunity, el.challengePlayer);
    renderBetGrid(el.challengeBets, c.round, answerChallenge, { showActions: true });
  }

  function finishChallenge() {
    const c = state.challenge;
    el.challengeGame.classList.add("hidden");
    el.challengeSummary.classList.remove("hidden");
    const percent = 100 * c.correct / CHALLENGE_HANDS;
    const passed = c.correct >= CHALLENGE_PASSING_HANDS;
    const perfect = c.correct === CHALLENGE_HANDS;
    const today = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(new Date());

    let resultMarkup;
    if (perfect) {
      resultMarkup = `
        <div class="certificate grand-master">
          <div class="grand-master-rays" aria-hidden="true"></div>
          <div class="grand-master-stars" aria-hidden="true">♠ · ♦ · ♣ · ♥</div>
          <div class="certificate-small">CASA DEL JEFE · HALL OF MASTERS</div>
          <div class="certificate-title">LET IT RIDE<br>GRAND MASTER</div>
          <div class="certificate-rule"></div>
          <p>This certifies a flawless performance in the ${CHALLENGE_HANDS}-hand El Jefe Let It Ride Challenge.</p>
          <div class="certificate-score">${CHALLENGE_HANDS} / ${CHALLENGE_HANDS} · 100%</div>
          <div class="grand-master-crest" aria-hidden="true">♛</div>
          <div class="grand-master-subtitle">Perfect Strategy</div>
          <p>Certified by El Jefe</p>
          <p>${today}</p>
          <div class="certificate-share">Screenshot this Grand Master certificate and send it to the group text thread.</div>
        </div>`;
    } else if (passed) {
      resultMarkup = `
        <div class="certificate">
          <div class="certificate-small">CERTIFICATE OF LET IT RIDE READINESS</div>
          <div class="certificate-title">EL JEFE APPROVED</div>
          <div class="certificate-rule"></div>
          <p>This certifies that the bearer completed the ${CHALLENGE_HANDS}-hand El Jefe Let It Ride Challenge with:</p>
          <div class="certificate-score">${c.correct} / ${CHALLENGE_HANDS} · ${percent.toFixed(1)}%</div>
          <p>You are now approved to play Let It Ride at Casa del Jefe.</p>
          <p>${today}</p>
          <div class="certificate-share">Screenshot this certificate and send it to the group text thread.</div>
        </div>`;
    } else {
      resultMarkup = `
        <div class="challenge-fail">
          <h2>Not quite El Jefe approved</h2>
          <div class="challenge-final-score">${c.correct} / ${CHALLENGE_HANDS} · ${percent.toFixed(1)}%</div>
          <p>You need ${CHALLENGE_PASSING_HANDS} correct hands to pass. Practice the missed situations and try the challenge again.</p>
        </div>`;
    }

    el.challengeSummary.innerHTML = `${resultMarkup}
      <div class="challenge-summary-actions"><button class="primary" id="challengeAgain" type="button">Try Again</button><button id="challengeDone" type="button">Done</button></div>
      <details class="review-details"><summary>Review missed hands (${c.misses.length})</summary><div id="challengeMisses"></div></details>`;
    $("#challengeAgain").addEventListener("click", startChallenge);
    $("#challengeDone").addEventListener("click", exitChallenge);
    const list = $("#challengeMisses");
    c.misses.forEach(miss => {
      const article = document.createElement("article");
      article.className = "mistake-card";
      const title = document.createElement("strong");
      title.textContent = `Hand ${miss.number}`;
      article.append(title);
      miss.decisions.forEach(d => {
        const hand = document.createElement("div"); hand.className = "hand";
        d.cards.forEach(card => hand.append(cardElement(card, { small: true })));
        const text = document.createElement("p");
        text.textContent = `Decision ${d.stage}: chose ${actionText(d.action)}; optimal ${actionText(d.optimal)}. ${d.reason}`;
        article.append(hand, text);
      });
      list.append(article);
    });
  }

  function exitChallenge() {
    state.challenge.active = false;
    el.challengePanel.classList.add("hidden");
    el.challengeLaunch.classList.remove("hidden");
    el.modeTabs.classList.remove("hidden");
    setMode(state.mode);
  }

  function setMode(mode) {
    state.mode = mode;
    el.tabs.forEach(tab => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    Object.entries(el.panels).forEach(([name, panel]) => panel.classList.toggle("hidden", name !== mode));
    if (mode === "train" && !state.train.round) startTrainHand();
    if (mode === "lookup") renderLookup();
    if (mode === "play") requestAnimationFrame(drawBalanceChart);
    requestAnimationFrame(alignAllBetGrids);
  }

  function resetPlay() {
    if (!window.confirm("Reset the bankroll, accuracy, chart, and incorrect-decision history?")) return;
    state.play = emptyPlay();
    savePlay();
    setPlayMessage("Press Deal to begin.");
    renderPlay();
  }

  function roundTo(value, digits) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function formatUnits(value) {
    const n = roundTo(value, 6);
    return `${formatNumber(n)} unit${Math.abs(n) === 1 ? "" : "s"}`;
  }

  function formatSigned(value, digits) {
    const text = Number(value).toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
    return value > 0 ? `+${text}` : text;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a || 1;
  }

  function reducedFraction(numerator, denominator) {
    if (numerator === 0) return "0";
    const d = gcd(numerator, denominator);
    return `${numerator / d}/${denominator / d}`;
  }

  el.tabs.forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  el.playDeal.addEventListener("click", startPlayHand);
  el.resetPlay.addEventListener("click", resetPlay);
  el.trainNew.addEventListener("click", startTrainHand);
  el.resetTrain.addEventListener("click", () => {
    state.train = { round: null, hands: 0, correct: 0 };
    startTrainHand();
  });
  el.clearLookup.addEventListener("click", () => {
    state.lookup = { cards: [], pendingRank: null };
    el.lookupFeedback.replaceChildren();
    renderLookup();
  });
  el.findStrategy.addEventListener("click", findLookupStrategy);
  el.challengeLaunch.addEventListener("click", startChallenge);
  el.challengeExit.addEventListener("click", exitChallenge);
  window.addEventListener("resize", () => requestAnimationFrame(drawBalanceChart));
  window.addEventListener("keydown", event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if (event.key === "Enter" && !state.challenge.active) {
      if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
      if (state.mode === "play" && !el.playDeal.disabled) {
        event.preventDefault();
        startPlayHand();
      } else if (state.mode === "train") {
        event.preventDefault();
        startTrainHand();
      }
      return;
    }

    const activeRound = state.challenge.active ? state.challenge.round : state.mode === "play" ? state.play.round : state.mode === "train" ? state.train.round : null;
    if (!activeRound || activeRound.completed) return;
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      state.challenge.active ? answerChallenge("pull") : state.mode === "play" ? answerPlay("pull") : answerTrain("pull");
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      state.challenge.active ? answerChallenge("ride") : state.mode === "play" ? answerPlay("ride") : answerTrain("ride");
    }
  });

  window.addEventListener("resize", () => requestAnimationFrame(alignAllBetGrids));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(alignAllBetGrids));
  }

  buildPickers();
  renderLookup();
  renderPlay();
  renderTrain();
  setMode("play");

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("Service worker registration failed.", error));
  }
})();
