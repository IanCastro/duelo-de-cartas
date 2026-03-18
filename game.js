(function () {
  const MAX_HEALTH = 40;
  const STARTING_HAND_SIZE = 4;
  const MAX_MANA = 8;
  const DRAW_COST = 1;
  const CARD_COPIES_PER_TYPE = 4;
  const SEPARATE_DECK_COPIES_PER_TYPE = 2;
  const AI_STEP_DELAY_MS = 500;
  const DECK_MODES = Object.freeze({
    SHARED: "shared",
    SEPARATE: "separate"
  });
  const PLAYER_CONTROLLER_TYPES = Object.freeze({
    HUMAN: "human",
    AI: "ai"
  });
  const LOG_VALIDATION_STATUS = Object.freeze({
    IDLE: "idle",
    VALID: "valid",
    INVALID: "invalid"
  });
  const LOG_EVENT_TYPES = Object.freeze({
    MATCH_START: "match-start",
    DRAW_CARD: "draw-card",
    PLAY_UNIT: "play-unit",
    PLAY_SUPPORT: "play-support",
    EFFECT_DAMAGE_PLAYER: "effect-damage-player",
    EFFECT_DAMAGE_UNIT: "effect-damage-unit",
    EFFECT_HEAL_PLAYER: "effect-heal-player",
    EFFECT_HEAL_UNIT: "effect-heal-unit",
    ATTACK_PLAYER: "attack-player",
    ATTACK_UNIT: "attack-unit",
    ATTACK_SUPPORT: "attack-support",
    ENTER_DEFENSE: "enter-defense",
    CANCEL_DEFENSE: "cancel-defense",
    SUPPORT_HEAL: "support-heal",
    VICTORY: "victory"
  });

  let sessionPlayerControllers = [PLAYER_CONTROLLER_TYPES.HUMAN, PLAYER_CONTROLLER_TYPES.AI];
  let sessionDeckMode = DECK_MODES.SEPARATE;
  let aiTurnTimerId = null;

  const CARD_LIBRARY = [
    {
      id: "unit-1",
      nome: "Escudeiro Solar",
      categoria: "unidade",
      imagem: "assets/cards/unit-1.png",
      custo: 2,
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
      custo: 3,
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
      custo: 4,
      ataque: 2,
      vida: 8,
      vidaBase: 8,
      descricao: "Resistente e ideal para travar o campo."
    },
    {
      id: "unit-4",
      nome: "Berserker Rubro",
      categoria: "unidade",
      imagem: "assets/cards/unit-4.png",
      custo: 5,
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
      custo: 5,
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

  function getTotalDeckSize(deckMode = DECK_MODES.SHARED) {
    if (deckMode === DECK_MODES.SEPARATE) {
      return CARD_LIBRARY.length * SEPARATE_DECK_COPIES_PER_TYPE;
    }

    return CARD_LIBRARY.length * CARD_COPIES_PER_TYPE;
  }

  function instantiateCard(card, suffix, prefix = "") {
    const baseInstanceId = `${card.id}-${suffix}`;
    return {
      ...card,
      instanceId: prefix ? `${prefix}-${baseInstanceId}` : baseInstanceId
    };
  }

  function createDeck(copiesPerType = CARD_COPIES_PER_TYPE, prefix = "") {
    const suffixes = ["a", "b", "c", "d"].slice(0, copiesPerType);
    return CARD_LIBRARY.flatMap((card) => suffixes.map((suffix) => instantiateCard(card, suffix, prefix)));
  }

  function shuffleDeck(cards) {
    const deck = [...cards];

    for (let index = deck.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
    }

    return deck;
  }

  function normalizePlayerController(controller) {
    return controller === PLAYER_CONTROLLER_TYPES.AI ? PLAYER_CONTROLLER_TYPES.AI : PLAYER_CONTROLLER_TYPES.HUMAN;
  }

  function normalizePlayerControllers(controllers) {
    const source = Array.isArray(controllers) ? controllers : sessionPlayerControllers;
    return [
      normalizePlayerController(source[0]),
      normalizePlayerController(source[1])
    ];
  }

  function getSessionPlayerControllers() {
    return [...sessionPlayerControllers];
  }

  function normalizeDeckMode(deckMode) {
    return deckMode === DECK_MODES.SHARED ? DECK_MODES.SHARED : DECK_MODES.SEPARATE;
  }

  function getSessionDeckMode() {
    return sessionDeckMode;
  }

  function setSessionDeckMode(deckMode) {
    sessionDeckMode = normalizeDeckMode(deckMode);
    return sessionDeckMode;
  }

  function setSessionPlayerControllers(controllers) {
    sessionPlayerControllers = normalizePlayerControllers(controllers);
    return getSessionPlayerControllers();
  }

  function setSessionPlayerController(playerIndex, controller) {
    if (playerIndex !== 0 && playerIndex !== 1) {
      return getSessionPlayerControllers();
    }

    sessionPlayerControllers[playerIndex] = normalizePlayerController(controller);
    return getSessionPlayerControllers();
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
    return {
      deck: [],
      discardPile: [],
      playerDecks: [[], []],
      playerDiscardPiles: [[], []],
      currentPlayerIndex: 0,
      playerControllers: getSessionPlayerControllers(),
      deckMode: getSessionDeckMode(),
      isMatchStarted: false,
      isAiVsAiPaused: false,
      isAiTurnInProgress: false,
      aiStepText: null,
      isLibraryOpen: false,
      isRulesOpen: false,
      isLogOpen: false,
      selectedAttackerId: null,
      selectedEffectCard: null,
      selectedLogEntryId: null,
      isWinnerModalOpen: false,
      winner: null,
      turnNumber: 1,
      log: [],
      nextLogNumber: 1,
      logValidationStatus: LOG_VALIDATION_STATUS.IDLE,
      validatedEntryCount: 0,
      logValidationIssues: [],
      players: [
        createPlayer(1, "Sentinela Azul"),
        createPlayer(2, "Guardiao Rubro")
      ]
    };
  }

  function startConfiguredMatch(previousState) {
    const nextState = createInitialState();
    const preservedControllers = setSessionPlayerControllers(previousState?.playerControllers);
    nextState.playerControllers = preservedControllers;
    nextState.deckMode = setSessionDeckMode(previousState?.deckMode);
    nextState.isLibraryOpen = Boolean(previousState?.isLibraryOpen);
    nextState.isRulesOpen = Boolean(previousState?.isRulesOpen);
    nextState.isLogOpen = Boolean(previousState?.isLogOpen);
    nextState.isMatchStarted = true;

    if (nextState.deckMode === DECK_MODES.SHARED) {
      nextState.deck = shuffleDeck(createDeck());
      nextState.discardPile = [];
      nextState.playerDecks = [[], []];
      nextState.playerDiscardPiles = [[], []];
    } else {
      nextState.deck = [];
      nextState.discardPile = [];
      nextState.playerDecks = [
        shuffleDeck(createDeck(SEPARATE_DECK_COPIES_PER_TYPE, "p1")),
        shuffleDeck(createDeck(SEPARATE_DECK_COPIES_PER_TYPE, "p2"))
      ];
      nextState.playerDiscardPiles = [[], []];
    }

    for (let playerIndex = 0; playerIndex < nextState.players.length; playerIndex += 1) {
      for (let draw = 0; draw < STARTING_HAND_SIZE; draw += 1) {
        drawCard(nextState, playerIndex, false);
      }
    }

    startTurn(nextState, 0, false);
    nextState.players[1].manaMax = 1;
    addLog(nextState, buildInitialLogMessage(nextState), buildInitialLogEvent(nextState));
    return nextState;
  }

  function createRestartState(previousState) {
    const nextState = createInitialState();

    if (!previousState) {
      return nextState;
    }

    nextState.playerControllers = setSessionPlayerControllers(previousState.playerControllers);
    nextState.deckMode = setSessionDeckMode(previousState.deckMode);
    nextState.isLibraryOpen = Boolean(previousState.isLibraryOpen);
    nextState.isRulesOpen = Boolean(previousState.isRulesOpen);
    nextState.isLogOpen = Boolean(previousState.isLogOpen);
    return nextState;
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function createEmptyLogValidationResult() {
    return {
      status: LOG_VALIDATION_STATUS.IDLE,
      validatedEntryCount: 0,
      issues: []
    };
  }

  function resetLogValidation(state) {
    const result = createEmptyLogValidationResult();
    state.logValidationStatus = result.status;
    state.validatedEntryCount = result.validatedEntryCount;
    state.logValidationIssues = result.issues;
  }

  function buildInitialLogMessage(state) {
    const playerHands = state.players
      .map((player) => `${player.nome}: ${player.hand.map((card) => card.nome).join(", ")}`)
      .join(" | ");

    return `Partida iniciada. ${playerHands}.`;
  }

  function buildInitialLogEvent(state) {
    return {
      kind: LOG_EVENT_TYPES.MATCH_START,
      currentPlayerIndex: state.currentPlayerIndex,
      turnNumber: state.turnNumber,
      deckMode: state.deckMode
    };
  }

  function getDrawPile(state, playerIndex) {
    if (state.deckMode === DECK_MODES.SEPARATE) {
      return state.playerDecks[playerIndex];
    }

    return state.deck;
  }

  function getDiscardPileForPlayer(state, playerIndex) {
    if (state.deckMode === DECK_MODES.SEPARATE) {
      return state.playerDiscardPiles[playerIndex];
    }

    return state.discardPile;
  }

  function getPlayerDeckTotal(state) {
    return getTotalDeckSize(state?.deckMode);
  }

  function getPlayerDeckCount(state, playerIndex) {
    if (!state?.isMatchStarted) {
      return getPlayerDeckTotal(state);
    }

    const pile = getDrawPile(state, playerIndex);
    return Array.isArray(pile) ? pile.length : 0;
  }

  function getDeckCountForLibrary(state, currentPlayerIndex) {
    if (!state) {
      return {};
    }

    if (!state.isMatchStarted) {
      const copiesPerType = state.deckMode === DECK_MODES.SEPARATE ? SEPARATE_DECK_COPIES_PER_TYPE : CARD_COPIES_PER_TYPE;
      return getDeckCardCounts(createDeck(copiesPerType));
    }

    const libraryPlayerIndex = state.deckMode === DECK_MODES.SEPARATE ? currentPlayerIndex : 0;
    return getDeckCardCounts(getDrawPile(state, libraryPlayerIndex));
  }

  function getGlobalDeckCount(state) {
    if (!state) {
      return 0;
    }

    if (!state.isMatchStarted) {
      return getTotalDeckSize(state.deckMode);
    }

    if (state.deckMode === DECK_MODES.SEPARATE) {
      return getPlayerDeckCount(state, 0) + getPlayerDeckCount(state, 1);
    }

    return state.deck.length;
  }

  function getGlobalDiscardCount(state) {
    if (!state) {
      return 0;
    }

    if (state.deckMode === DECK_MODES.SEPARATE) {
      return state.playerDiscardPiles.reduce((total, pile) => total + pile.length, 0);
    }

    return state.discardPile.length;
  }

  function createStateSnapshot(state) {
    return {
      deck: cloneData(state.deck),
      discardPile: cloneData(state.discardPile),
      playerDecks: cloneData(state.playerDecks),
      playerDiscardPiles: cloneData(state.playerDiscardPiles),
      currentPlayerIndex: state.currentPlayerIndex,
      playerControllers: cloneData(state.playerControllers),
      deckMode: state.deckMode,
      isMatchStarted: state.isMatchStarted,
      isLibraryOpen: state.isLibraryOpen,
      isRulesOpen: state.isRulesOpen,
      isLogOpen: state.isLogOpen,
      selectedAttackerId: state.selectedAttackerId,
      selectedEffectCard: cloneData(state.selectedEffectCard),
      winnerPlayerId: state.winner ? state.winner.id : null,
      turnNumber: state.turnNumber,
      players: cloneData(state.players)
    };
  }

  function cloneLogEntries(entries) {
    return entries.map((entry) => ({
      id: entry.id,
      numero: entry.numero,
      texto: entry.texto,
      event: cloneData(entry.event),
      snapshot: cloneData(entry.snapshot)
    }));
  }

  function addLog(state, message, event = null) {
    const entryNumber = state.nextLogNumber || (state.log.length + 1);

    state.log.push({
      id: entryNumber,
      numero: entryNumber,
      texto: message,
      event: cloneData(event),
      snapshot: createStateSnapshot(state)
    });

    state.nextLogNumber = entryNumber + 1;
    resetLogValidation(state);
  }

  function restoreStateFromSnapshot(snapshot, logEntries) {
    const restoredState = {
      deck: cloneData(snapshot.deck),
      discardPile: cloneData(snapshot.discardPile),
      playerDecks: cloneData(snapshot.playerDecks || [[], []]),
      playerDiscardPiles: cloneData(snapshot.playerDiscardPiles || [[], []]),
      currentPlayerIndex: snapshot.currentPlayerIndex,
      playerControllers: normalizePlayerControllers(snapshot.playerControllers),
      deckMode: normalizeDeckMode(snapshot.deckMode),
      isMatchStarted: Boolean(snapshot.isMatchStarted),
      isAiVsAiPaused: false,
      isAiTurnInProgress: false,
      aiStepText: null,
      isLibraryOpen: snapshot.isLibraryOpen,
      isRulesOpen: snapshot.isRulesOpen,
      isLogOpen: snapshot.isLogOpen,
      selectedAttackerId: snapshot.selectedAttackerId,
      selectedEffectCard: cloneData(snapshot.selectedEffectCard),
      selectedLogEntryId: null,
      isWinnerModalOpen: Boolean(snapshot.winnerPlayerId),
      winner: null,
      turnNumber: snapshot.turnNumber,
      log: cloneLogEntries(logEntries),
      nextLogNumber: logEntries.length + 1,
      logValidationStatus: LOG_VALIDATION_STATUS.IDLE,
      validatedEntryCount: 0,
      logValidationIssues: [],
      players: cloneData(snapshot.players)
    };

    restoredState.winner = snapshot.winnerPlayerId
      ? restoredState.players.find((player) => player.id === snapshot.winnerPlayerId) || null
      : null;

    return restoredState;
  }

  function getMatchCardPoolSize(deckMode) {
    if (deckMode === DECK_MODES.SEPARATE) {
      return getTotalDeckSize(DECK_MODES.SEPARATE) * 2;
    }

    return getTotalDeckSize(DECK_MODES.SHARED);
  }

  function createReplayStateFromSnapshot(snapshot) {
    return restoreStateFromSnapshot(snapshot, []);
  }

  function createValidationIssue(entry, code, message) {
    return {
      entryId: entry?.id ?? null,
      numero: entry?.numero ?? null,
      code,
      message
    };
  }

  function findCardByInstanceId(cards, instanceId) {
    return Array.isArray(cards)
      ? cards.find((card) => card.instanceId === instanceId) || null
      : null;
  }

  function removeCardByInstanceId(cards, instanceId) {
    if (!Array.isArray(cards)) {
      return null;
    }

    const cardIndex = cards.findIndex((card) => card.instanceId === instanceId);
    if (cardIndex === -1) {
      return null;
    }

    const [card] = cards.splice(cardIndex, 1);
    return card;
  }

  function getPlayerIndexById(state, playerId) {
    return state.players.findIndex((player) => player.id === playerId);
  }

  function getAllCardsFromStateLike(stateLike) {
    const cards = [];

    if (!stateLike) {
      return cards;
    }

    const pushCards = (list) => {
      if (Array.isArray(list)) {
        cards.push(...list);
      }
    };

    pushCards(stateLike.deck);
    pushCards(stateLike.discardPile);
    pushCards(stateLike.playerDecks?.[0]);
    pushCards(stateLike.playerDecks?.[1]);
    pushCards(stateLike.playerDiscardPiles?.[0]);
    pushCards(stateLike.playerDiscardPiles?.[1]);

    (stateLike.players || []).forEach((player) => {
      pushCards(player.hand);
      pushCards(player.board);
      pushCards(player.supportZone);
    });

    if (stateLike.selectedEffectCard) {
      cards.push(stateLike.selectedEffectCard);
    }

    return cards;
  }

  function getSnapshotSignature(snapshot) {
    return JSON.stringify(snapshot);
  }

  function validateSnapshotIntegrity(snapshot, entry) {
    const issues = [];

    if (!snapshot) {
      issues.push(createValidationIssue(entry, "missing-snapshot", "A linha do log nao possui snapshot."));
      return issues;
    }

    if (!Array.isArray(snapshot.players) || snapshot.players.length !== 2) {
      issues.push(createValidationIssue(entry, "invalid-players", "O snapshot nao possui exatamente dois jogadores."));
      return issues;
    }

    const deckMode = normalizeDeckMode(snapshot.deckMode);
    const allCards = getAllCardsFromStateLike(snapshot);
    const expectedCardCount = getMatchCardPoolSize(deckMode);

    if (allCards.length !== expectedCardCount) {
      issues.push(createValidationIssue(entry, "card-count-mismatch", `O snapshot deveria ter ${expectedCardCount} cartas no total, mas tem ${allCards.length}.`));
    }

    const seenInstanceIds = new Set();
    for (const card of allCards) {
      if (!card || !card.instanceId) {
        issues.push(createValidationIssue(entry, "missing-instance-id", "Existe uma carta sem instanceId no snapshot."));
        continue;
      }

      if (seenInstanceIds.has(card.instanceId)) {
        issues.push(createValidationIssue(entry, "duplicate-instance-id", `A carta ${card.instanceId} aparece mais de uma vez no snapshot.`));
      }

      seenInstanceIds.add(card.instanceId);
    }

    if (snapshot.currentPlayerIndex !== 0 && snapshot.currentPlayerIndex !== 1) {
      issues.push(createValidationIssue(entry, "invalid-current-player", "O snapshot possui currentPlayerIndex invalido."));
    }

    if (!Number.isInteger(snapshot.turnNumber) || snapshot.turnNumber < 1) {
      issues.push(createValidationIssue(entry, "invalid-turn-number", "O snapshot possui turnNumber invalido."));
    }

    snapshot.players.forEach((player) => {
      if (player.vida < 0 || player.vida > MAX_HEALTH) {
        issues.push(createValidationIssue(entry, "invalid-player-health", `${player.nome} possui vida fora dos limites.`));
      }

      if (player.manaMax < 0 || player.manaMax > MAX_MANA) {
        issues.push(createValidationIssue(entry, "invalid-player-mana-max", `${player.nome} possui mana maxima fora dos limites.`));
      }

      if (player.manaAtual < 0 || player.manaAtual > player.manaMax) {
        issues.push(createValidationIssue(entry, "invalid-player-mana-current", `${player.nome} possui mana atual fora dos limites.`));
      }

      player.board.forEach((unit) => {
        if (unit.vida < 0 || unit.vida > unit.vidaBase) {
          issues.push(createValidationIssue(entry, "invalid-unit-health", `${unit.nome} possui vida invalida no snapshot.`));
        }

        if (unit.isDefending && (!Number.isInteger(unit.defenseTurnNumber) || !unit.jaAtacouNoTurno)) {
          issues.push(createValidationIssue(entry, "invalid-defense-state", `${unit.nome} esta em defesa com estado invalido.`));
        }
      });
    });

    if (snapshot.selectedAttackerId) {
      const attackerExists = snapshot.players[snapshot.currentPlayerIndex]?.board
        ?.some((unit) => unit.instanceId === snapshot.selectedAttackerId);
      if (!attackerExists) {
        issues.push(createValidationIssue(entry, "invalid-selected-attacker", "selectedAttackerId nao aponta para uma unidade valida do jogador atual."));
      }
    }

    if (snapshot.selectedEffectCard && snapshot.selectedEffectCard.categoria !== "efeito") {
      issues.push(createValidationIssue(entry, "invalid-selected-effect", "selectedEffectCard nao referencia uma carta de efeito."));
    }

    if (snapshot.winnerPlayerId != null) {
      const winnerIndex = getPlayerIndexById(snapshot, snapshot.winnerPlayerId);
      const defeatedExists = snapshot.players.some((player) => player.id !== snapshot.winnerPlayerId && player.vida <= 0);
      if (winnerIndex === -1 || !defeatedExists) {
        issues.push(createValidationIssue(entry, "invalid-winner", "O winnerPlayerId do snapshot nao e coerente com a vida dos jogadores."));
      }
    }

    return issues;
  }

  function applySilentReplayTurnTransition(state, previouslyResolvedEventKind = null) {
    if (!state?.isMatchStarted || state.winner) {
      return false;
    }

    if (state.players.some((player) => player.vida <= 0)) {
      return false;
    }

    const currentPlayer = getCurrentPlayer(state);
    const healAmount = getSupportBonus(currentPlayer, "cura_fim_turno");
    const recovered = Math.min(healAmount, MAX_HEALTH - currentPlayer.vida);

    if (recovered > 0 && previouslyResolvedEventKind !== LOG_EVENT_TYPES.SUPPORT_HEAL) {
      return false;
    }

    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 2;
    state.selectedAttackerId = null;
    state.selectedEffectCard = null;
    startTurn(state, state.currentPlayerIndex, true);
    return true;
  }

  function applyLoggedEvent(state, event) {
    if (!state || !event || !event.kind) {
      return { ok: false, code: "missing-event", message: "A linha do log nao possui um evento estruturado valido." };
    }

    const player = event.playerIndex === 0 || event.playerIndex === 1
      ? state.players[event.playerIndex]
      : null;
    const opponent = event.targetPlayerIndex === 0 || event.targetPlayerIndex === 1
      ? state.players[event.targetPlayerIndex]
      : null;

    switch (event.kind) {
      case LOG_EVENT_TYPES.MATCH_START:
        return { ok: true };

      case LOG_EVENT_TYPES.DRAW_CARD: {
        if (!player || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-draw-player", message: "O replay nao encontrou o jogador correto para a compra." };
        }

        const drawPile = getDrawPile(state, event.playerIndex);
        const topCard = drawPile[drawPile.length - 1];
        if (!topCard || topCard.instanceId !== event.cardInstanceId) {
          return { ok: false, code: "unexpected-draw-order", message: "A carta comprada nao corresponde ao topo do baralho no replay." };
        }

        if (!spendMana(player, DRAW_COST)) {
          return { ok: false, code: "invalid-draw-mana", message: "O replay nao conseguiu pagar o custo da compra." };
        }

        drawCard(state, event.playerIndex, false);
        state.selectedAttackerId = null;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.PLAY_UNIT: {
        if (!player || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-unit-player", message: "O replay nao encontrou o jogador correto para baixar a unidade." };
        }

        const card = removeCardByInstanceId(player.hand, event.cardInstanceId);
        if (!card || card.categoria !== "unidade") {
          return { ok: false, code: "missing-unit-card", message: "A unidade registrada no log nao esta na mao durante o replay." };
        }

        if (!spendMana(player, card.custo)) {
          return { ok: false, code: "invalid-unit-mana", message: "O replay nao conseguiu pagar a mana da unidade baixada." };
        }

        player.board.push({
          ...card,
          estado: "campo",
          podeAgir: true,
          jaAtacouNoTurno: false,
          isDefending: false,
          defenseTurnNumber: null
        });
        state.selectedAttackerId = null;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.PLAY_SUPPORT: {
        if (!player || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-support-player", message: "O replay nao encontrou o jogador correto para ativar o suporte." };
        }

        const card = removeCardByInstanceId(player.hand, event.cardInstanceId);
        if (!card || card.categoria !== "suporte") {
          return { ok: false, code: "missing-support-card", message: "O suporte registrado no log nao esta na mao durante o replay." };
        }

        if (!spendMana(player, card.custo)) {
          return { ok: false, code: "invalid-support-mana", message: "O replay nao conseguiu pagar a mana do suporte." };
        }

        player.supportZone.push({
          ...card,
          estado: "suporte"
        });
        state.selectedAttackerId = null;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.EFFECT_DAMAGE_PLAYER: {
        if (!player || !opponent || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-effect-player", message: "O replay nao conseguiu resolver o dano direto no jogador." };
        }

        const card = removeCardByInstanceId(player.hand, event.cardInstanceId);
        if (!card || card.efeito !== "dano_direto") {
          return { ok: false, code: "missing-damage-card", message: "A carta de dano direto nao esta disponivel para replay." };
        }

        if (!spendMana(player, card.custo)) {
          return { ok: false, code: "invalid-effect-mana", message: "O replay nao conseguiu pagar a mana do efeito de dano." };
        }

        if (card.valor !== event.damage) {
          return { ok: false, code: "damage-mismatch", message: "O dano registrado no evento nao bate com o valor do efeito." };
        }

        opponent.vida = Math.max(opponent.vida - event.damage, 0);
        moveCardToDiscardForOwner(state, card, event.playerIndex);
        state.selectedEffectCard = null;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.EFFECT_DAMAGE_UNIT: {
        if (!player || !opponent || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-effect-unit-player", message: "O replay nao conseguiu resolver o dano direto na unidade." };
        }

        const card = removeCardByInstanceId(player.hand, event.cardInstanceId);
        const target = findCardByInstanceId(opponent.board, event.targetInstanceId);
        if (!card || card.efeito !== "dano_direto" || !target) {
          return { ok: false, code: "missing-effect-unit-target", message: "A carta ou o alvo de dano direto nao existem durante o replay." };
        }

        if (!spendMana(player, card.custo)) {
          return { ok: false, code: "invalid-effect-unit-mana", message: "O replay nao conseguiu pagar a mana do efeito de dano em unidade." };
        }

        const expectedDamage = getMitigatedDamage(target, card.valor);
        if (expectedDamage !== event.damage) {
          return { ok: false, code: "effect-unit-damage-mismatch", message: "O dano efetivo do evento nao bate com o dano calculado no replay." };
        }

        target.vida = Math.max(target.vida - event.damage, 0);
        if (event.defeated) {
          removeCardByInstanceId(opponent.board, event.targetInstanceId);
          moveCardToDiscardForOwner(state, target, event.targetPlayerIndex);
        } else if (target.vida <= 0) {
          return { ok: false, code: "effect-unit-defeat-mismatch", message: "O replay derrotou a unidade, mas o evento nao marcou derrota." };
        }

        moveCardToDiscardForOwner(state, card, event.playerIndex);
        state.selectedEffectCard = null;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.EFFECT_HEAL_PLAYER: {
        if (!player || !opponent || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-heal-player", message: "O replay nao conseguiu resolver a cura no jogador." };
        }

        const card = removeCardByInstanceId(player.hand, event.cardInstanceId);
        if (!card || card.efeito !== "cura_direta") {
          return { ok: false, code: "missing-heal-card", message: "A carta de cura nao esta disponivel para replay." };
        }

        if (!spendMana(player, card.custo)) {
          return { ok: false, code: "invalid-heal-mana", message: "O replay nao conseguiu pagar a mana do efeito de cura." };
        }

        const targetPlayer = state.players[event.targetPlayerIndex];
        const expectedRecovered = Math.min(card.valor, MAX_HEALTH - targetPlayer.vida);
        if (expectedRecovered !== event.recovered) {
          return { ok: false, code: "heal-player-mismatch", message: "A cura registrada no evento nao bate com a cura calculada no replay." };
        }

        targetPlayer.vida = Math.min(targetPlayer.vida + card.valor, MAX_HEALTH);
        moveCardToDiscardForOwner(state, card, event.playerIndex);
        state.selectedEffectCard = null;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.EFFECT_HEAL_UNIT: {
        if (!player || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-heal-unit-player", message: "O replay nao conseguiu resolver a cura na unidade." };
        }

        const card = removeCardByInstanceId(player.hand, event.cardInstanceId);
        const target = findCardByInstanceId(state.players[event.targetPlayerIndex].board, event.targetInstanceId);
        if (!card || card.efeito !== "cura_direta" || !target) {
          return { ok: false, code: "missing-heal-unit-target", message: "A carta ou o alvo de cura nao existem durante o replay." };
        }

        if (!spendMana(player, card.custo)) {
          return { ok: false, code: "invalid-heal-unit-mana", message: "O replay nao conseguiu pagar a mana do efeito de cura em unidade." };
        }

        const expectedRecovered = Math.min(card.valor, target.vidaBase - target.vida);
        if (expectedRecovered !== event.recovered) {
          return { ok: false, code: "heal-unit-mismatch", message: "A cura registrada no evento nao bate com a cura calculada no replay." };
        }

        target.vida = Math.min(target.vida + card.valor, target.vidaBase);
        moveCardToDiscardForOwner(state, card, event.playerIndex);
        state.selectedEffectCard = null;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.ATTACK_PLAYER: {
        if (!player || !opponent || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-attack-player", message: "O replay nao encontrou o ataque ao jogador correto." };
        }

        const attacker = findCardByInstanceId(player.board, event.attackerInstanceId);
        if (!attacker) {
          return { ok: false, code: "missing-attacker", message: "A unidade atacante nao existe no replay." };
        }

        const expectedDamage = getUnitAttack(attacker, player);
        if (expectedDamage !== event.damage) {
          return { ok: false, code: "attack-player-damage-mismatch", message: "O dano do ataque ao jogador nao bate com o calculado no replay." };
        }

        attacker.jaAtacouNoTurno = true;
        state.selectedAttackerId = null;
        opponent.vida = Math.max(opponent.vida - event.damage, 0);
        return { ok: true };
      }

      case LOG_EVENT_TYPES.ATTACK_SUPPORT: {
        if (!player || !opponent || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-attack-support", message: "O replay nao encontrou o ataque ao suporte correto." };
        }

        const attacker = findCardByInstanceId(player.board, event.attackerInstanceId);
        const support = findCardByInstanceId(opponent.supportZone, event.targetInstanceId);
        if (!attacker || !support) {
          return { ok: false, code: "missing-support-target", message: "O atacante ou o suporte alvo nao existem no replay." };
        }

        if (opponent.board.length > 0) {
          return { ok: false, code: "support-target-blocked", message: "O replay encontrou unidades inimigas em campo ao tentar destruir um suporte." };
        }

        attacker.jaAtacouNoTurno = true;
        state.selectedAttackerId = null;
        removeCardByInstanceId(opponent.supportZone, event.targetInstanceId);
        moveCardToDiscardForOwner(state, support, event.targetPlayerIndex);
        return { ok: true };
      }

      case LOG_EVENT_TYPES.ATTACK_UNIT: {
        if (!player || !opponent || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-attack-unit", message: "O replay nao encontrou o ataque a unidade correto." };
        }

        const attacker = findCardByInstanceId(player.board, event.attackerInstanceId);
        const target = findCardByInstanceId(opponent.board, event.targetInstanceId);
        if (!attacker || !target) {
          return { ok: false, code: "missing-attack-unit-target", message: "O atacante ou a unidade alvo nao existem no replay." };
        }

        const expectedDamage = getMitigatedDamage(target, getUnitAttack(attacker, player));
        if (expectedDamage !== event.damage) {
          return { ok: false, code: "attack-unit-damage-mismatch", message: "O dano do ataque na unidade nao bate com o calculado no replay." };
        }

        attacker.jaAtacouNoTurno = true;
        state.selectedAttackerId = null;
        target.vida = Math.max(target.vida - event.damage, 0);
        if (event.defeated) {
          removeCardByInstanceId(opponent.board, event.targetInstanceId);
          moveCardToDiscardForOwner(state, target, event.targetPlayerIndex);
        } else if (target.vida <= 0) {
          return { ok: false, code: "attack-unit-defeat-mismatch", message: "O replay derrotou a unidade, mas o evento nao marcou derrota." };
        }

        return { ok: true };
      }

      case LOG_EVENT_TYPES.ENTER_DEFENSE: {
        if (!player || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-enter-defense-player", message: "O replay nao encontrou o jogador correto para entrar em defesa." };
        }

        const unit = findCardByInstanceId(player.board, event.unitInstanceId);
        if (!unit || !canUnitEnterDefense(state, event.playerIndex, unit)) {
          return { ok: false, code: "invalid-enter-defense-state", message: "A unidade nao pode entrar em defesa no replay." };
        }

        state.selectedAttackerId = null;
        unit.isDefending = true;
        unit.defenseTurnNumber = state.turnNumber;
        unit.jaAtacouNoTurno = true;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.CANCEL_DEFENSE: {
        if (!player || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-cancel-defense-player", message: "O replay nao encontrou o jogador correto para cancelar a defesa." };
        }

        const unit = findCardByInstanceId(player.board, event.unitInstanceId);
        if (!unit || !canUnitCancelDefense(state, event.playerIndex, unit)) {
          return { ok: false, code: "invalid-cancel-defense-state", message: "A unidade nao pode cancelar a defesa no replay." };
        }

        unit.isDefending = false;
        unit.defenseTurnNumber = null;
        unit.jaAtacouNoTurno = false;
        unit.podeAgir = true;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.SUPPORT_HEAL: {
        if (!player || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-support-heal-player", message: "O replay nao encontrou o jogador correto para a cura de suporte." };
        }

        const healAmount = getSupportBonus(player, "cura_fim_turno");
        const expectedRecovered = Math.min(healAmount, MAX_HEALTH - player.vida);
        if (expectedRecovered !== event.recovered) {
          return { ok: false, code: "support-heal-mismatch", message: "A cura de suporte registrada nao bate com o valor calculado no replay." };
        }

        player.vida = Math.min(player.vida + healAmount, MAX_HEALTH);
        return { ok: true };
      }

      case LOG_EVENT_TYPES.VICTORY: {
        const winnerIndex = getPlayerIndexById(state, event.winnerPlayerId);
        if (winnerIndex === -1) {
          return { ok: false, code: "invalid-victory-player", message: "O evento de vitoria referencia um jogador inexistente." };
        }

        state.winner = state.players[winnerIndex];
        state.isWinnerModalOpen = true;
        return { ok: true };
      }

      default:
        return { ok: false, code: "unknown-event-kind", message: `Tipo de evento desconhecido: ${event.kind}.` };
    }
  }

  function validateMatchLog(logEntries) {
    const issues = [];

    if (!Array.isArray(logEntries) || !logEntries.length) {
      return {
        status: LOG_VALIDATION_STATUS.IDLE,
        validatedEntryCount: 0,
        issues
      };
    }

    const seenIds = new Set();
    let expectedNumber = 1;

    logEntries.forEach((entry) => {
      if (!entry) {
        issues.push(createValidationIssue(null, "missing-entry", "Existe uma linha vazia no log."));
        expectedNumber += 1;
        return;
      }

      if (seenIds.has(entry.id)) {
        issues.push(createValidationIssue(entry, "duplicate-id", `A linha ${entry.numero} reutiliza um id ja existente.`));
      }
      seenIds.add(entry.id);

      if (entry.numero !== expectedNumber) {
        issues.push(createValidationIssue(entry, "invalid-sequence", `A numeracao esperada era ${expectedNumber}, mas a linha usa ${entry.numero}.`));
      }

      if (!entry.snapshot) {
        issues.push(createValidationIssue(entry, "missing-snapshot", "A linha do log nao possui snapshot."));
      }

      if (!entry.event) {
        issues.push(createValidationIssue(entry, "missing-event", "A linha do log nao possui evento estruturado."));
      }

      issues.push(...validateSnapshotIntegrity(entry.snapshot, entry));
      expectedNumber += 1;
    });

    if (logEntries[0]?.event?.kind !== LOG_EVENT_TYPES.MATCH_START) {
      issues.push(createValidationIssue(logEntries[0], "missing-match-start", "A primeira linha do log deveria registrar o inicio da partida."));
    }

    let validatedEntryCount = 0;

    if (logEntries[0]?.snapshot) {
      let replayState = createReplayStateFromSnapshot(logEntries[0].snapshot);
      validatedEntryCount = 1;

      for (let entryIndex = 1; entryIndex < logEntries.length; entryIndex += 1) {
        const entry = logEntries[entryIndex];
        const previousEntry = logEntries[entryIndex - 1] || null;
        if (!entry?.snapshot || !entry?.event) {
          continue;
        }

        let workingState = createReplayStateFromSnapshot(createStateSnapshot(replayState));
        let matched = false;
        let lastApplyError = null;
        const maxSilentTransitions = 32;

        for (let silentTransitions = 0; silentTransitions <= maxSilentTransitions; silentTransitions += 1) {
          if (silentTransitions > 0) {
            const advanced = applySilentReplayTurnTransition(
              workingState,
              silentTransitions === 1 ? previousEntry?.event?.kind : null
            );
            if (!advanced) {
              break;
            }
          }

          const attemptState = createReplayStateFromSnapshot(createStateSnapshot(workingState));
          const applyResult = applyLoggedEvent(attemptState, entry.event);

          if (!applyResult.ok) {
            lastApplyError = applyResult;
            continue;
          }

          if (getSnapshotSignature(createStateSnapshot(attemptState)) === getSnapshotSignature(entry.snapshot)) {
            replayState = attemptState;
            validatedEntryCount = entryIndex + 1;
            matched = true;
            break;
          }

          lastApplyError = {
            code: "snapshot-mismatch",
            message: "O evento foi reaplicado, mas o snapshot reconstruido nao bate com o snapshot salvo."
          };
        }

        if (!matched) {
          issues.push(createValidationIssue(
            entry,
            lastApplyError?.code || "replay-failed",
            lastApplyError?.message || "Nao foi possivel reproduzir esta linha do log a partir da linha anterior."
          ));
        }
      }
    }

    return {
      status: issues.length ? LOG_VALIDATION_STATUS.INVALID : LOG_VALIDATION_STATUS.VALID,
      validatedEntryCount,
      issues
    };
  }

  function rewindToLogEntry(state, entryId) {
    const targetIndex = state.log.findIndex((entry) => entry.id === entryId);

    if (targetIndex === -1) {
      return state;
    }

    const keptEntries = state.log.slice(0, targetIndex + 1);
    return restoreStateFromSnapshot(keptEntries[targetIndex].snapshot, keptEntries);
  }

  function attemptRewindToLogEntry(state, entryId, options = {}) {
    const targetEntry = state.log.find((entry) => entry.id === entryId);

    if (!targetEntry) {
      return state;
    }

    if (typeof options.confirmFn === "function") {
      const confirmed = options.confirmFn(`Deseja voltar para a acao ${targetEntry.numero} e descartar o futuro da partida?`);
      if (!confirmed) {
        return state;
      }
    }

    return rewindToLogEntry(state, entryId);
  }

  function handleLogEntryClick(state, entryId, options = {}) {
    if (!state) {
      return state;
    }

    const latestEntry = state.log[state.log.length - 1] || null;
    if (latestEntry && latestEntry.id === entryId) {
      state.selectedLogEntryId = null;
      return state;
    }

    if (state.selectedLogEntryId === entryId) {
      return attemptRewindToLogEntry(state, entryId, options);
    }

    state.selectedLogEntryId = entryId;
    return state;
  }

  function getCurrentPlayer(state) {
    return state.players[state.currentPlayerIndex];
  }

  function getOpponentPlayer(state) {
    return state.players[(state.currentPlayerIndex + 1) % 2];
  }

  function compareText(left, right) {
    const leftText = String(left || "");
    const rightText = String(right || "");
    if (leftText < rightText) {
      return -1;
    }

    if (leftText > rightText) {
      return 1;
    }

    return 0;
  }

  function isAiEnabled(state) {
    return Boolean(
      state
      && Array.isArray(state.playerControllers)
      && state.playerControllers.some((controller) => normalizePlayerController(controller) === PLAYER_CONTROLLER_TYPES.AI)
    );
  }

  function isAiControlledPlayer(state, playerIndex) {
    if (!state || (playerIndex !== 0 && playerIndex !== 1)) {
      return false;
    }

    const controllers = normalizePlayerControllers(state?.playerControllers);
    return controllers[playerIndex] === PLAYER_CONTROLLER_TYPES.AI;
  }

  function isAiVsAiMatch(state) {
    return Boolean(
      state
      && state.isMatchStarted
      && isAiControlledPlayer(state, 0)
      && isAiControlledPlayer(state, 1)
    );
  }

  function toggleAiVsAiPause(state) {
    if (!isAiVsAiMatch(state) || state.winner) {
      return false;
    }

    state.isAiVsAiPaused = !state.isAiVsAiPaused;
    if (!state.isAiVsAiPaused) {
      state.aiStepText = "IA retomou a partida.";
    } else {
      state.isAiTurnInProgress = false;
      state.aiStepText = "IA x IA pausado.";
    }
    return true;
  }

  function isAiTurnActive(state) {
    return Boolean(state && state.isMatchStarted && !state.winner && isAiControlledPlayer(state, state.currentPlayerIndex));
  }

  function shouldRunAi(state) {
    return isAiTurnActive(state) && !isViewingHistory(state) && !state.isAiVsAiPaused;
  }

  function cancelAiTurn(state = null) {
    if (aiTurnTimerId !== null) {
      clearTimeout(aiTurnTimerId);
      aiTurnTimerId = null;
    }

    if (!state) {
      return;
    }

    state.isAiTurnInProgress = false;
    if (!isAiTurnActive(state)) {
      state.aiStepText = null;
    }
  }

  function getAiPlayableCards(state) {
    const playerIndex = state.currentPlayerIndex;
    const player = state.players[playerIndex];
    return player.hand.filter((card) => canPlayCard(state, playerIndex, card));
  }

  function getAiReadyAttackers(state) {
    return getAvailableAttackers(getCurrentPlayer(state));
  }

  function compareCardsByCostAsc(left, right) {
    return ((left.custo || 0) - (right.custo || 0))
      || compareText(left.nome, right.nome);
  }

  function compareUnitsByThreatDesc(left, right) {
    return (right.ataque - left.ataque)
      || ((right.vidaBase || right.vida || 0) - (left.vidaBase || left.vida || 0))
      || ((right.custo || 0) - (left.custo || 0))
      || compareText(left.nome, right.nome);
  }

  function compareUnitsForAiPlay(left, right) {
    return ((right.vidaBase || right.vida || 0) - (left.vidaBase || left.vida || 0))
      || (right.ataque - left.ataque)
      || ((left.custo || 0) - (right.custo || 0))
      || compareText(left.nome, right.nome);
  }

  function compareAttackersByPowerDesc(player) {
    return (left, right) => (getUnitAttack(right, player) - getUnitAttack(left, player))
      || ((right.vida || right.vidaBase || 0) - (left.vida || left.vidaBase || 0))
      || compareText(left.nome, right.nome);
  }

  function compareAttackersByPowerAsc(player) {
    return (left, right) => (getUnitAttack(left, player) - getUnitAttack(right, player))
      || ((left.vida || left.vidaBase || 0) - (right.vida || right.vidaBase || 0))
      || compareText(left.nome, right.nome);
  }

  function compareHealableUnits(left, right) {
    return ((right.vidaBase - right.vida) - (left.vidaBase - left.vida))
      || (right.ataque - left.ataque)
      || compareText(left.nome, right.nome);
  }

  function getAiSupportPriority(card) {
    if (card.efeito === "aura_ataque") {
      return 0;
    }

    if (card.efeito === "cura_fim_turno") {
      return 1;
    }

    return 2;
  }

  function compareSupportsForAiTarget(left, right) {
    return (getAiSupportPriority(left) - getAiSupportPriority(right))
      || compareText(left.nome, right.nome);
  }

  function getNextAiAction(state) {
    if (!shouldRunAi(state)) {
      return null;
    }

    const player = getCurrentPlayer(state);
    const opponent = getOpponentPlayer(state);
    const playableCards = getAiPlayableCards(state);
    const readyAttackers = getAiReadyAttackers(state);
    const damageCards = playableCards
      .filter((card) => card.efeito === "dano_direto")
      .sort(compareCardsByCostAsc);
    const healingCards = playableCards
      .filter((card) => card.efeito === "cura_direta")
      .sort(compareCardsByCostAsc);
    const supportCards = playableCards
      .filter((card) => card.categoria === "suporte")
      .sort(compareCardsByCostAsc);
    const unitCards = playableCards
      .filter((card) => card.categoria === "unidade")
      .sort(compareUnitsForAiPlay);
    const defendableUnits = player.board
      .filter((unit) => canUnitEnterDefense(state, state.currentPlayerIndex, unit))
      .sort((left, right) => ((right.custo || 0) - (left.custo || 0))
        || ((right.vidaBase || 0) - (left.vidaBase || 0))
        || (right.ataque - left.ataque)
        || compareText(left.nome, right.nome));

    const lethalAttacker = [...readyAttackers]
      .sort(compareAttackersByPowerAsc(player))
      .find((attacker) => getUnitAttack(attacker, player) >= opponent.vida);
    if (lethalAttacker) {
      return {
        type: "attack-player",
        attackerInstanceId: lethalAttacker.instanceId,
        text: `IA atacou ${opponent.nome} com ${lethalAttacker.nome}.`
      };
    }

    const lethalDamageCard = damageCards.find((card) => card.valor >= opponent.vida);
    if (lethalDamageCard) {
      return {
        type: "effect-player",
        cardInstanceId: lethalDamageCard.instanceId,
        text: `IA usou ${lethalDamageCard.nome} em ${opponent.nome}.`
      };
    }

    for (const card of damageCards) {
      const killTargets = opponent.board
        .filter((unit) => unit.vida <= getMitigatedDamage(unit, card.valor))
        .sort(compareUnitsByThreatDesc);

      if (killTargets[0]) {
        return {
          type: "effect-unit",
          cardInstanceId: card.instanceId,
          targetInstanceId: killTargets[0].instanceId,
          text: `IA usou ${card.nome} em ${killTargets[0].nome}.`
        };
      }
    }

    const healingCard = healingCards[0] || null;
    const healableUnits = getHealableUnits(player).sort(compareHealableUnits);
    if (healingCard && healableUnits[0]) {
      return {
        type: "effect-ally-unit",
        cardInstanceId: healingCard.instanceId,
        targetInstanceId: healableUnits[0].instanceId,
        text: `IA usou ${healingCard.nome} em ${healableUnits[0].nome}.`
      };
    }

    if (healingCard && canPlayerReceiveHealing(player) && (MAX_HEALTH - player.vida) >= 4) {
      return {
        type: "effect-player",
        cardInstanceId: healingCard.instanceId,
        text: `IA usou ${healingCard.nome} em si mesma.`
      };
    }

    const bannerSupport = supportCards.find((card) => card.efeito === "aura_ataque" && player.board.length > 0);
    if (bannerSupport) {
      return {
        type: "play-card",
        cardInstanceId: bannerSupport.instanceId,
        text: `IA ativou ${bannerSupport.nome}.`
      };
    }

    const healingSupport = supportCards.find((card) => card.efeito === "cura_fim_turno" && canPlayerReceiveHealing(player));
    if (healingSupport) {
      return {
        type: "play-card",
        cardInstanceId: healingSupport.instanceId,
        text: `IA ativou ${healingSupport.nome}.`
      };
    }

    if (unitCards[0]) {
      return {
        type: "play-card",
        cardInstanceId: unitCards[0].instanceId,
        text: `IA baixou ${unitCards[0].nome}.`
      };
    }

    const killableTargets = opponent.board
      .filter((target) => readyAttackers.some((attacker) => getMitigatedDamage(target, getUnitAttack(attacker, player)) >= target.vida))
      .sort(compareUnitsByThreatDesc);
    if (killableTargets[0]) {
      const chosenTarget = killableTargets[0];
      const attacker = [...readyAttackers]
        .filter((unit) => getMitigatedDamage(chosenTarget, getUnitAttack(unit, player)) >= chosenTarget.vida)
        .sort(compareAttackersByPowerAsc(player))[0];

      if (attacker) {
        return {
          type: "attack-unit",
          attackerInstanceId: attacker.instanceId,
          targetInstanceId: chosenTarget.instanceId,
          text: `IA atacou ${chosenTarget.nome} com ${attacker.nome}.`
        };
      }
    }

    if (opponent.board.length > 0 && readyAttackers[0]) {
      const chosenTarget = [...opponent.board].sort(compareUnitsByThreatDesc)[0];
      const attacker = [...readyAttackers].sort(compareAttackersByPowerDesc(player))[0];

      return {
        type: "attack-unit",
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: chosenTarget.instanceId,
        text: `IA atacou ${chosenTarget.nome} com ${attacker.nome}.`
      };
    }

    if (opponent.supportZone.length > 0 && readyAttackers[0]) {
      const chosenSupport = [...opponent.supportZone].sort(compareSupportsForAiTarget)[0];
      const attacker = [...readyAttackers].sort(compareAttackersByPowerAsc(player))[0];

      return {
        type: "attack-support",
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: chosenSupport.instanceId,
        text: `IA destruiu ${chosenSupport.nome} com ${attacker.nome}.`
      };
    }

    if (readyAttackers[0]) {
      const attacker = [...readyAttackers].sort(compareAttackersByPowerDesc(player))[0];
      return {
        type: "attack-player",
        attackerInstanceId: attacker.instanceId,
        text: `IA atacou ${opponent.nome} com ${attacker.nome}.`
      };
    }

    if (opponent.board.length > 0 && defendableUnits[0]) {
      return {
        type: "defend-unit",
        targetInstanceId: defendableUnits[0].instanceId,
        text: `IA colocou ${defendableUnits[0].nome} em defesa.`
      };
    }

    if (getDrawPile(state, state.currentPlayerIndex).length > 0 && canAfford(player, DRAW_COST)) {
      return {
        type: "draw-card",
        text: "IA comprou uma carta."
      };
    }

    return {
      type: "end-turn",
      text: "IA encerrou o turno."
    };
  }

  function performAiStep(state) {
    const action = getNextAiAction(state);

    if (!action) {
      return null;
    }

    const playerIndex = state.currentPlayerIndex;
    let didAct = false;

    if (action.type === "play-card") {
      didAct = playCard(state, playerIndex, action.cardInstanceId);
    }

    if (action.type === "draw-card") {
      didAct = Boolean(drawTurnCard(state, playerIndex));
    }

    if (action.type === "effect-player") {
      didAct = playCard(state, playerIndex, action.cardInstanceId)
        && resolveEffectTarget(state, playerIndex, "player");
    }

    if (action.type === "effect-unit") {
      didAct = playCard(state, playerIndex, action.cardInstanceId)
        && resolveEffectTarget(state, playerIndex, "unit", action.targetInstanceId);
    }

    if (action.type === "effect-ally-unit") {
      didAct = playCard(state, playerIndex, action.cardInstanceId)
        && resolveEffectTarget(state, playerIndex, "ally-unit", action.targetInstanceId);
    }

    if (action.type === "attack-player") {
      didAct = selectAttacker(state, playerIndex, action.attackerInstanceId)
        && attackTarget(state, playerIndex, "player");
    }

    if (action.type === "attack-unit") {
      didAct = selectAttacker(state, playerIndex, action.attackerInstanceId)
        && attackTarget(state, playerIndex, "unit", action.targetInstanceId);
    }

    if (action.type === "attack-support") {
      didAct = selectAttacker(state, playerIndex, action.attackerInstanceId)
        && attackTarget(state, playerIndex, "support", action.targetInstanceId);
    }

    if (action.type === "defend-unit") {
      didAct = enterDefenseMode(state, playerIndex, action.targetInstanceId);
    }

    if (action.type === "end-turn") {
      endTurn(state);
      didAct = true;
    }

    if (!didAct) {
      return null;
    }

    state.aiStepText = action.text;
    state.isAiTurnInProgress = isAiTurnActive(state);
    if (!isAiTurnActive(state)) {
      state.aiStepText = null;
    }

    return action;
  }

  function scheduleAiTurn(state) {
    if (!shouldRunAi(state)) {
      cancelAiTurn(state);
      return false;
    }

    if (aiTurnTimerId !== null) {
      return true;
    }

    state.isAiTurnInProgress = true;
    if (!state.aiStepText) {
      state.aiStepText = "IA avaliando o campo.";
    }

    aiTurnTimerId = setTimeout(() => {
      aiTurnTimerId = null;

      if (!shouldRunAi(gameState)) {
        cancelAiTurn(gameState);
        render(gameState);
        return;
      }

      performAiStep(gameState);
      render(gameState);
    }, AI_STEP_DELAY_MS);

    return true;
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

  function canPlayerReceiveHealing(player) {
    return Boolean(player && player.vida < MAX_HEALTH);
  }

  function getHealableUnits(player) {
    if (!player || !Array.isArray(player.board)) {
      return [];
    }

    return player.board.filter((unit) => unit.vida < unit.vidaBase);
  }

  function hasValidHealingTargets(state, playerIndex) {
    const player = state.players[playerIndex];
    return canPlayerReceiveHealing(player) || getHealableUnits(player).length > 0;
  }

  function canPlayCard(state, playerIndex, card) {
    if (!state.isMatchStarted || state.winner || state.currentPlayerIndex !== playerIndex || state.selectedEffectCard) {
      return false;
    }

    const player = state.players[playerIndex];

    if (!canAfford(player, card.custo)) {
      return false;
    }

    if (card.efeito === "cura_direta") {
      return hasValidHealingTargets(state, playerIndex);
    }

    return true;
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
    overlayData.stateText = card.isDefending ? "DEFENDENDO" : card.jaAtacouNoTurno ? "JA ATACOU" : card.podeAgir ? "PRONTA" : "EM ESPERA";
    return overlayData;
  }

  function getAvailableAttackers(player) {
    return player.board.filter((unit) => unit.podeAgir && !unit.jaAtacouNoTurno && !unit.isDefending);
  }

  function canUnitEnterDefense(state, playerIndex, unit) {
    return Boolean(
      state
      && unit
      && state.isMatchStarted
      && !state.winner
      && state.currentPlayerIndex === playerIndex
      && !state.selectedEffectCard
      && unit.estado === "campo"
      && unit.podeAgir
      && !unit.jaAtacouNoTurno
      && !unit.isDefending
    );
  }

  function canUnitCancelDefense(state, playerIndex, unit) {
    return Boolean(
      state
      && unit
      && state.isMatchStarted
      && !state.winner
      && state.currentPlayerIndex === playerIndex
      && unit.estado === "campo"
      && unit.isDefending
      && unit.defenseTurnNumber === state.turnNumber
    );
  }

  function getMitigatedDamage(unit, rawDamage) {
    if (!unit || !unit.isDefending) {
      return rawDamage;
    }

    return Math.ceil(rawDamage / 2);
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
    const drawPile = getDrawPile(state, playerIndex);

    if (!drawPile.length) {
      return null;
    }

    const card = drawPile.pop();
    player.hand.push(card);

    if (shouldLog) {
      addLog(state, `${player.nome} comprou ${card.nome}.`, {
        kind: LOG_EVENT_TYPES.DRAW_CARD,
        playerIndex,
        cardInstanceId: card.instanceId
      });
    }

    return card;
  }

  function drawTurnCard(state, playerIndex) {
    if (!state.isMatchStarted || state.winner || state.currentPlayerIndex !== playerIndex || state.selectedEffectCard || state.selectedAttackerId) {
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
    moveCardToDiscardForOwner(state, card, state.currentPlayerIndex);
  }

  function moveCardToDiscardForOwner(state, card, ownerPlayerIndex) {
    getDiscardPileForPlayer(state, ownerPlayerIndex).push(card);
  }

  function resolveDamageEffectOnPlayer(state, card, player, opponent) {
    opponent.vida = Math.max(opponent.vida - card.valor, 0);
    addLog(state, `${player.nome} usou ${card.nome} e causou ${card.valor} de dano em ${opponent.nome}.`, {
      kind: LOG_EVENT_TYPES.EFFECT_DAMAGE_PLAYER,
      playerIndex: state.currentPlayerIndex,
      cardInstanceId: card.instanceId,
      targetPlayerIndex: state.players.findIndex((targetPlayer) => targetPlayer.id === opponent.id),
      damage: card.valor
    });
  }

  function resolveDamageEffectOnUnit(state, card, player, opponent, targetInstanceId) {
    const targetIndex = opponent.board.findIndex((unit) => unit.instanceId === targetInstanceId);

    if (targetIndex === -1) {
      return false;
    }

    const target = opponent.board[targetIndex];
    const inflictedDamage = getMitigatedDamage(target, card.valor);
    target.vida = Math.max(target.vida - inflictedDamage, 0);

    if (target.vida <= 0) {
      const [defeatedUnit] = opponent.board.splice(targetIndex, 1);
      moveCardToDiscardForOwner(state, defeatedUnit, (state.currentPlayerIndex + 1) % 2);
      addLog(state, `${player.nome} usou ${card.nome} e causou ${inflictedDamage} de dano em ${target.nome}, derrotando a unidade.`, {
        kind: LOG_EVENT_TYPES.EFFECT_DAMAGE_UNIT,
        playerIndex: state.currentPlayerIndex,
        cardInstanceId: card.instanceId,
        targetPlayerIndex: (state.currentPlayerIndex + 1) % 2,
        targetInstanceId: target.instanceId,
        damage: inflictedDamage,
        defeated: true
      });
      return true;
    }

    addLog(state, `${player.nome} usou ${card.nome} e causou ${inflictedDamage} de dano em ${target.nome}.`, {
      kind: LOG_EVENT_TYPES.EFFECT_DAMAGE_UNIT,
      playerIndex: state.currentPlayerIndex,
      cardInstanceId: card.instanceId,
      targetPlayerIndex: (state.currentPlayerIndex + 1) % 2,
      targetInstanceId: target.instanceId,
      damage: inflictedDamage,
      defeated: false
    });
    return true;
  }

  function resolveHealingEffectOnPlayer(state, card, player) {
    if (!canPlayerReceiveHealing(player)) {
      return false;
    }

    const recovered = Math.min(card.valor, MAX_HEALTH - player.vida);
    player.vida = Math.min(player.vida + card.valor, MAX_HEALTH);
    addLog(state, `${player.nome} usou ${card.nome} e recuperou ${recovered} de vida.`, {
      kind: LOG_EVENT_TYPES.EFFECT_HEAL_PLAYER,
      playerIndex: state.currentPlayerIndex,
      cardInstanceId: card.instanceId,
      targetPlayerIndex: state.currentPlayerIndex,
      recovered
    });
    return true;
  }

  function resolveHealingEffectOnUnit(state, card, player, targetInstanceId) {
    const target = player.board.find((unit) => unit.instanceId === targetInstanceId);

    if (!target) {
      return false;
    }

    if (target.vida >= target.vidaBase) {
      return false;
    }

    const recovered = Math.min(card.valor, target.vidaBase - target.vida);
    target.vida = Math.min(target.vida + card.valor, target.vidaBase);
    addLog(state, `${player.nome} usou ${card.nome} e recuperou ${recovered} de vida em ${target.nome}.`, {
      kind: LOG_EVENT_TYPES.EFFECT_HEAL_UNIT,
      playerIndex: state.currentPlayerIndex,
      cardInstanceId: card.instanceId,
      targetPlayerIndex: state.currentPlayerIndex,
      targetInstanceId: target.instanceId,
      recovered
    });
    return true;
  }

  function resolveEffectTarget(state, playerIndex, targetType, targetInstanceId) {
    if (!state.isMatchStarted || state.winner || state.currentPlayerIndex !== playerIndex || !state.selectedEffectCard) {
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
        resolved = resolveHealingEffectOnPlayer(state, card, player);
      }

      if (targetType === "ally-unit") {
        resolved = resolveHealingEffectOnUnit(state, card, player, targetInstanceId);
      }
    }

    if (!resolved) {
      return false;
    }

    moveCardToDiscardForOwner(state, card, playerIndex);
    state.selectedEffectCard = null;
    checkWinner(state);
    return true;
  }

  function playCard(state, playerIndex, cardInstanceId) {
    if (!state.isMatchStarted || state.winner || state.currentPlayerIndex !== playerIndex || state.selectedEffectCard) {
      return false;
    }

    const player = state.players[playerIndex];
    const cardIndex = player.hand.findIndex((card) => card.instanceId === cardInstanceId);

    if (cardIndex === -1) {
      return false;
    }

    const card = player.hand[cardIndex];

    if (!canPlayCard(state, playerIndex, card) || !spendMana(player, card.custo)) {
      return false;
    }

    player.hand.splice(cardIndex, 1);
    state.selectedAttackerId = null;

    if (card.categoria === "unidade") {
      player.board.push({
        ...card,
        estado: "campo",
        podeAgir: true,
        jaAtacouNoTurno: false,
        isDefending: false,
        defenseTurnNumber: null
      });
      addLog(state, `${player.nome} baixou ${card.nome} no campo por ${card.custo} mana.`, {
        kind: LOG_EVENT_TYPES.PLAY_UNIT,
        playerIndex,
        cardInstanceId: card.instanceId
      });
      return true;
    }

    if (card.categoria === "suporte") {
      player.supportZone.push({
        ...card,
        estado: "suporte"
      });
      addLog(state, `${player.nome} ativou o suporte ${card.nome} por ${card.custo} mana.`, {
        kind: LOG_EVENT_TYPES.PLAY_SUPPORT,
        playerIndex,
        cardInstanceId: card.instanceId
      });
      return true;
    }

    if (card.efeito === "dano_direto" || card.efeito === "cura_direta") {
      state.selectedEffectCard = card;
      return true;
    }

    moveCardToDiscardForOwner(state, card, playerIndex);

    checkWinner(state);
    return true;
  }

  function selectAttacker(state, playerIndex, unitInstanceId) {
    if (!state.isMatchStarted || state.winner || state.currentPlayerIndex !== playerIndex || state.selectedEffectCard) {
      return false;
    }

    const player = state.players[playerIndex];
    const unit = player.board.find((card) => card.instanceId === unitInstanceId);

    if (!unit || !unit.podeAgir || unit.jaAtacouNoTurno || unit.isDefending) {
      return false;
    }

    if (state.selectedAttackerId === unitInstanceId) {
      state.selectedAttackerId = null;
      return true;
    }

    state.selectedAttackerId = unitInstanceId;
    return true;
  }

  function attackTarget(state, playerIndex, targetType, targetInstanceId) {
    if (state.selectedEffectCard) {
      return false;
    }

    if (!state.isMatchStarted || state.winner || state.currentPlayerIndex !== playerIndex) {
      return false;
    }

    const player = state.players[playerIndex];
    const opponent = state.players[(playerIndex + 1) % 2];
    const attacker = player.board.find((card) => card.instanceId === state.selectedAttackerId);

    if (!attacker || !attacker.podeAgir || attacker.jaAtacouNoTurno || attacker.isDefending) {
      return false;
    }

    const attackValue = getUnitAttack(attacker, player);
    attacker.jaAtacouNoTurno = true;
    state.selectedAttackerId = null;

    if (targetType === "player") {
      opponent.vida = Math.max(opponent.vida - attackValue, 0);
      addLog(state, `${attacker.nome} atacou ${opponent.nome} e causou ${attackValue} de dano.`, {
        kind: LOG_EVENT_TYPES.ATTACK_PLAYER,
        playerIndex,
        attackerInstanceId: attacker.instanceId,
        targetPlayerIndex: (playerIndex + 1) % 2,
        damage: attackValue
      });
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
      moveCardToDiscardForOwner(state, defeatedSupport, (playerIndex + 1) % 2);
      addLog(state, `${attacker.nome} destruiu o suporte ${defeatedSupport.nome}.`, {
        kind: LOG_EVENT_TYPES.ATTACK_SUPPORT,
        playerIndex,
        attackerInstanceId: attacker.instanceId,
        targetPlayerIndex: (playerIndex + 1) % 2,
        targetInstanceId: defeatedSupport.instanceId
      });
      return true;
    }

    const targetIndex = opponent.board.findIndex((card) => card.instanceId === targetInstanceId);

    if (targetIndex === -1) {
      attacker.jaAtacouNoTurno = false;
      return false;
    }

    const target = opponent.board[targetIndex];
    const inflictedDamage = getMitigatedDamage(target, attackValue);
    target.vida = Math.max(target.vida - inflictedDamage, 0);

    if (target.vida <= 0) {
      const [defeatedUnit] = opponent.board.splice(targetIndex, 1);
      moveCardToDiscardForOwner(state, defeatedUnit, (playerIndex + 1) % 2);
      addLog(state, `${attacker.nome} atacou ${target.nome}, causou ${inflictedDamage} de dano e derrotou a unidade.`, {
        kind: LOG_EVENT_TYPES.ATTACK_UNIT,
        playerIndex,
        attackerInstanceId: attacker.instanceId,
        targetPlayerIndex: (playerIndex + 1) % 2,
        targetInstanceId: target.instanceId,
        damage: inflictedDamage,
        defeated: true
      });
      return true;
    }

    addLog(state, `${attacker.nome} atacou ${target.nome} e causou ${inflictedDamage} de dano.`, {
      kind: LOG_EVENT_TYPES.ATTACK_UNIT,
      playerIndex,
      attackerInstanceId: attacker.instanceId,
      targetPlayerIndex: (playerIndex + 1) % 2,
      targetInstanceId: target.instanceId,
      damage: inflictedDamage,
      defeated: false
    });
    return true;
  }

  function enterDefenseMode(state, playerIndex, unitInstanceId) {
    const player = state.players[playerIndex];
    const unit = player.board.find((card) => card.instanceId === unitInstanceId);

    if (!canUnitEnterDefense(state, playerIndex, unit)) {
      return false;
    }

    state.selectedAttackerId = null;
    unit.isDefending = true;
    unit.defenseTurnNumber = state.turnNumber;
    unit.jaAtacouNoTurno = true;
    addLog(state, `${player.nome} colocou ${unit.nome} em defesa.`, {
      kind: LOG_EVENT_TYPES.ENTER_DEFENSE,
      playerIndex,
      unitInstanceId: unit.instanceId
    });
    return true;
  }

  function cancelDefenseMode(state, playerIndex, unitInstanceId) {
    const player = state.players[playerIndex];
    const unit = player.board.find((card) => card.instanceId === unitInstanceId);

    if (!canUnitCancelDefense(state, playerIndex, unit)) {
      return false;
    }

    unit.isDefending = false;
    unit.defenseTurnNumber = null;
    unit.jaAtacouNoTurno = false;
    unit.podeAgir = true;
    addLog(state, `${player.nome} cancelou a defesa de ${unit.nome}.`, {
      kind: LOG_EVENT_TYPES.CANCEL_DEFENSE,
      playerIndex,
      unitInstanceId: unit.instanceId
    });
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

  function resolvePlayerHeaderTarget(state, targetPlayerIndex) {
    if (!state.isMatchStarted || state.winner || isAiTurnActive(state)) {
      return false;
    }

    const targetMode = getPlayerHeaderTargetMode(state, targetPlayerIndex);

    if (!targetMode) {
      return false;
    }

    if (state.selectedEffectCard) {
      return resolveEffectTarget(state, state.currentPlayerIndex, "player");
    }

    if (state.selectedAttackerId && targetPlayerIndex !== state.currentPlayerIndex) {
      return attackTarget(state, state.currentPlayerIndex, "player");
    }

    return false;
  }

  function getAvailableActions(state, playerIndex = state.currentPlayerIndex) {
    if (!state.isMatchStarted || state.winner || state.currentPlayerIndex !== playerIndex) {
      return {
        canDraw: false,
        playableCards: 0,
        readyAttackers: 0,
        pendingSelection: false,
        hasAny: false
      };
    }

    const player = state.players[playerIndex];
    const canDraw = getDrawPile(state, playerIndex).length > 0 && canAfford(player, DRAW_COST);
    const playableCards = player.hand.filter((card) => canPlayCard(state, playerIndex, card)).length;
    const readyAttackers = getAvailableAttackers(player).length;
    const defendableUnits = player.board.filter((unit) => canUnitEnterDefense(state, playerIndex, unit)).length;
    const pendingSelection = Boolean(state.selectedAttackerId || state.selectedEffectCard);
    const hasAny = canDraw || playableCards > 0 || readyAttackers > 0 || defendableUnits > 0 || pendingSelection;

    return {
      canDraw,
      playableCards,
      readyAttackers,
      defendableUnits,
      pendingSelection,
      hasAny
    };
  }

  function attemptEndTurn(state, options = {}) {
    if (!state.isMatchStarted || state.winner) {
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

    if (normalizedKey === "escape" && isViewingHistory(state)) {
      state.selectedLogEntryId = null;
      return true;
    }

    if (isViewingHistory(state)) {
      return false;
    }

    if (!state.isMatchStarted) {
      return false;
    }

    if (isAiTurnActive(state)) {
      return false;
    }

    if (normalizedKey === "c") {
      return Boolean(drawTurnCard(state, state.currentPlayerIndex));
    }

    if (normalizedKey === "a") {
      if (state.selectedEffectCard && state.selectedEffectCard.efeito === "dano_direto") {
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
      addLog(state, `${player.nome} recuperou ${recovered} de vida com seus suportes.`, {
        kind: LOG_EVENT_TYPES.SUPPORT_HEAL,
        playerIndex: state.currentPlayerIndex,
        recovered
      });
    }
  }

  function refreshUnitsForTurn(player) {
    player.board.forEach((unit) => {
      unit.podeAgir = true;
      unit.jaAtacouNoTurno = false;
      unit.isDefending = false;
      unit.defenseTurnNumber = null;
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
    if (!state.isMatchStarted || state.winner) {
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
    if (state.winner) {
      return state.winner;
    }

    const defeated = state.players.find((player) => player.vida <= 0);

    if (!defeated) {
      return null;
    }

    state.winner = state.players.find((player) => player.id !== defeated.id) || null;

    if (state.winner) {
      state.isWinnerModalOpen = true;
      addLog(state, `${state.winner.nome} venceu a partida.`, {
        kind: LOG_EVENT_TYPES.VICTORY,
        winnerPlayerId: state.winner.id
      });
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

    if (card.isDefending) {
      return "DEFENDENDO";
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
    const groups = cards.reduce((groups, card) => {
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

    groups.unidade.sort((left, right) => {
      const costDifference = (left.custo || 0) - (right.custo || 0);

      if (costDifference !== 0) {
        return costDifference;
      }

      const leftName = String(left.nome || "");
      const rightName = String(right.nome || "");
      if (leftName < rightName) {
        return -1;
      }

      if (leftName > rightName) {
        return 1;
      }

      return 0;
    });

    return groups;
  }

  function isAnySidePanelOpen(state) {
    return Boolean(state.isLibraryOpen || state.isRulesOpen || state.isLogOpen);
  }

  function toggleExclusiveSidePanel(state, panelName) {
    const panelMap = {
      library: "isLibraryOpen",
      rules: "isRulesOpen",
      log: "isLogOpen"
    };
    const targetFlag = panelMap[panelName];

    if (!targetFlag) {
      return;
    }

    const nextValue = !state[targetFlag];
    state.isLibraryOpen = false;
    state.isRulesOpen = false;
    state.isLogOpen = false;
    state[targetFlag] = nextValue;
  }

  function getPlayerHeaderTargetMode(state, targetPlayerIndex) {
    if (!state.isMatchStarted || state.winner) {
      return null;
    }

    if (state.selectedEffectCard) {
      if (state.selectedEffectCard.efeito === "dano_direto" && targetPlayerIndex !== state.currentPlayerIndex) {
        return "attack";
      }

      if (
        state.selectedEffectCard.efeito === "cura_direta"
        && targetPlayerIndex === state.currentPlayerIndex
        && canPlayerReceiveHealing(state.players[targetPlayerIndex])
      ) {
        return "heal";
      }

      return null;
    }

    if (state.selectedAttackerId && targetPlayerIndex !== state.currentPlayerIndex) {
      return "attack";
    }

    return null;
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
    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    const {
      interactive = false,
      selected = false,
      className = "",
      onClick,
      player,
      defenseToggle = null
    } = config;
    const classes = ["card", className];
    wrapper.className = `card-entry${card.isDefending ? " is-defending" : ""}`;

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

    if (card.isDefending) {
      classes.push("defending");
    }

    button.type = "button";
    button.className = classes.join(" ").trim();
    button.disabled = !interactive;
    button.setAttribute("aria-label", card.nome);
    button.innerHTML = buildCardMarkup(card, player, { showDynamicState: true });

    if (interactive && typeof onClick === "function") {
      button.addEventListener("click", onClick);
    }

    wrapper.appendChild(button);

    if (defenseToggle) {
      const defenseButton = document.createElement("button");
      defenseButton.type = "button";
      defenseButton.className = `card-defense-toggle${defenseToggle.active ? " is-active" : ""}`;
      defenseButton.textContent = defenseToggle.active ? "CAN" : "DEF";
      defenseButton.title = defenseToggle.active ? "Cancelar defesa" : "Entrar em defesa";
      defenseButton.disabled = !defenseToggle.interactive;
      if (defenseToggle.interactive && typeof defenseToggle.onClick === "function") {
        defenseButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          defenseToggle.onClick();
        });
      }
      wrapper.appendChild(defenseButton);
    }

    return wrapper;
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
    const deckCounts = getDeckCountForLibrary(state, state?.currentPlayerIndex || 0);
    const deckCopiesPerCard = state?.deckMode === DECK_MODES.SEPARATE ? SEPARATE_DECK_COPIES_PER_TYPE : CARD_COPIES_PER_TYPE;

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
            countLabel: `${deckCounts[card.id] || 0}/${deckCopiesPerCard} no baralho`
          });

          section.appendChild(item);
        });

      libraryElement.appendChild(section);
    });
  }

  function formatPlayerHealth(player) {
    return `${player.vida}/${MAX_HEALTH}`;
  }

  function getTargetHintText(targetMode) {
    if (targetMode === "attack") {
      return "Clique para atacar jogador";
    }

    if (targetMode === "heal") {
      return "Clique para curar jogador";
    }

    return "";
  }

  function createHistoryPreviewItem(card) {
    const item = document.createElement("div");
    item.className = "history-preview-item";

    let meta = "";
    if (card.categoria === "unidade") {
      meta = `ATQ ${card.ataque} · VIDA ${card.vida}/${card.vidaBase}`;
    } else if (typeof card.valor === "number") {
      meta = `VALOR ${card.valor}`;
    } else {
      meta = card.categoria.toUpperCase();
    }

    item.innerHTML = `
      <span class="history-preview-item-title">${card.nome}</span>
      <span class="history-preview-item-meta">${meta}</span>
    `;

    return item;
  }

  function getDisplayLogEntries(logEntries) {
    return [...logEntries].reverse();
  }

  function getLogValidationStatusLabel(state) {
    if (state.logValidationStatus === LOG_VALIDATION_STATUS.VALID) {
      return `Log valido (${state.validatedEntryCount})`;
    }

    if (state.logValidationStatus === LOG_VALIDATION_STATUS.INVALID) {
      return `${state.logValidationIssues.length} problema(s)`;
    }

    return "Nao validado";
  }

  function renderLogValidation(state) {
    const validateButton = document.getElementById("validate-log-button");
    const statusElement = document.getElementById("log-validation-status");
    const resultsElement = document.getElementById("log-validation-results");

    if (!validateButton || !statusElement || !resultsElement) {
      return;
    }

    validateButton.disabled = !state.log.length;

    const statusClassName = state.logValidationStatus === LOG_VALIDATION_STATUS.VALID
      ? "log-validation-chip status-valid"
      : state.logValidationStatus === LOG_VALIDATION_STATUS.INVALID
        ? "log-validation-chip status-invalid"
        : "log-validation-chip";
    statusElement.className = statusClassName;
    statusElement.textContent = getLogValidationStatusLabel(state);

    if (state.logValidationStatus === LOG_VALIDATION_STATUS.IDLE) {
      resultsElement.hidden = false;
      resultsElement.innerHTML = `<div class="log-validation-summary">O log ainda nao foi validado nesta versao da partida.</div>`;
      return;
    }

    resultsElement.hidden = false;

    if (state.logValidationStatus === LOG_VALIDATION_STATUS.VALID) {
      resultsElement.innerHTML = `
        <div class="log-validation-summary">
          Replay concluido com sucesso. ${state.validatedEntryCount} acao(oes) foram verificadas sem divergencias.
        </div>
      `;
      return;
    }

    resultsElement.innerHTML = "";

    const summary = document.createElement("div");
    summary.className = "log-validation-summary";
    summary.textContent = `Foram encontrados ${state.logValidationIssues.length} problema(s) apos validar ${state.validatedEntryCount} acao(oes). Clique em um problema para focar a linha correspondente.`;
    resultsElement.appendChild(summary);

    const issuesList = document.createElement("div");
    issuesList.className = "log-validation-issues";

    state.logValidationIssues.forEach((issue) => {
      const issueButton = document.createElement("button");
      issueButton.type = "button";
      issueButton.className = "log-validation-issue";
      issueButton.innerHTML = `
        <span class="log-validation-issue-code">${issue.numero ? `Acao ${issue.numero}` : "Log"} · ${issue.code}</span>
        <span class="log-validation-issue-text">${issue.message}</span>
      `;
      issueButton.addEventListener("click", () => {
        if (issue.entryId != null) {
          state.selectedLogEntryId = issue.entryId;
          render(state);
        }
      });
      issuesList.appendChild(issueButton);
    });

    resultsElement.appendChild(issuesList);
  }

  function getSelectedLogEntry(state) {
    if (!state || state.selectedLogEntryId == null) {
      return null;
    }

    return state.log.find((entry) => entry.id === state.selectedLogEntryId) || null;
  }

  function isHistoryPreviewVisible(state) {
    return Boolean(state && state.isLogOpen && getSelectedLogEntry(state));
  }

  function renderHistoryPreview(state) {
    const historyPanel = document.getElementById("history-preview-panel");
    const historyTitle = document.getElementById("history-preview-title");
    const historyText = document.getElementById("history-preview-text");
    const historyTurn = document.getElementById("history-preview-turn");
    const historyDeck = document.getElementById("history-preview-deck");
    const historyDiscard = document.getElementById("history-preview-discard");
    const historyGrid = document.getElementById("history-preview-grid");

    if (!historyPanel || !historyTitle || !historyText || !historyTurn || !historyDeck || !historyDiscard || !historyGrid) {
      return;
    }

    historyGrid.innerHTML = "";
    const selectedEntry = getSelectedLogEntry(state);
    const isVisible = Boolean(state.isLogOpen && selectedEntry);
    historyPanel.hidden = !isVisible;
    historyPanel.setAttribute("aria-hidden", String(!isVisible));

    if (!isVisible || !selectedEntry) {
      return;
    }

    const snapshot = selectedEntry.snapshot;

    historyTitle.textContent = `Acao ${selectedEntry.numero}`;
    historyText.textContent = selectedEntry.texto;
    historyTurn.textContent = snapshot.players[snapshot.currentPlayerIndex].nome;
    historyDeck.textContent = snapshot.deckMode === DECK_MODES.SEPARATE
      ? `${(snapshot.playerDecks?.[0]?.length || 0) + (snapshot.playerDecks?.[1]?.length || 0)}/${getTotalDeckSize(DECK_MODES.SEPARATE)}`
      : `${snapshot.deck.length}/${getTotalDeckSize()}`;
    historyDiscard.textContent = snapshot.deckMode === DECK_MODES.SEPARATE
      ? String((snapshot.playerDiscardPiles?.[0]?.length || 0) + (snapshot.playerDiscardPiles?.[1]?.length || 0))
      : String(snapshot.discardPile.length);

    snapshot.players.forEach((player) => {
      const panel = document.createElement("section");
      panel.className = "history-preview-panel";

      const header = document.createElement("div");
      header.className = "history-preview-header";
      header.innerHTML = `
        <h3>${player.nome}</h3>
        <div class="history-preview-stats">
          <span class="history-preview-chip">Vida ${formatPlayerHealth(player)}</span>
          <span class="history-preview-chip">Mana ${player.manaAtual}/${player.manaMax}</span>
        </div>
      `;
      panel.appendChild(header);

      [
        { titulo: "Campo", cards: player.board },
        { titulo: "Suportes", cards: player.supportZone },
        { titulo: "Mao", cards: player.hand }
      ].forEach((sectionData) => {
        const section = document.createElement("div");
        section.className = "history-preview-section";

        const title = document.createElement("span");
        title.className = "history-preview-section-title";
        title.textContent = sectionData.titulo;
        section.appendChild(title);

        const list = document.createElement("div");
        list.className = "history-preview-list";

        if (!sectionData.cards.length) {
          const empty = document.createElement("div");
          empty.className = "history-preview-item";
          empty.innerHTML = `
            <span class="history-preview-item-title">Vazio</span>
            <span class="history-preview-item-meta">Sem cartas nesta area</span>
          `;
          list.appendChild(empty);
        } else {
          sectionData.cards.forEach((card) => {
            list.appendChild(createHistoryPreviewItem(card));
          });
        }

        section.appendChild(list);
        panel.appendChild(section);
      });

      historyGrid.appendChild(panel);
    });
  }

  function isViewingHistory(state) {
    return Boolean(state && state.isLogOpen && getSelectedLogEntry(state));
  }

  function getRenderedGameState(state) {
    const selectedEntry = getSelectedLogEntry(state);

    if (!state || !state.isLogOpen || !selectedEntry) {
      return state;
    }

    const snapshot = selectedEntry.snapshot;
    const players = cloneData(snapshot.players);
    const renderedState = {
      ...state,
      deck: cloneData(snapshot.deck),
      discardPile: cloneData(snapshot.discardPile),
      playerDecks: cloneData(snapshot.playerDecks || [[], []]),
      playerDiscardPiles: cloneData(snapshot.playerDiscardPiles || [[], []]),
      currentPlayerIndex: snapshot.currentPlayerIndex,
      playerControllers: normalizePlayerControllers(snapshot.playerControllers),
      deckMode: normalizeDeckMode(snapshot.deckMode),
      isMatchStarted: Boolean(snapshot.isMatchStarted),
      selectedAttackerId: snapshot.selectedAttackerId,
      selectedEffectCard: cloneData(snapshot.selectedEffectCard),
      turnNumber: snapshot.turnNumber,
      players
    };

    renderedState.winner = snapshot.winnerPlayerId
      ? renderedState.players.find((player) => player.id === snapshot.winnerPlayerId) || null
      : null;

    return renderedState;
  }

  function render(state) {
    const viewingHistory = isViewingHistory(state);
    const aiTurnActive = isAiTurnActive(state);
    const renderedState = getRenderedGameState(state);
    const currentPlayer = getCurrentPlayer(renderedState);
    const renderedCurrentPlayerIsAi = isAiControlledPlayer(renderedState, renderedState.currentPlayerIndex);
    const matchStarted = Boolean(renderedState.isMatchStarted);

    renderedState.players.forEach((player, index) => {
      const groupedHand = groupHandByCategory(player.hand);
      document.getElementById(`player-${player.id}-health`).textContent = formatPlayerHealth(player);
      document.getElementById(`player-${player.id}-hand-count`).textContent = `${player.hand.length} cartas`;
      document.getElementById(`player-${player.id}-board-count`).textContent = `${player.board.length} em campo`;
      document.getElementById(`player-${player.id}-support-count`).textContent = `${player.supportZone.length} suportes`;
      document.getElementById(`player-${player.id}-mana`).textContent = `${player.manaAtual}/${player.manaMax}`;
      const playerDeckCount = document.getElementById(`player-${player.id}-deck-count`);
      const playerDeckStat = document.getElementById(`player-${player.id}-deck-stat`);
      const playerNameButton = document.getElementById(`player-${player.id}-name`);
      const playerTargetHint = document.getElementById(`player-${player.id}-target-hint`);
      const headerTargetMode = (viewingHistory || aiTurnActive || !state.isMatchStarted) ? null : getPlayerHeaderTargetMode(state, index);

      if (playerDeckCount) {
        playerDeckCount.textContent = `${getPlayerDeckCount(renderedState, index)}/${getPlayerDeckTotal(renderedState)}`;
      }

      if (playerDeckStat) {
        playerDeckStat.hidden = renderedState.deckMode !== DECK_MODES.SEPARATE;
      }

      if (playerNameButton) {
        playerNameButton.textContent = isAiControlledPlayer(renderedState, index) ? `${player.nome} (IA)` : player.nome;
        playerNameButton.disabled = !headerTargetMode;
        playerNameButton.classList.toggle("targetable-name", Boolean(headerTargetMode));
        playerNameButton.classList.toggle("targetable-name-attack", headerTargetMode === "attack");
        playerNameButton.classList.toggle("targetable-name-heal", headerTargetMode === "heal");
      }

      if (playerTargetHint) {
        const hintText = getTargetHintText(headerTargetMode);
        playerTargetHint.hidden = !hintText;
        playerTargetHint.textContent = hintText;
        playerTargetHint.classList.toggle("target-hint-heal", headerTargetMode === "heal");
      }

      ["unidade", "suporte", "efeito"].forEach((category) => {
        document.getElementById(`player-${player.id}-hand-${category}-count`).textContent = String(groupedHand[category].length);

        renderCardList(
          `player-${player.id}-hand-${category}`,
          groupedHand[category],
          (card) => createCardElement(card, {
            interactive: matchStarted && !viewingHistory && !aiTurnActive && canPlayCard(state, index, card),
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
          const isCurrentPlayer = index === renderedState.currentPlayerIndex;
          const isSelected = matchStarted && !viewingHistory && !aiTurnActive && card.instanceId === state.selectedAttackerId;
          const canSelect = matchStarted && !viewingHistory && !aiTurnActive && isCurrentPlayer && !state.winner && card.podeAgir && !card.jaAtacouNoTurno && !state.selectedEffectCard;
          const canBeCombatTargeted = matchStarted && !viewingHistory && !aiTurnActive && !isCurrentPlayer && Boolean(state.selectedAttackerId) && !state.winner;
          const canBeDamageEffectTargeted = matchStarted && !viewingHistory && !aiTurnActive && !isCurrentPlayer && Boolean(state.selectedEffectCard) && state.selectedEffectCard.efeito === "dano_direto" && !state.winner;
          const canBeHealingEffectTargeted = matchStarted && !viewingHistory && !aiTurnActive && isCurrentPlayer
            && Boolean(state.selectedEffectCard)
            && state.selectedEffectCard.efeito === "cura_direta"
            && !state.winner
            && card.vida < card.vidaBase;

          const canEnterDefense = matchStarted && !viewingHistory && !aiTurnActive && canUnitEnterDefense(state, index, card);
          const canCancelDefense = matchStarted && !viewingHistory && !aiTurnActive && canUnitCancelDefense(state, index, card);

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
            player,
            defenseToggle: (canEnterDefense || canCancelDefense)
              ? {
                interactive: true,
                active: canCancelDefense,
                onClick: () => {
                  if (canCancelDefense) {
                    cancelDefenseMode(state, index, card.instanceId);
                  } else {
                    enterDefenseMode(state, index, card.instanceId);
                  }
                  render(state);
                }
              }
              : null
          });
        },
        "Nenhuma unidade em campo."
      );

      renderCardList(
        `player-${player.id}-support`,
        player.supportZone,
        (card) => {
          const isCurrentPlayer = index === renderedState.currentPlayerIndex;
          const canBeSupportTargeted = matchStarted
            && !viewingHistory
            && !aiTurnActive
            && !isCurrentPlayer
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

    const availableActions = !state.isMatchStarted || viewingHistory
      ? { hasAny: false }
      : getAvailableActions(state, state.currentPlayerIndex);
    document.getElementById("turn-indicator").textContent = !matchStarted
      ? "Pre-jogo"
      : renderedState.winner
      ? `${renderedState.winner.nome} venceu`
      : renderedCurrentPlayerIsAi
        ? `${currentPlayer.nome} (IA)`
        : currentPlayer.nome;
    document.getElementById("turn-status").textContent = viewingHistory
      ? "Visualizando um momento passado em somente leitura. Use Esc ou a linha mais recente do Log para voltar ao presente."
      : !state.isMatchStarted
      ? "Configure Jogador 1 e Jogador 2 como Humano ou IA e pressione Start para iniciar a partida."
      : state.winner
      ? "A partida terminou. Inicie uma nova partida para jogar novamente."
      : isAiVsAiMatch(state) && state.isAiVsAiPaused
      ? "IA x IA pausado. Use o botao de continuar para retomar a partida automatica."
      : aiTurnActive
      ? (state.aiStepText || "IA avaliando o campo.")
      : state.selectedEffectCard
        ? state.selectedEffectCard.efeito === "cura_direta"
          ? "Escolha uma unidade aliada ferida ou clique no seu nome para curar o jogador. Clique novamente na carta armada para cancelar."
          : "Escolha uma unidade inimiga ou clique no nome do rival para atacar diretamente o jogador. Clique novamente na carta armada para cancelar."
        : state.selectedAttackerId
          ? getOpponentPlayer(state).board.length === 0 && getOpponentPlayer(state).supportZone.length > 0
            ? "Escolha unidade, suporte exposto ou clique no nome do rival para atacar o jogador. Clique novamente na unidade para cancelar."
            : "Escolha uma unidade inimiga ou clique no nome do rival para atacar o jogador. Clique novamente na unidade para cancelar."
          : "Use sua mana, baixe cartas e ataque com unidades prontas.";
    document.getElementById("deck-count").textContent = `${getGlobalDeckCount(renderedState)}/${getTotalDeckSize(renderedState.deckMode === DECK_MODES.SEPARATE ? DECK_MODES.SEPARATE : DECK_MODES.SHARED)}`;
    document.getElementById("discard-count").textContent = String(getGlobalDiscardCount(renderedState));
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
    const startButton = document.getElementById("start-button");
    const restartButton = document.getElementById("restart-button");
    const aiMatchControls = document.getElementById("ai-match-controls");
    const toggleAiMatchButton = document.getElementById("toggle-ai-match-button");
    const sharedDeckButton = document.getElementById("deck-mode-shared");
    const separateDeckButton = document.getElementById("deck-mode-separate");
    const configPanel = document.getElementById("match-config-panel");
    const sharedDeckStat = document.getElementById("shared-deck-stat");
    const anySidePanelOpen = isAnySidePanelOpen(state);

    if (boardElement && sideRail && libraryPanel && rulesPanel && logPanel && toggleLibraryButton && toggleRulesButton && toggleLogButton) {
      boardElement.classList.toggle("board-with-side-rail", anySidePanelOpen);
      boardElement.classList.toggle("is-history-view", viewingHistory);
      boardElement.classList.toggle("is-ai-turn", aiTurnActive);
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

    [0, 1].forEach((playerIndex) => {
      const selectedController = normalizePlayerControllers(state.playerControllers)[playerIndex];
      const humanButton = document.getElementById(`player-${playerIndex + 1}-controller-human`);
      const aiButton = document.getElementById(`player-${playerIndex + 1}-controller-ai`);

      if (humanButton) {
        const isSelected = selectedController === PLAYER_CONTROLLER_TYPES.HUMAN;
        humanButton.disabled = state.isMatchStarted;
        humanButton.classList.toggle("is-selected", isSelected);
        humanButton.setAttribute("aria-pressed", String(isSelected));
      }

      if (aiButton) {
        const isSelected = selectedController === PLAYER_CONTROLLER_TYPES.AI;
        aiButton.disabled = state.isMatchStarted;
        aiButton.classList.toggle("is-selected", isSelected);
        aiButton.setAttribute("aria-pressed", String(isSelected));
      }
    });

    if (startButton) {
      startButton.hidden = state.isMatchStarted;
      startButton.disabled = state.isMatchStarted;
    }

    if (restartButton) {
      restartButton.hidden = !state.isMatchStarted;
      restartButton.disabled = !state.isMatchStarted;
    }

    if (aiMatchControls && toggleAiMatchButton) {
      const showAiMatchControls = isAiVsAiMatch(state) && !viewingHistory && !state.winner;
      aiMatchControls.hidden = !showAiMatchControls;
      toggleAiMatchButton.textContent = state.isAiVsAiPaused ? "Continuar IA x IA" : "Pausar IA x IA";
      toggleAiMatchButton.setAttribute("aria-pressed", String(state.isAiVsAiPaused));
    }

    if (sharedDeckButton) {
      const isSelected = state.deckMode === DECK_MODES.SHARED;
      sharedDeckButton.disabled = state.isMatchStarted;
      sharedDeckButton.classList.toggle("is-selected", isSelected);
      sharedDeckButton.setAttribute("aria-pressed", String(isSelected));
    }

    if (separateDeckButton) {
      const isSelected = state.deckMode === DECK_MODES.SEPARATE;
      separateDeckButton.disabled = state.isMatchStarted;
      separateDeckButton.classList.toggle("is-selected", isSelected);
      separateDeckButton.setAttribute("aria-pressed", String(isSelected));
    }

    if (configPanel) {
      configPanel.classList.toggle("is-locked", state.isMatchStarted);
    }

    if (sharedDeckStat) {
      sharedDeckStat.hidden = renderedState.deckMode === DECK_MODES.SEPARATE;
    }

    const turnActionsPanel = document.getElementById("player-turn-actions-panel");
    const playerOneTurnActionSlot = document.getElementById("player-1-turn-actions-slot");
    const playerTwoTurnActionSlot = document.getElementById("player-2-turn-actions-slot");
    const playerOnePendingSlot = document.getElementById("player-1-pending-slot");
    const playerTwoPendingSlot = document.getElementById("player-2-pending-slot");

    if (turnActionsPanel && playerOneTurnActionSlot && playerTwoTurnActionSlot) {
      if (!matchStarted) {
        turnActionsPanel.hidden = true;
        playerOneTurnActionSlot.hidden = true;
        playerTwoTurnActionSlot.hidden = true;
      } else {
        const activeTurnSlot = currentPlayer.id === 1 ? playerOneTurnActionSlot : playerTwoTurnActionSlot;
        const inactiveTurnSlot = currentPlayer.id === 1 ? playerTwoTurnActionSlot : playerOneTurnActionSlot;

        activeTurnSlot.hidden = false;
        inactiveTurnSlot.hidden = true;
        turnActionsPanel.hidden = false;

        if (turnActionsPanel.parentElement !== activeTurnSlot) {
          activeTurnSlot.appendChild(turnActionsPanel);
        }
      }
    }

    if (playerOnePendingSlot && playerTwoPendingSlot) {
      const activePendingSlot = currentPlayer.id === 1 ? playerOnePendingSlot : playerTwoPendingSlot;
      const inactivePendingSlot = currentPlayer.id === 1 ? playerTwoPendingSlot : playerOnePendingSlot;

      inactivePendingSlot.hidden = true;
      inactivePendingSlot.innerHTML = "";

      if (!matchStarted || viewingHistory) {
        activePendingSlot.hidden = true;
        activePendingSlot.innerHTML = "";
      } else if (state.selectedEffectCard) {
        activePendingSlot.hidden = false;
        activePendingSlot.innerHTML = "";
        activePendingSlot.appendChild(createCardElement(state.selectedEffectCard, {
          interactive: true,
          selected: true,
          className: "pending-effect-card",
          player: currentPlayer,
          onClick: () => {
            cancelPendingAction(state);
            render(state);
          }
        }));
      } else {
        activePendingSlot.hidden = true;
        activePendingSlot.innerHTML = "";
      }
    }

    const drawButton = document.getElementById("draw-button");
    const endTurnButton = document.getElementById("end-turn-button");

    drawButton.disabled = !state.isMatchStarted || viewingHistory || aiTurnActive || Boolean(state.winner) || Boolean(state.selectedAttackerId) || Boolean(state.selectedEffectCard) || !getDrawPile(state, state.currentPlayerIndex).length || !canAfford(getCurrentPlayer(state), DRAW_COST);
    endTurnButton.disabled = !state.isMatchStarted || viewingHistory || aiTurnActive || Boolean(state.winner);
    endTurnButton.classList.toggle("ready-to-end-turn", state.isMatchStarted && !viewingHistory && !aiTurnActive && !state.winner && !availableActions.hasAny);

    const logElement = document.getElementById("game-log");
    logElement.innerHTML = "";
    if (!state.log.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "A partida ainda nao comecou.";
      logElement.appendChild(empty);
    } else {
      getDisplayLogEntries(state.log).forEach((entry) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `log-entry${state.selectedLogEntryId === entry.id ? " is-selected" : ""}`;
        item.innerHTML = `
          <span class="log-entry-number">${entry.numero}</span>
          <span class="log-entry-text">${entry.texto}</span>
        `;
        item.addEventListener("click", () => {
          const nextState = handleLogEntryClick(state, entry.id, {
            confirmFn: typeof window !== "undefined" ? window.confirm.bind(window) : null
          });
          if (nextState !== state) {
            state = nextState;
            gameState = nextState;
          }
          render(state);
        });
        logElement.appendChild(item);
      });
    }

    renderLogValidation(state);
    renderLibrary(renderedState);

    document.getElementById("player-bottom-panel").classList.toggle("active", matchStarted && renderedState.currentPlayerIndex === 0 && !renderedState.winner);
    document.getElementById("player-top-panel").classList.toggle("active", matchStarted && renderedState.currentPlayerIndex === 1 && !renderedState.winner);

    const winnerModal = document.getElementById("winner-modal");
    const winnerModalTitle = document.getElementById("winner-modal-title");
    const winnerModalText = document.getElementById("winner-modal-text");

    if (winnerModal && winnerModalTitle && winnerModalText) {
      winnerModal.setAttribute("aria-hidden", String(viewingHistory || !state.isWinnerModalOpen));
      if (state.winner) {
        winnerModalTitle.textContent = `${state.winner.nome} venceu`;
        winnerModalText.textContent = `${state.winner.nome} reduziu a vida rival a zero e venceu a partida.`;
      }
    }

    if (shouldRunAi(state)) {
      scheduleAiTurn(state);
    } else {
      cancelAiTurn(state);
    }
  }

  function bindUI() {
    document.getElementById("toggle-library-button").addEventListener("click", () => {
      toggleExclusiveSidePanel(gameState, "library");
      gameState.selectedLogEntryId = null;
      render(gameState);
    });

    document.getElementById("toggle-rules-button").addEventListener("click", () => {
      toggleExclusiveSidePanel(gameState, "rules");
      gameState.selectedLogEntryId = null;
      render(gameState);
    });

    document.getElementById("toggle-log-button").addEventListener("click", () => {
      toggleExclusiveSidePanel(gameState, "log");
      if (!gameState.isLogOpen) {
        gameState.selectedLogEntryId = null;
      }
      render(gameState);
    });

    document.getElementById("validate-log-button").addEventListener("click", () => {
      const validationResult = validateMatchLog(gameState.log);
      gameState.logValidationStatus = validationResult.status;
      gameState.validatedEntryCount = validationResult.validatedEntryCount;
      gameState.logValidationIssues = validationResult.issues;
      render(gameState);
    });

    document.getElementById("toggle-ai-match-button").addEventListener("click", () => {
      if (toggleAiVsAiPause(gameState)) {
        render(gameState);
      }
    });

    document.querySelectorAll("[data-controller-button]").forEach((button) => {
      button.addEventListener("click", () => {
        if (gameState.isMatchStarted) {
          return;
        }

        const playerIndex = Number(button.dataset.playerIndex);
        const controller = button.dataset.controller;
        gameState.playerControllers = setSessionPlayerController(playerIndex, controller);
        render(gameState);
      });
    });

    document.querySelectorAll("[data-deck-mode-button]").forEach((button) => {
      button.addEventListener("click", () => {
        if (gameState.isMatchStarted) {
          return;
        }

        gameState.deckMode = setSessionDeckMode(button.dataset.deckMode);
        render(gameState);
      });
    });

    document.getElementById("start-button").addEventListener("click", () => {
      if (gameState.isMatchStarted) {
        return;
      }

      cancelAiTurn(gameState);
      gameState = startConfiguredMatch(gameState);
      render(gameState);
    });

    document.getElementById("draw-button").addEventListener("click", () => {
      handleShortcutAction(gameState, "c");
      render(gameState);
    });

    document.querySelectorAll(".player-name-button").forEach((button) => {
      button.addEventListener("click", () => {
        const targetPlayerIndex = Number(button.dataset.playerIndex);
        resolvePlayerHeaderTarget(gameState, targetPlayerIndex);
        render(gameState);
      });
    });

    document.getElementById("end-turn-button").addEventListener("click", () => {
      handleShortcutAction(gameState, "e", {
        confirmFn: typeof window !== "undefined" ? window.confirm.bind(window) : null
      });
      render(gameState);
    });

    document.getElementById("restart-button").addEventListener("click", () => {
      cancelAiTurn(gameState);
      gameState = createRestartState(gameState);
      render(gameState);
    });

    document.getElementById("winner-restart-button").addEventListener("click", () => {
      cancelAiTurn(gameState);
      gameState = createRestartState(gameState);
      render(gameState);
    });

    document.getElementById("close-winner-modal-button").addEventListener("click", () => {
      gameState.isWinnerModalOpen = false;
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
      SEPARATE_DECK_COPIES_PER_TYPE,
      AI_STEP_DELAY_MS,
      DECK_MODES,
      PLAYER_CONTROLLER_TYPES,
      LOG_VALIDATION_STATUS,
      LOG_EVENT_TYPES,
      CARD_LIBRARY,
      getSessionPlayerControllers,
      setSessionPlayerController,
      getSessionDeckMode,
      setSessionDeckMode,
      createDeck,
      shuffleDeck,
      createInitialState,
      startConfiguredMatch,
      createRestartState,
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
      canPlayerReceiveHealing,
      getHealableUnits,
      hasValidHealingTargets,
      canPlayCard,
      getDeckCardCounts,
      getPlayerHeaderTargetMode,
      resolvePlayerHeaderTarget,
      toggleExclusiveSidePanel,
      isAiEnabled,
      isAiControlledPlayer,
      isAiVsAiMatch,
      toggleAiVsAiPause,
      isAiTurnActive,
      createStateSnapshot,
      validateMatchLog,
      applyLoggedEvent,
      restoreStateFromSnapshot,
      rewindToLogEntry,
      attemptRewindToLogEntry,
      handleLogEntryClick,
      getDisplayLogEntries,
      isViewingHistory,
      getRenderedGameState,
      groupHandByCategory,
      getTotalDeckSize,
      isAnySidePanelOpen,
      getAvailableActions,
      attemptEndTurn,
      cancelPendingAction,
      handleShortcutAction,
      getNextAiAction,
      performAiStep,
      getUnitAttack,
      getAvailableAttackers,
      getDrawPile,
      getDiscardPileForPlayer,
      getPlayerDeckCount,
      getPlayerDeckTotal,
      getGlobalDeckCount,
      getGlobalDiscardCount,
      enterDefenseMode,
      cancelDefenseMode,
      canUnitEnterDefense,
      canUnitCancelDefense,
      getMitigatedDamage
    };
  }
})();

