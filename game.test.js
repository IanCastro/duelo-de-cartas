const game = require("./game.js");
const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function test(name, callback) {
  try {
    callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

function createStartedState(config = {}) {
  const playerControllers = Array.isArray(config)
    ? config
    : (config.playerControllers || [game.PLAYER_CONTROLLER_TYPES.HUMAN, game.PLAYER_CONTROLLER_TYPES.AI]);
  const deckMode = Array.isArray(config)
    ? game.DECK_MODES.SHARED
    : (config.deckMode || game.DECK_MODES.SHARED);
  const state = game.createInitialState();
  state.playerControllers = [...playerControllers];
  state.deckMode = deckMode;
  return game.startConfiguredMatch(state);
}

function snapshotStateForValidation(state) {
  return JSON.parse(JSON.stringify({
    deck: state.deck,
    discardPile: state.discardPile,
    playerDecks: state.playerDecks,
    playerDiscardPiles: state.playerDiscardPiles,
    currentPlayerIndex: state.currentPlayerIndex,
    playerControllers: state.playerControllers,
    deckMode: state.deckMode,
    isMatchStarted: state.isMatchStarted,
    isLibraryOpen: state.isLibraryOpen,
    isRulesOpen: state.isRulesOpen,
    isLogOpen: state.isLogOpen,
    selectedAttackerId: state.selectedAttackerId,
    selectedEffectCard: state.selectedEffectCard,
    winnerPlayerId: state.winner ? state.winner.id : null,
    turnNumber: state.turnNumber,
    players: state.players
  }));
}

function countCardInstanceOccurrences(state, instanceId) {
  const piles = [
    state.deck,
    state.discardPile,
    state.playerDecks?.[0],
    state.playerDecks?.[1],
    state.playerDiscardPiles?.[0],
    state.playerDiscardPiles?.[1]
  ];
  let total = 0;

  piles.forEach((pile) => {
    if (Array.isArray(pile)) {
      total += pile.filter((card) => card.instanceId === instanceId).length;
    }
  });

  state.players.forEach((player) => {
    total += player.hand.filter((card) => card.instanceId === instanceId).length;
    total += player.board.filter((card) => card.instanceId === instanceId).length;
    total += player.supportZone.filter((card) => card.instanceId === instanceId).length;
  });

  if (state.selectedEffectCard?.instanceId === instanceId) {
    total += 1;
  }

  return total;
}

test("initial state opens in pre-game with default player controllers", () => {
  const state = game.createInitialState();

  assert(state.isMatchStarted === false, "the page should open in pre-game");
  assert(state.players[0].vida === 40, "player 1 should start at max health");
  assert(state.players[1].vida === 40, "player 2 should start at max health");
  assert(state.players[0].hand.length === 0, "player 1 hand should stay empty before Start");
  assert(state.players[1].hand.length === 0, "player 2 hand should stay empty before Start");
  assert(state.players[0].manaAtual === 0 && state.players[0].manaMax === 0, "player 1 should not have mana before Start");
  assert(state.players[1].manaAtual === 0 && state.players[1].manaMax === 0, "player 2 should not have mana before Start");
  assert(Array.isArray(state.playerControllers), "the game should store controller config by player");
  assert(state.playerControllers[0] === game.PLAYER_CONTROLLER_TYPES.HUMAN, "player 1 should default to human");
  assert(state.playerControllers[1] === game.PLAYER_CONTROLLER_TYPES.AI, "player 2 should default to ai");
  assert(state.deckMode === game.DECK_MODES.SEPARATE, "pre-game should default to separate decks");
  assert(Array.isArray(state.log), "game should keep a log array");
  assert(state.log.length === 0, "pre-game should not start with match log entries");
});

test("start builds the initial match from the configured players", () => {
  const state = game.startConfiguredMatch(game.createInitialState());

  assert(state.isMatchStarted === true, "Start should create an active match");
  assert(state.deckMode === game.DECK_MODES.SEPARATE, "Start should respect the default separate deck mode");
  assert(state.players[0].vida === 40, "player 1 should start at max health");
  assert(state.players[1].vida === 40, "player 2 should start at max health");
  assert(state.players[0].hand.length === 4, "player 1 should draw 4 starting cards");
  assert(state.players[1].hand.length === 4, "player 2 should draw 4 starting cards");
  assert(game.getPlayerDeckCount(state, 0) === 12, "player 1 should keep 12 cards in a separate deck after the opening hand");
  assert(game.getPlayerDeckCount(state, 1) === 12, "player 2 should keep 12 cards in a separate deck after the opening hand");
  assert(state.players[0].manaAtual === 1 && state.players[0].manaMax === 1, "first player should start with 1 mana");
  assert(state.players[1].manaAtual === 0 && state.players[1].manaMax === 1, "second player should open the match showing 0/1 mana");
  assert(Array.isArray(state.log), "game should keep a log array");
  assert(state.log.length === 1, "log should start with the initial setup entry");
  assert(state.log[0].numero === 1, "first log line should start at action 1");
  assert(state.log[0].texto.includes("Partida iniciada"), "first log line should describe the start of the match");
  assert(state.log[0].event.kind === game.LOG_EVENT_TYPES.MATCH_START, "first log line should carry a structured match-start event");
});

test("session player controllers control how new matches start", () => {
  const previousControllers = game.getSessionPlayerControllers();

  try {
    game.setSessionPlayerController(0, game.PLAYER_CONTROLLER_TYPES.AI);
    game.setSessionPlayerController(1, game.PLAYER_CONTROLLER_TYPES.HUMAN);
    const humanMatch = game.createInitialState();
    assert(humanMatch.playerControllers[0] === game.PLAYER_CONTROLLER_TYPES.AI, "new pre-game states should use the session player 1 selection");
    assert(humanMatch.playerControllers[1] === game.PLAYER_CONTROLLER_TYPES.HUMAN, "new pre-game states should use the session player 2 selection");

    game.setSessionPlayerController(0, game.PLAYER_CONTROLLER_TYPES.HUMAN);
    game.setSessionPlayerController(1, game.PLAYER_CONTROLLER_TYPES.AI);
    const aiMatch = game.createInitialState();
    assert(aiMatch.playerControllers[0] === game.PLAYER_CONTROLLER_TYPES.HUMAN, "changing the session player 1 selection should affect the next new match");
    assert(aiMatch.playerControllers[1] === game.PLAYER_CONTROLLER_TYPES.AI, "changing the session player 2 selection should affect the next new match");
  } finally {
    game.setSessionPlayerController(0, previousControllers[0]);
    game.setSessionPlayerController(1, previousControllers[1]);
  }
});

test("session deck mode controls how new matches start", () => {
  const previousDeckMode = game.getSessionDeckMode();

  try {
    game.setSessionDeckMode(game.DECK_MODES.SHARED);
    const sharedMatch = game.createInitialState();
    assert(sharedMatch.deckMode === game.DECK_MODES.SHARED, "new pre-game states should use the session deck mode");

    game.setSessionDeckMode(game.DECK_MODES.SEPARATE);
    const separateMatch = game.createInitialState();
    assert(separateMatch.deckMode === game.DECK_MODES.SEPARATE, "changing the session deck mode should affect the next new match");
  } finally {
    game.setSessionDeckMode(previousDeckMode);
  }
});

test("new game keeps the currently open side menu", () => {
  const previousState = createStartedState();
  previousState.isRulesOpen = true;
  previousState.isLibraryOpen = false;
  previousState.isLogOpen = false;
  previousState.selectedLogEntryId = 1;
  previousState.isWinnerModalOpen = true;

  const restartedState = game.createRestartState(previousState);

  assert(restartedState.isRulesOpen === true, "restart should preserve the open rules menu");
  assert(restartedState.isLibraryOpen === false, "restart should keep unrelated menus closed");
  assert(restartedState.isLogOpen === false, "restart should keep unrelated menus closed");
  assert(restartedState.selectedLogEntryId === null, "restart should clear any selected history line");
  assert(restartedState.isWinnerModalOpen === false, "restart should close the winner modal in the new game");
  assert(restartedState.isMatchStarted === false, "restart should return to pre-game");
  assert(restartedState.log.length === 0, "restart should clear the old match log");
});

test("new game preserves the configured controllers", () => {
  const previousState = createStartedState();
  previousState.playerControllers = [game.PLAYER_CONTROLLER_TYPES.AI, game.PLAYER_CONTROLLER_TYPES.HUMAN];

  const restartedState = game.createRestartState(previousState);

  assert(restartedState.playerControllers[0] === game.PLAYER_CONTROLLER_TYPES.AI, "restart should preserve player 1 controller");
  assert(restartedState.playerControllers[1] === game.PLAYER_CONTROLLER_TYPES.HUMAN, "restart should preserve player 2 controller");
});

test("new game preserves the configured deck mode", () => {
  const previousState = createStartedState({ deckMode: game.DECK_MODES.SEPARATE });
  previousState.deckMode = game.DECK_MODES.SHARED;

  const restartedState = game.createRestartState(previousState);

  assert(restartedState.deckMode === game.DECK_MODES.SHARED, "restart should preserve the configured deck mode");
});

test("pre-game blocks shortcuts and gameplay actions until Start", () => {
  const state = game.createInitialState();

  assert(game.handleShortcutAction(state, "c") === false, "pre-game should block draw shortcuts");
  assert(game.handleShortcutAction(state, "e") === false, "pre-game should block end-turn shortcuts");
  assert(game.attemptEndTurn(state) === false, "pre-game should not allow ending turns");
  assert(game.drawTurnCard(state, 0) === null, "pre-game should not allow drawing cards");
});

test("starting with player 1 as ai makes the ai open the match", () => {
  const startedState = createStartedState([game.PLAYER_CONTROLLER_TYPES.AI, game.PLAYER_CONTROLLER_TYPES.HUMAN]);

  assert(startedState.isMatchStarted === true, "Start should still create the match");
  assert(game.isAiControlledPlayer(startedState, 0) === true, "player 1 should be controlled by the ai");
  assert(game.isAiTurnActive(startedState) === true, "the opening turn should be flagged as an ai turn");
});

test("starting with both players as ai enables ai vs ai", () => {
  const startedState = createStartedState([game.PLAYER_CONTROLLER_TYPES.AI, game.PLAYER_CONTROLLER_TYPES.AI]);

  assert(game.isAiControlledPlayer(startedState, 0) === true, "player 1 should be ai-controlled");
  assert(game.isAiControlledPlayer(startedState, 1) === true, "player 2 should be ai-controlled");
  assert(game.isAiEnabled(startedState) === true, "ai should stay enabled when both players are configured as ai");
  assert(game.isAiVsAiMatch(startedState) === true, "two ai controllers should be recognized as an ai-vs-ai match");
});

test("ai vs ai can be paused and resumed", () => {
  const state = createStartedState([game.PLAYER_CONTROLLER_TYPES.AI, game.PLAYER_CONTROLLER_TYPES.AI]);

  assert(game.isAiTurnActive(state) === true, "ai vs ai should start on an ai turn");

  const paused = game.toggleAiVsAiPause(state);
  assert(paused === true, "ai vs ai pause toggle should succeed during an active ai-vs-ai match");
  assert(state.isAiVsAiPaused === true, "pause toggle should mark the match as paused");
  assert(state.aiStepText === "IA x IA pausado.", "pausing should expose a clear paused status");

  const actionWhilePaused = game.getNextAiAction(state);
  assert(actionWhilePaused === null, "paused ai-vs-ai should stop producing automatic actions");

  const resumed = game.toggleAiVsAiPause(state);
  assert(resumed === true, "ai vs ai resume toggle should succeed");
  assert(state.isAiVsAiPaused === false, "resume should clear the paused state");
  assert(state.aiStepText === "IA retomou a partida.", "resuming should expose a clear resume status");
});

test("pause toggle is ignored outside ai vs ai", () => {
  const state = createStartedState([game.PLAYER_CONTROLLER_TYPES.HUMAN, game.PLAYER_CONTROLLER_TYPES.AI]);

  const toggled = game.toggleAiVsAiPause(state);

  assert(toggled === false, "pause toggle should do nothing when the match is not ai vs ai");
  assert(state.isAiVsAiPaused === false, "non-ai-vs-ai matches should stay unpaused");
});

test("mana grows by turn up to the cap and refills", () => {
  const state = createStartedState();

  game.endTurn(state);
  assert(state.players[1].manaAtual === 2 && state.players[1].manaMax === 2, "player 2 should get 2 mana on first turn");

  game.endTurn(state);
  assert(state.players[0].manaAtual === 2 && state.players[0].manaMax === 2, "player 1 should reach 2 mana on next round");

  game.endTurn(state);
  assert(state.players[1].manaAtual === 3 && state.players[1].manaMax === 3, "player 2 should stay one mana ahead on the second turn");

  for (let i = 0; i < 10; i += 1) {
    game.endTurn(state);
  }

  assert(state.players[state.currentPlayerIndex].manaMax <= game.MAX_MANA, "mana should never exceed the cap");
});

test("drawing spends mana and fails without enough resource", () => {
  const state = createStartedState();
  const deckBeforeDraw = state.deck.length;

  const drawResult = game.drawTurnCard(state, 0);
  const secondDraw = game.drawTurnCard(state, 0);

  assert(drawResult !== null, "first draw should succeed");
  assert(state.players[0].manaAtual === 0, "draw should cost 1 mana");
  assert(state.deck.length === deckBeforeDraw - 1, "deck should shrink after buying a card");
  assert(secondDraw === null, "second draw should fail without mana");
});

test("separate deck mode draws from the current player's own deck", () => {
  const state = createStartedState({ deckMode: game.DECK_MODES.SEPARATE });
  const playerOneDeckBeforeDraw = game.getPlayerDeckCount(state, 0);
  const playerTwoDeckBeforeDraw = game.getPlayerDeckCount(state, 1);

  const drawResult = game.drawTurnCard(state, 0);

  assert(drawResult !== null, "draw should still succeed in separate deck mode");
  assert(game.getPlayerDeckCount(state, 0) === playerOneDeckBeforeDraw - 1, "player 1 should draw from their own deck");
  assert(game.getPlayerDeckCount(state, 1) === playerTwoDeckBeforeDraw, "player 2 deck should stay untouched by player 1 draw");
});

test("shared deck mode still uses the global deck of 32 cards", () => {
  const state = createStartedState({ deckMode: game.DECK_MODES.SHARED });

  assert(state.deckMode === game.DECK_MODES.SHARED, "helper should be able to start a shared-deck match");
  assert(state.deck.length === 24, "shared deck should keep a single common pile after both opening hands");
  assert(game.getPlayerDeckTotal(state) === 32, "shared mode should keep the global total size");
});

test("separate deck mode sends discarded cards to the owner's discard pile", () => {
  const state = createStartedState({ deckMode: game.DECK_MODES.SEPARATE });
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "effect-1",
    instanceId: "effect-1",
    nome: "Raio Arcano",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];
  state.players[1].board = [{
    id: "def",
    instanceId: "def",
    nome: "Defensora",
    categoria: "unidade",
    custo: 2,
    ataque: 1,
    vida: 2,
    vidaBase: 2,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  game.playCard(state, 0, "effect-1");
  game.resolveEffectTarget(state, 0, "unit", "def");

  assert(state.playerDiscardPiles[0].length === 1, "the effect should go to player 1 discard pile");
  assert(state.playerDiscardPiles[1].length === 1, "the defeated unit should go to player 2 discard pile");
  assert(state.discardPile.length === 0, "the shared discard should stay empty in separate mode");
});

test("drawing is blocked while an attack is being aimed", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 1,
    ataque: 2,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  game.selectAttacker(state, 0, "atk");
  const deckBeforeDraw = state.deck.length;

  const drawResult = game.drawTurnCard(state, 0);

  assert(drawResult === null, "draw should not happen while an attacker is selected");
  assert(state.deck.length === deckBeforeDraw, "blocked draw should not change the deck");
});

test("keyboard shortcut c buys a card when the action is available", () => {
  const state = createStartedState();
  const handBeforeDraw = state.players[0].hand.length;
  const deckBeforeDraw = state.deck.length;

  const handled = game.handleShortcutAction(state, "c");

  assert(handled === true, "shortcut should trigger the draw action");
  assert(state.players[0].hand.length === handBeforeDraw + 1, "shortcut draw should add a card to hand");
  assert(state.deck.length === deckBeforeDraw - 1, "shortcut draw should consume one deck card");
  assert(state.players[0].manaAtual === 0, "shortcut draw should still spend mana");
});

test("keyboard shortcut a attacks the rival player with the selected unit", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 1,
    ataque: 3,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  game.selectAttacker(state, 0, "atk");

  const handled = game.handleShortcutAction(state, "a");

  assert(handled === true, "shortcut should trigger the attack");
  assert(state.players[1].vida === 37, "shortcut attack should hit the rival player");
  assert(state.players[0].board[0].jaAtacouNoTurno === true, "shortcut attack should spend the unit attack");
});

test("player header target mode exposes attack and heal player targets", () => {
  const attackState = createStartedState();
  attackState.selectedAttackerId = "atk";

  assert(game.getPlayerHeaderTargetMode(attackState, 0) === null, "own header should not be attackable");
  assert(game.getPlayerHeaderTargetMode(attackState, 1) === "attack", "enemy header should become an attack target");

  const healState = createStartedState();
  healState.players[0].vida = 30;
  healState.selectedEffectCard = {
    efeito: "cura_direta"
  };

  assert(game.getPlayerHeaderTargetMode(healState, 0) === "heal", "current player header should become a heal target");
  assert(game.getPlayerHeaderTargetMode(healState, 1) === null, "opponent header should not become a heal target");
});

test("player header resolution uses explicit target clicks", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].vida = 34;
  state.players[0].hand = [{
    id: "heal",
    instanceId: "heal",
    nome: "Reparo",
    categoria: "efeito",
    custo: 1,
    efeito: "cura_direta",
    valor: 6,
    descricao: ""
  }];

  game.playCard(state, 0, "heal");
  const resolved = game.resolvePlayerHeaderTarget(state, 0);

  assert(resolved === true, "clicking the current player header should resolve healing");
  assert(state.players[0].vida === 40, "header resolution should heal the current player");
  assert(state.selectedEffectCard === null, "healing should leave target mode after resolving");
});

