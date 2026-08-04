"use strict";

(() => {
  const APP_VERSION = "32";
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
    playDecisionIndicator: $("#playDecisionIndicator"),
    playCommunity: $("#playCommunity"),
    playPlayer: $("#playPlayer"),
    playBets: $("#playBets"),
    playMessage: $("#playMessage"),
    playDeal: $("#playDeal"),
    playChart: $("#playBalanceChart"),
    playDeltaSummary: $("#playDeltaSummary"),
    completedHands: $("#completedHands"),
    playWins: $("#playWins"),
    playPushes: $("#playPushes"),
    playLosses: $("#playLosses"),
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
    lookupFeedback: $("#lookupFeedback"),
    updateNotice: $("#updateNotice"),
    reloadUpdate: $("#reloadUpdate")
  };

  const state = {
    mode: "play",
    play: loadPlay(),
    train: { round: null, hands: 0, correct: 0 },
    lookup: { cards: [], pendingRank: null },
    challenge: { active: false, number: 0, correct: 0, round: null, misses: [] }
  };

  let balanceChartFrame = 0;
  let lastBalanceChartSignature = "";

  function emptyPlay() {
    return {
      balance: 0,
      optimalBalance: 0,
      balanceHistory: [0],
      optimalHistory: [0],
      hands: 0,
      accurateHands: 0,
      wins: 0,
      pushes: 0,
      losses: 0,
      mistakes: [],
      round: null
    };
  }

  function countOutcomesFromHistory(history, hands) {
    const values = Array.isArray(history) ? history.map(Number).filter(Number.isFinite) : [];
    const count = Math.min(Math.max(0, Number(hands) || 0), Math.max(0, values.length - 1));
    let wins = 0;
    let pushes = 0;
    let losses = 0;
    for (let index = 1; index <= count; index += 1) {
      const change = values[index] - values[index - 1];
      if (change > 1e-9) wins += 1;
      else if (change < -1e-9) losses += 1;
      else pushes += 1;
    }
    return { wins, pushes, losses };
  }

  function loadPlay() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return emptyPlay();
      const balanceHistory = Array.isArray(saved.balanceHistory) && saved.balanceHistory.length ? saved.balanceHistory.map(Number) : [0];
      const optimalHistory = Array.isArray(saved.optimalHistory) && saved.optimalHistory.length ? saved.optimalHistory.map(Number) : [0];
      const hands = Number(saved.hands) || 0;
      const migratedOutcomes = countOutcomesFromHistory(balanceHistory, hands);
      const hasSavedOutcomes = [saved.wins, saved.pushes, saved.losses].every(value => Number.isFinite(Number(value)));
      return {
        ...emptyPlay(),
        balance: Number(saved.balance) || 0,
        optimalBalance: Number(saved.optimalBalance) || 0,
        balanceHistory,
        optimalHistory,
        hands,
        accurateHands: Number(saved.accurateHands) || 0,
        wins: hasSavedOutcomes ? Number(saved.wins) : migratedOutcomes.wins,
        pushes: hasSavedOutcomes ? Number(saved.pushes) : migratedOutcomes.pushes,
        losses: hasSavedOutcomes ? Number(saved.losses) : migratedOutcomes.losses,
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
        wins: p.wins,
        pushes: p.pushes,
        losses: p.losses,
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
  // The First Decision acts on the right-hand 1 wager; the Second Decision acts on the middle 2 wager.
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
    cueText.textContent = actionsActive
      ? (round.stage === 1 ? "Choose First Decision" : "Choose Second Decision")
      : "Choose a Decision";
    cue.append(arrow, cueText);

    const actions = document.createElement("div");
    actions.className = "lir-decision-actions";
    actions.setAttribute("aria-label", actionsActive
      ? (round.stage === 1 ? "First Decision actions" : "Second Decision actions")
      : "Decision actions");
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

  function clearPlayAccuracyIndicator() {
    el.playDecisionIndicator.textContent = "";
    el.playDecisionIndicator.className = "play-decision-indicator";
    el.playDecisionIndicator.setAttribute("aria-label", "");
  }

  function flashPlayAccuracyIndicator(handCorrect) {
    const symbol = handCorrect ? "+" : "−";
    const resultClass = handCorrect ? "correct" : "incorrect";
    const spokenText = handCorrect ? "Hand played accurately" : "Hand included an incorrect decision";

    el.playDecisionIndicator.textContent = symbol;
    el.playDecisionIndicator.setAttribute("aria-label", spokenText);
    el.playDecisionIndicator.className = "play-decision-indicator";
    void el.playDecisionIndicator.offsetWidth;
    el.playDecisionIndicator.classList.add("visible", resultClass, "pulse");
  }

  function startPlayHand() {
    if (state.play.round && !state.play.round.completed) return;
    clearPlayAccuracyIndicator();
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
    const handCorrect = round.correctness.length === 2 && round.correctness.every(Boolean);
    if (handCorrect) p.accurateHands += 1;
    p.balanceHistory.push(p.balance);
    p.optimalHistory.push(p.optimalBalance);
    round.completed = true;

    const net = roundTo(p.balance - round.balanceBefore, 6);
    if (net > 1e-9) p.wins += 1;
    else if (net < -1e-9) p.losses += 1;
    else p.pushes += 1;
    const sign = net > 0 ? "+" : "";
    setPlayMessage(
      `${result.name}: ${sign}${formatUnits(net)} on the hand with ${actualActiveCount} bet${actualActiveCount === 1 ? "" : "s"} riding.`,
      net > 0 ? "win" : net < 0 ? "loss" : "neutral"
    );
    flashPlayAccuracyIndicator(handCorrect);
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
    el.completedHands.textContent = String(p.hands);
    el.playWins.textContent = String(p.wins);
    el.playPushes.textContent = String(p.pushes);
    el.playLosses.textContent = String(p.losses);
    const delta = roundTo(p.optimalBalance - p.balance, 6);
    el.playDeltaSummary.textContent = `Optimal − you: ${deltaLabel(delta)}`;
    el.playDeltaSummary.classList.toggle("behind", delta > 0);
    el.playDeltaSummary.classList.toggle("ahead", delta < 0);
    renderMistakes();
    scheduleBalanceChartDraw();
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

  function scheduleBalanceChartDraw() {
    if (balanceChartFrame) return;
    balanceChartFrame = window.requestAnimationFrame(() => {
      balanceChartFrame = 0;
      drawBalanceChart();
    });
  }

  function drawBalanceChart() {
    const canvas = el.playChart;
    if (!canvas || canvas.offsetParent === null) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(280, rect.width);
    const height = Math.max(150, rect.height);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    const actualValues = state.play.balanceHistory.length ? state.play.balanceHistory : [0];
    const optimalValues = state.play.optimalHistory.length ? state.play.optimalHistory : [0];
    const signature = `${pixelWidth}x${pixelHeight}:${state.play.hands}:${state.play.balance}:${state.play.optimalBalance}:${actualValues.length}:${optimalValues.length}`;
    if (signature === lastBalanceChartSignature) return;
    lastBalanceChartSignature = signature;
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const allValues = [...actualValues, ...optimalValues];
    const pointCount = Math.max(actualValues.length, optimalValues.length);
    const min = Math.min(0, ...allValues);
    const max = Math.max(0, ...allValues);
    const spread = Math.max(4, max - min);
    const low = min - spread * .18;
    const high = max + spread * .18;
    const left = 40, right = 12, top = 12, bottom = 12;
    const xAt = index => left + (pointCount === 1 ? 0 : index / (pointCount - 1) * (width - left - right));
    const yAt = value => top + (high - value) / (high - low || 1) * (height - top - bottom);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(232,226,207,.72)";
    ctx.strokeStyle = "rgba(232,226,207,.14)";
    for (let i = 0; i <= 4; i += 1) {
      const value = high - (high - low) * i / 4;
      const y = yAt(value);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      ctx.fillText(String(Math.round(value)), 6, y + 4);
    }
    const zeroY = yAt(0);
    ctx.save();
    ctx.strokeStyle = "rgba(231,200,106,.4)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(left, zeroY); ctx.lineTo(width - right, zeroY); ctx.stroke();
    ctx.restore();

    const buildPath = values => {
      ctx.beginPath();
      values.forEach((value, index) => index ? ctx.lineTo(xAt(index), yAt(value)) : ctx.moveTo(xAt(index), yAt(value)));
    };

    // Draw optimal first so Your play remains visible whenever the lines overlap.
    if (optimalValues.length > 1) {
      buildPath(optimalValues);
      ctx.strokeStyle = "#e7c86a";
      ctx.lineWidth = 2.25;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    if (actualValues.length > 1) {
      const drawClippedLine = (clipTop, clipBottom, color) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, clipTop, width, Math.max(0, clipBottom - clipTop));
        ctx.clip();
        buildPath(actualValues);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      };
      drawClippedLine(0, zeroY, "#4ccf79");
      drawClippedLine(zeroY, height, "#ff6b6b");
    }

    const actualLast = actualValues[actualValues.length - 1];
    const optimalLast = optimalValues[optimalValues.length - 1];
    ctx.fillStyle = "#e7c86a";
    ctx.beginPath(); ctx.arc(xAt(optimalValues.length - 1), yAt(optimalLast), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = actualLast >= 0 ? "#4ccf79" : "#ff6b6b";
    ctx.beginPath(); ctx.arc(xAt(actualValues.length - 1), yAt(actualLast), 4, 0, Math.PI * 2); ctx.fill();
    canvas.setAttribute("aria-label", `Line chart comparing your bankroll with optimal play. Current optimal-minus-you difference: ${deltaLabel(optimalLast - actualLast)}.`);
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
    stageLabel.textContent = stage === 1 ? "First Decision" : "Second Decision";
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
    if (mode === "play") scheduleBalanceChartDraw();
    requestAnimationFrame(alignAllBetGrids);
  }

  function resetPlay() {
    if (!window.confirm("Reset the bankroll, accuracy, chart, and incorrect-decision history?")) return;
    state.play = emptyPlay();
    clearPlayAccuracyIndicator();
    savePlay();
    setPlayMessage("Press Deal to begin.");
    renderPlay();
  }

  function roundTo(value, digits) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function formatNumber(value) {
    const rounded = roundTo(Number(value), 6);
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  function deltaLabel(value) {
    const rounded = roundTo(Number(value), 6);
    if (rounded === 0) return "0";
    return `${rounded > 0 ? "+" : "−"}${formatNumber(Math.abs(rounded))}`;
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

  if ("ResizeObserver" in window && el.playChart) {
    new ResizeObserver(() => {
      if (state.mode === "play") scheduleBalanceChartDraw();
    }).observe(el.playChart);
  } else {
    window.addEventListener("resize", () => {
      if (state.mode === "play") scheduleBalanceChartDraw();
    }, { passive: true });
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    let waitingWorker = null;
    let waitingRegistration = null;
    let reloadingForUpdate = false;

    const hideUpdateNotice = () => {
      waitingWorker = null;
      waitingRegistration = null;
      if (el.updateNotice) el.updateNotice.classList.add("hidden");
      if (el.reloadUpdate) {
        el.reloadUpdate.disabled = false;
        el.reloadUpdate.textContent = "Reload Now";
      }
    };

    const workerVersion = worker => new Promise(resolve => {
      if (!worker) {
        resolve(null);
        return;
      }
      const channel = new MessageChannel();
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value ? String(value) : null);
      };
      const timer = window.setTimeout(() => finish(null), 1200);
      channel.port1.onmessage = event => finish(event.data && event.data.version);
      try {
        worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
      } catch {
        finish(null);
      }
    });

    const numericVersion = value => {
      const parsed = Number.parseInt(String(value || "").replace(/\D+/g, ""), 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const considerWaitingWorker = async (registration, worker) => {
      if (!worker || worker.state !== "installed") return;
      const version = await workerVersion(worker);
      const pageVersion = numericVersion(APP_VERSION);
      const candidateVersion = numericVersion(version);

      if (candidateVersion === pageVersion) {
        hideUpdateNotice();
        worker.postMessage({ type: "SKIP_WAITING" });
        return;
      }

      if (candidateVersion === null || (pageVersion !== null && candidateVersion < pageVersion)) {
        hideUpdateNotice();
        return;
      }

      if (!navigator.serviceWorker.controller || !el.updateNotice) return;
      waitingWorker = worker;
      waitingRegistration = registration;
      el.updateNotice.classList.remove("hidden");
    };

    const watchedWorkers = new WeakSet();
    const watchWorker = (registration, worker) => {
      if (!worker || watchedWorkers.has(worker)) return;
      watchedWorkers.add(worker);
      const checkState = () => {
        if (worker.state === "installed") {
          considerWaitingWorker(registration, registration.waiting || worker);
        }
      };
      worker.addEventListener("statechange", checkState);
      checkState();
    };

    const watchRegistration = registration => {
      if (registration.waiting) considerWaitingWorker(registration, registration.waiting);
      watchWorker(registration, registration.installing);
      registration.addEventListener("updatefound", () => watchWorker(registration, registration.installing));
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${APP_VERSION}`, { updateViaCache: "none" });
        watchRegistration(registration);
        registration.update().catch(() => {});
      } catch (error) {
        console.warn("Could not register the Let It Ride service worker.", error);
      }
    };

    if (el.reloadUpdate) {
      el.reloadUpdate.addEventListener("click", () => {
        const worker = (waitingRegistration && waitingRegistration.waiting) || waitingWorker;
        el.reloadUpdate.disabled = true;
        el.reloadUpdate.textContent = "Reloading…";

        if (!worker) {
          window.location.reload();
          return;
        }

        const reloadOnce = () => {
          if (reloadingForUpdate) return;
          reloadingForUpdate = true;
          window.location.reload();
        };

        navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") reloadOnce();
        });

        try {
          worker.postMessage({ type: "SKIP_WAITING" });
        } catch {
          reloadOnce();
          return;
        }
        window.setTimeout(reloadOnce, 2500);
      });
    }

    window.addEventListener("load", () => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(registerServiceWorker, { timeout: 2500 });
      else window.setTimeout(registerServiceWorker, 750);
    }, { once: true });
  }

})();
