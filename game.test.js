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

test("initial state sets health, hands, and starting mana", () => {
  const state = game.createInitialState();

  assert(state.players[0].vida === 40, "player 1 should start at max health");
  assert(state.players[1].vida === 40, "player 2 should start at max health");
  assert(state.players[0].hand.length === 4, "player 1 should draw 4 starting cards");
  assert(state.players[1].hand.length === 4, "player 2 should draw 4 starting cards");
  assert(state.players[0].manaAtual === 1 && state.players[0].manaMax === 1, "first player should start with 1 mana");
  assert(state.players[1].manaAtual === 0 && state.players[1].manaMax === 0, "second player should wait for its turn to gain mana");
  assert(Array.isArray(state.log), "game should keep a log array");
  assert(state.log.length === 0, "log should start empty until real game actions happen");
});

test("mana grows by turn up to the cap and refills", () => {
  const state = game.createInitialState();

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
  const state = game.createInitialState();
  const deckBeforeDraw = state.deck.length;

  const drawResult = game.drawTurnCard(state, 0);
  const secondDraw = game.drawTurnCard(state, 0);

  assert(drawResult !== null, "first draw should succeed");
  assert(state.players[0].manaAtual === 0, "draw should cost 1 mana");
  assert(state.deck.length === deckBeforeDraw - 1, "deck should shrink after buying a card");
  assert(secondDraw === null, "second draw should fail without mana");
});

test("drawing is blocked while an attack is being aimed", () => {
  const state = game.createInitialState();
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
  const state = game.createInitialState();
  const handBeforeDraw = state.players[0].hand.length;
  const deckBeforeDraw = state.deck.length;

  const handled = game.handleShortcutAction(state, "c");

  assert(handled === true, "shortcut should trigger the draw action");
  assert(state.players[0].hand.length === handBeforeDraw + 1, "shortcut draw should add a card to hand");
  assert(state.deck.length === deckBeforeDraw - 1, "shortcut draw should consume one deck card");
  assert(state.players[0].manaAtual === 0, "shortcut draw should still spend mana");
});