test("keyboard shortcut e ends the turn", () => {
  const state = createStartedState();

  const handled = game.handleShortcutAction(state, "e");

  assert(handled === true, "shortcut should end the turn");
  assert(state.currentPlayerIndex === 1, "turn should pass to the next player");
  assert(state.players[1].manaAtual === 2, "next player should start with refreshed mana");
});

test("keyboard shortcuts are blocked during the ai-controlled turn", () => {
  const state = createStartedState();
  const handBeforeDraw = state.players[1].hand.length;
  const deckBeforeDraw = state.deck.length;

  state.currentPlayerIndex = 1;
  state.players[1].manaAtual = 2;
  state.players[1].manaMax = 2;

  const handled = game.handleShortcutAction(state, "c");

  assert(handled === false, "human shortcuts should be blocked while the AI controls the turn");
  assert(state.players[1].hand.length === handBeforeDraw, "blocked AI turn shortcuts should not change the hand");
  assert(state.deck.length === deckBeforeDraw, "blocked AI turn shortcuts should not draw from the deck");
});

test("keyboard shortcut escape cancels a prepared effect and refunds mana", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 3;
  state.players[0].manaMax = 3;
  state.players[0].hand = [{
    id: "effect-1",
    instanceId: "effect-1",
    nome: "Raio Arcano",
    categoria: "efeito",
    custo: 2,
    efeito: "dano_direto",
    valor: 4,
    descricao: ""
  }];

  game.playCard(state, 0, "effect-1");
  const handled = game.handleShortcutAction(state, "Escape");

  assert(handled === true, "escape should cancel the pending effect");
  assert(state.selectedEffectCard === null, "escape should clear the selected effect");
  assert(state.players[0].manaAtual === 3, "escape should refund the spent mana");
  assert(state.players[0].hand.length === 1, "escape should return the card to the hand");
});

