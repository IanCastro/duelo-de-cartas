(function () {
  const MAX_HEALTH = 40;
  const STARTING_HAND_SIZE = 4;
  const MAX_MANA = 6;
  const DRAW_COST = 1;
  const CARD_COPIES_PER_TYPE = 4;

  const CARD_LIBRARY = [
    {
      id: "unit-1",
      nome: "Escudeiro Solar",
      categoria: "unidade",
      imagem: "assets/cards/unit-1.png",
      custo: 1,
      ataque: 2,
      vida: 5,
      vidaBase: 5,
      descricao: "Uma unidade equilibrada para segurar a linha."
    },
    {
      id: "unit-2",
      nome: "Arqueira Nebulosa",
      categoria: "unidade",
      imagem: "assets/cards/unit-2.png",
      custo: 2,
      ataque: 3,
      vida: 3,
      vidaBase: 3,
      descricao: "Causa dano rapido antes que o rival se organize."
    },
    {
      id: "unit-3",
      nome: "Guardiao de Ferro",
      categoria: "unidade",
      imagem: "assets/cards/unit-3.png",
      custo: 3,
      ataque: 1,
      vida: 8,
      vidaBase: 8,
      descricao: "Resistente e ideal para travar o campo."
    },
    {
      id: "unit-4",
      nome: "Berserker Rubro",
      categoria: "unidade",
      imagem: "assets/cards/unit-4.png",
      custo: 4,
      ataque: 4,
      vida: 4,
      vidaBase: 4,
      descricao: "Uma ameaca agressiva para abrir espaco."
    },
    {
      id: "support-1",
      nome: "Estandarte de Guerra",
      categoria: "suporte",
      imagem: "assets/cards/support-1.png",
      custo: 4,
      efeito: "aura_ataque",
      valor: 1,
      descricao: "Suas unidades ganham +1 de ataque enquanto este suporte estiver em campo."
    },
    {
      id: "support-2",
      nome: "Fonte Serena",
      categoria: "suporte",
      imagem: "assets/cards/support-2.png",
      custo: 2,
      efeito: "cura_fim_turno",
      valor: 1,
      descricao: "No fim do seu turno, recupere 1 de vida."
    },
    {
      id: "effect-1",
      nome: "Raio Arcano",
      categoria: "efeito",
      imagem: "assets/cards/effect-1.png",
      custo: 1,
      efeito: "dano_direto",
      valor: 3,
      descricao: "Cause 3 de dano ao jogador rival ou a uma unidade inimiga."
    },
    {
      id: "effect-2",
      nome: "Reparo Rapido",
      categoria: "efeito",
      imagem: "assets/cards/effect-2.png",
      custo: 1,
      efeito: "cura_direta",
      valor: 6,
      descricao: "Recupere 6 de vida no jogador ou em uma unidade aliada."
    }
  ];

  function getTotalDeckSize() {
    return CARD_LIBRARY.length * CARD_COPIES_PER_TYPE;
  }

  function instantiateCard(card, suffix) {
    return {
      ...card,
      instanceId: `${card.id}-${suffix}`
    };
  }

  function createDeck() {
    const suffixes = ["a", "b", "c", "d"].slice(0, CARD_COPIES_PER_TYPE);
    return CARD_LIBRARY.flatMap((card) => suffixes.map((suffix) => instantiateCard(card, suffix)));
  }

  function shuffleDeck(cards) {
    const deck = [...cards];

    for (let index = deck.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
    }

    return deck;
  }

  function createPlayer(id, nome) {
    return {
      id,
      nome,
      vida: MAX_HEALTH,
      hand: [],
      board: [],
      supportZone: [],
      manaAtual: 0,
      manaMax: 0
    };
  }

  function createInitialState() {
    const state = {
      deck: shuffleDeck(createDeck()),
      discardPile: [],
      currentPlayerIndex: 0,
      isLibraryOpen: false,
      isRulesOpen: false,
      isLogOpen: false,
      selectedAttackerId: null,
      selectedEffectCard: null,
      winner: null,
      turnNumber: 1,
      log: [],
      players: [
        createPlayer(1, "Sentinela Azul"),
        createPlayer(2, "Guardiao Rubro")
      ]
    };

    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex += 1) {
      for (let draw = 0; draw < STARTING_HAND_SIZE; draw += 1) {
        drawCard(state, playerIndex, false);
      }
    }

    startTurn(state, 0, false);
    return state;
  }

  function addLog(state, message) {
    state.log.unshift(message);
  }

  function getCurrentPlayer(state) {
    return state.players[state.currentPlayerIndex];
  }

  function getOpponentPlayer(state) {
    return state.players[(state.currentPlayerIndex + 1) % 2];
  }

  function getSupportBonus(player, effect) {
    if (!player || !Array.isArray(player.supportZone)) {
      return 0;
    }

    return player.supportZone
      .filter((card) => card.efeito === effect)
      .reduce((total, card) => total + (card.valor || 0), 0);
  }

  function getUnitAttackBonus(player) {
    return getSupportBonus(player, "aura_ataque");
  }

  function getUnitAttackBreakdown(unit, player) {
    const bonus = getUnitAttackBonus(player);
    return {
      base: unit.ataque,
      bonus,
      total: unit.ataque + bonus
    };
  }

  function getUnitAttack(unit, player) {
    return getUnitAttackBreakdown(unit, player).total;
  }

  function getCardOverlayData(card, player) {
    const overlayData = {
      bonusText: null,
      lifeText: null,
      stateText: null
    };

    if (card.categoria !== "unidade" || card.estado !== "campo") {
      return overlayData;
    }

    const attackBreakdown = getUnitAttackBreakdown(card, player);

    if (attackBreakdown.bonus > 0) {
      overlayData.bonusText = `+${attackBreakdown.bonus} ATQ`;
    }

    overlayData.lifeText = `VIDA ${card.vida}/${card.vidaBase}`;
    overlayData.stateText = card.jaAtacouNoTurno ? "JA ATACOU" : card.podeAgir ? "PRONTA" : "EM ESPERA";
    return overlayData;
  }

  function getAvailableAttackers(player) {
    return player.board.filter((unit) => unit.podeAgir && !unit.jaAtacouNoTurno);
  }

  function canAfford(player, cost) {
    return player.manaAtual >= cost;
  }

  function spendMana(player, cost) {
    if (!canAfford(player, cost)) {
      return false;
    }

    player.manaAtual -= cost;
    return true;
  }

  function drawCard(state, playerIndex, shouldLog = true) {
    const player = state.players[playerIndex];

    if (!state.deck.length) {
      return null;
    }

    const card = state.deck.pop();
    player.hand.push(card);

    if (shouldLog) {
      addLog(state, `${player.nome} comprou ${card.nome}.`);
    }

    return card;
  }

  function drawTurnCard(state, playerIndex) {
    if (state.winner || state.currentPlayerIndex !== playerIndex || state.selectedEffectCard || state.selectedAttackerId) {
      return null;
    }

    const player = state.players[playerIndex];

    if (!spendMana(player, DRAW_COST)) {
      return null;
    }

    const card = drawCard(state, playerIndex, true);

    if (!card) {
      player.manaAtual += DRAW_COST;
      return null;
    }

    state.selectedAttackerId = null;
    return card;
  }

  function moveCardToDiscard(state, card) {
    state.discardPile.push(card);
  }

  function resolveDamageEffectOnPlayer(state, card, player, opponent) {
    opponent.vida = Math.max(opponent.vida - card.valor, 0);
    addLog(state, `${player.nome} usou ${card.nome} e causou ${card.valor} de dano em ${opponent.nome}.`);
    checkWinner(state);
  }

  function resolveDamageEffectOnUnit(state, card, player, opponent, targetInstanceId) {
    const targetIndex = opponent.board.findIndex((unit) => unit.instanceId === targetInstanceId);

    if (targetIndex === -1) {
      return false;
    }

    const target = opponent.board[targetIndex];
    target.vida = Math.max(target.vida - card.valor, 0);
    addLog(state, `${player.nome} usou ${card.nome} e causou ${card.valor} de dano em ${target.nome}.`);

    if (target.vida <= 0) {
      const [defeatedUnit] = opponent.board.splice(targetIndex, 1);
      moveCardToDiscard(state, defeatedUnit);
      addLog(state, `${defeatedUnit.nome} foi derrotada e enviada ao descarte.`);
    }

    return true;
  }

  function resolveHealingEffectOnPlayer(state, card, player) {
    const recovered = Math.min(card.valor, MAX_HEALTH - player.vida);
    player.vida = Math.min(player.vida + card.valor, MAX_HEALTH);
    addLog(state, `${player.nome} usou ${card.nome} e recuperou ${recovered} de vida.`);
  }

  function resolveHealingEffectOnUnit(state, card, player, targetInstanceId) {
    const target = player.board.find((unit) => unit.instanceId === targetInstanceId);

    if (!target) {
      return false;
    }

    const recovered = Math.min(card.valor, target.vidaBase - target.vida);
    target.vida = Math.min(target.vida + card.valor, target.vidaBase);
    addLog(state, `${player.nome} usou ${card.nome} e recuperou ${recovered} de vida em ${target.nome}.`);
    return true;
  }

  function resolveEffectTarget(state, playerIndex, targetType, targetInstanceId) {
    if (state.winner || state.currentPlayerIndex !== playerIndex || !state.selectedEffectCard) {
      return false;
    }

    const player = state.players[playerIndex];
    const opponent = state.players[(playerIndex + 1) % 2];
    const card = state.selectedEffectCard;

    let resolved = false;

    if (card.efeito === "dano_direto") {
      if (targetType === "player") {
        resolveDamageEffectOnPlayer(state, card, player, opponent);
        resolved = true;
      }

      if (targetType === "unit") {
        resolved = resolveDamageEffectOnUnit(state, card, player, opponent, targetInstanceId);
      }
    }

    if (card.efeito === "cura_direta") {
      if (targetType === "player") {
        resolveHealingEffectOnPlayer(state, card, player);
        resolved = true;
      }

      if (targetType === "ally-unit") {
        resolved = resolveHealingEffectOnUnit(state, card, player, targetInstanceId);
      }
    }

    if (!resolved) {
      return false;
    }

    moveCardToDiscard(state, card);
    state.selectedEffectCard = null;
    return true;
  }

  function playCard(state, playerIndex, cardInstanceId) {
    if (state.winner || state.currentPlayerIndex !== playerIndex || state.selectedEffectCard) {
      return false;
    }

    const player = state.players[playerIndex];
    const cardIndex = player.hand.findIndex((card) => card.instanceId === cardInstanceId);

    if (cardIndex === -1) {
      return false;
    }

    const card = player.hand[cardIndex];

    if (!spendMana(player, card.custo)) {
      return false;
    }

    player.hand.splice(cardIndex, 1);
    state.selectedAttackerId = null;

    if (card.categoria === "unidade") {
      player.board.push({
        ...card,
        estado: "campo",
        podeAgir: true,
        jaAtacouNoTurno: false
      });
      addLog(state, `${player.nome} baixou ${card.nome} no campo por ${card.custo} mana.`);
      return true;
    }

    if (card.categoria === "suporte") {
      player.supportZone.push({
        ...card,
        estado: "suporte"
      });
      addLog(state, `${player.nome} ativou o suporte ${card.nome} por ${card.custo} mana.`);
      return true;
    }

    if (card.efeito === "dano_direto" || card.efeito === "cura_direta") {
      state.selectedEffectCard = card;
      return true;
    }

    moveCardToDiscard(state, card);

    checkWinner(state);
    return true;
  }

  function selectAttacker(state, playerIndex, unitInstanceId) {
    if (state.winner || state.currentPlayerIndex !== playerIndex || state.selectedEffectCard) {
      return false;
    }

    const player = state.players[playerIndex];
    const unit = player.board.find((card) => card.instanceId === unitInstanceId);

    if (!unit || !unit.podeAgir || unit.jaAtacouNoTurno) {
      return false;
    }

    state.selectedAttackerId = unitInstanceId;
    return true;
  }

  function attackTarget(state, playerIndex, targetType, targetInstanceId) {
    if (state.selectedEffectCard) {
      return false;
    }

    if (state.winner || state.currentPlayerIndex !== playerIndex) {
      return false;
    }

    const player = state.players[playerIndex];
    const opponent = state.players[(playerIndex + 1) % 2];
    const attacker = player.board.find((card) => card.instanceId === state.selectedAttackerId);

    if (!attacker || !attacker.podeAgir || attacker.jaAtacouNoTurno) {
      return false;
    }

    const attackValue = getUnitAttack(attacker, player);
    attacker.jaAtacouNoTurno = true;
    state.selectedAttackerId = null;

    if (targetType === "player") {
      opponent.vida = Math.max(opponent.vida - attackValue, 0);
      addLog(state, `${attacker.nome} atacou ${opponent.nome} e causou ${attackValue} de dano.`);
      checkWinner(state);
      return true;
    }

    if (targetType === "support") {
      if (opponent.board.length > 0) {
        attacker.jaAtacouNoTurno = false;
        return false;
      }

      const targetIndex = opponent.supportZone.findIndex((card) => card.instanceId === targetInstanceId);

      if (targetIndex === -1) {
        attacker.jaAtacouNoTurno = false;
        return false;
      }

      const [defeatedSupport] = opponent.supportZone.splice(targetIndex, 1);
      moveCardToDiscard(state, defeatedSupport);
      addLog(state, `${attacker.nome} destruiu o suporte ${defeatedSupport.nome}.`);
      return true;
    }

    const targetIndex = opponent.board.findIndex((card) => card.instanceId === targetInstanceId);

    if (targetIndex === -1) {
      attacker.jaAtacouNoTurno = false;
      return false;
    }

    const target = opponent.board[targetIndex];
    target.vida = Math.max(target.vida - attackValue, 0);
    addLog(state, `${attacker.nome} atacou ${target.nome} e causou ${attackValue} de dano.`);

    if (target.vida <= 0) {
      const [defeatedUnit] = opponent.board.splice(targetIndex, 1);
      moveCardToDiscard(state, defeatedUnit);
      addLog(state, `${defeatedUnit.nome} foi derrotada e enviada ao descarte.`);
    }

    return true;
  }

  function cancelPendingAction(state, playerIndex = state.currentPlayerIndex) {
    let didCancel = false;

    if (state.selectedEffectCard && state.currentPlayerIndex === playerIndex) {
      const player = state.players[playerIndex];
      const canceledCard = state.selectedEffectCard;
      player.hand.push(canceledCard);
      player.manaAtual = Math.min(player.manaAtual + canceledCard.custo, player.manaMax);
      state.selectedEffectCard = null;
      didCancel = true;
    }

    if (state.selectedAttackerId) {
      state.selectedAttackerId = null;
      didCancel = true;
    }

    return didCancel;
  }

  function getAvailableActions(state, playerIndex = state.currentPlayerIndex) {
    if (state.winner || state.currentPlayerIndex !== playerIndex) {
      return {
        canDraw: false,
        playableCards: 0,
        readyAttackers: 0,
        pendingSelection: false,
        hasAny: false
      };
    }

    const player = state.players[playerIndex];
    const canDraw = state.deck.length > 0 && canAfford(player, DRAW_COST);
    const playableCards = player.hand.filter((card) => canAfford(player, card.custo)).length;
    const readyAttackers = getAvailableAttackers(player).length;
    const pendingSelection = Boolean(state.selectedAttackerId || state.selectedEffectCard);
    const hasAny = canDraw || playableCards > 0 || readyAttackers > 0 || pendingSelection;

    return {
      canDraw,
      playableCards,
      readyAttackers,
      pendingSelection,
      hasAny
    };
  }

  function attemptEndTurn(state, options = {}) {
    if (state.winner) {
      return false;
    }

    const availableActions = getAvailableActions(state, state.currentPlayerIndex);

    if (availableActions.hasAny && typeof options.confirmFn === "function") {
      const confirmed = options.confirmFn("Ainda ha acoes disponiveis neste turno. Deseja encerrar mesmo assim?");
      if (!confirmed) {
        return false;
      }
    }

    endTurn(state);
    return true;
  }

  function isInteractiveShortcutTarget(target) {
    if (!target) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    const tagName = typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";
    return ["INPUT", "TEXTAREA", "SELECT"].includes(tagName);
  }

  function handleShortcutAction(state, shortcutKey, options = {}) {
    const normalizedKey = typeof shortcutKey === "string" ? shortcutKey.toLowerCase() : "";

    if (options.repeat || isInteractiveShortcutTarget(options.target)) {
      return false;
    }

    if (normalizedKey === "c") {
      return Boolean(drawTurnCard(state, state.currentPlayerIndex));
    }

    if (normalizedKey === "a") {
      if (state.selectedEffectCard) {
        return resolveEffectTarget(state, state.currentPlayerIndex, "player");
      }

      if (state.selectedAttackerId) {
        return attackTarget(state, state.currentPlayerIndex, "player");
      }

      return false;
    }

    if (normalizedKey === "e") {
      return attemptEndTurn(state, options);
    }

    if (normalizedKey === "escape") {
      return cancelPendingAction(state, state.currentPlayerIndex);
    }

    return false;
  }

  function resolveEndOfTurnSupport(state, player) {
    const healAmount = getSupportBonus(player, "cura_fim_turno");

    if (!healAmount) {
      return;
    }

    const recovered = Math.min(healAmount, MAX_HEALTH - player.vida);
    player.vida = Math.min(player.vida + healAmount, MAX_HEALTH);

    if (recovered > 0) {
      addLog(state, `${player.nome} recuperou ${recovered} de vida com seus suportes.`);
    }
  }

  function refreshUnitsForTurn(player) {
    player.board.forEach((unit) => {
      unit.podeAgir = true;
      unit.jaAtacouNoTurno = false;
    });
  }

  function startTurn(state, playerIndex, incrementTurn = true) {
    if (incrementTurn && playerIndex === 0) {
      state.turnNumber += 1;
    }

    const player = state.players[playerIndex];
    const manaBase = state.turnNumber;
    const secondPlayerBonus = playerIndex === 1 ? 1 : 0;
    player.manaMax = Math.min(manaBase + secondPlayerBonus, MAX_MANA);
    player.manaAtual = player.manaMax;
    refreshUnitsForTurn(player);
  }

  function endTurn(state) {
    if (state.winner) {
      return;
    }

    const currentPlayer = getCurrentPlayer(state);
    resolveEndOfTurnSupport(state, currentPlayer);
    checkWinner(state);

    if (state.winner) {
      return;
    }

    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 2;
    state.selectedAttackerId = null;
    state.selectedEffectCard = null;
    startTurn(state, state.currentPlayerIndex, true);
  }

  function checkWinner(state) {
    const defeated = state.players.find((player) => player.vida <= 0);

    if (!defeated) {
      return null;
    }

    state.winner = state.players.find((player) => player.id !== defeated.id) || null;

    if (state.winner) {
      addLog(state, `${state.winner.nome} venceu a partida.`);
    }

    return state.winner;
  }

  function getCardEffectTag(card) {
    if (card.categoria === "suporte") {
      if (card.efeito === "aura_ataque") {
        return "+ATQ";
      }

      if (card.efeito === "cura_fim_turno") {
        return "CURA";
      }
    }

    if (card.categoria === "efeito") {
      if (card.efeito === "dano_direto") {
        return "INIMIGO";
      }

      if (card.efeito === "cura_direta") {
        return "ALIADO";
      }
    }

    return "";
  }

  function getCardStateText(card) {
    if (card.categoria !== "unidade" || card.estado !== "campo") {
      return null;
    }

    if (card.jaAtacouNoTurno) {
      return "JA ATACOU";
    }

    if (card.podeAgir) {
      return "PRONTA";
    }

    return "EM ESPERA";
  }

  function getCardDisplayData(card, player, options = {}) {
    const showDynamicState = options.showDynamicState !== false;
    const data = {
      nome: card.nome,
      categoria: card.categoria,
      custo: card.custo,
      descricao: card.descricao,
      primaryLabel: null,
      primaryValue: null,
      primaryBonus: null,
      secondaryLabel: null,
      secondaryValue: null,
      stateText: null
    };

    if (card.categoria === "unidade") {
      const attackBreakdown = getUnitAttackBreakdown(card, player);
      data.primaryLabel = "ATQ";
      data.primaryValue = String(attackBreakdown.base);
      data.primaryBonus = showDynamicState && card.estado === "campo" && attackBreakdown.bonus > 0
        ? `+${attackBreakdown.bonus}`
        : null;
      data.secondaryLabel = "VIDA";
      data.secondaryValue = showDynamicState && card.estado === "campo"
        ? `${card.vida}/${card.vidaBase}`
        : String(card.vidaBase);
      data.stateText = showDynamicState ? getCardStateText(card) : null;
      return data;
    }

    data.primaryLabel = "VALOR";
    data.primaryValue = String(card.valor || 0);
    data.secondaryLabel = card.categoria === "suporte" ? "TIPO" : "ALVO";
    data.secondaryValue = getCardEffectTag(card);
    return data;
  }

  function getDeckCardCounts(deck) {
    return deck.reduce((counts, card) => {
      counts[card.id] = (counts[card.id] || 0) + 1;
      return counts;
    }, {});
  }

  function groupHandByCategory(cards) {
    return cards.reduce((groups, card) => {
      if (!groups[card.categoria]) {
        groups[card.categoria] = [];
      }

      groups[card.categoria].push(card);
      return groups;
    }, {
      unidade: [],
      suporte: [],
      efeito: []
    });
  }

  function isAnySidePanelOpen(state) {
    return Boolean(state.isLibraryOpen || state.isRulesOpen || state.isLogOpen);
  }

  function buildCardMarkup(card, player, options = {}) {
    const displayData = getCardDisplayData(card, player, options);
    const countMarkup = options.countLabel
      ? `<div class="card-count-note">${options.countLabel}</div>`
      : "";
    const stateMarkup = displayData.stateText
      ? `<div class="card-state">${displayData.stateText}</div>`
      : "";
    const bonusMarkup = displayData.primaryBonus
      ? `<span class="card-stat-bonus">${displayData.primaryBonus}</span>`
      : "";
    const secondaryMarkup = displayData.secondaryLabel
      ? `
        <div class="card-stat-chip">
          <span class="card-stat-label">${displayData.secondaryLabel}</span>
          <span class="card-stat-value">${displayData.secondaryValue}</span>
        </div>
      `
      : "";

    return `
      <div class="card-shell">
        <div class="card-top">
          <span class="card-cost">${displayData.custo}</span>
          <span class="card-type type-${displayData.categoria}">${displayData.categoria}</span>
        </div>
        <div class="card-art card-art--${displayData.categoria}">
          <div class="card-art-fallback">${displayData.nome}</div>
          <img src="${card.imagem}" alt="Ilustracao de ${displayData.nome}" loading="lazy">
        </div>
        <div class="card-body">
          <h3 class="card-title">${displayData.nome}</h3>
          <p class="card-description">${displayData.descricao}</p>
          ${countMarkup}
        </div>
        <div class="card-stats">
          <div class="card-stat-chip">
            <span class="card-stat-label">${displayData.primaryLabel}</span>
            <span class="card-stat-value">${displayData.primaryValue}</span>
            ${bonusMarkup}
          </div>
          ${secondaryMarkup}
        </div>
        ${stateMarkup}
      </div>
    `;
  }

  function createCardElement(card, config) {
    const button = document.createElement("button");
    const { interactive = false, selected = false, className = "", onClick, player } = config;
    const classes = ["card", className];

    if (interactive) {
      classes.push("playable");
    } else {
      classes.push("disabled");
    }

    if (selected) {
      classes.push("selected");
    }

    if (card.categoria === "unidade" && card.podeAgir && !card.jaAtacouNoTurno) {
      classes.push("ready");
    }

    if (card.categoria === "unidade" && card.jaAtacouNoTurno) {
      classes.push("spent");
    }

    button.type = "button";
    button.className = classes.join(" ").trim();
    button.disabled = !interactive;
    button.setAttribute("aria-label", card.nome);
    button.innerHTML = buildCardMarkup(card, player, { showDynamicState: true });

    if (interactive && typeof onClick === "function") {
      button.addEventListener("click", onClick);
    }

    return button;
  }

  function renderCardList(containerId, cards, factory, emptyMessage) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    if (!cards.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = emptyMessage;
      container.appendChild(empty);
      return;
    }

    cards.forEach((card) => {
      container.appendChild(factory(card));
    });
  }

  function renderLibrary(state) {
    const libraryElement = document.getElementById("card-library");

    if (!libraryElement) {
      return;
    }

    libraryElement.innerHTML = "";
    const deckCounts = state ? getDeckCardCounts(state.deck) : {};

    ["unidade", "suporte", "efeito"].forEach((category) => {
      const section = document.createElement("section");
      section.className = "library-section";

      const title = document.createElement("h3");
      title.className = "library-title";
      title.textContent = category;
      section.appendChild(title);

      CARD_LIBRARY
        .filter((card) => card.categoria === category)
        .forEach((card) => {
          const item = document.createElement("article");
          item.className = "library-card";

          item.setAttribute("aria-label", card.nome);
          item.innerHTML = buildCardMarkup(card, null, {
            showDynamicState: false,
            countLabel: `${deckCounts[card.id] || 0}/${CARD_COPIES_PER_TYPE} no baralho`
          });

          section.appendChild(item);
        });

      libraryElement.appendChild(section);
    });
  }

  function render(state) {
    const currentPlayer = getCurrentPlayer(state);

    state.players.forEach((player, index) => {
      const groupedHand = groupHandByCategory(player.hand);
      document.getElementById(`player-${player.id}-health`).textContent = String(player.vida);
      document.getElementById(`player-${player.id}-hand-count`).textContent = `${player.hand.length} cartas`;
      document.getElementById(`player-${player.id}-board-count`).textContent = `${player.board.length} em campo`;
      document.getElementById(`player-${player.id}-support-count`).textContent = `${player.supportZone.length} suportes`;
      document.getElementById(`player-${player.id}-mana`).textContent = `${player.manaAtual}/${player.manaMax}`;

      ["unidade", "suporte", "efeito"].forEach((category) => {
        document.getElementById(`player-${player.id}-hand-${category}-count`).textContent = String(groupedHand[category].length);

        renderCardList(
          `player-${player.id}-hand-${category}`,
          groupedHand[category],
          (card) => createCardElement(card, {
            interactive: index === state.currentPlayerIndex && !state.winner && canAfford(player, card.custo) && !state.selectedEffectCard,
            className: player.id === 2 ? "opponent-card" : "",
            player,
            onClick: () => {
              playCard(state, index, card.instanceId);
              render(state);
            }
          }),
          category === "unidade"
            ? "Sem unidades."
            : category === "suporte"
              ? "Sem suportes."
              : "Sem efeitos."
        );
      });

      renderCardList(
        `player-${player.id}-board`,
        player.board,
        (card) => {
          const isCurrentPlayer = index === state.currentPlayerIndex;
          const isSelected = card.instanceId === state.selectedAttackerId;
          const canSelect = isCurrentPlayer && !state.winner && card.podeAgir && !card.jaAtacouNoTurno && !state.selectedEffectCard;
          const canBeCombatTargeted = !isCurrentPlayer && Boolean(state.selectedAttackerId) && !state.winner;
          const canBeDamageEffectTargeted = !isCurrentPlayer && Boolean(state.selectedEffectCard) && state.selectedEffectCard.efeito === "dano_direto" && !state.winner;
          const canBeHealingEffectTargeted = isCurrentPlayer && Boolean(state.selectedEffectCard) && state.selectedEffectCard.efeito === "cura_direta" && !state.winner;

          return createCardElement(card, {
            interactive: canSelect || canBeCombatTargeted || canBeDamageEffectTargeted || canBeHealingEffectTargeted,
            selected: isSelected,
            className: (canBeCombatTargeted || canBeDamageEffectTargeted || canBeHealingEffectTargeted) ? "targetable" : "",
            onClick: () => {
              if (canSelect) {
                selectAttacker(state, index, card.instanceId);
              } else if (canBeCombatTargeted) {
                attackTarget(state, state.currentPlayerIndex, "unit", card.instanceId);
              } else if (canBeDamageEffectTargeted) {
                resolveEffectTarget(state, state.currentPlayerIndex, "unit", card.instanceId);
              } else if (canBeHealingEffectTargeted) {
                resolveEffectTarget(state, state.currentPlayerIndex, "ally-unit", card.instanceId);
              }
              render(state);
            },
            player
          });
        },
        "Nenhuma unidade em campo."
      );

      renderCardList(
        `player-${player.id}-support`,
        player.supportZone,
        (card) => {
          const isCurrentPlayer = index === state.currentPlayerIndex;
          const canBeSupportTargeted = !isCurrentPlayer
            && Boolean(state.selectedAttackerId)
            && !state.selectedEffectCard
            && !state.winner
            && player.board.length === 0;

          return createCardElement(card, {
            interactive: canBeSupportTargeted,
            className: `support-card${canBeSupportTargeted ? " targetable" : ""}`,
            onClick: () => {
              if (canBeSupportTargeted) {
                attackTarget(state, state.currentPlayerIndex, "support", card.instanceId);
                render(state);
              }
            },
            player
          });
        },
        "Nenhum suporte ativo."
      );
    });

    const availableActions = getAvailableActions(state, state.currentPlayerIndex);
    document.getElementById("turn-indicator").textContent = state.winner ? `${state.winner.nome} venceu` : currentPlayer.nome;
    document.getElementById("turn-status").textContent = state.winner
      ? "A partida terminou. Inicie uma nova partida para jogar novamente."
      : state.selectedEffectCard
        ? state.selectedEffectCard.efeito === "cura_direta"
          ? "Escolha uma unidade aliada ou use o botao do painel para curar o jogador atual."
          : "Escolha uma unidade inimiga ou use o botao do painel para atingir o jogador rival."
        : state.selectedAttackerId
          ? getOpponentPlayer(state).board.length === 0 && getOpponentPlayer(state).supportZone.length > 0
            ? "Escolha unidade, suporte exposto ou use o botao do painel para atacar o rival."
            : "Escolha uma unidade inimiga ou use o botao do painel para atacar o rival."
          : "Use sua mana, baixe cartas e ataque com unidades prontas.";
    document.getElementById("deck-count").textContent = `${state.deck.length}/${getTotalDeckSize()}`;
    document.getElementById("discard-count").textContent = String(state.discardPile.length);
    document.getElementById("mana-display").textContent = `${currentPlayer.manaAtual}/${currentPlayer.manaMax}`;
    document.getElementById("attacks-left").textContent = String(getAvailableAttackers(currentPlayer).length);
    document.getElementById("winner-banner").textContent = state.winner ? `${state.winner.nome} venceu` : "Sem vencedor";

    const boardElement = document.querySelector(".board");
    const sideRail = document.getElementById("side-rail");
    const libraryPanel = document.getElementById("library-panel");
    const rulesPanel = document.getElementById("rules-panel");
    const logPanel = document.getElementById("log-panel");
    const toggleLibraryButton = document.getElementById("toggle-library-button");
    const toggleRulesButton = document.getElementById("toggle-rules-button");
    const toggleLogButton = document.getElementById("toggle-log-button");
    const anySidePanelOpen = isAnySidePanelOpen(state);

    if (boardElement && sideRail && libraryPanel && rulesPanel && logPanel && toggleLibraryButton && toggleRulesButton && toggleLogButton) {
      boardElement.classList.toggle("board-with-side-rail", anySidePanelOpen);
      sideRail.setAttribute("aria-hidden", String(!anySidePanelOpen));
      libraryPanel.setAttribute("aria-hidden", String(!state.isLibraryOpen));
      rulesPanel.setAttribute("aria-hidden", String(!state.isRulesOpen));
      logPanel.setAttribute("aria-hidden", String(!state.isLogOpen));
      toggleLibraryButton.classList.toggle("is-open", state.isLibraryOpen);
      toggleRulesButton.classList.toggle("is-open", state.isRulesOpen);
      toggleLogButton.classList.toggle("is-open", state.isLogOpen);
      toggleLibraryButton.setAttribute("aria-expanded", String(state.isLibraryOpen));
      toggleRulesButton.setAttribute("aria-expanded", String(state.isRulesOpen));
      toggleLogButton.setAttribute("aria-expanded", String(state.isLogOpen));
    }

    const actionPanel = document.getElementById("player-actions-panel");
    const playerOneActionSlot = document.getElementById("player-1-actions-slot");
    const playerTwoActionSlot = document.getElementById("player-2-actions-slot");

    if (actionPanel && playerOneActionSlot && playerTwoActionSlot) {
      const activeActionSlot = currentPlayer.id === 1 ? playerOneActionSlot : playerTwoActionSlot;
      const inactiveActionSlot = currentPlayer.id === 1 ? playerTwoActionSlot : playerOneActionSlot;

      activeActionSlot.hidden = false;
      inactiveActionSlot.hidden = true;

      if (actionPanel.parentElement !== activeActionSlot) {
        activeActionSlot.appendChild(actionPanel);
      }
    }

    const drawButton = document.getElementById("draw-button");
    const attackPlayerButton = document.getElementById("attack-player-button");
    const cancelAttackButton = document.getElementById("cancel-attack-button");
    const endTurnButton = document.getElementById("end-turn-button");

    drawButton.disabled = Boolean(state.winner) || Boolean(state.selectedAttackerId) || Boolean(state.selectedEffectCard) || !state.deck.length || !canAfford(currentPlayer, DRAW_COST);
    attackPlayerButton.disabled = Boolean(state.winner) || (!state.selectedAttackerId && !state.selectedEffectCard);
    attackPlayerButton.textContent = state.selectedEffectCard && state.selectedEffectCard.efeito === "cura_direta"
      ? "Curar jogador"
      : "Atacar jogador";
    cancelAttackButton.disabled = !state.selectedAttackerId && !state.selectedEffectCard;
    endTurnButton.disabled = Boolean(state.winner);
    endTurnButton.classList.toggle("ready-to-end-turn", !state.winner && !availableActions.hasAny);

    const logElement = document.getElementById("game-log");
    logElement.innerHTML = "";
    state.log.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      logElement.appendChild(item);
    });

    renderLibrary(state);

    document.getElementById("player-bottom-panel").classList.toggle("active", state.currentPlayerIndex === 0 && !state.winner);
    document.getElementById("player-top-panel").classList.toggle("active", state.currentPlayerIndex === 1 && !state.winner);
  }

  function bindUI() {
    document.getElementById("toggle-library-button").addEventListener("click", () => {
      gameState.isLibraryOpen = !gameState.isLibraryOpen;
      render(gameState);
    });

    document.getElementById("toggle-rules-button").addEventListener("click", () => {
      gameState.isRulesOpen = !gameState.isRulesOpen;
      render(gameState);
    });

    document.getElementById("toggle-log-button").addEventListener("click", () => {
      gameState.isLogOpen = !gameState.isLogOpen;
      render(gameState);
    });

    document.getElementById("draw-button").addEventListener("click", () => {
      handleShortcutAction(gameState, "c");
      render(gameState);
    });

      document.getElementById("attack-player-button").addEventListener("click", () => {
      handleShortcutAction(gameState, "a");
      render(gameState);
    });

    document.getElementById("cancel-attack-button").addEventListener("click", () => {
      cancelPendingAction(gameState);
      render(gameState);
    });

    document.getElementById("end-turn-button").addEventListener("click", () => {
      handleShortcutAction(gameState, "e", {
        confirmFn: typeof window !== "undefined" ? window.confirm.bind(window) : null
      });
      render(gameState);
    });

    document.getElementById("restart-button").addEventListener("click", () => {
      gameState = createInitialState();
      render(gameState);
    });

    document.addEventListener("keydown", (event) => {
      if (!["a", "c", "e", "escape"].includes(event.key.toLowerCase())) {
        return;
      }

      const didHandle = handleShortcutAction(gameState, event.key, {
        repeat: event.repeat,
        target: event.target,
        confirmFn: typeof window !== "undefined" ? window.confirm.bind(window) : null
      });

      if (!didHandle) {
        return;
      }

      event.preventDefault();
      render(gameState);
    });
  }

  let gameState = createInitialState();

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      bindUI();
      render(gameState);
    });
  }

  if (typeof module !== "undefined") {
    module.exports = {
      MAX_HEALTH,
      STARTING_HAND_SIZE,
      MAX_MANA,
      DRAW_COST,
      CARD_COPIES_PER_TYPE,
      CARD_LIBRARY,
      createDeck,
      shuffleDeck,
      createInitialState,
      drawCard,
      drawTurnCard,
      playCard,
      resolveEffectTarget,
      selectAttacker,
      attackTarget,
      endTurn,
      checkWinner,
      getUnitAttackBonus,
      getUnitAttackBreakdown,
      getCardDisplayData,
      getCardOverlayData,
      getDeckCardCounts,
      groupHandByCategory,
      getTotalDeckSize,
      isAnySidePanelOpen,
      getAvailableActions,
      attemptEndTurn,
      cancelPendingAction,
      handleShortcutAction,
      getUnitAttack,
      getAvailableAttackers
    };
  }
})();