test("keyboard shortcut a attacks the rival player with the selected unit", () => {
  const state = game.createInitialState();
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

test("keyboard shortcut e ends the turn", () => {
  const state = game.createInitialState();

  const handled = game.handleShortcutAction(state, "e");

  assert(handled === true, "shortcut should end the turn");
  assert(state.currentPlayerIndex === 1, "turn should pass to the next player");
  assert(state.players[1].manaAtual === 2, "next player should start with refreshed mana");
});

test("keyboard shortcut escape cancels a prepared effect and refunds mana", () => {
  const state = game.createInitialState();
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

test("keyboard shortcuts still work when focus is on a button", () => {
  const state = game.createInitialState();
  const handBeforeDraw = state.players[0].hand.length;

  const handled = game.handleShortcutAction(state, "c", {
    target: { tagName: "button" }
  });

  assert(handled === true, "shortcut should still work after a button keeps focus");
  assert(state.players[0].hand.length === handBeforeDraw + 1, "button focus should not block the shortcut action");
});

test("keyboard shortcuts ignore editable targets", () => {
  const state = game.createInitialState();
  const handBeforeDraw = state.players[0].hand.length;

  const handled = game.handleShortcutAction(state, "c", {
    target: { tagName: "input" }
  });

  assert(handled === false, "shortcut should stay blocked inside editable controls");
  assert(state.players[0].hand.length === handBeforeDraw, "editable focus should not change the game state");
});

test("playing a unit spends mana and the unit can attack immediately", () => {
  const state = game.createInitialState();
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
  const state = game.createInitialState();
  state.players[0].manaAtual = 6;
  state.players[0].manaMax = 6;
  state.players[0].hand = [{
    id: "s",
    instanceId: "s",
    nome: "Estandarte",
    categoria: "suporte",
    custo: 4,
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
  assert(state.players[0].manaAtual === 2, "support should use the new cost");
});

test("each unit can attack only once per turn", () => {
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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
    { categoria: "unidade", nome: "Escudeiro" },
    { categoria: "suporte", nome: "Estandarte" },
    { categoria: "unidade", nome: "Arqueira" }
  ]);

  assert(grouped.unidade.length === 2, "unit cards should be grouped together");
  assert(grouped.suporte.length === 1, "support cards should be grouped together");
  assert(grouped.efeito.length === 1, "effect cards should be grouped together");
  assert(grouped.unidade[0].nome === "Escudeiro", "grouping should preserve original order inside a category");
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

test("unit health package matches the new rebalance", () => {
  const escudeiro = game.CARD_LIBRARY.find((card) => card.id === "unit-1");
  const arqueira = game.CARD_LIBRARY.find((card) => card.id === "unit-2");
  const guardiao = game.CARD_LIBRARY.find((card) => card.id === "unit-3");
  const berserker = game.CARD_LIBRARY.find((card) => card.id === "unit-4");

  assert(escudeiro.vidaBase === 5, "Escudeiro Solar should have 5 base life");
  assert(arqueira.vidaBase === 3, "Arqueira Nebulosa should have 3 base life");
  assert(guardiao.vidaBase === 8, "Guardiao de Ferro should have 8 base life");
  assert(berserker.vidaBase === 4, "Berserker Rubro should have 4 base life");
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
  const state = game.createInitialState();
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

test("attack against a unit deals damage and discards it if defeated", () => {
  const state = game.createInitialState();
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
});

test("unit can attack an enemy support only when there are no enemy units in play", () => {
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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
});

test("direct damage cannot target allied units", () => {
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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

  const player = state.players[0];
  player.hand.push(state.selectedEffectCard);
  player.manaAtual = Math.min(player.manaAtual + state.selectedEffectCard.custo, player.manaMax);
  state.selectedEffectCard = null;

  assert(player.manaAtual === 2, "cancel should refund the spent mana");
  assert(player.hand.length === 1, "cancel should return the direct damage card to hand");
  assert(state.selectedEffectCard === null, "cancel should clear selected effect");
  assert(state.log.length === 0, "canceling a prepared effect should not add log noise");
});

test("estandarte de guerra now costs 4 mana", () => {
  const banner = game.CARD_LIBRARY.find((card) => card.nome === "Estandarte de Guerra");

  assert(Boolean(banner), "banner card should exist");
  assert(banner.custo === 4, "banner should use the new cost");
});

test("every card exposes an image path that exists on disk", () => {
  game.CARD_LIBRARY.forEach((card) => {
    assert(typeof card.imagem === "string" && card.imagem.length > 0, `${card.nome} should declare an image path`);
    const imagePath = path.join(process.cwd(), card.imagem);
    assert(fs.existsSync(imagePath), `${card.nome} image should exist at ${card.imagem}`);
  });
});

test("support with new cost cannot be played below 4 mana", () => {
  const state = game.createInitialState();
  state.players[0].manaAtual = 3;
  state.players[0].manaMax = 3;
  state.players[0].hand = [{
    id: "s",
    instanceId: "s",
    nome: "Estandarte de Guerra",
    categoria: "suporte",
    custo: 4,
    efeito: "aura_ataque",
    valor: 1,
    descricao: ""
  }];

  const played = game.playCard(state, 0, "s");

  assert(played === false, "banner should fail without 4 mana");
  assert(state.players[0].supportZone.length === 0, "banner should not enter play");
  assert(state.log.length === 0, "failed play should not create a log entry");
});

test("preparing direct damage does not log until it resolves", () => {
  const state = game.createInitialState();
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
  assert(state.log.length === 0, "preparing the effect should not log by itself");
});

test("repair can heal the player and respects the new max health", () => {
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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

test("available actions detect when the player still has meaningful plays", () => {
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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
  const state = game.createInitialState();
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

test("winner is detected when player health reaches zero", () => {
  const state = game.createInitialState();
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
});

test("log keeps full history without truncating", () => {
  const state = game.createInitialState();

  for (let i = 0; i < 30; i += 1) {
    state.log.unshift(`Entrada ${i}`);
  }

  assert(state.log.length > 12, "log should keep more than the old truncated size");
});