test("keyboard shortcut a does not auto-heal when repair is waiting for an explicit target", () => {
  const state = createStartedState();
  state.players[0].vida = 32;
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "heal",
    instanceId: "heal",
    nome: "Reparo Rapido",
    categoria: "efeito",
    custo: 1,
    efeito: "cura_direta",
    valor: 6,
    descricao: ""
  }];

  game.playCard(state, 0, "heal");
  const handled = game.handleShortcutAction(state, "a");

  assert(handled === false, "shortcut should not resolve healing automatically");
  assert(state.players[0].vida === 32, "healing should wait for an explicit target click");
  assert(state.selectedEffectCard !== null, "repair should remain armed until the player chooses a target");
});

test("keyboard shortcuts still work when focus is on a button", () => {
  const state = createStartedState();
  const handBeforeDraw = state.players[0].hand.length;

  const handled = game.handleShortcutAction(state, "c", {
    target: { tagName: "button" }
  });

  assert(handled === true, "shortcut should still work after a button keeps focus");
  assert(state.players[0].hand.length === handBeforeDraw + 1, "button focus should not block the shortcut action");
});

test("keyboard shortcuts ignore editable targets", () => {
  const state = createStartedState();
  const handBeforeDraw = state.players[0].hand.length;

  const handled = game.handleShortcutAction(state, "c", {
    target: { tagName: "input" }
  });

  assert(handled === false, "shortcut should stay blocked inside editable controls");
  assert(state.players[0].hand.length === handBeforeDraw, "editable focus should not change the game state");
});

test("playing a unit spends mana and the unit can attack immediately", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 3;
  state.players[0].manaMax = 3;
  state.players[0].hand = [{
    id: "u",
    instanceId: "u",
    nome: "Teste Unidade",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 3,
    vidaBase: 3,
    descricao: ""
  }];

  const played = game.playCard(state, 0, "u");

  assert(played === true, "unit should be playable");
  assert(state.players[0].manaAtual === 1, "unit cost should reduce mana");
  assert(state.players[0].board.length === 1, "unit should move to board");
  assert(state.players[0].board[0].podeAgir === true, "new unit should be ready immediately");
  assert(state.players[0].board[0].jaAtacouNoTurno === false, "new unit should still have its attack available");
});

test("player can play a card and still attack with a ready unit in the same turn", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 6;
  state.players[0].manaMax = 6;
  state.players[0].hand = [{
    id: "s",
    instanceId: "s",
    nome: "Estandarte",
    categoria: "suporte",
    custo: 5,
    efeito: "aura_ataque",
    valor: 1,
    descricao: ""
  }];
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 1,
    ataque: 2,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  const played = game.playCard(state, 0, "s");
  const selected = game.selectAttacker(state, 0, "atk");
  const attacked = game.attackTarget(state, 0, "player");

  assert(played === true, "support should be playable");
  assert(selected === true, "ready unit should still be selectable after playing a card");
  assert(attacked === true, "unit should still attack in the same turn");
  assert(state.players[1].vida === 37, "support aura should buff the attack");
  assert(game.getUnitAttackBreakdown(state.players[0].board[0], state.players[0]).bonus === 1, "attack breakdown should expose support bonus");
  assert(state.players[0].manaAtual === 1, "support should use the new cost");
});

test("each unit can attack only once per turn", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 1,
    ataque: 3,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  game.selectAttacker(state, 0, "atk");
  const firstAttack = game.attackTarget(state, 0, "player");
  const reselect = game.selectAttacker(state, 0, "atk");

  assert(firstAttack === true, "first attack should succeed");
  assert(reselect === false, "unit should not attack twice in the same turn");
});

test("newly played unit can attack on the same turn but only once", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 3;
  state.players[0].manaMax = 3;
  state.players[0].hand = [{
    id: "u",
    instanceId: "u",
    nome: "Pressao Inicial",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 3,
    vidaBase: 3,
    descricao: ""
  }];

  game.playCard(state, 0, "u");
  const selected = game.selectAttacker(state, 0, "u");
  const attacked = game.attackTarget(state, 0, "player");
  const selectedAgain = game.selectAttacker(state, 0, "u");

  assert(selected === true, "fresh unit should be selectable");
  assert(attacked === true, "fresh unit should attack on the same turn");
  assert(selectedAgain === false, "fresh unit should still respect one attack per turn");
});

test("selecting the same ready unit twice cancels the attack selection", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 1,
    ataque: 2,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  const firstSelect = game.selectAttacker(state, 0, "atk");
  const secondSelect = game.selectAttacker(state, 0, "atk");

  assert(firstSelect === true, "first click should arm the attacker");
  assert(secondSelect === true, "second click should toggle the attacker off");
  assert(state.selectedAttackerId === null, "second click should clear the attack selection");
});

test("deck size grows with 4 copies of each card", () => {
  const deck = game.createDeck();

  assert(deck.length === game.CARD_LIBRARY.length * 4, "deck should have four copies of each card");
  assert(deck.length === game.getTotalDeckSize(), "deck size helper should match the real deck size");
});

test("deck card counts report how many copies remain in the baralho", () => {
  const counts = game.getDeckCardCounts([
    { id: "unit-1" },
    { id: "unit-1" },
    { id: "support-1" }
  ]);

  assert(counts["unit-1"] === 2, "count helper should accumulate repeated cards");
  assert(counts["support-1"] === 1, "count helper should track different card ids");
  assert((counts["effect-1"] || 0) === 0, "missing cards should read as zero when consumed by the UI");
});

test("group hand by category keeps cards in their correct columns", () => {
  const grouped = game.groupHandByCategory([
    { categoria: "efeito", nome: "Raio" },
    { categoria: "unidade", nome: "Berserker", custo: 5 },
    { categoria: "suporte", nome: "Estandarte" },
    { categoria: "unidade", nome: "Escudeiro", custo: 2 },
    { categoria: "unidade", nome: "Guardiao", custo: 4 }
  ]);

  assert(grouped.unidade.length === 3, "unit cards should be grouped together");
  assert(grouped.suporte.length === 1, "support cards should be grouped together");
  assert(grouped.efeito.length === 1, "effect cards should be grouped together");
  assert(grouped.unidade[0].nome === "Escudeiro", "units should be ordered from lowest to highest cost");
  assert(grouped.unidade[1].nome === "Guardiao", "units with middle costs should stay in the middle");
  assert(grouped.unidade[2].nome === "Berserker", "higher cost units should appear last in the hand column");
});

test("ai helper follows the configured controller on each seat", () => {
  const state = createStartedState();

  assert(game.isAiEnabled(state) === true, "ai mode should be enabled by default");
  assert(game.isAiControlledPlayer(state, 0) === false, "player 1 should stay human in ai mode");
  assert(game.isAiControlledPlayer(state, 1) === true, "player 2 should be controlled by the ai in ai mode");

  state.playerControllers = [game.PLAYER_CONTROLLER_TYPES.AI, game.PLAYER_CONTROLLER_TYPES.HUMAN];
  assert(game.isAiControlledPlayer(state, 0) === true, "player 1 should become ai-controlled when configured as ai");
  assert(game.isAiControlledPlayer(state, 1) === false, "player 2 should stop being ai-controlled when configured as human");

  state.playerControllers = [game.PLAYER_CONTROLLER_TYPES.HUMAN, game.PLAYER_CONTROLLER_TYPES.HUMAN];
  assert(game.isAiEnabled(state) === false, "human vs human should disable the ai");
  assert(game.isAiControlledPlayer(state, 1) === false, "player 2 should stop being ai-controlled in human mode");
});

test("ai action helper prioritizes killing an enemy unit before attacking the player", () => {
  const state = createStartedState();
  state.currentPlayerIndex = 1;
  state.players[1].board = [{
    id: "ai-attacker",
    instanceId: "ai-attacker",
    nome: "Guardiao de Ferro",
    categoria: "unidade",
    custo: 4,
    ataque: 2,
    vida: 8,
    vidaBase: 8,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  state.players[0].board = [{
    id: "enemy-threat",
    instanceId: "enemy-threat",
    nome: "Arqueira Nebulosa",
    categoria: "unidade",
    custo: 3,
    ataque: 3,
    vida: 2,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  const action = game.getNextAiAction(state);

  assert(action.type === "attack-unit", "the ai should remove a killable enemy unit before going face");
  assert(action.targetInstanceId === "enemy-threat", "the ai should focus the threatening enemy unit");
});

test("ai action helper uses exposed support targets only when no enemy units remain", () => {
  const state = createStartedState();
  state.currentPlayerIndex = 1;
  state.players[1].board = [{
    id: "ai-attacker",
    instanceId: "ai-attacker",
    nome: "Escudeiro Solar",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 5,
    vidaBase: 5,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  state.players[0].supportZone = [{
    id: "support-1",
    instanceId: "support-1-a",
    nome: "Estandarte de Guerra",
    categoria: "suporte",
    custo: 5,
    efeito: "aura_ataque",
    valor: 1,
    descricao: "",
    estado: "suporte"
  }];

  let action = game.getNextAiAction(state);
  assert(action.type === "attack-support", "the ai should hit exposed supports when the field is clear");

  state.players[0].board = [{
    id: "enemy-blocker",
    instanceId: "enemy-blocker",
    nome: "Escudeiro Solar",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 3,
    vidaBase: 5,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  action = game.getNextAiAction(state);
  assert(action.type === "attack-unit", "the ai should stop targeting supports when enemy units are still in play");
});

test("ai action helper avoids wasting repair on full targets", () => {
  const state = createStartedState();
  state.currentPlayerIndex = 1;
  state.players[1].manaAtual = 1;
  state.players[1].manaMax = 1;
  state.players[1].hand = [{
    id: "effect-2",
    instanceId: "effect-2-a",
    nome: "Reparo Rapido",
    categoria: "efeito",
    custo: 1,
    efeito: "cura_direta",
    valor: 6,
    descricao: ""
  }];
  state.deck = [];

  const action = game.getNextAiAction(state);

  assert(action.type === "end-turn", "the ai should not spend repair when every target is already at full life");
});

test("ai action helper only buys a card when no stronger play exists", () => {
  const state = createStartedState();
  state.currentPlayerIndex = 1;
  state.players[1].manaAtual = 1;
  state.players[1].manaMax = 1;
  state.players[1].hand = [];
  state.players[1].board = [];
  state.players[0].board = [];
  state.players[0].supportZone = [];
  state.deck = [{
    id: "unit-1",
    instanceId: "unit-1-a",
    nome: "Escudeiro Solar",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 5,
    vidaBase: 5,
    descricao: ""
  }];

  const action = game.getNextAiAction(state);

  assert(action.type === "draw-card", "the ai should buy a card only after exhausting stronger plays");
});

test("ai step does not run outside the ai-controlled turn", () => {
  const state = createStartedState();

  const action = game.performAiStep(state);

  assert(action === null, "the ai should not take actions during the human turn");
});

test("side rail helper reports when any optional panel is open", () => {
  assert(game.isAnySidePanelOpen({
    isLibraryOpen: false,
    isRulesOpen: false,
    isLogOpen: false
  }) === false, "helper should stay false when all optional panels are closed");

  assert(game.isAnySidePanelOpen({
    isLibraryOpen: false,
    isRulesOpen: true,
    isLogOpen: false
  }) === true, "helper should be true when any side panel is open");
});

test("exclusive side panel helper keeps only one menu open at a time", () => {
  const state = createStartedState();

  game.toggleExclusiveSidePanel(state, "library");
  assert(state.isLibraryOpen === true, "library should open");
  assert(state.isRulesOpen === false && state.isLogOpen === false, "other panels should stay closed");

  game.toggleExclusiveSidePanel(state, "log");
  assert(state.isLogOpen === true, "log should become the only open panel");
  assert(state.isLibraryOpen === false && state.isRulesOpen === false, "opening another panel should close the previous one");

  game.toggleExclusiveSidePanel(state, "log");
  assert(state.isLogOpen === false, "clicking the active panel again should close it");
});

test("unit health package matches the new rebalance", () => {
  const escudeiro = game.CARD_LIBRARY.find((card) => card.id === "unit-1");
  const arqueira = game.CARD_LIBRARY.find((card) => card.id === "unit-2");
  const guardiao = game.CARD_LIBRARY.find((card) => card.id === "unit-3");
  const berserker = game.CARD_LIBRARY.find((card) => card.id === "unit-4");

  assert(escudeiro.vidaBase === 5, "Escudeiro Solar should have 5 base life");
  assert(arqueira.vidaBase === 3, "Arqueira Nebulosa should have 3 base life");
  assert(guardiao.vidaBase === 8, "Guardiao de Ferro should have 8 base life");
  assert(berserker.vidaBase === 4, "Berserker Rubro should have 4 base life");
  assert(guardiao.ataque === 2, "Guardiao de Ferro should now have 2 attack");
  assert(escudeiro.custo === 2, "Escudeiro Solar should cost 2");
  assert(arqueira.custo === 3, "Arqueira Nebulosa should cost 3");
  assert(guardiao.custo === 4, "Guardiao de Ferro should cost 4");
  assert(berserker.custo === 5, "Berserker Rubro should cost 5");
});

test("max mana is now 8", () => {
  assert(game.MAX_MANA === 8, "max mana should be raised to 8");
});

test("attack breakdown separates base and bonus", () => {
  const player = {
    supportZone: [{ efeito: "aura_ataque", valor: 2 }]
  };
  const unit = {
    ataque: 3
  };

  const breakdown = game.getUnitAttackBreakdown(unit, player);

  assert(breakdown.base === 3, "base attack should stay separate");
  assert(breakdown.bonus === 2, "bonus attack should be reported separately");
  assert(breakdown.total === 5, "total attack should still be the sum");
});

test("card display data shows dynamic bonus only for units in play", () => {
  const player = {
    supportZone: [{ efeito: "aura_ataque", valor: 1 }]
  };
  const unit = {
    categoria: "unidade",
    estado: "campo",
    ataque: 2,
    vida: 3,
    vidaBase: 3,
    podeAgir: true,
    jaAtacouNoTurno: false
  };

  const display = game.getCardDisplayData(unit, player);

  assert(display.primaryLabel === "ATQ", "display should expose attack label");
  assert(display.primaryValue === "2", "display should expose base attack");
  assert(display.primaryBonus === "+1", "display should expose the live attack bonus");
  assert(display.secondaryLabel === "VIDA", "display should expose life label");
  assert(display.secondaryValue === "3/3", "display should expose current life in the life area");
  assert(display.stateText === "PRONTA", "display should expose unit readiness");
});

test("card display data omits dynamic bonus for cards outside the field", () => {
  const player = {
    supportZone: [{ efeito: "aura_ataque", valor: 2 }]
  };
  const handUnit = {
    categoria: "unidade",
    ataque: 3,
    vida: 2,
    vidaBase: 2
  };

  const display = game.getCardDisplayData(handUnit, player);

  assert(display.primaryLabel === "ATQ", "hand units should still expose attack label");
  assert(display.primaryValue === "3", "hand units should show base attack");
  assert(display.primaryBonus === null, "hand units should not show live bonus before entering the field");
  assert(display.secondaryValue === "2", "hand units should show base life when not in play");
  assert(display.stateText === null, "hand cards should not show field state");
});

test("end turn refreshes next player's units for combat", () => {
  const state = createStartedState();
  state.players[1].board.push({
    id: "u2",
    instanceId: "u2",
    nome: "Dormindo",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: false,
    jaAtacouNoTurno: true
  });

  game.endTurn(state);

  assert(state.currentPlayerIndex === 1, "turn should pass to player 2");
  assert(state.players[1].board[0].podeAgir === true, "next player's unit should be enabled");
  assert(state.players[1].board[0].jaAtacouNoTurno === false, "next player's unit attack should refresh");
});

test("unit can enter and cancel defense in the same turn", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "guard",
    instanceId: "guard",
    nome: "Guardiao",
    categoria: "unidade",
    custo: 4,
    ataque: 2,
    vida: 8,
    vidaBase: 8,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false,
    isDefending: false,
    defenseTurnNumber: null
  }];

  const entered = game.enterDefenseMode(state, 0, "guard");

  assert(entered === true, "defense should be available for a ready allied unit");
  assert(state.players[0].board[0].isDefending === true, "unit should enter defense mode");
  assert(state.players[0].board[0].jaAtacouNoTurno === true, "defense should spend the action for the turn");

  const canceled = game.cancelDefenseMode(state, 0, "guard");

  assert(canceled === true, "defense should be cancelable on the same turn");
  assert(state.players[0].board[0].isDefending === false, "unit should leave defense mode after canceling");
  assert(state.players[0].board[0].jaAtacouNoTurno === false, "canceling defense should restore the action");
});

test("defense halves incoming combat damage rounding up", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 3,
    ataque: 3,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  state.players[1].board = [{
    id: "def",
    instanceId: "def",
    nome: "Defensora",
    categoria: "unidade",
    custo: 2,
    ataque: 1,
    vida: 4,
    vidaBase: 4,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: true,
    isDefending: true,
    defenseTurnNumber: state.turnNumber
  }];

  game.selectAttacker(state, 0, "atk");
  const attacked = game.attackTarget(state, 0, "unit", "def");

  assert(attacked === true, "attack should still resolve against a defending unit");
  assert(state.players[1].board[0].vida === 2, "3 damage should become 2 against defense");
});

test("defense also halves direct damage and expires on the owner's next turn", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "effect-1",
    instanceId: "effect-1",
    nome: "Raio Arcano",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];
  state.players[1].board = [{
    id: "def",
    instanceId: "def",
    nome: "Defensora",
    categoria: "unidade",
    custo: 2,
    ataque: 1,
    vida: 4,
    vidaBase: 4,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: true,
    isDefending: true,
    defenseTurnNumber: state.turnNumber
  }];

  game.playCard(state, 0, "effect-1");
  const resolved = game.resolveEffectTarget(state, 0, "unit", "def");

  assert(resolved === true, "direct damage should still resolve against a defending unit");
  assert(state.players[1].board[0].vida === 2, "direct damage should also be halved against defense");

  game.endTurn(state);
  game.endTurn(state);

  assert(state.players[1].board[0].isDefending === false, "defense should expire at the start of the owner's next turn");
});

test("attack against a unit deals damage and discards it if defeated", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 2,
    ataque: 3,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  state.players[1].board = [{
    id: "def",
    instanceId: "def",
    nome: "Defensora",
    categoria: "unidade",
    custo: 2,
    ataque: 1,
    vida: 2,
    vidaBase: 2,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  const selected = game.selectAttacker(state, 0, "atk");
  const attacked = game.attackTarget(state, 0, "unit", "def");

  assert(selected === true, "attacker should be selectable");
  assert(attacked === true, "attack should resolve");
  assert(state.players[1].board.length === 0, "defeated unit should leave the board");
  assert(state.discardPile.length === 1, "defeated unit should go to discard");
  assert(state.log[state.log.length - 1].texto.includes("derrotou a unidade"), "lethal combat should be recorded in a single log line");
  assert(state.log[state.log.length - 1].event.defeated === true, "lethal combat event should mark the defeated unit");
});

test("unit can attack an enemy support only when there are no enemy units in play", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 2,
    ataque: 3,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  state.players[1].supportZone = [{
    id: "support-1",
    instanceId: "support-1",
    nome: "Estandarte de Guerra",
    categoria: "suporte",
    custo: 4,
    efeito: "aura_ataque",
    valor: 1,
    descricao: "",
    estado: "suporte"
  }];

  game.selectAttacker(state, 0, "atk");
  const attacked = game.attackTarget(state, 0, "support", "support-1");

  assert(attacked === true, "support should be attackable without enemy units protecting it");
  assert(state.players[1].supportZone.length === 0, "destroyed support should leave the support zone");
  assert(state.discardPile.length === 1, "destroyed support should go to discard");
});

test("support cannot be attacked while the opponent still has units in play", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Atacante",
    categoria: "unidade",
    custo: 2,
    ataque: 3,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  state.players[1].board = [{
    id: "guard",
    instanceId: "guard",
    nome: "Guardia",
    categoria: "unidade",
    custo: 2,
    ataque: 1,
    vida: 2,
    vidaBase: 2,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  state.players[1].supportZone = [{
    id: "support-1",
    instanceId: "support-1",
    nome: "Estandarte de Guerra",
    categoria: "suporte",
    custo: 4,
    efeito: "aura_ataque",
    valor: 1,
    descricao: "",
    estado: "suporte"
  }];

  game.selectAttacker(state, 0, "atk");
  const attacked = game.attackTarget(state, 0, "support", "support-1");

  assert(attacked === false, "support should stay protected while enemy units exist");
  assert(state.players[1].supportZone.length === 1, "support should remain in play");
  assert(state.players[0].board[0].jaAtacouNoTurno === false, "failed support attack should not spend the attack");
});

test("direct damage can hit the opposing player", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "e",
    instanceId: "e",
    nome: "Raio",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];

  const played = game.playCard(state, 0, "e");
  const resolved = game.resolveEffectTarget(state, 0, "player");

  assert(played === true, "direct damage card should enter target mode");
  assert(resolved === true, "direct damage should resolve on player");
  assert(state.players[1].vida === 37, "effect should damage opponent immediately");
  assert(state.players[0].manaAtual === 1, "effect should spend mana");
  assert(state.discardPile.length === 1, "effect should go to discard");
});

test("direct damage can hit an enemy unit and discard it if defeated", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "e",
    instanceId: "e",
    nome: "Raio",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];
  state.players[1].board = [{
    id: "def",
    instanceId: "def",
    nome: "Defensora",
    categoria: "unidade",
    custo: 2,
    ataque: 1,
    vida: 2,
    vidaBase: 2,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  game.playCard(state, 0, "e");
  const resolved = game.resolveEffectTarget(state, 0, "unit", "def");

  assert(resolved === true, "direct damage should resolve on enemy unit");
  assert(state.players[1].board.length === 0, "enemy unit should be removed");
  assert(state.discardPile.length === 2, "effect and defeated unit should go to discard");
  assert(state.log[state.log.length - 1].texto.includes("derrotando a unidade"), "lethal direct damage should stay in a single log line");
  assert(state.log[state.log.length - 1].event.defeated === true, "lethal direct damage event should mark the defeated unit");
});

test("direct damage cannot target allied units", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "e",
    instanceId: "e",
    nome: "Raio",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];
  state.players[0].board = [{
    id: "ally",
    instanceId: "ally",
    nome: "Aliada",
    categoria: "unidade",
    custo: 2,
    ataque: 1,
    vida: 2,
    vidaBase: 2,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  game.playCard(state, 0, "e");
  const resolved = game.resolveEffectTarget(state, 0, "unit", "ally");

  assert(resolved === false, "direct damage should not target allied units");
  assert(state.selectedEffectCard !== null, "effect should remain waiting for a valid target");
});

test("direct damage cannot target supports", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "e",
    instanceId: "e",
    nome: "Raio",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];
  state.players[1].supportZone = [{
    id: "support-1",
    instanceId: "support-1",
    nome: "Estandarte de Guerra",
    categoria: "suporte",
    custo: 4,
    efeito: "aura_ataque",
    valor: 1,
    descricao: "",
    estado: "suporte"
  }];

  game.playCard(state, 0, "e");
  const resolved = game.resolveEffectTarget(state, 0, "support", "support-1");

  assert(resolved === false, "direct damage should not resolve on supports");
  assert(state.selectedEffectCard !== null, "invalid support target should keep the effect waiting");
});

test("canceling prepared direct damage refunds mana and returns the card to hand", () => {
  const state = createStartedState();
  const logLengthBefore = state.log.length;
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "e",
    instanceId: "e",
    nome: "Raio Arcano",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];

  game.playCard(state, 0, "e");
  const canceled = game.cancelPendingAction(state, 0);

  const player = state.players[0];
  assert(canceled === true, "cancel helper should report the rollback");
  assert(player.manaAtual === 2, "cancel should refund the spent mana");
  assert(player.hand.length === 1, "cancel should return the direct damage card to hand");
  assert(state.selectedEffectCard === null, "cancel should clear selected effect");
  assert(state.log.length === logLengthBefore, "canceling a prepared effect should not add log noise");
});

test("layout markup removes the cancel button and keeps a pending effect slot", () => {
  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");

  assert(!html.includes("cancel-attack-button"), "cancel button should be removed from the markup");
  assert(html.includes("player-1-pending-slot"), "active player area should expose a pending effect slot");
  assert(html.includes("player-2-pending-slot"), "inactive player area should expose a pending effect slot");
  assert(!html.includes("id=\"mana-display\""), "top bar should no longer render redundant mana");
  assert(!html.includes("class=\"top-game-bar\""), "the old second top bar should be removed from the markup");
  assert(html.includes("id=\"ai-match-strip\""), "the page should expose a minimal ai-vs-ai strip in the top area");
  assert(html.includes("id=\"winner-modal\""), "winner modal markup should exist");
  assert(!html.includes("id=\"history-modal\""), "history preview should no longer use its own modal");
  assert(!html.includes("class=\"history-floating-panel\""), "history preview should no longer render as a floating panel");
  assert(!html.includes("id=\"history-preview-panel\""), "separate history preview markup should be removed");
  assert(!html.includes("id=\"history-view-banner\""), "history mode banner should be removed from the markup");
  assert(!html.includes("id=\"exit-history-view-button\""), "history mode should no longer render a dedicated back button");
  assert(!html.includes("id=\"rewind-history-button\""), "history mode should no longer render a dedicated rewind button");
  assert(!html.includes("id=\"game-mode-select\""), "the old shared mode selector should be removed");
  assert(html.includes("id=\"match-config-panel\""), "the page should render a dedicated pre-game configuration panel");
  assert(fs.readFileSync(path.join(process.cwd(), "styles.css"), "utf8").includes(".match-config-panel[hidden]"), "pregame panel should have an explicit hidden style hook");
  assert(html.indexOf("id=\"match-config-panel\"") < html.indexOf("id=\"ai-match-strip\""), "ai-vs-ai strip should come after the pre-game config panel in the markup");
  assert(html.includes("id=\"player-1-controller-human\""), "the config panel should expose a controller toggle for player 1");
  assert(html.includes("id=\"player-2-controller-ai\""), "the config panel should expose a controller toggle for player 2");
  assert(html.includes("id=\"deck-mode-separate\""), "the config panel should expose a separate-deck toggle");
  assert(html.includes("id=\"deck-mode-shared\""), "the config panel should expose a shared-deck toggle");
  assert(html.includes("id=\"start-button\""), "the config panel should expose a Start button for the pre-game");
  assert(html.includes("id=\"player-1-deck-stat\""), "player panels should expose per-player deck stats");
  assert(html.includes("id=\"player-1-controller-chip\""), "player headers should expose the controller chip for player 1");
  assert(html.includes("id=\"player-2-controller-chip\""), "player headers should expose the controller chip for player 2");
  assert(!html.includes("<p class=\"player-label\">Jogador 1</p>"), "player 1 header should no longer render the Jogador 1 label");
  assert(!html.includes("<p class=\"player-label\">Jogador 2</p>"), "player 2 header should no longer render the Jogador 2 label");
  assert(!html.includes("id=\"match-config-summary\""), "the pre-game panel should no longer keep a collapsed summary during the match");
  assert(html.includes("id=\"validate-log-button\""), "the log panel should expose a manual validation button");
  assert(html.includes("id=\"log-validation-status\""), "the log panel should expose a validation status chip");
  assert(html.includes("compact-action-button"), "turn action buttons should use the compact button style");
  assert(html.includes("pressione Esc para voltar ao presente"), "rules should describe how to leave history view without dedicated buttons");
  assert(html.includes("so comeca quando voce clicar em Start"), "rules should describe the pre-game Start flow");
  assert(html.includes("configuracao fica travada"), "rules should explain that Humano/IA choices lock after Start");
  assert(html.includes("default e Separado"), "rules should describe the default separate deck mode");
  assert(html.includes("carta fica deitada"), "rules should describe the defense stance visuals");
  assert(html.includes("IA vs IA"), "rules should describe how to configure ai vs ai");
  assert(html.includes("Validar log"), "rules should mention the manual log validation flow");
});

test("estandarte de guerra now costs 5 mana", () => {
  const banner = game.CARD_LIBRARY.find((card) => card.nome === "Estandarte de Guerra");

  assert(Boolean(banner), "banner card should exist");
  assert(banner.custo === 5, "banner should use the new cost");
});

test("every card exposes an image path that exists on disk", () => {
  game.CARD_LIBRARY.forEach((card) => {
    assert(typeof card.imagem === "string" && card.imagem.length > 0, `${card.nome} should declare an image path`);
    const imagePath = path.join(process.cwd(), card.imagem);
    assert(fs.existsSync(imagePath), `${card.nome} image should exist at ${card.imagem}`);
  });
});

test("support with new cost cannot be played below 5 mana", () => {
  const state = createStartedState();
  const logLengthBefore = state.log.length;
  state.players[0].manaAtual = 4;
  state.players[0].manaMax = 4;
  state.players[0].hand = [{
    id: "s",
    instanceId: "s",
    nome: "Estandarte de Guerra",
    categoria: "suporte",
    custo: 5,
    efeito: "aura_ataque",
    valor: 1,
    descricao: ""
  }];

  const played = game.playCard(state, 0, "s");

  assert(played === false, "banner should fail without 5 mana");
  assert(state.players[0].supportZone.length === 0, "banner should not enter play");
  assert(state.log.length === logLengthBefore, "failed play should not create a log entry");
});

test("preparing direct damage does not log until it resolves", () => {
  const state = createStartedState();
  const logLengthBefore = state.log.length;
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "e",
    instanceId: "e",
    nome: "Raio Arcano",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];

  const played = game.playCard(state, 0, "e");

  assert(played === true, "direct damage should still enter target mode");
  assert(state.log.length === logLengthBefore, "preparing the effect should not log by itself");
});

test("repair can heal the player and respects the new max health", () => {
  const state = createStartedState();
  state.players[0].vida = 35;
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "heal",
    instanceId: "heal",
    nome: "Reparo",
    categoria: "efeito",
    custo: 1,
    efeito: "cura_direta",
    valor: 6,
    descricao: ""
  }];

  const played = game.playCard(state, 0, "heal");
  const resolved = game.resolveEffectTarget(state, 0, "player");

  assert(played === true, "healing card should enter target mode");
  assert(resolved === true, "healing card should resolve on the player");
  assert(state.players[0].vida === 40, "healing should cap at the new max health");
  assert(state.discardPile.length === 1, "healing card should move to discard after resolving");
});

test("repair can heal an allied unit without exceeding its base life", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "heal",
    instanceId: "heal",
    nome: "Reparo",
    categoria: "efeito",
    custo: 1,
    efeito: "cura_direta",
    valor: 6,
    descricao: ""
  }];
  state.players[0].board = [{
    id: "ally",
    instanceId: "ally",
    nome: "Aliada",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 2,
    vidaBase: 5,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  game.playCard(state, 0, "heal");
  const resolved = game.resolveEffectTarget(state, 0, "ally-unit", "ally");

  assert(resolved === true, "healing should resolve on an allied unit");
  assert(state.players[0].board[0].vida === 5, "healing should stop at the unit base life");
  assert(state.discardPile.length === 1, "healing card should go to discard after healing an ally");
});

test("repair cannot be played if every healing target is full", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 3;
  state.players[0].manaMax = 3;
  state.players[0].vida = 40;
  state.players[0].board = [{
    id: "ally",
    instanceId: "ally",
    nome: "Aliada Inteira",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 5,
    vidaBase: 5,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];
  const healCard = {
    id: "heal",
    instanceId: "heal",
    nome: "Reparo",
    categoria: "efeito",
    custo: 1,
    efeito: "cura_direta",
    valor: 6,
    descricao: ""
  };
  state.players[0].hand = [healCard];

  assert(game.hasValidHealingTargets(state, 0) === false, "there should be no valid healing targets");
  assert(game.canPlayCard(state, 0, healCard) === false, "repair should be blocked with no wounded targets");
  assert(game.playCard(state, 0, "heal") === false, "repair should not enter target mode when no healing target exists");
});

test("available actions detect when the player still has meaningful plays", () => {
  const state = createStartedState();
  state.players[0].hand = [{
    id: "cheap",
    instanceId: "cheap",
    nome: "Carta Barata",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];

  const available = game.getAvailableActions(state, 0);

  assert(available.canDraw === true, "opening hand should allow drawing with 1 mana");
  assert(available.playableCards === 1, "available actions should count affordable cards in hand");
  assert(available.hasAny === true, "player should still have available actions");
});

test("available actions report no actions when mana, cards, and attacks are exhausted", () => {
  const state = createStartedState();
  state.deck = [];
  state.players[0].manaAtual = 0;
  state.players[0].manaMax = 0;
  state.players[0].hand = [{
    id: "expensive",
    instanceId: "expensive",
    nome: "Carta Cara",
    categoria: "suporte",
    custo: 4,
    efeito: "aura_ataque",
    valor: 1,
    descricao: ""
  }];
  state.players[0].board = [{
    id: "spent",
    instanceId: "spent",
    nome: "Exausta",
    categoria: "unidade",
    custo: 1,
    ataque: 1,
    vida: 1,
    vidaBase: 1,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: true
  }];

  const available = game.getAvailableActions(state, 0);

  assert(available.hasAny === false, "player should have no actions left in this exhausted state");
});

test("attempting to end turn with available actions depends on confirmation", () => {
  const state = createStartedState();
  let confirmCalls = 0;

  const canceled = game.attemptEndTurn(state, {
    confirmFn: () => {
      confirmCalls += 1;
      return false;
    }
  });

  assert(canceled === false, "turn should stay active when confirmation is rejected");
  assert(confirmCalls === 1, "confirmation should run when actions are still available");
  assert(state.currentPlayerIndex === 0, "player should keep the turn after rejecting confirmation");
});

test("ending turn without actions left should not ask for confirmation", () => {
  const state = createStartedState();
  state.deck = [];
  state.players[0].manaAtual = 0;
  state.players[0].manaMax = 0;
  state.players[0].hand = [];
  let confirmCalls = 0;

  const ended = game.attemptEndTurn(state, {
    confirmFn: () => {
      confirmCalls += 1;
      return true;
    }
  });

  assert(ended === true, "turn should end immediately when no actions remain");
  assert(confirmCalls === 0, "no confirmation should be requested with no actions left");
  assert(state.currentPlayerIndex === 1, "turn should pass to the next player");
});

test("ending turn with an armed effect should not lose the card", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  state.players[0].hand = [{
    id: "effect-1",
    instanceId: "armed-effect",
    nome: "Raio Arcano",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  }];

  const played = game.playCard(state, 0, "armed-effect");
  const ended = game.attemptEndTurn(state, {
    confirmFn: () => true
  });

  assert(played === true, "effect should enter target mode before the turn-end attempt");
  assert(ended === false, "turn should not end while an effect is still armed");
  assert(state.currentPlayerIndex === 0, "current player should keep the turn");
  assert(state.selectedEffectCard?.instanceId === "armed-effect", "armed effect should remain selected");
  assert(countCardInstanceOccurrences(state, "armed-effect") === 1, "armed effect card should still exist exactly once in the full game state");
});

test("winner is detected when player health reaches zero", () => {
  const state = createStartedState();
  state.players[0].board = [{
    id: "atk",
    instanceId: "atk",
    nome: "Finalizador",
    categoria: "unidade",
    custo: 4,
    ataque: 50,
    vida: 3,
    vidaBase: 3,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false
  }];

  game.selectAttacker(state, 0, "atk");
  game.attackTarget(state, 0, "player");

  assert(state.winner && state.winner.id === 1, "player 1 should win after lethal attack");
  assert(state.isWinnerModalOpen === true, "winner modal state should open when the game ends");
});

test("log keeps full history without truncating", () => {
  const state = createStartedState();

  for (let i = 0; i < 30; i += 1) {
    state.log.push({
      id: i + 2,
      numero: i + 2,
      texto: `Entrada ${i}`,
      snapshot: game.createStateSnapshot(state)
    });
  }

  assert(state.log.length > 12, "log should keep more than the old truncated size");
});

test("log entries stay chronological and snapshots allow rewind", () => {
  const state = createStartedState();
  const initialHandSize = state.players[0].hand.length;

  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  game.drawTurnCard(state, 0);

  assert(state.log.length === 2, "drawing should append a second log line after the initial setup");
  assert(state.log[0].numero === 1, "the first entry should stay numbered as action 1");
  assert(state.log[1].numero === 2, "the new action should become number 2");
  assert(state.log[1].snapshot.players[0].hand.length === initialHandSize + 1, "snapshot should capture the post-action hand size");

  const rewound = game.rewindToLogEntry(state, 1);

  assert(rewound.players[0].hand.length === initialHandSize, "rewind should restore the original hand size");
  assert(rewound.log.length === 1, "rewind should discard future log entries");
  assert(rewound.nextLogNumber === 2, "rewind should continue numbering from the restored point");
  assert(state.log[1].event.kind === game.LOG_EVENT_TYPES.DRAW_CARD, "logged draw actions should keep a structured event payload");
});

test("log validator passes on a normal match history in separate deck mode", () => {
  const state = createStartedState();
  Object.assign(state.players[0].hand[0], {
    id: "unit-1",
    nome: "Escudeiro Solar",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 5,
    vidaBase: 5,
    descricao: ""
  });
  Object.assign(state.log[0].snapshot.players[0].hand[0], {
    id: "unit-1",
    nome: "Escudeiro Solar",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 5,
    vidaBase: 5,
    descricao: ""
  });

  const unitInstanceId = state.players[0].hand[0].instanceId;
  game.endTurn(state);
  game.endTurn(state);
  game.playCard(state, 0, unitInstanceId);
  game.enterDefenseMode(state, 0, unitInstanceId);

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "normal separate-deck histories should validate successfully");
  assert(result.issues.length === 0, "valid histories should not produce issues");
  assert(result.validatedEntryCount === state.log.length, "valid histories should validate every log line");
});

test("log validator also passes on shared deck mode", () => {
  const state = createStartedState({ deckMode: game.DECK_MODES.SHARED });
  game.drawTurnCard(state, 0);

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "shared-deck histories should also validate successfully");
  assert(result.validatedEntryCount === state.log.length, "shared-deck validation should cover every line");
});

test("log validator ignores side menu visibility changes between logged actions", () => {
  const state = createStartedState();
  state.isLogOpen = true;
  game.drawTurnCard(state, 0);

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "side menu visibility should not invalidate an otherwise correct log replay");
});

test("log validator passes after a logged end-of-turn support heal", () => {
  const state = createStartedState();
  Object.assign(state.players[0].hand[0], {
    id: "support-2",
    nome: "Fonte Serena",
    categoria: "suporte",
    imagem: "assets/cards/support-2.png",
    custo: 2,
    efeito: "cura_fim_turno",
    valor: 1,
    descricao: ""
  });
  Object.assign(state.log[0].snapshot.players[0].hand[0], {
    id: "support-2",
    nome: "Fonte Serena",
    categoria: "suporte",
    imagem: "assets/cards/support-2.png",
    custo: 2,
    efeito: "cura_fim_turno",
    valor: 1,
    descricao: ""
  });
  state.players[0].vida = 35;
  state.log[0].snapshot.players[0].vida = 35;

  game.endTurn(state);
  game.endTurn(state);
  game.playCard(state, 0, state.players[0].hand[0].instanceId);
  game.endTurn(state);

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "histories with logged support heal should validate successfully");
});

test("log validator passes after healing an allied unit with repair", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  const healCard = state.players[0].hand[0];
  Object.assign(healCard, {
    id: "heal",
    nome: "Reparo",
    categoria: "efeito",
    custo: 1,
    efeito: "cura_direta",
    valor: 6,
    descricao: ""
  });

  const unitCard = state.players[0].hand.splice(1, 1)[0];
  Object.assign(unitCard, {
    id: "ally",
    nome: "Aliada",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 2,
    vidaBase: 5,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false,
    isDefending: false,
    defenseTurnNumber: null
  });
  state.players[0].board = [unitCard];
  state.log[0].snapshot = snapshotStateForValidation(state);

  game.playCard(state, 0, healCard.instanceId);
  game.resolveEffectTarget(state, 0, "ally-unit", unitCard.instanceId);

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "repairing an allied unit should keep the log replay valid");
});

test("log validator passes after direct damage resolves on an enemy unit", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  const damageCard = state.players[0].hand[0];
  Object.assign(damageCard, {
    id: "bolt",
    nome: "Raio",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  });

  const enemyUnit = state.players[1].hand.splice(0, 1)[0];
  Object.assign(enemyUnit, {
    id: "enemy",
    nome: "Inimiga",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 5,
    vidaBase: 5,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false,
    isDefending: false,
    defenseTurnNumber: null
  });
  state.players[1].board = [enemyUnit];
  state.log[0].snapshot = snapshotStateForValidation(state);

  game.playCard(state, 0, damageCard.instanceId);
  game.resolveEffectTarget(state, 0, "unit", enemyUnit.instanceId);

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "direct damage on a unit should keep the log replay valid");
});

test("log validator passes on histories produced during ai turns", () => {
  const state = createStartedState();
  let safety = 0;

  while (state.log.length < 5 && safety < 16) {
    if (game.isAiControlledPlayer(state, state.currentPlayerIndex)) {
      const action = game.performAiStep(state);
      assert(Boolean(action), "ai test setup should keep producing actions");
    } else {
      game.endTurn(state);
    }
    safety += 1;
  }

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "histories generated on ai turns should also validate successfully");
  assert(result.validatedEntryCount === state.log.length, "ai-generated histories should validate every line");
});

test("log validator reports tampered snapshots", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  game.drawTurnCard(state, 0);
  state.log[1].snapshot.players[0].hand.pop();

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.INVALID, "tampered histories should fail validation");
  assert(result.issues.some((issue) => issue.numero === 2), "the validator should point to the broken line");
});

test("new log entries reset the validation status to idle", () => {
  const state = createStartedState();
  let result = game.validateMatchLog(state.log);
  state.logValidationStatus = result.status;
  state.validatedEntryCount = result.validatedEntryCount;
  state.logValidationIssues = result.issues;

  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  game.drawTurnCard(state, 0);

  assert(state.logValidationStatus === game.LOG_VALIDATION_STATUS.IDLE, "any new log entry should invalidate the previous validation result");
  assert(state.validatedEntryCount === 0, "new log entries should clear the validated entry count");
  assert(state.logValidationIssues.length === 0, "new log entries should clear previous validation issues");
});

test("attempting to rewind depends on confirmation", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  game.drawTurnCard(state, 0);
  let confirmCalls = 0;

  const canceled = game.attemptRewindToLogEntry(state, 1, {
    confirmFn: () => {
      confirmCalls += 1;
      return false;
    }
  });

  assert(confirmCalls === 1, "rewind should ask for confirmation");
  assert(canceled === state, "canceled rewind should keep the current state object");
  assert(state.log.length === 2, "canceled rewind should keep the future log entries");
});

test("confirmed rewind restores the selected snapshot", () => {
  const state = createStartedState();
  const initialHandSize = state.players[0].hand.length;
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  game.drawTurnCard(state, 0);

  const rewound = game.attemptRewindToLogEntry(state, 1, {
    confirmFn: () => true
  });

  assert(rewound !== state, "confirmed rewind should return a restored state");
  assert(rewound.players[0].hand.length === initialHandSize, "confirmed rewind should restore the selected snapshot");
  assert(rewound.log.length === 1, "confirmed rewind should truncate future history");
});

test("rewind to a resolved effect entry should restore a stable post-effect state", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;

  const healCard = state.players[0].hand[0];
  Object.assign(healCard, {
    id: "heal",
    nome: "Reparo",
    categoria: "efeito",
    custo: 1,
    efeito: "cura_direta",
    valor: 6,
    descricao: ""
  });

  const unitCard = state.players[0].hand.splice(1, 1)[0];
  Object.assign(unitCard, {
    id: "ally",
    nome: "Aliada",
    categoria: "unidade",
    custo: 2,
    ataque: 2,
    vida: 2,
    vidaBase: 5,
    descricao: "",
    estado: "campo",
    podeAgir: true,
    jaAtacouNoTurno: false,
    isDefending: false,
    defenseTurnNumber: null
  });
  state.players[0].board = [unitCard];
  state.log[0].snapshot = snapshotStateForValidation(state);

  game.playCard(state, 0, healCard.instanceId);
  game.resolveEffectTarget(state, 0, "ally-unit", unitCard.instanceId);

  const rewound = game.rewindToLogEntry(state, 2);

  assert(rewound.selectedEffectCard === null, "rewind should not restore a resolved effect as still armed");
  assert(game.getDiscardPileForPlayer(rewound, 0).some((card) => card.instanceId === healCard.instanceId), "resolved healing card should already be in discard after rewind");
  assert(rewound.players[0].board[0].vida === 5, "rewind should preserve the healed unit life total");
  assert(countCardInstanceOccurrences(rewound, healCard.instanceId) === 1, "resolved healing card should still exist exactly once after rewind");
});

test("clicking the selected log entry again rewinds after confirmation", () => {
  const state = createStartedState();
  const initialHandSize = state.players[0].hand.length;
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  game.drawTurnCard(state, 0);

  const selected = game.handleLogEntryClick(state, 1);
  assert(selected === state, "first click should only select the log entry");
  assert(state.selectedLogEntryId === 1, "first click should mark the entry as selected");

  let confirmCalls = 0;
  const rewound = game.handleLogEntryClick(state, 1, {
    confirmFn: () => {
      confirmCalls += 1;
      return true;
    }
  });

  assert(confirmCalls === 1, "second click on the same entry should ask for confirmation");
  assert(rewound !== state, "confirmed second click should restore a new state");
  assert(rewound.players[0].hand.length === initialHandSize, "confirmed second click should restore the selected snapshot");
  assert(rewound.log.length === 1, "confirmed second click should discard future history");
});

test("clicking the latest log entry returns to the present moment", () => {
  const state = createStartedState();
  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  game.drawTurnCard(state, 0);
  state.isLogOpen = true;
  state.selectedLogEntryId = 1;

  const latestEntryId = state.log[state.log.length - 1].id;
  const result = game.handleLogEntryClick(state, latestEntryId, {
    confirmFn: () => false
  });

  assert(result === state, "returning to the present should keep the current state object");
  assert(state.selectedLogEntryId === null, "clicking the latest entry should leave history view and return to the present");
});

test("rewind to a lethal attack entry should preserve the winner state", () => {
  const state = createStartedState();
  state.players[1].vida = 2;
  state.players[0].manaAtual = 1;
  state.players[0].manaMax = 1;
  Object.assign(state.players[0].hand[0], {
    id: "atk",
    nome: "Finalizador",
    categoria: "unidade",
    custo: 1,
    ataque: 4,
    vida: 3,
    vidaBase: 3,
    descricao: ""
  });

  const attackerInstanceId = state.players[0].hand[0].instanceId;
  state.log[0].snapshot.players[1].vida = 2;

  game.playCard(state, 0, attackerInstanceId);
  game.selectAttacker(state, 0, attackerInstanceId);
  game.attackTarget(state, 0, "player");

  const rewound = game.rewindToLogEntry(state, 3);

  assert(rewound.players[1].vida === 0, "rewind should keep the defeated player at zero life on the lethal attack line");
  assert(rewound.winner && rewound.winner.id === 1, "rewind should preserve the declared winner on the lethal attack line");
  assert(rewound.isWinnerModalOpen === true, "rewind should preserve the winner modal state on the lethal attack line");
});

test("lethal player attack logs a single final line with the winner embedded", () => {
  const state = createStartedState();
  state.players[1].vida = 2;
  state.players[0].manaAtual = 1;
  state.players[0].manaMax = 1;
  Object.assign(state.players[0].hand[0], {
    id: "atk",
    nome: "Finalizador",
    categoria: "unidade",
    custo: 1,
    ataque: 4,
    vida: 3,
    vidaBase: 3,
    descricao: ""
  });

  const attackerInstanceId = state.players[0].hand[0].instanceId;
  state.log[0].snapshot.players[1].vida = 2;

  game.playCard(state, 0, attackerInstanceId);
  game.selectAttacker(state, 0, attackerInstanceId);
  game.attackTarget(state, 0, "player");

  const lastEntry = state.log[state.log.length - 1];

  assert(state.log.length === 3, "lethal attack should only add the summon and the lethal attack lines");
  assert(lastEntry.event.kind === game.LOG_EVENT_TYPES.ATTACK_PLAYER, "last log entry should stay on the lethal attack event");
  assert(lastEntry.event.winnerPlayerId === 1, "lethal attack entry should embed the winner");
  assert(lastEntry.snapshot.winnerPlayerId === 1, "lethal attack snapshot should already preserve the winner");
  assert(lastEntry.snapshot.players[1].vida === 0, "lethal attack snapshot should already preserve the defeated player life");
  assert(state.log.every((entry) => entry.event?.kind !== game.LOG_EVENT_TYPES.VICTORY), "lethal attack should not create a separate victory log line");
});

test("lethal direct damage logs a single final line with the winner embedded", () => {
  const state = createStartedState();
  state.players[1].vida = 3;
  state.players[0].manaAtual = 1;
  state.players[0].manaMax = 1;
  Object.assign(state.players[0].hand[0], {
    id: "bolt",
    nome: "Raio Arcano",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  });

  const effectInstanceId = state.players[0].hand[0].instanceId;
  state.log[0].snapshot.players[1].vida = 3;

  game.playCard(state, 0, effectInstanceId);
  game.resolveEffectTarget(state, 0, "player");

  const lastEntry = state.log[state.log.length - 1];

  assert(state.log.length === 2, "lethal direct damage should only add its own final log line");
  assert(lastEntry.event.kind === game.LOG_EVENT_TYPES.EFFECT_DAMAGE_PLAYER, "last log entry should stay on the lethal damage event");
  assert(lastEntry.event.winnerPlayerId === 1, "lethal direct damage entry should embed the winner");
  assert(lastEntry.snapshot.winnerPlayerId === 1, "lethal direct damage snapshot should already preserve the winner");
  assert(lastEntry.snapshot.selectedEffectCard === null, "lethal direct damage snapshot should already be fully settled");
  assert(lastEntry.snapshot.players[1].vida === 0, "lethal direct damage snapshot should already preserve the defeated player life");
  assert(state.log.every((entry) => entry.event?.kind !== game.LOG_EVENT_TYPES.VICTORY), "lethal direct damage should not create a separate victory log line");
});

test("log validator passes after a lethal player attack", () => {
  const state = createStartedState();
  state.players[1].vida = 2;
  state.players[0].manaAtual = 1;
  state.players[0].manaMax = 1;
  Object.assign(state.players[0].hand[0], {
    id: "atk",
    nome: "Finalizador",
    categoria: "unidade",
    custo: 1,
    ataque: 4,
    vida: 3,
    vidaBase: 3,
    descricao: ""
  });

  const attackerInstanceId = state.players[0].hand[0].instanceId;
  state.log[0].snapshot = snapshotStateForValidation(state);

  game.playCard(state, 0, attackerInstanceId);
  game.selectAttacker(state, 0, attackerInstanceId);
  game.attackTarget(state, 0, "player");

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "lethal player attack histories should validate successfully");
  assert(result.validatedEntryCount === state.log.length, "lethal player attack validation should cover every line");
});

test("log validator passes after lethal direct damage on the player", () => {
  const state = createStartedState();
  state.players[1].vida = 3;
  state.players[0].manaAtual = 1;
  state.players[0].manaMax = 1;
  Object.assign(state.players[0].hand[0], {
    id: "bolt",
    nome: "Raio Arcano",
    categoria: "efeito",
    custo: 1,
    efeito: "dano_direto",
    valor: 3,
    descricao: ""
  });

  const effectInstanceId = state.players[0].hand[0].instanceId;
  state.log[0].snapshot = snapshotStateForValidation(state);

  game.playCard(state, 0, effectInstanceId);
  game.resolveEffectTarget(state, 0, "player");

  const result = game.validateMatchLog(state.log);

  assert(result.status === game.LOG_VALIDATION_STATUS.VALID, "lethal direct-damage histories should validate successfully");
  assert(result.validatedEntryCount === state.log.length, "lethal direct-damage validation should cover every line");
});

test("log display helper shows the newest entry first without renumbering", () => {
  const displayed = game.getDisplayLogEntries([
    { id: 1, numero: 1, texto: "Primeira" },
    { id: 2, numero: 2, texto: "Segunda" },
    { id: 3, numero: 3, texto: "Terceira" }
  ]);

  assert(displayed[0].numero === 3, "newest entry should render first");
  assert(displayed[1].numero === 2, "middle entry should stay in the middle");
  assert(displayed[2].numero === 1, "oldest entry should render last");
});

test("history view depends on log panel and a selected entry", () => {
  const state = createStartedState();

  assert(game.isViewingHistory(state) === false, "history view should stay hidden with no selected line");

  state.selectedLogEntryId = 1;
  assert(game.isViewingHistory(state) === false, "history view should stay hidden while the log menu is closed");

  state.isLogOpen = true;
  assert(game.isViewingHistory(state) === true, "history view should open only when the log is open and a line is selected");

  state.selectedLogEntryId = 999;
  assert(game.isViewingHistory(state) === false, "history view should hide again if the selected entry no longer exists");
});

test("rendered game state returns the selected snapshot without mutating the live state", () => {
  const state = createStartedState();
  const liveHandSize = state.players[0].hand.length;

  state.players[0].manaAtual = 2;
  state.players[0].manaMax = 2;
  game.drawTurnCard(state, 0);
  state.isLogOpen = true;
  state.selectedLogEntryId = 1;

  const rendered = game.getRenderedGameState(state);

  assert(rendered.players[0].hand.length === liveHandSize, "rendered state should show the selected snapshot hand");
  assert(state.players[0].hand.length === liveHandSize + 1, "live state should keep the current hand untouched");
});

test("history view blocks keyboard shortcuts that would mutate the live game", () => {
  const state = createStartedState();
  const handSizeBefore = state.players[0].hand.length;

  state.isLogOpen = true;
  state.selectedLogEntryId = 1;

  const handled = game.handleShortcutAction(state, "c");

  assert(handled === false, "shortcut should be ignored while viewing history");
  assert(state.players[0].hand.length === handSizeBefore, "blocked shortcut should not change the live game");
});

test("keyboard shortcut escape returns to the present while viewing history", () => {
  const state = createStartedState();

  state.isLogOpen = true;
  state.selectedLogEntryId = 1;

  const handled = game.handleShortcutAction(state, "Escape");

  assert(handled === true, "escape should be handled while viewing history");
  assert(state.selectedLogEntryId === null, "escape should leave history view and return to the present");
});

