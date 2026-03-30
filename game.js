(function () {
  const MAX_HEALTH = 40;
  const STARTING_HAND_SIZE = 4;
  const MAX_MANA = 8;
  const DRAW_COST = 1;
  const CARD_COPIES_PER_TYPE = 4;
  const SEPARATE_DECK_COPIES_PER_TYPE = 2;
  const AI_STEP_DELAY_MS = 500;
  const HEADLESS_AI_BATCH_SIZE = 40;
  const HEADLESS_AI_BATCH_MIN_MATCHES = 1;
  const HEADLESS_AI_BATCH_DEFAULT_MATCHES = 1;
  const HEADLESS_AI_BATCH_MAX_MATCHES = 1000;
  const HEADLESS_AI_MATCH_ACTION_LIMIT = 4000;
  const MATCH_HISTORY_STORAGE_KEY = "duelo-de-cartas-match-history-v1";
  const MAX_SAVED_MATCHES = 20;
  const APP_VERSION = "2026.03.30";
  const MATCH_PRESENTATION_MODES = Object.freeze({
    VISUAL: "visual",
    HEADLESS_AI_VS_AI: "headless-ai-vs-ai"
  });
  const HEADLESS_BATCH_STATUSES = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    FINISHED: "finished",
    FAILED: "failed"
  });
  const DECK_MODES = Object.freeze({
    SHARED: "shared",
    SEPARATE: "separate"
  });
  const PLAYER_CONTROLLER_TYPES = Object.freeze({
    HUMAN: "human",
    AI: "ai_base",
    AI_BASE: "ai_base",
    AI_SMART: "ai_smart"
  });
  const HEADLESS_BATCH_MODES = Object.freeze({
    SIMPLE: "simple",
    MIRRORED_COMPARE: "mirrored-compare"
  });
  const MATCH_KINDS = Object.freeze({
    HUMAN_HUMAN: "human-human",
    HUMAN_AI: "human-ai",
    AI_AI: "ai-ai"
  });
  const REMOTE_MATCH_SYNC_STATUSES = Object.freeze({
    PENDING: "pending",
    SYNCED: "synced",
    FAILED: "failed"
  });
  const HISTORY_VIEW_MODES = Object.freeze({
    LOCAL: "local",
    REMOTE: "remote"
  });
  const REMOTE_MATCH_HISTORY_LOAD_STATUSES = Object.freeze({
    IDLE: "idle",
    LOADING: "loading",
    READY: "ready",
    FAILED: "failed"
  });
  const REMOTE_MATCH_HISTORY_TABLE = "played_matches";
  const REMOTE_MATCH_HISTORY_FETCH_LIMIT = 50;
  const PLAYER_DISPLAY_NAMES = ["Sentinela Azul", "Guardiao Rubro"];
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

  let sessionPlayerControllers = [PLAYER_CONTROLLER_TYPES.HUMAN, PLAYER_CONTROLLER_TYPES.AI_BASE];
  let sessionHumanAliases = ["", ""];
  let sessionDeckMode = DECK_MODES.SEPARATE;
  let aiTurnTimerId = null;
  let headlessSimulationTimerId = null;
  let nextMatchId = 1;

  function createHeadlessBatchStarterResults() {
    return {
      [PLAYER_CONTROLLER_TYPES.AI_BASE]: { wins: 0, losses: 0 },
      [PLAYER_CONTROLLER_TYPES.AI_SMART]: { wins: 0, losses: 0 }
    };
  }

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

  function shuffleDeck(cards, rng = Math.random) {
    const deck = [...cards];

    for (let index = deck.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(rng() * (index + 1));
      [deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
    }

    return deck;
  }

  function normalizePlayerController(controller) {
    if (controller === "ai" || controller === PLAYER_CONTROLLER_TYPES.AI || controller === PLAYER_CONTROLLER_TYPES.AI_BASE) {
      return PLAYER_CONTROLLER_TYPES.AI_BASE;
    }

    if (controller === PLAYER_CONTROLLER_TYPES.AI_SMART) {
      return PLAYER_CONTROLLER_TYPES.AI_SMART;
    }

    return PLAYER_CONTROLLER_TYPES.HUMAN;
  }

  function normalizePlayerControllers(controllers) {
    const source = Array.isArray(controllers) ? controllers : sessionPlayerControllers;
    return [
      normalizePlayerController(source[0]),
      normalizePlayerController(source[1])
    ];
  }

  function getDefaultHumanAlias(playerIndex) {
    return playerIndex === 0 ? "Humano Azul" : "Humano Rubro";
  }

  function normalizeHumanAlias(alias) {
    if (typeof alias !== "string") {
      return "";
    }

    return alias.trim().slice(0, 40);
  }

  function normalizeHumanAliases(aliases) {
    const source = Array.isArray(aliases) ? aliases : sessionHumanAliases;
    return [
      normalizeHumanAlias(source[0]),
      normalizeHumanAlias(source[1])
    ];
  }

  function getSessionHumanAliases() {
    return [...sessionHumanAliases];
  }

  function setSessionHumanAliases(aliases) {
    sessionHumanAliases = normalizeHumanAliases(aliases);
    return getSessionHumanAliases();
  }

  function setSessionHumanAlias(playerIndex, alias) {
    if (playerIndex !== 0 && playerIndex !== 1) {
      return getSessionHumanAliases();
    }

    const nextAliases = getSessionHumanAliases();
    nextAliases[playerIndex] = normalizeHumanAlias(alias);
    return setSessionHumanAliases(nextAliases);
  }

  function hasHumanPlayer(controllers) {
    return normalizePlayerControllers(controllers).some((controller) => normalizePlayerController(controller) === PLAYER_CONTROLLER_TYPES.HUMAN);
  }

  function getMatchKind(controllers) {
    const normalizedControllers = normalizePlayerControllers(controllers);
    const humanCount = normalizedControllers.filter((controller) => normalizePlayerController(controller) === PLAYER_CONTROLLER_TYPES.HUMAN).length;

    if (humanCount === 2) {
      return MATCH_KINDS.HUMAN_HUMAN;
    }

    if (humanCount === 1) {
      return MATCH_KINDS.HUMAN_AI;
    }

    return MATCH_KINDS.AI_AI;
  }

  function getMatchKindLabel(matchKind) {
    if (matchKind === MATCH_KINDS.HUMAN_HUMAN) {
      return "Humano x Humano";
    }

    if (matchKind === MATCH_KINDS.HUMAN_AI) {
      return "Humano x IA";
    }

    return "IA x IA";
  }

  function getEffectiveHumanAliases(humanAliases, controllers) {
    const normalizedControllers = normalizePlayerControllers(controllers);
    const normalizedAliases = normalizeHumanAliases(humanAliases);

    return normalizedControllers.map((controller, playerIndex) => {
      if (normalizePlayerController(controller) !== PLAYER_CONTROLLER_TYPES.HUMAN) {
        return null;
      }

      return normalizedAliases[playerIndex] || getDefaultHumanAlias(playerIndex);
    });
  }

  function getRemoteHistoryConfig(options = {}) {
    const source = options.remoteHistoryConfig
      || (typeof window !== "undefined" ? window.DUELO_REMOTE_HISTORY_CONFIG : null)
      || {};
    const url = typeof source.SUPABASE_URL === "string"
      ? source.SUPABASE_URL.trim().replace(/\/+$/, "")
      : "";
    const anonKey = typeof source.SUPABASE_ANON_KEY === "string"
      ? source.SUPABASE_ANON_KEY.trim()
      : "";
    const enabled = Boolean(source.REMOTE_MATCH_HISTORY_ENABLED && url && anonKey);

    return {
      enabled,
      url,
      anonKey
    };
  }

  function getRemoteSyncStatusLabel(syncStatus) {
    if (syncStatus === REMOTE_MATCH_SYNC_STATUSES.SYNCED) {
      return "Sincronizado";
    }

    if (syncStatus === REMOTE_MATCH_SYNC_STATUSES.FAILED) {
      return "Falhou";
    }

    if (syncStatus === REMOTE_MATCH_SYNC_STATUSES.PENDING) {
      return "Pendente";
    }

    return "Nao enviado";
  }

  function getControllerDisplayLabel(controller) {
    const normalizedController = normalizePlayerController(controller);
    if (normalizedController === PLAYER_CONTROLLER_TYPES.AI_SMART) {
      return "IA Nova";
    }

    if (normalizedController === PLAYER_CONTROLLER_TYPES.AI_BASE) {
      return "IA Base";
    }

    return "Humano";
  }

  function isAiControllerType(controller) {
    const normalizedController = normalizePlayerController(controller);
    return normalizedController === PLAYER_CONTROLLER_TYPES.AI_BASE
      || normalizedController === PLAYER_CONTROLLER_TYPES.AI_SMART;
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

  function createBoardUnit(card) {
    return {
      ...card,
      estado: "campo",
      podeAgir: true,
      jaAtacouNoTurno: false,
      isDefending: false,
      defendingTargetType: null,
      defendingTargetPlayerIndex: null,
      defendingTargetInstanceId: null,
      defenseOrder: null
    };
  }

  function createUniqueMatchId() {
    const randomPart = Math.random().toString(36).slice(2, 8);
    const id = `match-${Date.now()}-${nextMatchId}-${randomPart}`;
    nextMatchId += 1;
    return id;
  }

  function cloneSavedMatchRecord(record) {
    return {
      id: record.id,
      savedAt: record.savedAt,
      status: record.status,
      winnerPlayerId: record.winnerPlayerId ?? null,
      summary: record.summary,
      snapshot: cloneData(record.snapshot),
      log: cloneLogEntries(record.log || []),
      nextLogNumber: record.nextLogNumber,
      playerControllers: normalizePlayerControllers(record.playerControllers),
      deckMode: normalizeDeckMode(record.deckMode),
      appVersion: typeof record.appVersion === "string" && record.appVersion.length ? record.appVersion : APP_VERSION,
      humanAliases: getEffectiveHumanAliases(record.humanAliases, record.playerControllers),
      matchKind: Object.values(MATCH_KINDS).includes(record.matchKind)
        ? record.matchKind
        : getMatchKind(record.playerControllers),
      remoteEligible: Boolean(record.remoteEligible ?? hasHumanPlayer(record.playerControllers)),
      remoteSyncStatus: Object.values(REMOTE_MATCH_SYNC_STATUSES).includes(record.remoteSyncStatus)
        ? record.remoteSyncStatus
        : null,
      remoteRecordId: typeof record.remoteRecordId === "string" && record.remoteRecordId.length
        ? record.remoteRecordId
        : null,
      remoteSyncError: typeof record.remoteSyncError === "string" && record.remoteSyncError.length
        ? record.remoteSyncError
        : null,
      remoteSyncAttemptedAt: typeof record.remoteSyncAttemptedAt === "string" && record.remoteSyncAttemptedAt.length
        ? record.remoteSyncAttemptedAt
        : null
    };
  }

  function normalizeHeadlessBatchCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return HEADLESS_AI_BATCH_DEFAULT_MATCHES;
    }

    return Math.min(
      HEADLESS_AI_BATCH_MAX_MATCHES,
      Math.max(HEADLESS_AI_BATCH_MIN_MATCHES, parsed)
    );
  }

  function isSupportedDeckMode(deckMode) {
    return deckMode === DECK_MODES.SHARED || deckMode === DECK_MODES.SEPARATE;
  }

  function isSupportedPlayerController(controller) {
    return controller === "ai"
      || controller === PLAYER_CONTROLLER_TYPES.HUMAN
      || controller === PLAYER_CONTROLLER_TYPES.AI_BASE
      || controller === PLAYER_CONTROLLER_TYPES.AI_SMART;
  }

  function hasSupportedPlayerControllers(controllers) {
    return Array.isArray(controllers)
      && controllers.length === 2
      && controllers.every((controller) => isSupportedPlayerController(controller));
  }

  function hasValidSnapshotPlayers(players) {
    return Array.isArray(players)
      && players.length === 2
      && players.every((player) => (
        player
        && typeof player === "object"
        && Array.isArray(player.hand)
        && Array.isArray(player.board)
        && Array.isArray(player.supportZone)
      ));
  }

  function isRestorableSavedMatchSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    if (!Array.isArray(snapshot.deck) || !Array.isArray(snapshot.discardPile)) {
      return false;
    }

    if (!Array.isArray(snapshot.playerDecks) || snapshot.playerDecks.length !== 2) {
      return false;
    }

    if (!Array.isArray(snapshot.playerDiscardPiles) || snapshot.playerDiscardPiles.length !== 2) {
      return false;
    }

    if (!Number.isInteger(snapshot.currentPlayerIndex) || snapshot.currentPlayerIndex < 0 || snapshot.currentPlayerIndex > 1) {
      return false;
    }

    if (!isSupportedDeckMode(snapshot.deckMode) || !hasSupportedPlayerControllers(snapshot.playerControllers)) {
      return false;
    }

    if (!hasValidSnapshotPlayers(snapshot.players)) {
      return false;
    }

    try {
      const restoredState = restoreStateFromSnapshot(snapshot, []);
      return Array.isArray(restoredState.players) && restoredState.players.length === 2;
    } catch (error) {
      return false;
    }
  }

  function stripLogSnapshots(entries) {
    return Array.isArray(entries)
      ? entries.map((entry) => ({
        id: entry.id,
        numero: entry.numero,
        texto: entry.texto,
        event: cloneData(entry.event)
      }))
      : [];
  }

  function rehydrateSavedMatchLog(logEntries, initialSnapshot) {
    if (!Array.isArray(logEntries) || !logEntries.length) {
      return [];
    }

    if (logEntries.every((entry) => entry?.snapshot)) {
      return cloneLogEntries(logEntries);
    }

    if (!initialSnapshot) {
      return null;
    }

    const hydratedEntries = logEntries.map((entry) => ({
      id: entry.id,
      numero: entry.numero,
      texto: entry.texto,
      event: cloneData(entry.event),
      snapshot: null
    }));
    hydratedEntries[0].snapshot = cloneData(initialSnapshot);

    for (let entryIndex = 1; entryIndex < hydratedEntries.length; entryIndex += 1) {
      const entry = hydratedEntries[entryIndex];
      const previousEntry = hydratedEntries[entryIndex - 1];
      if (!previousEntry?.snapshot || !entry?.event) {
        return null;
      }

      let workingState = createReplayStateFromSnapshot(previousEntry.snapshot);
      let rebuiltSnapshot = null;
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
          continue;
        }

        rebuiltSnapshot = createStateSnapshot(attemptState);
        break;
      }

      if (!rebuiltSnapshot) {
        return null;
      }

      entry.snapshot = rebuiltSnapshot;
    }

    return hydratedEntries;
  }

  function createPersistedMatchRecord(record) {
    const normalizedRecord = normalizeSavedMatchRecord(record);
    if (!normalizedRecord) {
      return null;
    }

    return {
      id: normalizedRecord.id,
      savedAt: normalizedRecord.savedAt,
      status: normalizedRecord.status,
      winnerPlayerId: normalizedRecord.winnerPlayerId,
      summary: normalizedRecord.summary,
      snapshot: cloneData(normalizedRecord.snapshot),
      initialSnapshot: normalizedRecord.log[0]?.snapshot ? cloneData(normalizedRecord.log[0].snapshot) : null,
      log: stripLogSnapshots(normalizedRecord.log),
      nextLogNumber: normalizedRecord.nextLogNumber,
      playerControllers: normalizePlayerControllers(normalizedRecord.playerControllers),
      deckMode: normalizeDeckMode(normalizedRecord.deckMode),
      appVersion: normalizedRecord.appVersion,
      humanAliases: cloneData(normalizedRecord.humanAliases),
      matchKind: normalizedRecord.matchKind,
      remoteEligible: normalizedRecord.remoteEligible,
      remoteSyncStatus: normalizedRecord.remoteSyncStatus,
      remoteRecordId: normalizedRecord.remoteRecordId,
      remoteSyncError: normalizedRecord.remoteSyncError,
      remoteSyncAttemptedAt: normalizedRecord.remoteSyncAttemptedAt
    };
  }

  function normalizeSavedMatchRecord(record) {
    if (!record || typeof record !== "object" || !record.snapshot || !Array.isArray(record.log)) {
      return null;
    }

    const snapshotControllers = hasSupportedPlayerControllers(record.snapshot?.playerControllers)
      ? record.snapshot.playerControllers
      : null;
    const recordControllers = hasSupportedPlayerControllers(record.playerControllers)
      ? record.playerControllers
      : null;
    const normalizedControllers = recordControllers || snapshotControllers;
    const snapshotDeckMode = isSupportedDeckMode(record.snapshot?.deckMode)
      ? record.snapshot.deckMode
      : null;
    const recordDeckMode = isSupportedDeckMode(record.deckMode)
      ? record.deckMode
      : null;
    const normalizedDeckMode = recordDeckMode || snapshotDeckMode;

    if (!normalizedControllers || !normalizedDeckMode || !isRestorableSavedMatchSnapshot(record.snapshot)) {
      return null;
    }

    const initialSnapshot = record.initialSnapshot
      ? cloneData(record.initialSnapshot)
      : (record.log[0]?.snapshot ? cloneData(record.log[0].snapshot) : null);
    if (initialSnapshot && !isRestorableSavedMatchSnapshot(initialSnapshot)) {
      return null;
    }

    const normalizedLog = rehydrateSavedMatchLog(record.log, initialSnapshot);
    if (normalizedLog == null) {
      return null;
    }

    return {
      id: typeof record.id === "string" && record.id.length ? record.id : createUniqueMatchId(),
      savedAt: typeof record.savedAt === "string" && record.savedAt.length ? record.savedAt : new Date().toISOString(),
      status: record.status === "finished" ? "finished" : "abandoned",
      winnerPlayerId: Number.isInteger(record.winnerPlayerId) ? record.winnerPlayerId : null,
      summary: typeof record.summary === "string" ? record.summary : "",
      snapshot: cloneData(record.snapshot),
      log: normalizedLog,
      nextLogNumber: Number.isInteger(record.nextLogNumber) ? record.nextLogNumber : (Array.isArray(record.log) ? record.log.length + 1 : 1),
      playerControllers: normalizePlayerControllers(normalizedControllers),
      deckMode: normalizeDeckMode(normalizedDeckMode),
      appVersion: typeof record.appVersion === "string" && record.appVersion.length ? record.appVersion : APP_VERSION,
      humanAliases: getEffectiveHumanAliases(record.humanAliases, normalizedControllers),
      matchKind: Object.values(MATCH_KINDS).includes(record.matchKind)
        ? record.matchKind
        : getMatchKind(normalizedControllers),
      remoteEligible: Boolean(record.remoteEligible ?? hasHumanPlayer(normalizedControllers)),
      remoteSyncStatus: Object.values(REMOTE_MATCH_SYNC_STATUSES).includes(record.remoteSyncStatus)
        ? record.remoteSyncStatus
        : null,
      remoteRecordId: typeof record.remoteRecordId === "string" && record.remoteRecordId.length
        ? record.remoteRecordId
        : null,
      remoteSyncError: typeof record.remoteSyncError === "string" && record.remoteSyncError.length
        ? record.remoteSyncError
        : null,
      remoteSyncAttemptedAt: typeof record.remoteSyncAttemptedAt === "string" && record.remoteSyncAttemptedAt.length
        ? record.remoteSyncAttemptedAt
        : null
    };
  }

  function getHistoryStorage(options = {}) {
    if (options.storage) {
      return options.storage;
    }

    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function loadMatchHistory(options = {}) {
    const storage = getHistoryStorage(options);
    if (!storage || typeof storage.getItem !== "function") {
      return [];
    }

    try {
      const rawValue = storage.getItem(MATCH_HISTORY_STORAGE_KEY);
      if (!rawValue) {
        return [];
      }

      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((record) => normalizeSavedMatchRecord(record))
        .filter(Boolean)
        .slice(0, MAX_SAVED_MATCHES);
    } catch (error) {
      return [];
    }
  }

  function saveMatchHistory(records, options = {}) {
    const normalizedRecords = Array.isArray(records)
      ? records
        .map((record) => createPersistedMatchRecord(record))
        .filter(Boolean)
        .slice(0, MAX_SAVED_MATCHES)
      : [];
    const storage = getHistoryStorage(options);

    if (!storage || typeof storage.setItem !== "function") {
      return false;
    }

    try {
      storage.setItem(MATCH_HISTORY_STORAGE_KEY, JSON.stringify(normalizedRecords));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getHistoryStatusLabel(status) {
    return status === "finished" ? "Encerrada" : "Abandonada";
  }

  function getDeckModeLabel(deckMode) {
    return normalizeDeckMode(deckMode) === DECK_MODES.SHARED ? "Compartilhado" : "Separado";
  }

  function buildSavedMatchSummary(state, status) {
    const winner = state.winner;
    const actionCount = state.log.length;
    if (status === "finished" && winner) {
      return `${winner.nome} venceu apos ${actionCount} acao(oes).`;
    }

    return `Partida abandonada apos ${actionCount} acao(oes).`;
  }

  function createSavedMatchRecord(state, status) {
    return {
      id: state.currentMatchId || createUniqueMatchId(),
      savedAt: new Date().toISOString(),
      status,
      winnerPlayerId: state.winner ? state.winner.id : null,
      summary: buildSavedMatchSummary(state, status),
      snapshot: createStateSnapshot(state),
      log: cloneLogEntries(state.log),
      nextLogNumber: state.nextLogNumber,
      playerControllers: normalizePlayerControllers(state.playerControllers),
      deckMode: normalizeDeckMode(state.deckMode),
      appVersion: APP_VERSION,
      humanAliases: getEffectiveHumanAliases(state.humanAliases, state.playerControllers),
      matchKind: getMatchKind(state.playerControllers),
      remoteEligible: hasHumanPlayer(state.playerControllers),
      remoteSyncStatus: null,
      remoteRecordId: null,
      remoteSyncError: null,
      remoteSyncAttemptedAt: null
    };
  }

  function notifyHistoryPersistenceFailure(status, options = {}) {
    const statusLabel = status === "finished" ? "encerrada" : "abandonada";
    const message = `A partida ${statusLabel} foi mantida apenas nesta sessao. Nao foi possivel persistir o Historico no navegador.`;

    if (typeof options.notifyFn === "function") {
      options.notifyFn(message);
      return;
    }

    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(message);
    }
  }

  function archiveCurrentMatchIfNeeded(state, status, options = {}) {
    const result = {
      archived: false,
      persisted: false,
      recordId: null
    };

    if (!state?.isMatchStarted || state.hasCurrentMatchBeenSavedToHistory || state.isHeadlessBatchInternal) {
      return result;
    }

    if (!state.log.length) {
      return result;
    }

    if (state.historySourceRecordId && !state.hasDivergedFromHistorySource) {
      return result;
    }

    if (status === "finished" && !state.winner) {
      return result;
    }

    const savedRecord = createSavedMatchRecord(state, status);
    const remoteConfig = getRemoteHistoryConfig(options);
    if (savedRecord.remoteEligible && remoteConfig.enabled) {
      savedRecord.remoteSyncStatus = REMOTE_MATCH_SYNC_STATUSES.PENDING;
    }
    state.matchHistory = [
      savedRecord,
      ...((state.matchHistory || []).filter((record) => record.id !== savedRecord.id))
    ]
      .map((record) => cloneSavedMatchRecord(record))
      .slice(0, MAX_SAVED_MATCHES);
    result.archived = true;
    result.recordId = savedRecord.id;
    result.persisted = saveMatchHistory(state.matchHistory, options);
    state.hasCurrentMatchBeenSavedToHistory = result.persisted;

    if (!result.persisted) {
      notifyHistoryPersistenceFailure(status, options);
    }

    if (savedRecord.remoteEligible && remoteConfig.enabled && state === gameState) {
      scheduleRemoteMatchSync(savedRecord.id, options);
    }

    return result;
  }

  function isPromiseLike(value) {
    return Boolean(value && typeof value.then === "function");
  }

  function handleMaybePromise(value, onSuccess, onError) {
    if (isPromiseLike(value)) {
      return value.then(onSuccess, onError);
    }

    try {
      return onSuccess(value);
    } catch (error) {
      if (typeof onError === "function") {
        return onError(error);
      }

      throw error;
    }
  }

  function getSavedMatchById(state, recordId) {
    if (!state || !Array.isArray(state.matchHistory)) {
      return null;
    }

    return state.matchHistory.find((record) => record.id === recordId) || null;
  }

  function setSavedMatchRemoteSyncState(state, recordId, patch, options = {}) {
    const record = getSavedMatchById(state, recordId);
    if (!record) {
      return null;
    }

    Object.assign(record, patch);
    saveMatchHistory(state.matchHistory, options);
    return record;
  }

  function buildRemoteMatchPayload(record) {
    const normalizedRecord = normalizeSavedMatchRecord(record);
    if (!normalizedRecord || !normalizedRecord.remoteEligible) {
      return null;
    }

    const persistedRecord = createPersistedMatchRecord(normalizedRecord);
    if (!persistedRecord) {
      return null;
    }

    const winnerName = getSavedMatchWinnerName(normalizedRecord);
    return {
      match_saved_at: normalizedRecord.savedAt,
      status: normalizedRecord.status,
      match_kind: normalizedRecord.matchKind,
      winner_player_id: normalizedRecord.winnerPlayerId,
      winner_name: winnerName,
      summary: normalizedRecord.summary,
      deck_mode: normalizedRecord.deckMode,
      player_controllers: normalizePlayerControllers(normalizedRecord.playerControllers),
      human_aliases: cloneData(normalizedRecord.humanAliases),
      app_version: normalizedRecord.appVersion,
      action_count: normalizedRecord.log.length,
      record: {
        ...persistedRecord,
        appVersion: normalizedRecord.appVersion,
        humanAliases: cloneData(normalizedRecord.humanAliases),
        matchKind: normalizedRecord.matchKind
      }
    };
  }

  function normalizeSupabaseRemoteRow(row) {
    if (!row || typeof row !== "object" || !row.record) {
      return null;
    }

    const normalizedRecord = normalizeSavedMatchRecord({
      ...cloneData(row.record),
      id: typeof row.record.id === "string" && row.record.id.length ? row.record.id : String(row.id || createUniqueMatchId()),
      savedAt: typeof row.match_saved_at === "string" && row.match_saved_at.length
        ? row.match_saved_at
        : (typeof row.record.savedAt === "string" ? row.record.savedAt : new Date().toISOString()),
      status: row.status === "finished" ? "finished" : "abandoned",
      winnerPlayerId: Number.isInteger(row.winner_player_id) ? row.winner_player_id : row.record.winnerPlayerId,
      summary: typeof row.summary === "string" ? row.summary : row.record.summary,
      playerControllers: row.player_controllers || row.record.playerControllers,
      deckMode: row.deck_mode || row.record.deckMode,
      appVersion: typeof row.app_version === "string" && row.app_version.length
        ? row.app_version
        : row.record.appVersion,
      humanAliases: row.human_aliases || row.record.humanAliases,
      matchKind: typeof row.match_kind === "string" && row.match_kind.length
        ? row.match_kind
        : row.record.matchKind,
      remoteEligible: true,
      remoteSyncStatus: REMOTE_MATCH_SYNC_STATUSES.SYNCED,
      remoteRecordId: typeof row.id === "string" ? row.id : String(row.id || ""),
      remoteSyncError: null,
      remoteSyncAttemptedAt: typeof row.created_at === "string" ? row.created_at : null
    });

    if (!normalizedRecord) {
      return null;
    }

    normalizedRecord.remoteCreatedAt = typeof row.created_at === "string" ? row.created_at : normalizedRecord.savedAt;
    return normalizedRecord;
  }

  function fetchRemoteMatchHistory(options = {}) {
    const config = getRemoteHistoryConfig(options);
    if (!config.enabled) {
      return [];
    }

    const request = typeof options.fetch === "function"
      ? options.fetch
      : (typeof fetch === "function" ? fetch.bind(typeof window !== "undefined" ? window : null) : null);
    if (!request) {
      throw new Error("fetch indisponivel para carregar o historico remoto.");
    }

    const selectFields = [
      "id",
      "created_at",
      "match_saved_at",
      "status",
      "match_kind",
      "winner_player_id",
      "winner_name",
      "summary",
      "deck_mode",
      "player_controllers",
      "human_aliases",
      "app_version",
      "action_count",
      "record"
    ].join(",");
    const url = `${config.url}/rest/v1/${REMOTE_MATCH_HISTORY_TABLE}?select=${encodeURIComponent(selectFields)}&order=match_saved_at.desc&limit=${REMOTE_MATCH_HISTORY_FETCH_LIMIT}`;

    return handleMaybePromise(
      request(url, {
        method: "GET",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          Accept: "application/json"
        }
      }),
      (response) => {
        if (!response || response.ok === false) {
          const statusCode = response?.status ? ` ${response.status}` : "";
          throw new Error(`Falha ao carregar o historico remoto.${statusCode}`);
        }

        const payload = typeof response.json === "function" ? response.json() : [];
        return handleMaybePromise(payload, (rows) => (
          Array.isArray(rows)
            ? rows.map((row) => normalizeSupabaseRemoteRow(row)).filter(Boolean)
            : []
        ));
      }
    );
  }

  function refreshRemoteMatchHistory(state, options = {}) {
    const config = getRemoteHistoryConfig(options);
    if (!config.enabled) {
      state.remoteMatchHistory = [];
      state.remoteMatchHistoryStatus = REMOTE_MATCH_HISTORY_LOAD_STATUSES.FAILED;
      state.remoteMatchHistoryError = "Historico remoto desativado ou nao configurado.";
      state.selectedRemoteHistoryMatchId = null;
      return false;
    }

    state.remoteMatchHistoryStatus = REMOTE_MATCH_HISTORY_LOAD_STATUSES.LOADING;
    state.remoteMatchHistoryError = null;
    const finishSuccess = (records) => {
      state.remoteMatchHistory = Array.isArray(records) ? records.map((record) => cloneSavedMatchRecord(record)) : [];
      state.remoteMatchHistoryStatus = REMOTE_MATCH_HISTORY_LOAD_STATUSES.READY;
      state.remoteMatchHistoryError = null;
      const selectedStillExists = state.remoteMatchHistory.some((record) => record.id === state.selectedRemoteHistoryMatchId);
      state.selectedRemoteHistoryMatchId = selectedStillExists
        ? state.selectedRemoteHistoryMatchId
        : (state.remoteMatchHistory[0]?.id || null);
      return state.remoteMatchHistory;
    };
    const finishFailure = (error) => {
      state.remoteMatchHistory = [];
      state.remoteMatchHistoryStatus = REMOTE_MATCH_HISTORY_LOAD_STATUSES.FAILED;
      state.remoteMatchHistoryError = error?.message || "Nao foi possivel carregar o historico remoto.";
      state.selectedRemoteHistoryMatchId = null;
      return [];
    };

    return handleMaybePromise(fetchRemoteMatchHistory(options), finishSuccess, finishFailure);
  }

  function syncSavedMatchRecordToRemote(state, recordId, options = {}) {
    const record = getSavedMatchById(state, recordId);
    const config = getRemoteHistoryConfig(options);
    const request = typeof options.fetch === "function"
      ? options.fetch
      : (typeof fetch === "function" ? fetch.bind(typeof window !== "undefined" ? window : null) : null);

    if (!record || !record.remoteEligible || !config.enabled || !request) {
      return false;
    }

    const payload = buildRemoteMatchPayload(record);
    if (!payload) {
      return false;
    }

    setSavedMatchRemoteSyncState(state, recordId, {
      remoteSyncStatus: REMOTE_MATCH_SYNC_STATUSES.PENDING,
      remoteSyncError: null,
      remoteSyncAttemptedAt: new Date().toISOString()
    }, options);

    const finishSuccess = (rowPayload) => {
      const row = Array.isArray(rowPayload) ? rowPayload[0] : rowPayload;
      setSavedMatchRemoteSyncState(state, recordId, {
        remoteSyncStatus: REMOTE_MATCH_SYNC_STATUSES.SYNCED,
        remoteRecordId: typeof row?.id === "string" && row.id.length ? row.id : (record.remoteRecordId || null),
        remoteSyncError: null,
        remoteSyncAttemptedAt: new Date().toISOString()
      }, options);
      if (options.showFeedback) {
        state.remoteHistorySyncFeedback = "Partida enviada para o historico remoto.";
        state.remoteHistorySyncFeedbackStatus = "success";
      }
      return true;
    };
    const finishFailure = (error) => {
      setSavedMatchRemoteSyncState(state, recordId, {
        remoteSyncStatus: REMOTE_MATCH_SYNC_STATUSES.FAILED,
        remoteSyncError: error?.message || "Falha ao enviar a partida para o historico remoto.",
        remoteSyncAttemptedAt: new Date().toISOString()
      }, options);
      if (options.showFeedback) {
        state.remoteHistorySyncFeedback = error?.message || "Falha ao enviar a partida para o historico remoto.";
        state.remoteHistorySyncFeedbackStatus = "error";
      }
      return false;
    };

    return handleMaybePromise(
      request(`${config.url}/rest/v1/${REMOTE_MATCH_HISTORY_TABLE}`, {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      }),
      (response) => {
        if (!response || response.ok === false) {
          const statusCode = response?.status ? ` ${response.status}` : "";
          throw new Error(`Falha ao salvar a partida no historico remoto.${statusCode}`);
        }

        const responsePayload = typeof response.json === "function" ? response.json() : null;
        return handleMaybePromise(responsePayload, finishSuccess, finishFailure);
      },
      finishFailure
    );
  }

  function scheduleRemoteMatchSync(recordId, options = {}) {
    Promise.resolve().then(() => {
      const currentState = typeof options.getState === "function" ? options.getState() : gameState;
      const renderFn = typeof options.renderFn === "function"
        ? options.renderFn
        : (typeof document !== "undefined" ? render : null);
      const syncResult = syncSavedMatchRecordToRemote(currentState, recordId, options);

      if (isPromiseLike(syncResult)) {
        syncResult.finally(() => {
          if (typeof renderFn === "function") {
            renderFn(currentState);
          }
        });
        return;
      }

      if (typeof renderFn === "function") {
        renderFn(currentState);
      }
    });
  }

  function getSavedMatchPlayers(record) {
    return Array.isArray(record?.snapshot?.players) ? record.snapshot.players : [];
  }

  function getSavedMatchWinnerName(record) {
    if (!record || !Number.isInteger(record.winnerPlayerId)) {
      return null;
    }

    return getSavedMatchPlayers(record).find((player) => player.id === record.winnerPlayerId)?.nome || "Vencedor";
  }

  function getSelectedHistoryMatch(state) {
    if (!state || state.selectedHistoryMatchId == null || !Array.isArray(state.matchHistory)) {
      return null;
    }

    return state.matchHistory.find((record) => record.id === state.selectedHistoryMatchId) || null;
  }

  function getSelectedRemoteHistoryMatch(state) {
    if (!state || state.selectedRemoteHistoryMatchId == null || !Array.isArray(state.remoteMatchHistory)) {
      return null;
    }

    return state.remoteMatchHistory.find((record) => record.id === state.selectedRemoteHistoryMatchId) || null;
  }

  function getHistoryRestoreTarget(record, selectedEntryId = null) {
    if (!record) {
      return null;
    }

    const recordLog = Array.isArray(record.log) ? record.log : [];

    if (selectedEntryId != null) {
      const selectedIndex = recordLog.findIndex((entry) => entry.id === selectedEntryId);
      const selectedEntry = selectedIndex === -1 ? null : recordLog[selectedIndex];
      if (selectedEntry?.snapshot) {
        return {
          snapshot: selectedEntry.snapshot,
          log: cloneLogEntries(recordLog.slice(0, selectedIndex + 1))
        };
      }
    }

    for (let index = recordLog.length - 1; index >= 0; index -= 1) {
      const entry = recordLog[index];
      if (entry?.snapshot) {
        return {
          snapshot: entry.snapshot,
          log: cloneLogEntries(recordLog.slice(0, index + 1))
        };
      }
    }

    if (record.snapshot) {
      return {
        snapshot: record.snapshot,
        log: cloneLogEntries(recordLog)
      };
    }

    return null;
  }

  function restoreMatchFromHistory(record, previousState, options = {}) {
    if (previousState?.isMatchStarted) {
      archiveCurrentMatchIfNeeded(previousState, previousState.winner ? "finished" : "abandoned", options);
    }

    const restoreTarget = getHistoryRestoreTarget(record, previousState?.selectedHistoryLogEntryId ?? null);
    if (!restoreTarget) {
      return previousState || createInitialState();
    }

    const restoredState = restoreStateFromSnapshot(restoreTarget.snapshot, restoreTarget.log);
    restoredState.currentMatchId = createUniqueMatchId();
    restoredState.matchHistory = (previousState?.matchHistory || []).map((item) => cloneSavedMatchRecord(item));
    restoredState.remoteMatchHistory = (previousState?.remoteMatchHistory || []).map((item) => cloneSavedMatchRecord(item));
    restoredState.hasCurrentMatchBeenSavedToHistory = false;
    restoredState.historySourceRecordId = record.id;
    restoredState.hasDivergedFromHistorySource = false;
    restoredState.humanAliases = normalizeHumanAliases(record.humanAliases);
    restoredState.selectedHistoryMatchId = null;
    restoredState.selectedHistoryLogEntryId = null;
    restoredState.selectedRemoteHistoryMatchId = null;
    restoredState.selectedValidationIssueIndex = null;
    restoredState.logValidationCopyFeedback = null;
    restoredState.logValidationCopyFeedbackStatus = null;
    restoredState.remoteHistorySyncFeedback = null;
    restoredState.remoteHistorySyncFeedbackStatus = null;
    restoredState.isLibraryOpen = false;
    restoredState.isRulesOpen = false;
    restoredState.isLogOpen = false;
    restoredState.isHistoryOpen = false;
    restoredState.historyViewMode = HISTORY_VIEW_MODES.LOCAL;
    restoredState.selectedLogEntryId = null;
    return restoredState;
  }

  function createInitialState() {
    return {
      deck: [],
      discardPile: [],
      playerDecks: [[], []],
      playerDiscardPiles: [[], []],
      currentPlayerIndex: 0,
      playerControllers: getSessionPlayerControllers(),
      humanAliases: getSessionHumanAliases(),
      deckMode: getSessionDeckMode(),
      isMatchStarted: false,
      matchPresentationMode: MATCH_PRESENTATION_MODES.VISUAL,
      isHeadlessSimulationRunning: false,
      headlessBatchRequestedCount: HEADLESS_AI_BATCH_DEFAULT_MATCHES,
      headlessBatchCompletedCount: 0,
      headlessBatchWins: [0, 0],
      headlessBatchControllerWins: {
        [PLAYER_CONTROLLER_TYPES.AI_BASE]: 0,
        [PLAYER_CONTROLLER_TYPES.AI_SMART]: 0
      },
      headlessBatchStarterResults: createHeadlessBatchStarterResults(),
      headlessBatchSeatWins: [0, 0],
      headlessBatchMode: HEADLESS_BATCH_MODES.SIMPLE,
      headlessBatchPairCountRequested: 0,
      headlessBatchCurrentMatchNumber: 0,
      headlessBatchCurrentMatchActionCount: 0,
      headlessBatchStatus: HEADLESS_BATCH_STATUSES.IDLE,
      headlessBatchErrorMessage: null,
      headlessBatchMatchState: null,
      headlessBatchRandomFn: null,
      isHeadlessBatchInternal: false,
      suppressValidationAlerts: false,
      isAiVsAiPaused: false,
      isAiTurnInProgress: false,
      aiStepText: null,
      isLibraryOpen: false,
      isRulesOpen: false,
      isLogOpen: false,
      isHistoryOpen: false,
      historyViewMode: HISTORY_VIEW_MODES.LOCAL,
      selectedAttackerId: null,
      selectedEffectCard: null,
      selectedLogEntryId: null,
      selectedHistoryMatchId: null,
      selectedHistoryLogEntryId: null,
      remoteMatchHistory: [],
      selectedRemoteHistoryMatchId: null,
      remoteMatchHistoryStatus: REMOTE_MATCH_HISTORY_LOAD_STATUSES.IDLE,
      remoteMatchHistoryError: null,
      remoteHistorySyncFeedback: null,
      remoteHistorySyncFeedbackStatus: null,
      isWinnerModalOpen: false,
      winner: null,
      turnNumber: 1,
      nextDefenseOrder: 1,
      currentMatchId: null,
      historySourceRecordId: null,
      hasDivergedFromHistorySource: false,
      hasCurrentMatchBeenSavedToHistory: false,
      matchHistory: [],
      log: [],
      nextLogNumber: 1,
      logValidationStatus: LOG_VALIDATION_STATUS.IDLE,
      validatedEntryCount: 0,
      logValidationIssues: [],
      selectedValidationIssueIndex: null,
      logValidationCopyFeedback: null,
      logValidationCopyFeedbackStatus: null,
      players: [
        createPlayer(1, PLAYER_DISPLAY_NAMES[0]),
        createPlayer(2, PLAYER_DISPLAY_NAMES[1])
      ]
    };
  }

  function startConfiguredMatch(previousState, options = {}) {
    const nextState = createInitialState();
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const preservedControllers = setSessionPlayerControllers(previousState?.playerControllers);
    nextState.playerControllers = preservedControllers;
    nextState.humanAliases = setSessionHumanAliases(previousState?.humanAliases);
    nextState.deckMode = setSessionDeckMode(previousState?.deckMode);
    nextState.headlessBatchRequestedCount = normalizeHeadlessBatchCount(previousState?.headlessBatchRequestedCount);
    nextState.isLibraryOpen = Boolean(previousState?.isLibraryOpen);
    nextState.isRulesOpen = Boolean(previousState?.isRulesOpen);
    nextState.isLogOpen = Boolean(previousState?.isLogOpen);
    nextState.isHistoryOpen = Boolean(previousState?.isHistoryOpen);
    nextState.historyViewMode = previousState?.historyViewMode === HISTORY_VIEW_MODES.REMOTE
      ? HISTORY_VIEW_MODES.REMOTE
      : HISTORY_VIEW_MODES.LOCAL;
    nextState.matchHistory = (previousState?.matchHistory || []).map((record) => cloneSavedMatchRecord(record));
    nextState.remoteMatchHistory = (previousState?.remoteMatchHistory || []).map((record) => cloneSavedMatchRecord(record));
    nextState.selectedRemoteHistoryMatchId = previousState?.selectedRemoteHistoryMatchId ?? null;
    nextState.remoteMatchHistoryStatus = previousState?.remoteMatchHistoryStatus || REMOTE_MATCH_HISTORY_LOAD_STATUSES.IDLE;
    nextState.remoteMatchHistoryError = previousState?.remoteMatchHistoryError || null;
    nextState.remoteHistorySyncFeedback = previousState?.remoteHistorySyncFeedback || null;
    nextState.remoteHistorySyncFeedbackStatus = previousState?.remoteHistorySyncFeedbackStatus || null;
    nextState.currentMatchId = createUniqueMatchId();
    nextState.isMatchStarted = true;
    nextState.matchPresentationMode = MATCH_PRESENTATION_MODES.VISUAL;
    nextState.isHeadlessSimulationRunning = false;

    if (nextState.deckMode === DECK_MODES.SHARED) {
      nextState.deck = shuffleDeck(createDeck(), rng);
      nextState.discardPile = [];
      nextState.playerDecks = [[], []];
      nextState.playerDiscardPiles = [[], []];
    } else {
      nextState.deck = [];
      nextState.discardPile = [];
      nextState.playerDecks = [
        shuffleDeck(createDeck(SEPARATE_DECK_COPIES_PER_TYPE, "p1"), rng),
        shuffleDeck(createDeck(SEPARATE_DECK_COPIES_PER_TYPE, "p2"), rng)
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
    nextState.selectedHistoryMatchId = null;
    nextState.selectedHistoryLogEntryId = null;
    return nextState;
  }

  function createRestartState(previousState, options = {}) {
    const nextState = createInitialState();

    if (!previousState) {
      return nextState;
    }

    nextState.playerControllers = setSessionPlayerControllers(previousState.playerControllers);
    nextState.humanAliases = setSessionHumanAliases(previousState.humanAliases);
    nextState.deckMode = setSessionDeckMode(previousState.deckMode);
    nextState.headlessBatchRequestedCount = normalizeHeadlessBatchCount(previousState.headlessBatchRequestedCount);
    nextState.isLibraryOpen = Boolean(previousState.isLibraryOpen);
    nextState.isRulesOpen = Boolean(previousState.isRulesOpen);
    nextState.isLogOpen = Boolean(previousState.isLogOpen);
    nextState.isHistoryOpen = Boolean(previousState.isHistoryOpen);
    nextState.historyViewMode = previousState.historyViewMode === HISTORY_VIEW_MODES.REMOTE
      ? HISTORY_VIEW_MODES.REMOTE
      : HISTORY_VIEW_MODES.LOCAL;
    nextState.matchHistory = (previousState.matchHistory || []).map((record) => cloneSavedMatchRecord(record));
    nextState.remoteMatchHistory = (previousState.remoteMatchHistory || []).map((record) => cloneSavedMatchRecord(record));
    nextState.selectedRemoteHistoryMatchId = previousState.selectedRemoteHistoryMatchId ?? null;
    nextState.remoteMatchHistoryStatus = previousState.remoteMatchHistoryStatus || REMOTE_MATCH_HISTORY_LOAD_STATUSES.IDLE;
    nextState.remoteMatchHistoryError = previousState.remoteMatchHistoryError || null;
    nextState.remoteHistorySyncFeedback = previousState.remoteHistorySyncFeedback || null;
    nextState.remoteHistorySyncFeedbackStatus = previousState.remoteHistorySyncFeedbackStatus || null;

    if (previousState.isMatchStarted && !isHeadlessAiVsAiMode(previousState)) {
      archiveCurrentMatchIfNeeded(previousState, previousState.winner ? "finished" : "abandoned", options);
      nextState.matchHistory = (previousState.matchHistory || []).map((record) => cloneSavedMatchRecord(record));
    }

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
    state.selectedValidationIssueIndex = null;
    state.logValidationCopyFeedback = null;
    state.logValidationCopyFeedbackStatus = null;
  }

  function markHistorySourceDiverged(state) {
    if (state?.historySourceRecordId) {
      state.hasDivergedFromHistorySource = true;
    }
  }

  function applyLogValidationResult(state, result) {
    state.logValidationStatus = result.status;
    state.validatedEntryCount = result.validatedEntryCount;
    state.logValidationIssues = result.issues;
    state.selectedValidationIssueIndex = result.status === LOG_VALIDATION_STATUS.INVALID && result.issues.length
      ? 0
      : null;
    state.logValidationCopyFeedback = null;
    state.logValidationCopyFeedbackStatus = null;
    return result;
  }

  function validateCurrentLog(state, options = {}) {
    const result = applyLogValidationResult(state, validateMatchLog(state.log));

    if (options.alertOnFailure && !state?.suppressValidationAlerts && result.status === LOG_VALIDATION_STATUS.INVALID) {
      const problemCount = result.issues.length;
      const message = problemCount === 1
        ? "A validacao automatica do log encontrou 1 problema. Abra o menu Log para revisar."
        : `A validacao automatica do log encontrou ${problemCount} problemas. Abra o menu Log para revisar.`;

      if (typeof options.notifyFn === "function") {
        options.notifyFn(message);
      } else if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(message);
      }
    }

    return result;
  }

  function finalizeCompletedMatch(state, options = {}) {
    const result = validateCurrentLog(state, {
      alertOnFailure: true,
      notifyFn: options.notifyFn
    });
    archiveCurrentMatchIfNeeded(state, "finished", options);
    if (isHeadlessAiVsAiMode(state)) {
      finishHeadlessAiMatch(state);
    }
    return result;
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
      nextDefenseOrder: state.nextDefenseOrder,
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
    markHistorySourceDiverged(state);
    resetLogValidation(state);
  }

  function restoreStateFromSnapshot(snapshot, logEntries, stateOptions = {}) {
    const restoredState = {
      deck: cloneData(snapshot.deck),
      discardPile: cloneData(snapshot.discardPile),
      playerDecks: cloneData(snapshot.playerDecks || [[], []]),
      playerDiscardPiles: cloneData(snapshot.playerDiscardPiles || [[], []]),
      currentPlayerIndex: snapshot.currentPlayerIndex,
      playerControllers: normalizePlayerControllers(snapshot.playerControllers),
      humanAliases: normalizeHumanAliases(stateOptions.humanAliases),
      deckMode: normalizeDeckMode(snapshot.deckMode),
      isMatchStarted: Boolean(snapshot.isMatchStarted),
      matchPresentationMode: MATCH_PRESENTATION_MODES.VISUAL,
      isHeadlessSimulationRunning: false,
      headlessBatchRequestedCount: HEADLESS_AI_BATCH_DEFAULT_MATCHES,
      headlessBatchCompletedCount: 0,
      headlessBatchWins: [0, 0],
      headlessBatchControllerWins: {
        [PLAYER_CONTROLLER_TYPES.AI_BASE]: 0,
        [PLAYER_CONTROLLER_TYPES.AI_SMART]: 0
      },
      headlessBatchStarterResults: createHeadlessBatchStarterResults(),
      headlessBatchSeatWins: [0, 0],
      headlessBatchMode: HEADLESS_BATCH_MODES.SIMPLE,
      headlessBatchPairCountRequested: 0,
      headlessBatchCurrentMatchNumber: 0,
      headlessBatchCurrentMatchActionCount: 0,
      headlessBatchStatus: HEADLESS_BATCH_STATUSES.IDLE,
      headlessBatchErrorMessage: null,
      headlessBatchMatchState: null,
      headlessBatchRandomFn: null,
      isHeadlessBatchInternal: false,
      suppressValidationAlerts: false,
      isAiVsAiPaused: false,
      isAiTurnInProgress: false,
      aiStepText: null,
      isLibraryOpen: snapshot.isLibraryOpen,
      isRulesOpen: snapshot.isRulesOpen,
      isLogOpen: snapshot.isLogOpen,
      isHistoryOpen: Boolean(stateOptions.isHistoryOpen),
      historyViewMode: stateOptions.historyViewMode === HISTORY_VIEW_MODES.REMOTE
        ? HISTORY_VIEW_MODES.REMOTE
        : HISTORY_VIEW_MODES.LOCAL,
      selectedAttackerId: snapshot.selectedAttackerId,
      selectedEffectCard: cloneData(snapshot.selectedEffectCard),
      selectedLogEntryId: null,
      selectedHistoryMatchId: stateOptions.selectedHistoryMatchId ?? null,
      selectedHistoryLogEntryId: stateOptions.selectedHistoryLogEntryId ?? null,
      remoteMatchHistory: (stateOptions.remoteMatchHistory || []).map((record) => cloneSavedMatchRecord(record)),
      selectedRemoteHistoryMatchId: stateOptions.selectedRemoteHistoryMatchId ?? null,
      remoteMatchHistoryStatus: stateOptions.remoteMatchHistoryStatus || REMOTE_MATCH_HISTORY_LOAD_STATUSES.IDLE,
      remoteMatchHistoryError: stateOptions.remoteMatchHistoryError || null,
      remoteHistorySyncFeedback: stateOptions.remoteHistorySyncFeedback || null,
      remoteHistorySyncFeedbackStatus: stateOptions.remoteHistorySyncFeedbackStatus || null,
      isWinnerModalOpen: Boolean(snapshot.winnerPlayerId),
      winner: null,
      turnNumber: snapshot.turnNumber,
      nextDefenseOrder: Number.isInteger(snapshot.nextDefenseOrder) ? snapshot.nextDefenseOrder : 1,
      currentMatchId: stateOptions.currentMatchId ?? null,
      historySourceRecordId: stateOptions.historySourceRecordId ?? null,
      hasDivergedFromHistorySource: Boolean(stateOptions.hasDivergedFromHistorySource),
      hasCurrentMatchBeenSavedToHistory: Boolean(stateOptions.hasCurrentMatchBeenSavedToHistory),
      matchHistory: (stateOptions.matchHistory || []).map((record) => cloneSavedMatchRecord(record)),
      log: cloneLogEntries(logEntries),
      nextLogNumber: logEntries.length + 1,
      logValidationStatus: LOG_VALIDATION_STATUS.IDLE,
      validatedEntryCount: 0,
      logValidationIssues: [],
      selectedValidationIssueIndex: null,
      logValidationCopyFeedback: null,
      logValidationCopyFeedbackStatus: null,
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

  function createValidationIssue(entry, code, message, details = null) {
    return {
      entryId: entry?.id ?? null,
      numero: entry?.numero ?? null,
      code,
      message,
      details: details == null ? null : cloneData(details)
    };
  }

  function createValidationEntrySummary(entry) {
    if (!entry) {
      return null;
    }

    return {
      id: entry.id,
      numero: entry.numero,
      texto: entry.texto,
      eventKind: entry.event?.kind ?? null
    };
  }

  function createValidationExportEntry(entry) {
    if (!entry) {
      return null;
    }

    return {
      id: entry.id,
      numero: entry.numero,
      texto: entry.texto,
      event: cloneData(entry.event)
    };
  }

  function createStateLikeSummary(stateLike) {
    if (!stateLike) {
      return null;
    }

    return {
      currentPlayerIndex: stateLike.currentPlayerIndex,
      turnNumber: stateLike.turnNumber,
      winnerPlayerId: stateLike.winner?.id ?? stateLike.winnerPlayerId ?? null,
      selectedAttackerId: stateLike.selectedAttackerId ?? null,
      selectedEffectCardInstanceId: stateLike.selectedEffectCard?.instanceId ?? null,
      players: (stateLike.players || []).map((player) => ({
        id: player.id,
        nome: player.nome,
        vida: player.vida,
        manaAtual: player.manaAtual,
        manaMax: player.manaMax,
        handCount: player.hand?.length || 0,
        board: (player.board || []).map((card) => ({
          instanceId: card.instanceId,
          vida: card.vida,
          isDefending: Boolean(card.isDefending),
          defendingTargetType: card.defendingTargetType ?? null,
          defendingTargetPlayerIndex: card.defendingTargetPlayerIndex ?? null,
          defendingTargetInstanceId: card.defendingTargetInstanceId ?? null
        })),
        supportZone: (player.supportZone || []).map((card) => card.instanceId)
      }))
    };
  }

  function getSelectedValidationIssueIndex(state) {
    if (!state || !Array.isArray(state.logValidationIssues) || !state.logValidationIssues.length) {
      return null;
    }

    if (
      Number.isInteger(state.selectedValidationIssueIndex)
      && state.selectedValidationIssueIndex >= 0
      && state.selectedValidationIssueIndex < state.logValidationIssues.length
    ) {
      return state.selectedValidationIssueIndex;
    }

    return state.logValidationStatus === LOG_VALIDATION_STATUS.INVALID ? 0 : null;
  }

  function getSelectedValidationIssue(state) {
    const issueIndex = getSelectedValidationIssueIndex(state);
    return issueIndex == null ? null : state.logValidationIssues[issueIndex] || null;
  }

  function canCopyFocusedLogValidationIssue(state) {
    return Boolean(
      state
      && state.logValidationStatus === LOG_VALIDATION_STATUS.INVALID
      && getSelectedValidationIssue(state)
    );
  }

  function selectLogValidationIssue(state, issueIndex) {
    if (!state || !Array.isArray(state.logValidationIssues)) {
      return null;
    }

    if (!Number.isInteger(issueIndex) || issueIndex < 0 || issueIndex >= state.logValidationIssues.length) {
      state.selectedValidationIssueIndex = null;
      return null;
    }

    const issue = state.logValidationIssues[issueIndex];
    state.selectedValidationIssueIndex = issueIndex;
    if (issue?.entryId != null) {
      state.selectedLogEntryId = issue.entryId;
    }
    return issue;
  }

  function buildLogValidationExportPayload(state) {
    const issueIndex = getSelectedValidationIssueIndex(state);
    const issue = getSelectedValidationIssue(state);

    if (!issue || issueIndex == null) {
      return null;
    }

    const focusedEntryIndex = issue.entryId == null
      ? -1
      : state.log.findIndex((entry) => entry.id === issue.entryId);
    const focusedEntry = focusedEntryIndex === -1 ? null : state.log[focusedEntryIndex];
    const previousEntry = focusedEntryIndex > 0 ? state.log[focusedEntryIndex - 1] : null;
    const nextEntry = focusedEntryIndex >= 0 && focusedEntryIndex < state.log.length - 1
      ? state.log[focusedEntryIndex + 1]
      : null;

    return {
      validationSummary: {
        status: state.logValidationStatus,
        validatedEntryCount: state.validatedEntryCount,
        issueCount: state.logValidationIssues.length,
        focusedIssueIndex: issueIndex
      },
      focusedIssue: cloneData(issue),
      focusedEntry: createValidationExportEntry(focusedEntry),
      previousEntry: createValidationExportEntry(previousEntry),
      nextEntry: createValidationExportEntry(nextEntry),
      focusedSnapshot: focusedEntry?.snapshot ? cloneData(focusedEntry.snapshot) : null
    };
  }

  function copyTextToClipboard(text, options = {}) {
    const clipboard = options.navigator?.clipboard
      || (typeof navigator !== "undefined" ? navigator.clipboard : null);

    if (clipboard && typeof clipboard.writeText === "function") {
      const writeResult = clipboard.writeText(text);
      if (writeResult && typeof writeResult.then === "function") {
        return writeResult.then(() => true).catch(() => false);
      }
      return writeResult === false ? false : true;
    }

    const doc = options.document || (typeof document !== "undefined" ? document : null);
    if (!doc || typeof doc.createElement !== "function" || !doc.body || typeof doc.execCommand !== "function") {
      return false;
    }

    const textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    doc.body.appendChild(textarea);
    if (typeof textarea.select === "function") {
      textarea.select();
    }

    let copied = false;
    try {
      copied = Boolean(doc.execCommand("copy"));
    } finally {
      doc.body.removeChild(textarea);
    }

    return copied;
  }

  function copyFocusedLogValidationIssue(state, options = {}) {
    const payload = buildLogValidationExportPayload(state);

    if (!payload) {
      state.logValidationCopyFeedback = "Nao ha nenhum erro detalhado selecionado para copiar.";
      state.logValidationCopyFeedbackStatus = "error";
      return false;
    }

    const serializedPayload = JSON.stringify(payload, null, 2);
    const finishCopy = (copied) => {
      state.logValidationCopyFeedback = copied
        ? "Erro detalhado copiado em JSON."
        : "Nao foi possivel copiar o erro detalhado.";
      state.logValidationCopyFeedbackStatus = copied ? "success" : "error";
      return copied;
    };

    const copyResult = copyTextToClipboard(serializedPayload, options);
    if (copyResult && typeof copyResult.then === "function") {
      return copyResult
        .then((copied) => finishCopy(Boolean(copied)))
        .catch(() => finishCopy(false));
    }

    return finishCopy(Boolean(copyResult));
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
    if (!snapshot) {
      return "null";
    }

    const normalizedSnapshot = cloneData(snapshot);
    delete normalizedSnapshot.isLibraryOpen;
    delete normalizedSnapshot.isRulesOpen;
    delete normalizedSnapshot.isLogOpen;
    return JSON.stringify(normalizedSnapshot);
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

    if (!Number.isInteger(snapshot.nextDefenseOrder) || snapshot.nextDefenseOrder < 1) {
      issues.push(createValidationIssue(entry, "invalid-defense-order-sequence", "O snapshot possui nextDefenseOrder invalido."));
    }

    snapshot.players.forEach((player, playerIndex) => {
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

        if (!unit.isDefending) {
          return;
        }

        if (!unit.podeAgir) {
          issues.push(createValidationIssue(entry, "invalid-defense-state", `${unit.nome} esta defendendo sem poder agir.`));
        }

        if (!Number.isInteger(unit.defenseOrder) || unit.defenseOrder < 1 || unit.defenseOrder >= snapshot.nextDefenseOrder) {
          issues.push(createValidationIssue(entry, "invalid-defense-order", `${unit.nome} possui defenseOrder invalido.`));
        }

        if (unit.defendingTargetPlayerIndex !== playerIndex) {
          issues.push(createValidationIssue(entry, "invalid-defense-owner", `${unit.nome} aponta para um alvo de defesa fora do proprio lado.`));
          return;
        }

        if (unit.defendingTargetType === "player") {
          return;
        }

        if (unit.defendingTargetType !== "unit") {
          issues.push(createValidationIssue(entry, "invalid-defense-target-type", `${unit.nome} possui um tipo de alvo de defesa invalido.`));
          return;
        }

        const targetUnit = player.board.find((candidate) => candidate.instanceId === unit.defendingTargetInstanceId);
        if (!targetUnit || targetUnit.instanceId === unit.instanceId || targetUnit.isDefending) {
          issues.push(createValidationIssue(entry, "invalid-defense-target", `${unit.nome} protege uma unidade invalida no snapshot.`));
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

    function applyLoggedWinner() {
      if (!event.winnerPlayerId) {
        return { ok: true };
      }

      const winnerIndex = getPlayerIndexById(state, event.winnerPlayerId);
      if (winnerIndex === -1) {
        return { ok: false, code: "invalid-victory-player", message: "O evento referencia um vencedor inexistente." };
      }

      state.winner = state.players[winnerIndex];
      state.isWinnerModalOpen = true;
      return { ok: true };
    }

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

        player.board.push(createBoardUnit(card));
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
        state.selectedAttackerId = null;

        if (opponent.vida <= 0 && !event.winnerPlayerId) {
          return { ok: false, code: "missing-effect-victory", message: "O dano direto foi letal, mas o evento nao registrou o vencedor." };
        }

        return applyLoggedWinner();
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
          cleanupInvalidDefenseAssignments(state);
        } else if (target.vida <= 0) {
          return { ok: false, code: "effect-unit-defeat-mismatch", message: "O replay derrotou a unidade, mas o evento nao marcou derrota." };
        }

        moveCardToDiscardForOwner(state, card, event.playerIndex);
        state.selectedEffectCard = null;
        state.selectedAttackerId = null;
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
        state.selectedAttackerId = null;
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
        state.selectedAttackerId = null;
        return { ok: true };
      }

      case LOG_EVENT_TYPES.ATTACK_PLAYER: {
        if (!player || !opponent || state.currentPlayerIndex !== event.playerIndex) {
          return { ok: false, code: "invalid-attack-player", message: "O replay nao encontrou o ataque ao jogador correto." };
        }

        if (isCombatTargetProtected(state, "player", event.targetPlayerIndex)) {
          return { ok: false, code: "protected-player-target", message: "O replay encontrou um ataque contra um jogador protegido." };
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

        if (opponent.vida <= 0 && !event.winnerPlayerId) {
          return { ok: false, code: "missing-attack-victory", message: "O ataque foi letal, mas o evento nao registrou o vencedor." };
        }

        return applyLoggedWinner();
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

        if (isCombatTargetProtected(state, "unit", event.targetPlayerIndex, event.targetInstanceId)) {
          return { ok: false, code: "protected-unit-target", message: "O replay encontrou um ataque contra uma unidade protegida." };
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
          cleanupInvalidDefenseAssignments(state);
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
        if (!unit || !canUnitProtectTarget(state, event.playerIndex, unit, event.targetType, event.targetPlayerIndex, event.targetInstanceId || null)) {
          return { ok: false, code: "invalid-enter-defense-state", message: "A unidade nao pode entrar em defesa no replay." };
        }

        state.selectedAttackerId = null;
        unit.isDefending = true;
        unit.defendingTargetType = event.targetType;
        unit.defendingTargetPlayerIndex = event.targetPlayerIndex;
        unit.defendingTargetInstanceId = event.targetType === "unit" ? event.targetInstanceId : null;
        unit.defenseOrder = state.nextDefenseOrder;
        state.nextDefenseOrder += 1;
        if (!event.reassigned) {
          unit.jaAtacouNoTurno = true;
        }
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

        clearDefenseState(unit);
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

      case LOG_EVENT_TYPES.VICTORY:
        return applyLoggedWinner();

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
      validatedEntryCount = 1;

      for (let entryIndex = 1; entryIndex < logEntries.length; entryIndex += 1) {
        const entry = logEntries[entryIndex];
        const previousEntry = logEntries[entryIndex - 1] || null;
        if (!entry?.snapshot || !entry?.event || !previousEntry?.snapshot) {
          continue;
        }

        let workingState = createReplayStateFromSnapshot(previousEntry.snapshot);
        let matched = false;
        let lastIssue = null;
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
          const replayBeforeEvent = createStateLikeSummary(attemptState);
          const applyResult = applyLoggedEvent(attemptState, entry.event);

          if (!applyResult.ok) {
            lastIssue = createValidationIssue(entry, applyResult.code, applyResult.message, {
              eventKind: entry.event.kind,
              entryId: entry.id,
              numero: entry.numero,
              replayCurrentPlayerIndex: replayBeforeEvent?.currentPlayerIndex ?? null,
              eventPlayerIndex: Number.isInteger(entry.event.playerIndex) ? entry.event.playerIndex : null,
              silentTransitionsTried: silentTransitions,
              lastApplyError: {
                code: applyResult.code,
                message: applyResult.message
              },
              previousEntry: createValidationEntrySummary(previousEntry),
              event: cloneData(entry.event),
              replayStateSummary: replayBeforeEvent
            });
            continue;
          }

          const rebuiltSnapshot = createStateSnapshot(attemptState);
          const rebuiltSignature = getSnapshotSignature(rebuiltSnapshot);
          const expectedSignature = getSnapshotSignature(entry.snapshot);

          if (rebuiltSignature === expectedSignature) {
            validatedEntryCount = entryIndex + 1;
            matched = true;
            break;
          }

          lastIssue = createValidationIssue(
            entry,
            "snapshot-mismatch",
            "O evento foi reaplicado, mas o snapshot reconstruido nao bate com o snapshot salvo.",
            {
              eventKind: entry.event.kind,
              entryId: entry.id,
              numero: entry.numero,
              replayCurrentPlayerIndex: replayBeforeEvent?.currentPlayerIndex ?? null,
              eventPlayerIndex: Number.isInteger(entry.event.playerIndex) ? entry.event.playerIndex : null,
              silentTransitionsTried: silentTransitions,
              lastApplyError: {
                code: "snapshot-mismatch",
                message: "O evento foi reaplicado, mas o snapshot reconstruido nao bate com o snapshot salvo."
              },
              previousEntry: createValidationEntrySummary(previousEntry),
              event: cloneData(entry.event),
              replayStateSummary: replayBeforeEvent,
              reconstructedSnapshotSummary: createStateLikeSummary(rebuiltSnapshot),
              expectedSnapshotSummary: createStateLikeSummary(entry.snapshot),
              reconstructedSnapshotSignature: rebuiltSignature,
              expectedSnapshotSignature: expectedSignature
            }
          );
        }

        if (!matched) {
          issues.push(
            lastIssue
            || createValidationIssue(
              entry,
              "replay-failed",
              "Nao foi possivel reproduzir esta linha do log a partir do snapshot anterior."
            )
          );
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
    return restoreStateFromSnapshot(keptEntries[targetIndex].snapshot, keptEntries, {
      currentMatchId: state.currentMatchId,
      historySourceRecordId: state.historySourceRecordId,
      hasDivergedFromHistorySource: state.historySourceRecordId
        ? true
        : state.hasDivergedFromHistorySource,
      hasCurrentMatchBeenSavedToHistory: state.hasCurrentMatchBeenSavedToHistory,
      humanAliases: state.humanAliases,
      matchHistory: state.matchHistory,
      remoteMatchHistory: state.remoteMatchHistory,
      selectedRemoteHistoryMatchId: state.selectedRemoteHistoryMatchId,
      remoteMatchHistoryStatus: state.remoteMatchHistoryStatus,
      remoteMatchHistoryError: state.remoteMatchHistoryError,
      remoteHistorySyncFeedback: state.remoteHistorySyncFeedback,
      remoteHistorySyncFeedbackStatus: state.remoteHistorySyncFeedbackStatus,
      historyViewMode: state.historyViewMode,
      isHistoryOpen: state.isHistoryOpen
    });
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
      && state.playerControllers.some((controller) => isAiControllerType(controller))
    );
  }

  function getAiControllerForPlayer(state, playerIndex) {
    if (!state || (playerIndex !== 0 && playerIndex !== 1)) {
      return PLAYER_CONTROLLER_TYPES.HUMAN;
    }

    return normalizePlayerController(normalizePlayerControllers(state?.playerControllers)[playerIndex]);
  }

  function isAiControlledPlayer(state, playerIndex) {
    if (!state || (playerIndex !== 0 && playerIndex !== 1)) {
      return false;
    }

    return isAiControllerType(getAiControllerForPlayer(state, playerIndex));
  }

  function isAiVsAiMatch(state) {
    return Boolean(
      state
      && state.isMatchStarted
      && isAiControlledPlayer(state, 0)
      && isAiControlledPlayer(state, 1)
    );
  }

  function isHeadlessAiVsAiMode(state) {
    return Boolean(
      state
      && state.matchPresentationMode === MATCH_PRESENTATION_MODES.HEADLESS_AI_VS_AI
    );
  }

  function isHeadlessAiComparisonMode(state) {
    return Boolean(state && state.headlessBatchMode === HEADLESS_BATCH_MODES.MIRRORED_COMPARE);
  }

  function getHeadlessBatchTotalMatchCount(state) {
    if (isHeadlessAiComparisonMode(state)) {
      return state.headlessBatchRequestedCount * 2;
    }

    return state?.headlessBatchRequestedCount || 0;
  }

  function getHeadlessBatchControllersForMatch(state) {
    const controllers = normalizePlayerControllers(state?.playerControllers);

    if (!isHeadlessAiComparisonMode(state)) {
      return controllers;
    }

    return state.headlessBatchCompletedCount % 2 === 0
      ? controllers
      : [controllers[1], controllers[0]];
  }

  function canAiTakeStep(state, options = {}) {
    const ignorePause = options.ignorePause === true;
    return Boolean(
      state
      && state.isMatchStarted
      && !state.winner
      && isAiControlledPlayer(state, state.currentPlayerIndex)
      && !isViewingHistory(state)
      && (ignorePause || !state.isAiVsAiPaused)
    );
  }

  function toggleAiVsAiPause(state) {
    if (!isAiVsAiMatch(state) || state.winner || isHeadlessAiVsAiMode(state)) {
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
    return canAiTakeStep(state) && !isHeadlessAiVsAiMode(state);
  }

  function shouldRunHeadlessSimulation(state) {
    return Boolean(
      isHeadlessAiVsAiMode(state)
      && state.isHeadlessSimulationRunning
      && state.headlessBatchStatus === HEADLESS_BATCH_STATUSES.RUNNING
    );
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

  function cancelHeadlessSimulation() {
    if (headlessSimulationTimerId !== null) {
      clearTimeout(headlessSimulationTimerId);
      headlessSimulationTimerId = null;
    }
  }

  function resetHeadlessBatchRuntime(state) {
    state.isHeadlessSimulationRunning = false;
    state.headlessBatchCompletedCount = 0;
    state.headlessBatchWins = [0, 0];
    state.headlessBatchControllerWins = {
      [PLAYER_CONTROLLER_TYPES.AI_BASE]: 0,
      [PLAYER_CONTROLLER_TYPES.AI_SMART]: 0
    };
    state.headlessBatchStarterResults = createHeadlessBatchStarterResults();
    state.headlessBatchSeatWins = [0, 0];
    state.headlessBatchMode = HEADLESS_BATCH_MODES.SIMPLE;
    state.headlessBatchPairCountRequested = 0;
    state.headlessBatchCurrentMatchNumber = 0;
    state.headlessBatchCurrentMatchActionCount = 0;
    state.headlessBatchStatus = HEADLESS_BATCH_STATUSES.IDLE;
    state.headlessBatchErrorMessage = null;
    state.headlessBatchMatchState = null;
    state.headlessBatchRandomFn = null;
  }

  function createHeadlessBatchMatchState(state) {
    const pregameState = createInitialState();
    pregameState.playerControllers = getHeadlessBatchControllersForMatch(state);
    pregameState.deckMode = normalizeDeckMode(state.deckMode);

    const matchState = startConfiguredMatch(pregameState, {
      rng: typeof state?.headlessBatchRandomFn === "function" ? state.headlessBatchRandomFn : Math.random
    });
    matchState.matchHistory = [];
    matchState.currentMatchId = null;
    matchState.hasCurrentMatchBeenSavedToHistory = false;
    matchState.isHeadlessBatchInternal = true;
    matchState.suppressValidationAlerts = true;
    matchState.isLibraryOpen = false;
    matchState.isRulesOpen = false;
    matchState.isLogOpen = false;
    matchState.isHistoryOpen = false;
    return matchState;
  }

  function failHeadlessAiBatch(state, message) {
    if (!isHeadlessAiVsAiMode(state)) {
      return false;
    }

    cancelHeadlessSimulation();
    state.isHeadlessSimulationRunning = false;
    state.isAiTurnInProgress = false;
    state.isAiVsAiPaused = false;
    state.headlessBatchStatus = HEADLESS_BATCH_STATUSES.FAILED;
    state.headlessBatchErrorMessage = message;
    state.headlessBatchMatchState = null;
    state.headlessBatchCurrentMatchActionCount = 0;
    state.aiStepText = "A simulacao em lote falhou.";
    return true;
  }

  function finishHeadlessAiMatch(state) {
    if (!isHeadlessAiVsAiMode(state)) {
      return false;
    }

    cancelHeadlessSimulation();
    state.isHeadlessSimulationRunning = false;
    state.isAiTurnInProgress = false;
    state.isAiVsAiPaused = false;
    state.isWinnerModalOpen = false;
    state.isLibraryOpen = false;
    state.isRulesOpen = false;
    state.isLogOpen = false;
    state.isHistoryOpen = false;
    state.selectedLogEntryId = null;
    state.headlessBatchMatchState = null;
    state.headlessBatchCurrentMatchActionCount = 0;
    if (state.headlessBatchStatus !== HEADLESS_BATCH_STATUSES.FAILED) {
      state.headlessBatchStatus = HEADLESS_BATCH_STATUSES.FINISHED;
      state.aiStepText = isHeadlessAiComparisonMode(state)
        ? "Comparacao IA x IA concluida."
        : "Bateria IA x IA concluida.";
    }
    return true;
  }

  function cancelHeadlessAiBatch(state) {
    if (!isHeadlessAiVsAiMode(state)) {
      return false;
    }

    cancelHeadlessSimulation();
    resetHeadlessBatchRuntime(state);
    state.isAiTurnInProgress = false;
    state.isAiVsAiPaused = false;
    state.aiStepText = null;
    return true;
  }

  function startHeadlessAiBatch(previousState, requestedCount = previousState?.headlessBatchRequestedCount, options = {}) {
    if (!isAiControlledPlayer(previousState, 0) || !isAiControlledPlayer(previousState, 1)) {
      return startConfiguredMatch(previousState);
    }

    const normalizedControllers = normalizePlayerControllers(previousState?.playerControllers);
    const isComparisonMode = normalizedControllers[0] !== normalizedControllers[1];
    const nextState = createInitialState();
    nextState.playerControllers = setSessionPlayerControllers(normalizedControllers);
    nextState.deckMode = setSessionDeckMode(previousState?.deckMode);
    nextState.headlessBatchRequestedCount = normalizeHeadlessBatchCount(requestedCount);
    nextState.headlessBatchPairCountRequested = isComparisonMode ? normalizeHeadlessBatchCount(requestedCount) : 0;
    nextState.matchHistory = (previousState?.matchHistory || []).map((record) => cloneSavedMatchRecord(record));
    nextState.currentMatchId = createUniqueMatchId();
    nextState.isMatchStarted = true;
    nextState.matchPresentationMode = MATCH_PRESENTATION_MODES.HEADLESS_AI_VS_AI;
    nextState.isHeadlessSimulationRunning = true;
    nextState.headlessBatchCompletedCount = 0;
    nextState.headlessBatchWins = [0, 0];
    nextState.headlessBatchCurrentMatchNumber = 0;
    nextState.headlessBatchCurrentMatchActionCount = 0;
    nextState.headlessBatchStatus = HEADLESS_BATCH_STATUSES.RUNNING;
    nextState.headlessBatchErrorMessage = null;
    nextState.headlessBatchMatchState = null;
    nextState.headlessBatchMode = isComparisonMode ? HEADLESS_BATCH_MODES.MIRRORED_COMPARE : HEADLESS_BATCH_MODES.SIMPLE;
    nextState.headlessBatchControllerWins = {
      [PLAYER_CONTROLLER_TYPES.AI_BASE]: 0,
      [PLAYER_CONTROLLER_TYPES.AI_SMART]: 0
    };
    nextState.headlessBatchStarterResults = createHeadlessBatchStarterResults();
    nextState.headlessBatchSeatWins = [0, 0];
    nextState.headlessBatchRandomFn = typeof options.rng === "function"
      ? options.rng
      : (typeof previousState?.headlessBatchRandomFn === "function" ? previousState.headlessBatchRandomFn : Math.random);
    nextState.isAiVsAiPaused = false;
    nextState.isAiTurnInProgress = true;
    nextState.aiStepText = isComparisonMode
      ? `Comparando ${getHeadlessBatchComparisonLabel(nextState)} em pares espelhados...`
      : "Simulando bateria IA x IA...";
    nextState.isLibraryOpen = false;
    nextState.isRulesOpen = false;
    nextState.isLogOpen = false;
    nextState.isHistoryOpen = false;
    nextState.selectedLogEntryId = null;
    nextState.selectedHistoryMatchId = null;
    nextState.selectedHistoryLogEntryId = null;
    nextState.isWinnerModalOpen = false;
    return nextState;
  }

  function startHeadlessAiMatch(previousState, requestedCount = previousState?.headlessBatchRequestedCount) {
    return startHeadlessAiBatch(previousState, requestedCount);
  }

  function completeHeadlessBatchMatch(state) {
    const matchState = state.headlessBatchMatchState;
    if (!matchState?.winner) {
      return failHeadlessAiBatch(
        state,
        `A partida ${state.headlessBatchCurrentMatchNumber} nao terminou com um vencedor valido.`
      );
    }

    if (matchState.logValidationStatus !== LOG_VALIDATION_STATUS.VALID) {
      return failHeadlessAiBatch(
        state,
        `A validacao do log falhou na partida ${state.headlessBatchCurrentMatchNumber}.`
      );
    }

    state.headlessBatchCompletedCount += 1;
    state.headlessBatchWins[matchState.winner.id - 1] += 1;
    state.headlessBatchSeatWins[matchState.winner.id - 1] += 1;
    const startingController = getAiControllerForPlayer(matchState, 0);
    const winningController = getAiControllerForPlayer(matchState, matchState.winner.id - 1);
    if (isAiControllerType(winningController)) {
      state.headlessBatchControllerWins[winningController] = (state.headlessBatchControllerWins[winningController] || 0) + 1;
    }
    if (isAiControllerType(startingController) && state.headlessBatchStarterResults[startingController]) {
      if (winningController === startingController) {
        state.headlessBatchStarterResults[startingController].wins += 1;
      } else {
        state.headlessBatchStarterResults[startingController].losses += 1;
      }
    }
    state.headlessBatchMatchState = null;
    state.headlessBatchCurrentMatchActionCount = 0;

    if (state.headlessBatchCompletedCount >= getHeadlessBatchTotalMatchCount(state)) {
      finishHeadlessAiMatch(state);
      return true;
    }

    state.headlessBatchCurrentMatchNumber = state.headlessBatchCompletedCount + 1;
    state.aiStepText = `Preparando a partida ${state.headlessBatchCurrentMatchNumber} de ${getHeadlessBatchTotalMatchCount(state)}.`;
    return true;
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

  function compareUnitsForAiDefense(left, right) {
    return ((right.custo || 0) - (left.custo || 0))
      || ((right.vidaBase || 0) - (left.vidaBase || 0))
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

  function createAiEvaluationState(state) {
    const previewState = createInitialState();
    previewState.deck = cloneData(state.deck);
    previewState.discardPile = cloneData(state.discardPile);
    previewState.playerDecks = cloneData(state.playerDecks || [[], []]);
    previewState.playerDiscardPiles = cloneData(state.playerDiscardPiles || [[], []]);
    previewState.currentPlayerIndex = state.currentPlayerIndex;
    previewState.playerControllers = normalizePlayerControllers(state.playerControllers);
    previewState.deckMode = normalizeDeckMode(state.deckMode);
    previewState.isMatchStarted = Boolean(state.isMatchStarted);
    previewState.selectedAttackerId = state.selectedAttackerId;
    previewState.selectedEffectCard = cloneData(state.selectedEffectCard);
    previewState.turnNumber = state.turnNumber;
    previewState.nextDefenseOrder = state.nextDefenseOrder;
    previewState.players = cloneData(state.players);
    previewState.winner = state.winner
      ? previewState.players.find((player) => player.id === state.winner.id) || null
      : null;
    previewState.isWinnerModalOpen = Boolean(previewState.winner);
    previewState.log = [];
    previewState.nextLogNumber = 1;
    previewState.matchHistory = [];
    previewState.currentMatchId = null;
    previewState.historySourceRecordId = null;
    previewState.hasDivergedFromHistorySource = false;
    previewState.hasCurrentMatchBeenSavedToHistory = true;
    previewState.isHeadlessBatchInternal = true;
    previewState.suppressValidationAlerts = true;
    return previewState;
  }

  function getAiSupportBoardValue(card) {
    if (card.efeito === "aura_ataque") {
      return 8;
    }

    if (card.efeito === "cura_fim_turno") {
      return 5;
    }

    return 2;
  }

  function getAiUnitBoardValue(state, playerIndex, unit) {
    const player = state.players[playerIndex];
    const heroProtectionBonus = doesUnitProtectTarget(unit, "player", playerIndex) ? 5 : 0;
    const allyProtectionBonus = unit.isDefending && unit.defendingTargetType === "unit" ? 3 : 0;
    const unitAttack = getUnitAttack(unit, player);
    const readyToAttack = Boolean(unit.podeAgir && !unit.jaAtacouNoTurno && !unit.isDefending);
    const attackValue = unit.isDefending
      ? unitAttack
      : unit.jaAtacouNoTurno
        ? unitAttack * 2
        : unitAttack * 4;
    const readinessBonus = readyToAttack ? unitAttack * 3 : 0;
    const healthValue = (unit.vida || 0) * 2;
    return ((unit.custo || 0) * 3)
      + attackValue
      + readinessBonus
      + healthValue
      + heroProtectionBonus
      + allyProtectionBonus;
  }

  function getAiHeroPressure(state, targetPlayerIndex) {
    const attackerPlayerIndex = (targetPlayerIndex + 1) % 2;
    const attackerPlayer = state.players[attackerPlayerIndex];
    return attackerPlayer.board
      .filter((unit) => !unit.isDefending)
      .reduce((total, unit) => total + getUnitAttack(unit, attackerPlayer), 0);
  }

  function getAiBoardValue(state, playerIndex) {
    const player = state.players[playerIndex];
    return player.board.reduce((total, unit) => total + getAiUnitBoardValue(state, playerIndex, unit), 0)
      + player.supportZone.reduce((total, support) => total + getAiSupportBoardValue(support), 0);
  }

  function evaluateAiStateScore(state, playerIndex) {
    const opponentIndex = (playerIndex + 1) % 2;
    const player = state.players[playerIndex];
    const opponent = state.players[opponentIndex];

    if (opponent.vida <= 0) {
      return 1000000;
    }

    if (player.vida <= 0) {
      return -1000000;
    }

    const playerBoardValue = getAiBoardValue(state, playerIndex);
    const opponentBoardValue = getAiBoardValue(state, opponentIndex);
    const playerHeroPressure = getAiHeroPressure(state, playerIndex);
    const opponentHeroPressure = getAiHeroPressure(state, opponentIndex);
    const playerHeroDefenders = getDefendersForTarget(state, playerIndex, "player").length;
    const opponentHeroDefenders = getDefendersForTarget(state, opponentIndex, "player").length;

    return ((player.vida - opponent.vida) * 12)
      + ((playerBoardValue - opponentBoardValue) * 3)
      + ((player.hand.length - opponent.hand.length) * 4)
      + ((opponentHeroPressure - playerHeroPressure) * 6)
      + ((playerHeroDefenders - opponentHeroDefenders) * 4)
      + (player.manaAtual - opponent.manaAtual);
  }

  function getAiActionStableKey(action) {
    return [
      action.type,
      action.cardInstanceId || "",
      action.attackerInstanceId || "",
      action.defenderInstanceId || "",
      action.targetType || "",
      action.targetPlayerIndex ?? "",
      action.targetInstanceId || ""
    ].join("|");
  }

  function getSmartAiActionBias(state, action, playerIndex) {
    const opponentIndex = (playerIndex + 1) % 2;
    const player = state.players[playerIndex];
    const opponent = state.players[opponentIndex];
    const heroPressure = getAiHeroPressure(state, playerIndex);
    const opponentHeroPressure = getAiHeroPressure(state, opponentIndex);

    if (action.type === "draw-card") {
      return -8;
    }

    if (action.type === "end-turn") {
      return -12;
    }

    if (action.type === "defend-target") {
      if (action.targetType === "player") {
        return heroPressure >= Math.max(6, player.vida - 6) ? 12 : -6;
      }

      return heroPressure >= Math.max(6, player.vida - 6) ? 3 : -8;
    }

    if (action.type === "attack-player") {
      return opponentHeroPressure > heroPressure ? 10 : 4;
    }

    if (action.type === "effect-player") {
      const effectCard = findCardByInstanceId(player.hand, action.cardInstanceId);
      if (effectCard?.efeito === "dano_direto") {
        return 8;
      }

      if (effectCard?.efeito === "cura_direta") {
        return heroPressure >= Math.max(6, player.vida - 6) ? 10 : 2;
      }
    }

    if (action.type === "effect-unit" || action.type === "attack-unit") {
      const targetUnit = findCardByInstanceId(opponent.board, action.targetInstanceId);
      return targetUnit ? (targetUnit.ataque * 5) + ((targetUnit.custo || 0) * 2) : 0;
    }

    if (action.type === "effect-ally-unit") {
      const targetUnit = findCardByInstanceId(player.board, action.targetInstanceId);
      return targetUnit ? ((targetUnit.custo || 0) * 2) + (targetUnit.ataque * 3) : 0;
    }

    if (action.type === "play-card") {
      const card = findCardByInstanceId(player.hand, action.cardInstanceId);
      if (!card) {
        return 0;
      }

      if (card.categoria === "suporte" && card.efeito === "aura_ataque" && player.board.length > 0) {
        return 12;
      }

      if (card.categoria === "suporte" && card.efeito === "cura_fim_turno" && player.vida < MAX_HEALTH) {
        return 8;
      }

      if (card.categoria === "unidade") {
        return (card.ataque * 3) + (card.vidaBase * 2) + (card.custo || 0);
      }
    }

    return 0;
  }

  function enumerateSmartAiActions(state) {
    if (!canAiTakeStep(state)) {
      return [];
    }

    const player = getCurrentPlayer(state);
    const opponent = getOpponentPlayer(state);
    const playerIndex = state.currentPlayerIndex;
    const opponentIndex = (playerIndex + 1) % 2;
    const actions = [];
    const playableCards = getAiPlayableCards(state);
    const damageCards = playableCards.filter((card) => card.efeito === "dano_direto").sort(compareCardsByCostAsc);
    const healingCards = playableCards.filter((card) => card.efeito === "cura_direta").sort(compareCardsByCostAsc);
    const supportCards = playableCards.filter((card) => card.categoria === "suporte").sort(compareCardsByCostAsc);
    const unitCards = playableCards.filter((card) => card.categoria === "unidade").sort(compareUnitsForAiPlay);
    const readyAttackers = getAiReadyAttackers(state);
    const attackableOpponentUnits = opponent.board.filter((unit) => !isCombatTargetProtected(state, "unit", opponentIndex, unit.instanceId));
    const attackableSupports = opponent.board.length === 0
      ? [...opponent.supportZone].sort(compareSupportsForAiTarget)
      : [];
    const opponentHeroProtected = isCombatTargetProtected(state, "player", opponentIndex);
    const defendableUnits = player.board
      .filter((unit) => canUnitEnterDefense(state, playerIndex, unit))
      .sort(compareUnitsForAiDefense);
    const defenseTargets = player.board
      .filter((unit) => !unit.isDefending)
      .sort(compareUnitsByThreatDesc);
    const shouldConsiderDefense = getAiHeroPressure(state, playerIndex) >= Math.max(6, player.vida - 4)
      || player.vida <= 12;

    unitCards.forEach((card) => {
      actions.push({
        type: "play-card",
        cardInstanceId: card.instanceId,
        text: `IA baixou ${card.nome}.`
      });
    });

    supportCards.forEach((card) => {
      actions.push({
        type: "play-card",
        cardInstanceId: card.instanceId,
        text: `IA ativou ${card.nome}.`
      });
    });

    damageCards.forEach((card) => {
      actions.push({
        type: "effect-player",
        cardInstanceId: card.instanceId,
        text: `IA usou ${card.nome} em ${opponent.nome}.`
      });

      attackableOpponentUnits.forEach((unit) => {
        actions.push({
          type: "effect-unit",
          cardInstanceId: card.instanceId,
          targetInstanceId: unit.instanceId,
          text: `IA usou ${card.nome} em ${unit.nome}.`
        });
      });
    });

    healingCards.forEach((card) => {
      if (canPlayerReceiveHealing(player)) {
        actions.push({
          type: "effect-player",
          cardInstanceId: card.instanceId,
          text: `IA usou ${card.nome} em si mesma.`
        });
      }

      getHealableUnits(player).sort(compareHealableUnits).forEach((unit) => {
        actions.push({
          type: "effect-ally-unit",
          cardInstanceId: card.instanceId,
          targetInstanceId: unit.instanceId,
          text: `IA usou ${card.nome} em ${unit.nome}.`
        });
      });
    });

    readyAttackers.forEach((attacker) => {
      if (!opponentHeroProtected) {
        actions.push({
          type: "attack-player",
          attackerInstanceId: attacker.instanceId,
          text: `IA atacou ${opponent.nome} com ${attacker.nome}.`
        });
      }

      attackableOpponentUnits.forEach((unit) => {
        actions.push({
          type: "attack-unit",
          attackerInstanceId: attacker.instanceId,
          targetInstanceId: unit.instanceId,
          text: `IA atacou ${unit.nome} com ${attacker.nome}.`
        });
      });

      attackableSupports.forEach((support) => {
        actions.push({
          type: "attack-support",
          attackerInstanceId: attacker.instanceId,
          targetInstanceId: support.instanceId,
          text: `IA destruiu ${support.nome} com ${attacker.nome}.`
        });
      });
    });

    if (shouldConsiderDefense) {
      defendableUnits.forEach((unit) => {
        actions.push({
          type: "defend-target",
          defenderInstanceId: unit.instanceId,
          targetType: "player",
          targetPlayerIndex: playerIndex,
          targetInstanceId: null,
          text: `IA colocou ${unit.nome} para defender ${player.nome}.`
        });

        defenseTargets.forEach((target) => {
          if (target.instanceId === unit.instanceId) {
            return;
          }

          actions.push({
            type: "defend-target",
            defenderInstanceId: unit.instanceId,
            targetType: "unit",
            targetPlayerIndex: playerIndex,
            targetInstanceId: target.instanceId,
            text: `IA colocou ${unit.nome} para defender ${target.nome}.`
          });
        });
      });
    }

    if (getDrawPile(state, playerIndex).length > 0 && canAfford(player, DRAW_COST)) {
      actions.push({
        type: "draw-card",
        text: "IA comprou uma carta."
      });
    }

    actions.push({
      type: "end-turn",
      text: "IA encerrou o turno."
    });

    return actions;
  }

  function getSmartImmediateLethalAction(state) {
    const playerIndex = state.currentPlayerIndex;
    const player = getCurrentPlayer(state);
    const opponent = getOpponentPlayer(state);
    const opponentIndex = (playerIndex + 1) % 2;
    const playableCards = getAiPlayableCards(state);
    const damageCards = playableCards
      .filter((card) => card.efeito === "dano_direto")
      .sort((left, right) => (right.valor - left.valor) || compareCardsByCostAsc(left, right));
    const readyAttackers = getAiReadyAttackers(state).sort(compareAttackersByPowerDesc(player));
    const opponentHeroProtected = isCombatTargetProtected(state, "player", opponentIndex);
    const totalDamageFromCards = damageCards.reduce((total, card) => total + (card.valor || 0), 0);
    const totalDamageFromAttackers = opponentHeroProtected
      ? 0
      : readyAttackers.reduce((total, attacker) => total + getUnitAttack(attacker, player), 0);

    if ((totalDamageFromCards + totalDamageFromAttackers) < opponent.vida) {
      return null;
    }

    const directLethalCard = damageCards.find((card) => (card.valor || 0) >= opponent.vida);
    if (directLethalCard) {
      return {
        type: "effect-player",
        cardInstanceId: directLethalCard.instanceId,
        text: `IA usou ${directLethalCard.nome} em ${opponent.nome}.`
      };
    }

    if (!opponentHeroProtected) {
      const directLethalAttacker = readyAttackers.find((attacker) => getUnitAttack(attacker, player) >= opponent.vida);
      if (directLethalAttacker) {
        return {
          type: "attack-player",
          attackerInstanceId: directLethalAttacker.instanceId,
          text: `IA atacou ${opponent.nome} com ${directLethalAttacker.nome}.`
        };
      }

      if (readyAttackers[0]) {
        return {
          type: "attack-player",
          attackerInstanceId: readyAttackers[0].instanceId,
          text: `IA atacou ${opponent.nome} com ${readyAttackers[0].nome}.`
        };
      }
    }

    if (damageCards[0]) {
      return {
        type: "effect-player",
        cardInstanceId: damageCards[0].instanceId,
        text: `IA usou ${damageCards[0].nome} em ${opponent.nome}.`
      };
    }

    return null;
  }

  function getSmartHeroStabilizationAction(state) {
    const playerIndex = state.currentPlayerIndex;
    const player = getCurrentPlayer(state);
    const opponent = getOpponentPlayer(state);
    const incomingThreat = opponent.board
      .filter((unit) => !unit.isDefending)
      .reduce((total, unit) => total + getUnitAttack(unit, opponent), 0);

    if (incomingThreat < (player.vida - 2)) {
      return null;
    }

    const playableCards = getAiPlayableCards(state);
    const healingCards = playableCards
      .filter((card) => card.efeito === "cura_direta")
      .sort((left, right) => (right.valor - left.valor) || compareCardsByCostAsc(left, right));
    const safeHealingCard = healingCards.find((card) => canPlayerReceiveHealing(player) && Math.min(MAX_HEALTH, player.vida + (card.valor || 0)) > incomingThreat);
    if (safeHealingCard) {
      return {
        type: "effect-player",
        cardInstanceId: safeHealingCard.instanceId,
        text: `IA usou ${safeHealingCard.nome} em si mesma.`
      };
    }

    return null;
  }

  function getNextSmartAiAction(state, options = {}) {
    if (!canAiTakeStep(state, { ignorePause: options.ignorePause === true })) {
      return null;
    }

    const baseAction = getNextBaseAiAction(state, options);
    const immediateLethalAction = getSmartImmediateLethalAction(state);
    if (immediateLethalAction) {
      return immediateLethalAction;
    }

    const stabilizationAction = getSmartHeroStabilizationAction(state);
    if (stabilizationAction) {
      return stabilizationAction;
    }

    const playerIndex = state.currentPlayerIndex;
    const player = getCurrentPlayer(state);
    const opponent = getOpponentPlayer(state);
    const opponentIndex = (playerIndex + 1) % 2;
    const incomingThreat = opponent.board
      .filter((unit) => !unit.isDefending)
      .reduce((total, unit) => total + getUnitAttack(unit, opponent), 0);
    const defendableUnits = player.board
      .filter((unit) => canUnitEnterDefense(state, playerIndex, unit))
      .sort(compareUnitsForAiDefense);
    const readyAttackers = getAiReadyAttackers(state).sort(compareAttackersByPowerDesc(player));
    const totalReadyDamage = readyAttackers.reduce((total, attacker) => total + getUnitAttack(attacker, player), 0);
    const totalDirectDamage = getAiPlayableCards(state)
      .filter((card) => card.efeito === "dano_direto")
      .reduce((total, card) => total + (card.valor || 0), 0);
    const opponentHeroProtected = isCombatTargetProtected(state, "player", opponentIndex);

    if (
      baseAction
      && incomingThreat >= (player.vida - 1)
      && defendableUnits[0]
      && ["draw-card", "end-turn", "play-card", "effect-ally-unit"].includes(baseAction.type)
    ) {
      return {
        type: "defend-target",
        defenderInstanceId: defendableUnits[0].instanceId,
        targetType: "player",
        targetPlayerIndex: playerIndex,
        targetInstanceId: null,
        text: `IA colocou ${defendableUnits[0].nome} para defender ${player.nome}.`
      };
    }

    if (
      baseAction
      && !opponentHeroProtected
      && readyAttackers[0]
      && (incomingThreat + 4) < player.vida
      && (totalReadyDamage + totalDirectDamage) >= Math.max(8, opponent.vida - 2)
      && ["play-card", "draw-card", "end-turn"].includes(baseAction.type)
    ) {
      return {
        type: "attack-player",
        attackerInstanceId: readyAttackers[0].instanceId,
        text: `IA atacou ${opponent.nome} com ${readyAttackers[0].nome}.`
      };
    }

    if (baseAction?.type === "attack-unit" && !opponentHeroProtected) {
      const attacker = findCardByInstanceId(player.board, baseAction.attackerInstanceId);
      const target = findCardByInstanceId(opponent.board, baseAction.targetInstanceId);
      const attackDamage = attacker ? getUnitAttack(attacker, player) : 0;
      const wouldKillTarget = target ? getMitigatedDamage(target, attackDamage) >= target.vida : false;
      const nearLethalRace = totalReadyDamage >= Math.max(8, opponent.vida - 4);

      if (!wouldKillTarget && nearLethalRace && attacker) {
        return {
          type: "attack-player",
          attackerInstanceId: attacker.instanceId,
          text: `IA atacou ${opponent.nome} com ${attacker.nome}.`
        };
      }
    }

    return baseAction || {
      type: "end-turn",
      text: "IA encerrou o turno."
    };
  }

  function getNextBaseAiAction(state, options = {}) {
    if (!canAiTakeStep(state, { ignorePause: options.ignorePause === true })) {
      return null;
    }

    const player = getCurrentPlayer(state);
    const opponent = getOpponentPlayer(state);
    const playerIndex = state.currentPlayerIndex;
    const opponentIndex = (playerIndex + 1) % 2;
    const playableCards = getAiPlayableCards(state);
    const readyAttackers = getAiReadyAttackers(state);
    const attackableOpponentUnits = opponent.board.filter((unit) => !isCombatTargetProtected(state, "unit", opponentIndex, unit.instanceId));
    const opponentHeroProtected = isCombatTargetProtected(state, "player", opponentIndex);
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
      .filter((unit) => canUnitEnterDefense(state, playerIndex, unit))
      .sort(compareUnitsForAiDefense);

    const lethalAttacker = opponentHeroProtected
      ? null
      : [...readyAttackers]
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
      const killTargets = attackableOpponentUnits
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

    const killableTargets = attackableOpponentUnits
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

    if (attackableOpponentUnits.length > 0 && readyAttackers[0]) {
      const chosenTarget = [...attackableOpponentUnits].sort(compareUnitsByThreatDesc)[0];
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

    if (readyAttackers[0] && !opponentHeroProtected) {
      const attacker = [...readyAttackers].sort(compareAttackersByPowerDesc(player))[0];
      return {
        type: "attack-player",
        attackerInstanceId: attacker.instanceId,
        text: `IA atacou ${opponent.nome} com ${attacker.nome}.`
      };
    }

    if (opponent.board.length > 0 && defendableUnits[0]) {
      const totalEnemyThreat = opponent.board.reduce((total, unit) => total + getUnitAttack(unit, opponent), 0);
      const heroUnderPressure = player.vida <= 12 || totalEnemyThreat >= Math.max(6, player.vida - 6);
      const defenseTargetUnit = [...player.board]
        .filter((unit) => !unit.isDefending)
        .sort((left, right) => {
          const leftDefenders = getDefendersForTarget(state, playerIndex, "unit", left.instanceId).length;
          const rightDefenders = getDefendersForTarget(state, playerIndex, "unit", right.instanceId).length;
          return (leftDefenders - rightDefenders)
            || compareUnitsByThreatDesc(left, right);
        })[0] || null;
      const chosenTarget = heroUnderPressure
        ? {
          type: "player",
          targetPlayerIndex: playerIndex,
          targetInstanceId: null,
          label: player.nome
        }
        : defenseTargetUnit
          ? {
            type: "unit",
            targetPlayerIndex: playerIndex,
            targetInstanceId: defenseTargetUnit.instanceId,
            label: defenseTargetUnit.nome
          }
          : {
            type: "player",
            targetPlayerIndex: playerIndex,
            targetInstanceId: null,
            label: player.nome
          };

      return {
        type: "defend-target",
        defenderInstanceId: defendableUnits[0].instanceId,
        targetType: chosenTarget.type,
        targetPlayerIndex: chosenTarget.targetPlayerIndex,
        targetInstanceId: chosenTarget.targetInstanceId,
        text: `IA colocou ${defendableUnits[0].nome} para defender ${chosenTarget.label}.`
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

  function getNextAiActionForController(state, controllerType, options = {}) {
    const normalizedController = normalizePlayerController(controllerType);

    if (!isAiControllerType(normalizedController)) {
      return null;
    }

    if (normalizedController === PLAYER_CONTROLLER_TYPES.AI_SMART) {
      return getNextSmartAiAction(state, options);
    }

    return getNextBaseAiAction(state, options);
  }

  function getNextAiAction(state, options = {}) {
    if (!canAiTakeStep(state, { ignorePause: options.ignorePause === true })) {
      return null;
    }

    return getNextAiActionForController(state, getAiControllerForPlayer(state, state.currentPlayerIndex), options);
  }

  function executeAiAction(state, action) {
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

    if (action.type === "defend-target") {
      didAct = enterDefenseMode(
        state,
        playerIndex,
        action.defenderInstanceId,
        action.targetType,
        action.targetPlayerIndex,
        action.targetInstanceId
      );
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

  function performAiStep(state, options = {}) {
    const action = getNextAiAction(state, options);
    return executeAiAction(state, action);
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

  function performHeadlessSimulationBatch(state, batchSize = HEADLESS_AI_BATCH_SIZE) {
    if (!shouldRunHeadlessSimulation(state)) {
      return 0;
    }

    let actionsPerformed = 0;

    while (actionsPerformed < batchSize && shouldRunHeadlessSimulation(state)) {
      if (!state.headlessBatchMatchState) {
        state.headlessBatchCurrentMatchNumber = state.headlessBatchCompletedCount + 1;
        state.headlessBatchMatchState = createHeadlessBatchMatchState(state);
        state.headlessBatchCurrentMatchActionCount = 0;
        state.aiStepText = `Simulando partida ${state.headlessBatchCurrentMatchNumber} de ${getHeadlessBatchTotalMatchCount(state)}.`;
      }

      const matchState = state.headlessBatchMatchState;
      if (matchState.winner) {
        completeHeadlessBatchMatch(state);
        continue;
      }

      const action = performAiStep(matchState, { ignorePause: true });

      if (!action) {
        failHeadlessAiBatch(
          state,
          `A simulacao travou na partida ${state.headlessBatchCurrentMatchNumber} sem produzir uma nova acao.`
        );
        break;
      }

      actionsPerformed += 1;
      state.headlessBatchCurrentMatchActionCount += 1;

      if (state.headlessBatchCurrentMatchActionCount > HEADLESS_AI_MATCH_ACTION_LIMIT) {
        failHeadlessAiBatch(
          state,
          `A partida ${state.headlessBatchCurrentMatchNumber} excedeu o limite de ${HEADLESS_AI_MATCH_ACTION_LIMIT} acoes.`
        );
        break;
      }

      if (matchState.winner) {
        completeHeadlessBatchMatch(state);
      }
    }

    return actionsPerformed;
  }

  function scheduleHeadlessSimulationTick(state) {
    if (!shouldRunHeadlessSimulation(state)) {
      cancelHeadlessSimulation();
      return false;
    }

    if (headlessSimulationTimerId !== null) {
      return true;
    }

    headlessSimulationTimerId = setTimeout(() => {
      headlessSimulationTimerId = null;

      if (!shouldRunHeadlessSimulation(gameState)) {
        if (gameState.headlessBatchStatus === HEADLESS_BATCH_STATUSES.FINISHED) {
          finishHeadlessAiMatch(gameState);
        }
        render(gameState);
        return;
      }

      performHeadlessSimulationBatch(gameState);
      render(gameState);
    }, 0);

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
    overlayData.stateText = card.isDefending
      ? card.defendingTargetType === "player"
        ? "DEF HEROI"
        : "DEF ALIADO"
      : card.jaAtacouNoTurno
        ? "JA ATACOU"
        : card.podeAgir
          ? "PRONTA"
          : "EM ESPERA";
    return overlayData;
  }

  function getAvailableAttackers(player) {
    return player.board.filter((unit) => unit.podeAgir && !unit.jaAtacouNoTurno && !unit.isDefending);
  }

  function clearDefenseState(unit) {
    if (!unit) {
      return;
    }

    unit.isDefending = false;
    unit.defendingTargetType = null;
    unit.defendingTargetPlayerIndex = null;
    unit.defendingTargetInstanceId = null;
    unit.defenseOrder = null;
  }

  function doesUnitProtectTarget(unit, targetType, targetPlayerIndex, targetInstanceId = null) {
    if (!unit || !unit.isDefending) {
      return false;
    }

    if (unit.defendingTargetType !== targetType || unit.defendingTargetPlayerIndex !== targetPlayerIndex) {
      return false;
    }

    if (targetType === "player") {
      return true;
    }

    return unit.defendingTargetInstanceId === targetInstanceId;
  }

  function getDefenseTargetUnit(state, targetPlayerIndex, targetInstanceId) {
    return findCardByInstanceId(state?.players?.[targetPlayerIndex]?.board, targetInstanceId);
  }

  function getDefendersForTarget(state, targetPlayerIndex, targetType, targetInstanceId = null) {
    const player = state?.players?.[targetPlayerIndex];

    if (!player) {
      return [];
    }

    return player.board
      .filter((unit) => doesUnitProtectTarget(unit, targetType, targetPlayerIndex, targetInstanceId))
      .sort((left, right) => (left.defenseOrder || 0) - (right.defenseOrder || 0));
  }

  function isCombatTargetProtected(state, targetType, targetPlayerIndex, targetInstanceId = null) {
    return getDefendersForTarget(state, targetPlayerIndex, targetType, targetInstanceId).length > 0;
  }

  function cleanupInvalidDefenseAssignments(state) {
    if (!state?.players) {
      return;
    }

    state.players.forEach((player, playerIndex) => {
      player.board.forEach((unit) => {
        if (!unit.isDefending) {
          clearDefenseState(unit);
          return;
        }

        if (unit.defendingTargetPlayerIndex !== playerIndex) {
          clearDefenseState(unit);
          return;
        }

        if (unit.defendingTargetType === "player") {
          unit.defendingTargetInstanceId = null;
          return;
        }

        const targetUnit = getDefenseTargetUnit(state, playerIndex, unit.defendingTargetInstanceId);
        if (!targetUnit || targetUnit.instanceId === unit.instanceId || targetUnit.isDefending) {
          clearDefenseState(unit);
        }
      });
    });
  }

  function canUnitSelectForAction(state, playerIndex, unit) {
    return Boolean(
      state
      && unit
      && state.isMatchStarted
      && !state.winner
      && state.currentPlayerIndex === playerIndex
      && !state.selectedEffectCard
      && unit.estado === "campo"
      && unit.podeAgir
      && ((!unit.isDefending && !unit.jaAtacouNoTurno) || unit.isDefending)
    );
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
    );
  }

  function canUnitProtectTarget(state, playerIndex, unit, targetType, targetPlayerIndex, targetInstanceId = null) {
    if (
      !state
      || !unit
      || !state.isMatchStarted
      || state.winner
      || state.currentPlayerIndex !== playerIndex
      || state.selectedEffectCard
      || unit.estado !== "campo"
      || targetPlayerIndex !== playerIndex
    ) {
      return false;
    }

    const canManageDefense = unit.isDefending || (unit.podeAgir && !unit.jaAtacouNoTurno && !unit.isDefending);
    if (!canManageDefense) {
      return false;
    }

    if (targetType === "player") {
      return true;
    }

    if (targetType !== "unit" || !targetInstanceId) {
      return false;
    }

    const targetUnit = getDefenseTargetUnit(state, playerIndex, targetInstanceId);
    return Boolean(targetUnit && targetUnit.instanceId !== unit.instanceId && !targetUnit.isDefending);
  }

  function getSelectedUnit(state, playerIndex = state?.currentPlayerIndex) {
    if (!state || !state.selectedAttackerId || (playerIndex !== 0 && playerIndex !== 1)) {
      return null;
    }

    return findCardByInstanceId(state.players[playerIndex]?.board, state.selectedAttackerId);
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
    return {
      message: `${player.nome} usou ${card.nome} e causou ${card.valor} de dano em ${opponent.nome}.`,
      event: {
        kind: LOG_EVENT_TYPES.EFFECT_DAMAGE_PLAYER,
        playerIndex: state.currentPlayerIndex,
        cardInstanceId: card.instanceId,
        targetPlayerIndex: state.players.findIndex((targetPlayer) => targetPlayer.id === opponent.id),
        damage: card.valor
      },
      canWin: true
    };
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
      cleanupInvalidDefenseAssignments(state);
      return {
        message: `${player.nome} usou ${card.nome} e causou ${inflictedDamage} de dano em ${target.nome}, derrotando a unidade.`,
        event: {
          kind: LOG_EVENT_TYPES.EFFECT_DAMAGE_UNIT,
          playerIndex: state.currentPlayerIndex,
          cardInstanceId: card.instanceId,
          targetPlayerIndex: (state.currentPlayerIndex + 1) % 2,
          targetInstanceId: target.instanceId,
          damage: inflictedDamage,
          defeated: true
        },
        canWin: false
      };
    }

    return {
      message: `${player.nome} usou ${card.nome} e causou ${inflictedDamage} de dano em ${target.nome}.`,
      event: {
        kind: LOG_EVENT_TYPES.EFFECT_DAMAGE_UNIT,
        playerIndex: state.currentPlayerIndex,
        cardInstanceId: card.instanceId,
        targetPlayerIndex: (state.currentPlayerIndex + 1) % 2,
        targetInstanceId: target.instanceId,
        damage: inflictedDamage,
        defeated: false
      },
      canWin: false
    };
  }

  function resolveHealingEffectOnPlayer(state, card, player) {
    if (!canPlayerReceiveHealing(player)) {
      return false;
    }

    const recovered = Math.min(card.valor, MAX_HEALTH - player.vida);
    player.vida = Math.min(player.vida + card.valor, MAX_HEALTH);
    return {
      message: `${player.nome} usou ${card.nome} e recuperou ${recovered} de vida.`,
      event: {
        kind: LOG_EVENT_TYPES.EFFECT_HEAL_PLAYER,
        playerIndex: state.currentPlayerIndex,
        cardInstanceId: card.instanceId,
        targetPlayerIndex: state.currentPlayerIndex,
        recovered
      },
      canWin: false
    };
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
    return {
      message: `${player.nome} usou ${card.nome} e recuperou ${recovered} de vida em ${target.nome}.`,
      event: {
        kind: LOG_EVENT_TYPES.EFFECT_HEAL_UNIT,
        playerIndex: state.currentPlayerIndex,
        cardInstanceId: card.instanceId,
        targetPlayerIndex: state.currentPlayerIndex,
        targetInstanceId: target.instanceId,
        recovered
      },
      canWin: false
    };
  }

  function resolveEffectTarget(state, playerIndex, targetType, targetInstanceId, options = {}) {
    if (!state.isMatchStarted || state.winner || state.currentPlayerIndex !== playerIndex || !state.selectedEffectCard) {
      return false;
    }

    const player = state.players[playerIndex];
    const opponent = state.players[(playerIndex + 1) % 2];
    const card = state.selectedEffectCard;

    let resolution = null;

    if (card.efeito === "dano_direto") {
      if (targetType === "player") {
        resolution = resolveDamageEffectOnPlayer(state, card, player, opponent);
      }

      if (targetType === "unit") {
        resolution = resolveDamageEffectOnUnit(state, card, player, opponent, targetInstanceId);
      }
    }

    if (card.efeito === "cura_direta") {
      if (targetType === "player") {
        resolution = resolveHealingEffectOnPlayer(state, card, player);
      }

      if (targetType === "ally-unit") {
        resolution = resolveHealingEffectOnUnit(state, card, player, targetInstanceId);
      }
    }

    if (!resolution) {
      return false;
    }

    moveCardToDiscardForOwner(state, card, playerIndex);
    state.selectedEffectCard = null;
    const winner = resolution.canWin ? checkWinner(state) : null;
    if (winner) {
      resolution.event.winnerPlayerId = winner.id;
      resolution.message = `${resolution.message} ${winner.nome} venceu a partida.`;
    }
    addLog(state, resolution.message, resolution.event);
    if (state.winner) {
      finalizeCompletedMatch(state, options);
    }
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
      player.board.push(createBoardUnit(card));
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

    if (!canUnitSelectForAction(state, playerIndex, unit)) {
      return false;
    }

    if (state.selectedAttackerId === unitInstanceId) {
      if (unit.isDefending) {
        return cancelDefenseMode(state, playerIndex, unitInstanceId);
      }

      state.selectedAttackerId = null;
      return true;
    }

    state.selectedAttackerId = unitInstanceId;
    return true;
  }

  function attackTarget(state, playerIndex, targetType, targetInstanceId, options = {}) {
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
      if (isCombatTargetProtected(state, "player", (playerIndex + 1) % 2)) {
        attacker.jaAtacouNoTurno = false;
        state.selectedAttackerId = attacker.instanceId;
        return false;
      }

      opponent.vida = Math.max(opponent.vida - attackValue, 0);
      const winner = checkWinner(state);
      const event = {
        kind: LOG_EVENT_TYPES.ATTACK_PLAYER,
        playerIndex,
        attackerInstanceId: attacker.instanceId,
        targetPlayerIndex: (playerIndex + 1) % 2,
        damage: attackValue
      };
      let message = `${attacker.nome} atacou ${opponent.nome} e causou ${attackValue} de dano.`;
      if (winner) {
        event.winnerPlayerId = winner.id;
        message = `${message} ${winner.nome} venceu a partida.`;
      }
      addLog(state, message, event);
      if (state.winner) {
        finalizeCompletedMatch(state, options);
      }
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
    if (isCombatTargetProtected(state, "unit", (playerIndex + 1) % 2, target.instanceId)) {
      attacker.jaAtacouNoTurno = false;
      state.selectedAttackerId = attacker.instanceId;
      return false;
    }

    const inflictedDamage = getMitigatedDamage(target, attackValue);
    target.vida = Math.max(target.vida - inflictedDamage, 0);

    if (target.vida <= 0) {
      const [defeatedUnit] = opponent.board.splice(targetIndex, 1);
      moveCardToDiscardForOwner(state, defeatedUnit, (playerIndex + 1) % 2);
      cleanupInvalidDefenseAssignments(state);
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

  function enterDefenseMode(state, playerIndex, unitInstanceId, targetType, targetPlayerIndex = playerIndex, targetInstanceId = null) {
    const player = state.players[playerIndex];
    const unit = player.board.find((card) => card.instanceId === unitInstanceId);

    if (!canUnitProtectTarget(state, playerIndex, unit, targetType, targetPlayerIndex, targetInstanceId)) {
      return false;
    }

    const targetLabel = targetType === "player"
      ? player.nome
      : getDefenseTargetUnit(state, targetPlayerIndex, targetInstanceId)?.nome;

    if (!targetLabel || doesUnitProtectTarget(unit, targetType, targetPlayerIndex, targetInstanceId)) {
      return false;
    }

    const isReassigned = unit.isDefending;
    state.selectedAttackerId = null;
    unit.isDefending = true;
    unit.defendingTargetType = targetType;
    unit.defendingTargetPlayerIndex = targetPlayerIndex;
    unit.defendingTargetInstanceId = targetType === "unit" ? targetInstanceId : null;
    unit.defenseOrder = state.nextDefenseOrder;
    state.nextDefenseOrder += 1;
    if (!isReassigned) {
      unit.jaAtacouNoTurno = true;
    }
    addLog(state, `${player.nome} colocou ${unit.nome} para defender ${targetLabel}.`, {
      kind: LOG_EVENT_TYPES.ENTER_DEFENSE,
      playerIndex,
      unitInstanceId: unit.instanceId,
      targetType,
      targetPlayerIndex,
      targetInstanceId: targetType === "unit" ? targetInstanceId : null,
      reassigned: isReassigned
    });
    return true;
  }

  function cancelDefenseMode(state, playerIndex, unitInstanceId) {
    const player = state.players[playerIndex];
    const unit = player.board.find((card) => card.instanceId === unitInstanceId);

    if (!canUnitCancelDefense(state, playerIndex, unit)) {
      return false;
    }

    state.selectedAttackerId = null;
    clearDefenseState(unit);
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

    const selectedUnit = getSelectedUnit(state);
    if (!selectedUnit) {
      return false;
    }

    if (targetPlayerIndex === state.currentPlayerIndex) {
      return enterDefenseMode(state, state.currentPlayerIndex, selectedUnit.instanceId, "player", targetPlayerIndex);
    }

    if (!isCombatTargetProtected(state, "player", targetPlayerIndex)) {
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
        defenseMovers: 0,
        pendingSelection: false,
        hasAny: false
      };
    }

    const player = state.players[playerIndex];
    const canDraw = getDrawPile(state, playerIndex).length > 0 && canAfford(player, DRAW_COST);
    const playableCards = player.hand.filter((card) => canPlayCard(state, playerIndex, card)).length;
    const readyAttackers = getAvailableAttackers(player).length;
    const defenseMovers = player.board.filter((unit) => canUnitSelectForAction(state, playerIndex, unit) && unit.isDefending).length;
    const pendingSelection = Boolean(state.selectedAttackerId || state.selectedEffectCard);
    const hasAny = canDraw || playableCards > 0 || readyAttackers > 0 || pendingSelection;

    return {
      canDraw,
      playableCards,
      readyAttackers,
      defenseMovers,
      pendingSelection,
      hasAny
    };
  }

  function attemptEndTurn(state, options = {}) {
    if (!state.isMatchStarted || state.winner) {
      return false;
    }

    if (state.selectedEffectCard) {
      if (typeof options.notifyFn === "function") {
        options.notifyFn("Resolva ou cancele o efeito preparado antes de encerrar o turno.");
      }
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
      if (state.isHistoryOpen && state.selectedHistoryLogEntryId != null) {
        state.selectedHistoryLogEntryId = null;
      } else {
        state.selectedLogEntryId = null;
      }
      return true;
    }

    if (isViewingHistory(state)) {
      return false;
    }

    if (isHeadlessAiVsAiMode(state)) {
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

      const selectedUnit = getSelectedUnit(state);
      if (selectedUnit && !selectedUnit.isDefending) {
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
    cleanupInvalidDefenseAssignments(state);
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
    markHistorySourceDiverged(state);
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
      return card.defendingTargetType === "player" ? "DEF HEROI" : "DEF ALIADO";
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
    return Boolean(state.isLibraryOpen || state.isRulesOpen || state.isLogOpen || state.isHistoryOpen);
  }

  function toggleExclusiveSidePanel(state, panelName) {
    const panelMap = {
      library: "isLibraryOpen",
      rules: "isRulesOpen",
      log: "isLogOpen",
      history: "isHistoryOpen"
    };
    const targetFlag = panelMap[panelName];

    if (!targetFlag) {
      return;
    }

    const nextValue = !state[targetFlag];
    state.isLibraryOpen = false;
    state.isRulesOpen = false;
    state.isLogOpen = false;
    state.isHistoryOpen = false;
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

    const selectedUnit = getSelectedUnit(state);
    if (!selectedUnit) {
      return null;
    }

    if (targetPlayerIndex === state.currentPlayerIndex && canUnitProtectTarget(state, state.currentPlayerIndex, selectedUnit, "player", targetPlayerIndex)) {
      return "defend";
    }

    if (!selectedUnit.isDefending && targetPlayerIndex !== state.currentPlayerIndex && !isCombatTargetProtected(state, "player", targetPlayerIndex)) {
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
      entryClassName = "",
      onClick,
      player
    } = config;
    const classes = ["card", className];
    wrapper.className = `card-entry${card.isDefending ? " is-defending" : ""}${entryClassName ? ` ${entryClassName}` : ""}`;

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

  function handleBoardUnitClick(state, renderedState, playerIndex, cardInstanceId) {
    const matchStarted = Boolean(renderedState?.isMatchStarted);
    const viewingHistory = isViewingHistory(state);
    const aiTurnActive = isAiTurnActive(state);
    const isCurrentPlayer = playerIndex === renderedState?.currentPlayerIndex;
    const card = findCardByInstanceId(renderedState?.players?.[playerIndex]?.board, cardInstanceId);
    const selectedUnit = getSelectedUnit(state);

    if (!card) {
      return false;
    }

    const canSelect = matchStarted && !viewingHistory && !aiTurnActive && !state.winner && isCurrentPlayer && canUnitSelectForAction(state, playerIndex, card);
    const canBeCombatTargeted = matchStarted
      && !viewingHistory
      && !aiTurnActive
      && !isCurrentPlayer
      && Boolean(selectedUnit)
      && !selectedUnit.isDefending
      && !state.selectedEffectCard
      && !state.winner
      && !isCombatTargetProtected(state, "unit", playerIndex, card.instanceId);
    const canBeDamageEffectTargeted = matchStarted
      && !viewingHistory
      && !aiTurnActive
      && !isCurrentPlayer
      && Boolean(state.selectedEffectCard)
      && state.selectedEffectCard.efeito === "dano_direto"
      && !state.winner;
    const canBeHealingEffectTargeted = matchStarted
      && !viewingHistory
      && !aiTurnActive
      && isCurrentPlayer
      && Boolean(state.selectedEffectCard)
      && state.selectedEffectCard.efeito === "cura_direta"
      && !state.winner
      && card.vida < card.vidaBase;
    const canBeDefenseTargeted = matchStarted
      && !viewingHistory
      && !aiTurnActive
      && isCurrentPlayer
      && Boolean(selectedUnit)
      && !state.selectedEffectCard
      && !state.winner
      && selectedUnit.instanceId !== card.instanceId
      && canUnitProtectTarget(state, state.currentPlayerIndex, selectedUnit, "unit", playerIndex, card.instanceId);

    // Prioritize ally-protection clicks over reselecting another ready ally.
    if (canBeDefenseTargeted) {
      return enterDefenseMode(state, state.currentPlayerIndex, selectedUnit.instanceId, "unit", playerIndex, card.instanceId);
    }

    if (canSelect) {
      return selectAttacker(state, playerIndex, card.instanceId);
    }

    if (canBeCombatTargeted) {
      return attackTarget(state, state.currentPlayerIndex, "unit", card.instanceId);
    }

    if (canBeDamageEffectTargeted) {
      return resolveEffectTarget(state, state.currentPlayerIndex, "unit", card.instanceId);
    }

    if (canBeHealingEffectTargeted) {
      return resolveEffectTarget(state, state.currentPlayerIndex, "ally-unit", card.instanceId);
    }

    return false;
  }

  function buildUnitCardElementForBoard(state, renderedState, playerIndex, card) {
    const matchStarted = Boolean(renderedState.isMatchStarted);
    const viewingHistory = isViewingHistory(state);
    const aiTurnActive = isAiTurnActive(state);
    const isCurrentPlayer = playerIndex === renderedState.currentPlayerIndex;
    const selectedUnit = getSelectedUnit(state);
    const isSelected = matchStarted && !viewingHistory && !aiTurnActive && card.instanceId === state.selectedAttackerId;
    const canSelect = matchStarted && !viewingHistory && !aiTurnActive && !state.winner && isCurrentPlayer && canUnitSelectForAction(state, playerIndex, card);
    const canBeCombatTargeted = matchStarted
      && !viewingHistory
      && !aiTurnActive
      && !isCurrentPlayer
      && Boolean(selectedUnit)
      && !selectedUnit.isDefending
      && !state.selectedEffectCard
      && !state.winner
      && !isCombatTargetProtected(state, "unit", playerIndex, card.instanceId);
    const canBeDamageEffectTargeted = matchStarted
      && !viewingHistory
      && !aiTurnActive
      && !isCurrentPlayer
      && Boolean(state.selectedEffectCard)
      && state.selectedEffectCard.efeito === "dano_direto"
      && !state.winner;
    const canBeHealingEffectTargeted = matchStarted
      && !viewingHistory
      && !aiTurnActive
      && isCurrentPlayer
      && Boolean(state.selectedEffectCard)
      && state.selectedEffectCard.efeito === "cura_direta"
      && !state.winner
      && card.vida < card.vidaBase;
    const canBeDefenseTargeted = matchStarted
      && !viewingHistory
      && !aiTurnActive
      && isCurrentPlayer
      && Boolean(selectedUnit)
      && !state.selectedEffectCard
      && !state.winner
      && selectedUnit.instanceId !== card.instanceId
      && canUnitProtectTarget(state, state.currentPlayerIndex, selectedUnit, "unit", playerIndex, card.instanceId);

    return createCardElement(card, {
      interactive: canSelect || canBeCombatTargeted || canBeDamageEffectTargeted || canBeHealingEffectTargeted || canBeDefenseTargeted,
      selected: isSelected,
      className: (canBeCombatTargeted || canBeDamageEffectTargeted || canBeHealingEffectTargeted || canBeDefenseTargeted) ? "targetable" : "",
      onClick: () => {
        handleBoardUnitClick(state, renderedState, playerIndex, card.instanceId);
        render(state);
      },
      player: renderedState.players[playerIndex]
    });
  }

  function renderBoardZone(state, renderedState, playerIndex) {
    const player = renderedState.players[playerIndex];
    const container = document.getElementById(`player-${player.id}-board`);
    container.innerHTML = "";

    const baseUnits = player.board.filter((unit) => !unit.isDefending);
    if (!baseUnits.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nenhuma unidade em campo.";
      container.appendChild(empty);
      return;
    }

    baseUnits.forEach((card) => {
      const defenders = getDefendersForTarget(renderedState, playerIndex, "unit", card.instanceId);
      if (!defenders.length) {
        container.appendChild(buildUnitCardElementForBoard(state, renderedState, playerIndex, card));
        return;
      }

      const stack = document.createElement("div");
      stack.className = "protected-stack";

      const base = document.createElement("div");
      base.className = "protected-stack-base";
      base.appendChild(buildUnitCardElementForBoard(state, renderedState, playerIndex, card));
      stack.appendChild(base);

      const defenderLayer = document.createElement("div");
      defenderLayer.className = "protected-stack-defenders";
      defenders.forEach((defender, defenderIndex) => {
        const defenderElement = buildUnitCardElementForBoard(state, renderedState, playerIndex, defender);
        defenderElement.classList.add("protected-defender-entry");
        defenderElement.style.setProperty("--defense-offset", `${defenderIndex * 18}px`);
        defenderElement.style.zIndex = String(defenderIndex + 2);
        defenderLayer.appendChild(defenderElement);
      });
      stack.appendChild(defenderLayer);
      container.appendChild(stack);
    });
  }

  function renderHeroDefenseSlot(state, renderedState, playerIndex) {
    const player = renderedState.players[playerIndex];
    const slot = document.getElementById(`player-${player.id}-hero-defense-slot`);

    if (!slot) {
      return;
    }

    slot.innerHTML = "";
    const defenders = getDefendersForTarget(renderedState, playerIndex, "player");
    slot.hidden = defenders.length === 0;

    defenders.forEach((defender, defenderIndex) => {
      const defenderElement = buildUnitCardElementForBoard(state, renderedState, playerIndex, defender);
      defenderElement.classList.add("hero-defense-entry");
      defenderElement.style.setProperty("--defense-offset", `${defenderIndex * 16}px`);
      defenderElement.style.zIndex = String(defenderIndex + 2);
      slot.appendChild(defenderElement);
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

    if (targetMode === "defend") {
      return "Clique para defender jogador";
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

  function getSelectedHistoryLogEntry(state) {
    const selectedMatch = getSelectedHistoryMatch(state);
    if (!selectedMatch || state.selectedHistoryLogEntryId == null) {
      return null;
    }

    const selectedLog = Array.isArray(selectedMatch.log) ? selectedMatch.log : [];
    return selectedLog.find((entry) => entry.id === state.selectedHistoryLogEntryId) || null;
  }

  function getDefaultHistoryLogEntryId(record) {
    const recordLog = Array.isArray(record?.log) ? record.log : [];
    for (let index = recordLog.length - 1; index >= 0; index -= 1) {
      const entry = recordLog[index];
      if (entry?.snapshot) {
        return entry.id;
      }
    }

    return null;
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
    const copyButton = document.getElementById("copy-validation-issue-button");
    const statusElement = document.getElementById("log-validation-status");
    const resultsElement = document.getElementById("log-validation-results");
    const copyFeedbackElement = document.getElementById("log-validation-copy-feedback");

    if (!validateButton || !copyButton || !statusElement || !resultsElement || !copyFeedbackElement) {
      return;
    }

    validateButton.disabled = !state.log.length;
    copyButton.hidden = state.logValidationStatus !== LOG_VALIDATION_STATUS.INVALID;
    copyButton.disabled = !canCopyFocusedLogValidationIssue(state);
    copyFeedbackElement.hidden = !state.logValidationCopyFeedback;
    copyFeedbackElement.textContent = state.logValidationCopyFeedback || "";
    copyFeedbackElement.className = state.logValidationCopyFeedbackStatus === "success"
      ? "log-validation-copy-feedback status-success"
      : state.logValidationCopyFeedbackStatus === "error"
        ? "log-validation-copy-feedback status-error"
        : "log-validation-copy-feedback";

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

    state.logValidationIssues.forEach((issue, issueIndex) => {
      const issueButton = document.createElement("button");
      issueButton.type = "button";
      issueButton.className = issueIndex === getSelectedValidationIssueIndex(state)
        ? "log-validation-issue is-focused"
        : "log-validation-issue";
      issueButton.innerHTML = `
        <span class="log-validation-issue-code">${issue.numero ? `Acao ${issue.numero}` : "Log"} · ${issue.code}</span>
        <span class="log-validation-issue-text">${issue.message}</span>
      `;
      issueButton.addEventListener("click", () => {
        selectLogValidationIssue(state, issueIndex);
        render(state);
      });
      issuesList.appendChild(issueButton);
    });

    resultsElement.appendChild(issuesList);
  }

  function formatSavedMatchDate(savedAt) {
    const parsedDate = new Date(savedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return savedAt || "Data desconhecida";
    }

    return parsedDate.toLocaleString("pt-BR");
  }

  function formatHumanAliasSummary(record) {
    const aliases = Array.isArray(record?.humanAliases)
      ? record.humanAliases.filter((alias) => typeof alias === "string" && alias.length)
      : [];

    return aliases.length ? aliases.join(" · ") : "Sem apelidos humanos";
  }

  function getHistoryRecordMetaLine(record) {
    const winnerName = getSavedMatchWinnerName(record);
    return [
      winnerName ? `${winnerName} venceu` : null,
      record.summary,
      getMatchKindLabel(record.matchKind),
      formatHumanAliasSummary(record),
      `${getControllerDisplayLabel(record.playerControllers[0])} x ${getControllerDisplayLabel(record.playerControllers[1])}`,
      `Baralho ${getDeckModeLabel(record.deckMode)}`,
      `${record.log.length} acao(oes)`,
      record.appVersion ? `Versao ${record.appVersion}` : null
    ].filter(Boolean).join(" · ");
  }

  function getLocalHistorySyncLine(record, options = {}) {
    const config = getRemoteHistoryConfig(options);
    if (!record?.remoteEligible || !config.enabled) {
      return "";
    }

    const baseLabel = `Sync remoto: ${getRemoteSyncStatusLabel(record.remoteSyncStatus)}`;
    if (record.remoteSyncStatus === REMOTE_MATCH_SYNC_STATUSES.FAILED && record.remoteSyncError) {
      return `${baseLabel}. ${record.remoteSyncError}`;
    }

    return baseLabel;
  }

  function selectHistoryMatch(state, matchId) {
    const selectedRecord = (state.matchHistory || []).find((record) => record.id === matchId) || null;
    state.selectedHistoryMatchId = selectedRecord?.id ?? null;
    state.selectedHistoryLogEntryId = selectedRecord ? getDefaultHistoryLogEntryId(selectedRecord) : null;
    return selectedRecord;
  }

  function selectRemoteHistoryMatch(state, matchId) {
    const selectedRecord = (state.remoteMatchHistory || []).find((record) => record.id === matchId) || null;
    state.selectedRemoteHistoryMatchId = selectedRecord?.id ?? null;
    return selectedRecord;
  }

  function renderMatchHistory(state) {
    const historyCount = document.getElementById("history-match-count");
    const historyList = document.getElementById("match-history-list");
    const historyDetails = document.getElementById("history-match-details");
    const historyTitle = document.getElementById("history-match-title");
    const historyMeta = document.getElementById("history-match-meta");
    const historyLog = document.getElementById("history-log");
    const restoreButton = document.getElementById("restore-history-match-button");

    if (!historyCount || !historyList || !historyDetails || !historyTitle || !historyMeta || !historyLog || !restoreButton) {
      return;
    }

    historyCount.textContent = `${state.matchHistory.length} partida(s)`;
    historyList.innerHTML = "";
    historyLog.innerHTML = "";

    if (!state.matchHistory.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nenhuma partida anterior foi salva ainda.";
      historyList.appendChild(empty);
      historyDetails.hidden = true;
      restoreButton.disabled = true;
      return;
    }

    state.matchHistory.forEach((record) => {
      const winnerName = getSavedMatchWinnerName(record);
      const item = document.createElement("button");
      item.type = "button";
      item.className = record.id === state.selectedHistoryMatchId
        ? "match-history-entry is-selected"
        : "match-history-entry";
      item.innerHTML = `
        <span class="match-history-entry-title">${getHistoryStatusLabel(record.status)} · ${formatSavedMatchDate(record.savedAt)}</span>
        <span class="match-history-entry-meta">${winnerName ? `${winnerName} venceu · ` : ""}${record.summary} ${getControllerDisplayLabel(record.playerControllers[0])} x ${getControllerDisplayLabel(record.playerControllers[1])} · Baralho ${getDeckModeLabel(record.deckMode)} · ${record.log.length} acao(oes)</span>
      `;
      item.addEventListener("click", () => {
        selectHistoryMatch(state, record.id);
        render(state);
      });
      historyList.appendChild(item);
    });

    const selectedRecord = getSelectedHistoryMatch(state);
    if (!selectedRecord) {
      historyDetails.hidden = true;
      restoreButton.disabled = true;
      return;
    }

    historyDetails.hidden = false;
    const winnerName = getSavedMatchWinnerName(selectedRecord);
    historyTitle.textContent = `${getHistoryStatusLabel(selectedRecord.status)} · ${formatSavedMatchDate(selectedRecord.savedAt)}`;
    historyMeta.textContent = `${selectedRecord.summary} ${winnerName ? `Vencedor: ${winnerName}. ` : ""}${getControllerDisplayLabel(selectedRecord.playerControllers[0])} x ${getControllerDisplayLabel(selectedRecord.playerControllers[1])} · Baralho ${getDeckModeLabel(selectedRecord.deckMode)}.`;
    restoreButton.disabled = !getHistoryRestoreTarget(selectedRecord, state.selectedHistoryLogEntryId);

    if (!selectedRecord.log.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Esta partida nao possui log salvo.";
      historyLog.appendChild(empty);
      return;
    }

    getDisplayLogEntries(selectedRecord.log).forEach((entry) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `log-entry${state.selectedHistoryLogEntryId === entry.id ? " is-selected" : ""}`;
      item.innerHTML = `
        <span class="log-entry-number">${entry.numero}</span>
        <span class="log-entry-text">${entry.texto}</span>
      `;
      item.addEventListener("click", () => {
        state.selectedHistoryLogEntryId = entry.id;
        render(state);
      });
      historyLog.appendChild(item);
    });
  }

  function renderMatchHistoryLegacy(state) {
    const historyCount = document.getElementById("history-match-count");
    const historyList = document.getElementById("match-history-list");
    const historyDetails = document.getElementById("history-match-details");
    const historyTitle = document.getElementById("history-match-title");
    const historyMeta = document.getElementById("history-match-meta");
    const historyLog = document.getElementById("history-log");
    const restoreButton = document.getElementById("restore-history-match-button");
    const historyLocalTabButton = document.getElementById("history-local-tab-button");
    const historyRemoteTabButton = document.getElementById("history-remote-tab-button");
    const refreshRemoteHistoryButton = document.getElementById("refresh-remote-history-button");
    const retryRemoteHistorySyncButton = document.getElementById("retry-remote-history-sync-button");
    const remoteHistoryFeedback = document.getElementById("remote-history-sync-feedback");
    const remoteConfig = getRemoteHistoryConfig();

    if (!historyCount || !historyList || !historyDetails || !historyTitle || !historyMeta || !historyLog || !restoreButton || !historyLocalTabButton || !historyRemoteTabButton || !refreshRemoteHistoryButton || !retryRemoteHistorySyncButton || !remoteHistoryFeedback) {
      return;
    }

    const viewingRemote = state.historyViewMode === HISTORY_VIEW_MODES.REMOTE;
    historyLocalTabButton.classList.toggle("is-selected", !viewingRemote);
    historyRemoteTabButton.classList.toggle("is-selected", viewingRemote);
    historyLocalTabButton.setAttribute("aria-pressed", String(!viewingRemote));
    historyRemoteTabButton.setAttribute("aria-pressed", String(viewingRemote));
    refreshRemoteHistoryButton.hidden = !viewingRemote;
    refreshRemoteHistoryButton.disabled = !viewingRemote || state.remoteMatchHistoryStatus === REMOTE_MATCH_HISTORY_LOAD_STATUSES.LOADING || !remoteConfig.enabled;
    remoteHistoryFeedback.hidden = !state.remoteHistorySyncFeedback;
    remoteHistoryFeedback.textContent = state.remoteHistorySyncFeedback || "";
    remoteHistoryFeedback.className = state.remoteHistorySyncFeedbackStatus === "error"
      ? "remote-history-sync-feedback is-error"
      : "remote-history-sync-feedback";
    historyList.innerHTML = "";
    historyLog.innerHTML = "";

    if (!viewingRemote) {
      historyCount.textContent = `${state.matchHistory.length} partida(s) locais`;

      if (!state.matchHistory.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Nenhuma partida anterior foi salva ainda.";
        historyList.appendChild(empty);
        historyDetails.hidden = true;
        restoreButton.hidden = false;
        restoreButton.disabled = true;
        retryRemoteHistorySyncButton.hidden = true;
        return;
      }

      state.matchHistory.forEach((record) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = record.id === state.selectedHistoryMatchId
          ? "match-history-entry is-selected"
          : "match-history-entry";
        item.innerHTML = `
          <span class="match-history-entry-title">${getHistoryStatusLabel(record.status)} · ${formatSavedMatchDate(record.savedAt)}</span>
          <span class="match-history-entry-meta">${getHistoryRecordMetaLine(record)}</span>
        `;
        item.addEventListener("click", () => {
          selectHistoryMatch(state, record.id);
          render(state);
        });
        historyList.appendChild(item);
      });

      const selectedRecord = getSelectedHistoryMatch(state);
      if (!selectedRecord) {
        historyDetails.hidden = true;
        restoreButton.hidden = false;
        restoreButton.disabled = true;
        retryRemoteHistorySyncButton.hidden = true;
        return;
      }

      historyDetails.hidden = false;
      historyTitle.textContent = `${getHistoryStatusLabel(selectedRecord.status)} · ${formatSavedMatchDate(selectedRecord.savedAt)}`;
      historyMeta.textContent = `${getHistoryRecordMetaLine(selectedRecord)}${getLocalHistorySyncLine(selectedRecord) ? `. ${getLocalHistorySyncLine(selectedRecord)}` : ""}`;
      restoreButton.hidden = false;
      restoreButton.disabled = !getHistoryRestoreTarget(selectedRecord, state.selectedHistoryLogEntryId);
      retryRemoteHistorySyncButton.hidden = !selectedRecord.remoteEligible || !remoteConfig.enabled;
      retryRemoteHistorySyncButton.disabled = selectedRecord.remoteSyncStatus === REMOTE_MATCH_SYNC_STATUSES.PENDING;

      if (!selectedRecord.log.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Esta partida nao possui log salvo.";
        historyLog.appendChild(empty);
        return;
      }

      getDisplayLogEntries(selectedRecord.log).forEach((entry) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `log-entry${state.selectedHistoryLogEntryId === entry.id ? " is-selected" : ""}`;
        item.innerHTML = `
          <span class="log-entry-number">${entry.numero}</span>
          <span class="log-entry-text">${entry.texto}</span>
        `;
        item.addEventListener("click", () => {
          state.selectedHistoryLogEntryId = entry.id;
          render(state);
        });
        historyLog.appendChild(item);
      });
      return;
    }

    restoreButton.hidden = true;
    retryRemoteHistorySyncButton.hidden = true;

    if (!remoteConfig.enabled) {
      historyCount.textContent = "Historico remoto desativado";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Configure remote-history-config.js com SUPABASE_URL e SUPABASE_ANON_KEY para habilitar o historico remoto.";
      historyList.appendChild(empty);
      historyDetails.hidden = true;
      return;
    }

    if (state.remoteMatchHistoryStatus === REMOTE_MATCH_HISTORY_LOAD_STATUSES.LOADING) {
      historyCount.textContent = "Carregando remoto...";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Carregando partidas do historico remoto...";
      historyList.appendChild(empty);
      historyDetails.hidden = true;
      return;
    }

    if (state.remoteMatchHistoryStatus === REMOTE_MATCH_HISTORY_LOAD_STATUSES.FAILED && state.remoteMatchHistoryError) {
      historyCount.textContent = "Historico remoto";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = state.remoteMatchHistoryError;
      historyList.appendChild(empty);
      historyDetails.hidden = true;
      return;
    }

    historyCount.textContent = `${state.remoteMatchHistory.length} partida(s) remotas`;
    if (!state.remoteMatchHistory.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nenhuma partida humana foi enviada para o historico remoto ainda.";
      historyList.appendChild(empty);
      historyDetails.hidden = true;
      return;
    }

    state.remoteMatchHistory.forEach((record) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = record.id === state.selectedRemoteHistoryMatchId
        ? "match-history-entry is-selected"
        : "match-history-entry";
      item.innerHTML = `
        <span class="match-history-entry-title">${getHistoryStatusLabel(record.status)} · ${formatSavedMatchDate(record.savedAt)}</span>
        <span class="match-history-entry-meta">${getHistoryRecordMetaLine(record)}</span>
      `;
      item.addEventListener("click", () => {
        selectRemoteHistoryMatch(state, record.id);
        render(state);
      });
      historyList.appendChild(item);
    });

    const selectedRemoteRecord = getSelectedRemoteHistoryMatch(state);
    if (!selectedRemoteRecord) {
      historyDetails.hidden = true;
      return;
    }

    historyDetails.hidden = false;
    historyTitle.textContent = `${getHistoryStatusLabel(selectedRemoteRecord.status)} · ${formatSavedMatchDate(selectedRemoteRecord.savedAt)}`;
    historyMeta.textContent = getHistoryRecordMetaLine(selectedRemoteRecord);

    if (!selectedRemoteRecord.log.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Esta partida remota nao possui log salvo.";
      historyLog.appendChild(empty);
      return;
    }

    getDisplayLogEntries(selectedRemoteRecord.log).forEach((entry) => {
      const item = document.createElement("div");
      item.className = "log-entry is-read-only";
      item.innerHTML = `
        <span class="log-entry-number">${entry.numero}</span>
        <span class="log-entry-text">${entry.texto}</span>
      `;
      historyLog.appendChild(item);
    });
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
    return Boolean(
      state
      && (
        (state.isLogOpen && getSelectedLogEntry(state))
        || (state.isHistoryOpen && state.historyViewMode === HISTORY_VIEW_MODES.LOCAL && getSelectedHistoryLogEntry(state))
      )
    );
  }

  function getRenderedGameState(state) {
    const currentMatchEntry = state?.isLogOpen ? getSelectedLogEntry(state) : null;
    const historyMatchEntry = state?.isHistoryOpen && state.historyViewMode === HISTORY_VIEW_MODES.LOCAL
      ? getSelectedHistoryLogEntry(state)
      : null;
    const selectedEntry = historyMatchEntry || currentMatchEntry;

    if (!state || !selectedEntry) {
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

  function getHeadlessAiStatusText(state) {
    if (!isHeadlessAiVsAiMode(state)) {
      return "";
    }

    if (state.headlessBatchStatus === HEADLESS_BATCH_STATUSES.RUNNING) {
      return "Em andamento";
    }

    if (state.headlessBatchStatus === HEADLESS_BATCH_STATUSES.FAILED) {
      return "Falhou";
    }

    if (state.headlessBatchStatus === HEADLESS_BATCH_STATUSES.FINISHED) {
      return "Concluida";
    }

    return "Encerrada";
  }

  function getHeadlessBatchComparisonControllers(state) {
    const controllers = normalizePlayerControllers(state?.playerControllers);
    return isHeadlessAiComparisonMode(state)
      ? controllers
      : [PLAYER_CONTROLLER_TYPES.AI_BASE, PLAYER_CONTROLLER_TYPES.AI_SMART];
  }

  function getHeadlessBatchComparisonLabel(state) {
    const comparisonControllers = getHeadlessBatchComparisonControllers(state);
    return `${getControllerDisplayLabel(comparisonControllers[0])} x ${getControllerDisplayLabel(comparisonControllers[1])}`;
  }

  function getHeadlessAiSummaryText(state) {
    const comparisonControllers = getHeadlessBatchComparisonControllers(state);
    if (state.headlessBatchStatus === HEADLESS_BATCH_STATUSES.RUNNING) {
      return isHeadlessAiComparisonMode(state)
        ? `Comparando ${getHeadlessBatchComparisonLabel(state)}.`
        : `Simulando bateria IA x IA. Partida atual: ${state.headlessBatchCurrentMatchNumber || 1} de ${getHeadlessBatchTotalMatchCount(state)}.`;
    }

    if (state.headlessBatchStatus === HEADLESS_BATCH_STATUSES.FAILED) {
      return "A bateria foi interrompida antes de concluir todas as partidas.";
    }

    if (isHeadlessAiComparisonMode(state)) {
      return `Placar geral: ${getControllerDisplayLabel(comparisonControllers[0])} ${state.headlessBatchControllerWins[comparisonControllers[0]] || 0} x ${state.headlessBatchControllerWins[comparisonControllers[1]] || 0} ${getControllerDisplayLabel(comparisonControllers[1])}.`;
    }

    return `Placar final: ${PLAYER_DISPLAY_NAMES[0]} ${state.headlessBatchWins[0]} x ${state.headlessBatchWins[1]} ${PLAYER_DISPLAY_NAMES[1]}.`;
  }

  function getHeadlessAiProgressText(state) {
    if (isHeadlessAiComparisonMode(state)) {
      return `${Math.floor(state.headlessBatchCompletedCount / 2)}/${state.headlessBatchPairCountRequested} pares · ${state.headlessBatchCompletedCount}/${getHeadlessBatchTotalMatchCount(state)} partidas`;
    }

    return `${state.headlessBatchCompletedCount}/${state.headlessBatchRequestedCount} partidas`;
  }

  function getHeadlessStarterRecordText(state, controllerType) {
    const record = state.headlessBatchStarterResults?.[controllerType];
    if (!record) {
      return "";
    }

    return `${getControllerDisplayLabel(controllerType)} começou: ${record.wins} vitorias e ${record.losses} derrotas`;
  }

  function renderHeadlessAiPanel(state) {
    const panel = document.getElementById("headless-ai-panel");
    const title = document.getElementById("headless-ai-title");
    const status = document.getElementById("headless-ai-status");
    const copy = document.getElementById("headless-ai-copy");
    const progress = document.getElementById("headless-ai-progress");
    const controllerPrimaryStat = document.getElementById("headless-ai-controller-primary-stat");
    const controllerPrimaryLabel = document.getElementById("headless-ai-controller-primary-label");
    const controllerPrimaryWins = document.getElementById("headless-ai-controller-primary-wins");
    const controllerSecondaryStat = document.getElementById("headless-ai-controller-secondary-stat");
    const controllerSecondaryLabel = document.getElementById("headless-ai-controller-secondary-label");
    const controllerSecondaryWins = document.getElementById("headless-ai-controller-secondary-wins");
    const playerOneWins = document.getElementById("headless-ai-player-1-wins");
    const playerTwoWins = document.getElementById("headless-ai-player-2-wins");
    const smartStarterRecord = document.getElementById("headless-ai-smart-start-record");
    const baseStarterRecord = document.getElementById("headless-ai-base-start-record");
    const summary = document.getElementById("headless-ai-summary");
    const error = document.getElementById("headless-ai-error");

    if (!panel || !title || !status || !copy || !progress || !controllerPrimaryStat || !controllerPrimaryLabel || !controllerPrimaryWins || !controllerSecondaryStat || !controllerSecondaryLabel || !controllerSecondaryWins || !playerOneWins || !playerTwoWins || !smartStarterRecord || !baseStarterRecord || !summary || !error) {
      return;
    }

    const isHeadlessMode = isHeadlessAiVsAiMode(state);
    panel.hidden = !isHeadlessMode;

    if (!isHeadlessMode) {
      return;
    }

    const running = state.isHeadlessSimulationRunning;
    const comparisonControllers = getHeadlessBatchComparisonControllers(state);
    title.textContent = running ? "Simulacao IA x IA" : "Resultado da simulacao";
    status.textContent = getHeadlessAiStatusText(state);
    copy.textContent = running
      ? isHeadlessAiComparisonMode(state)
        ? `Comparando ${getHeadlessBatchComparisonLabel(state)} em pares espelhados, sem tabuleiro.`
        : "Simulando uma bateria IA x IA sem tabuleiro. O placar parcial e atualizado automaticamente."
      : state.headlessBatchStatus === HEADLESS_BATCH_STATUSES.FAILED
        ? "A bateria falhou antes de concluir todas as partidas."
        : isHeadlessAiComparisonMode(state)
          ? `A comparacao ${getHeadlessBatchComparisonLabel(state)} terminou. Confira abaixo as vitorias por IA e por lado.`
          : "A bateria terminou. Confira abaixo quantas partidas cada lado venceu.";
    progress.textContent = getHeadlessAiProgressText(state);
    controllerPrimaryLabel.textContent = getControllerDisplayLabel(comparisonControllers[0]);
    controllerPrimaryWins.textContent = String(state.headlessBatchControllerWins[comparisonControllers[0]] || 0);
    controllerSecondaryLabel.textContent = getControllerDisplayLabel(comparisonControllers[1]);
    controllerSecondaryWins.textContent = String(state.headlessBatchControllerWins[comparisonControllers[1]] || 0);
    controllerPrimaryStat.hidden = !isHeadlessAiComparisonMode(state);
    controllerSecondaryStat.hidden = !isHeadlessAiComparisonMode(state);
    playerOneWins.textContent = String(state.headlessBatchWins[0]);
    playerTwoWins.textContent = String(state.headlessBatchWins[1]);
    smartStarterRecord.hidden = !isHeadlessAiComparisonMode(state);
    baseStarterRecord.hidden = !isHeadlessAiComparisonMode(state);
    smartStarterRecord.textContent = getHeadlessStarterRecordText(state, PLAYER_CONTROLLER_TYPES.AI_SMART);
    baseStarterRecord.textContent = getHeadlessStarterRecordText(state, PLAYER_CONTROLLER_TYPES.AI_BASE);
    summary.textContent = getHeadlessAiSummaryText(state);
    error.hidden = !state.headlessBatchErrorMessage;
    error.textContent = state.headlessBatchErrorMessage || "";
  }

  function render(state) {
    const viewingHistory = isViewingHistory(state);
    const aiTurnActive = isAiTurnActive(state);
    const renderedState = getRenderedGameState(state);
    const currentPlayer = getCurrentPlayer(renderedState);
    const matchStarted = Boolean(renderedState.isMatchStarted);
    const controllers = normalizePlayerControllers(renderedState.playerControllers);

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
      const playerControllerChip = document.getElementById(`player-${player.id}-controller-chip`);
      const playerTargetHint = document.getElementById(`player-${player.id}-target-hint`);
      const headerTargetMode = (viewingHistory || aiTurnActive || !state.isMatchStarted) ? null : getPlayerHeaderTargetMode(state, index);

      if (playerDeckCount) {
        playerDeckCount.textContent = `${getPlayerDeckCount(renderedState, index)}/${getPlayerDeckTotal(renderedState)}`;
      }

      if (playerDeckStat) {
        playerDeckStat.hidden = false;
      }

      if (playerNameButton) {
        playerNameButton.textContent = player.nome;
        playerNameButton.disabled = !headerTargetMode;
        playerNameButton.classList.toggle("targetable-name", Boolean(headerTargetMode));
        playerNameButton.classList.toggle("targetable-name-attack", headerTargetMode === "attack");
        playerNameButton.classList.toggle("targetable-name-defense", headerTargetMode === "defend");
        playerNameButton.classList.toggle("targetable-name-heal", headerTargetMode === "heal");
      }

      if (playerControllerChip) {
        playerControllerChip.textContent = getControllerDisplayLabel(controllers[index]);
      }

      if (playerTargetHint) {
        const hintText = getTargetHintText(headerTargetMode);
        playerTargetHint.hidden = !hintText;
        playerTargetHint.textContent = hintText;
        playerTargetHint.classList.toggle("target-hint-defend", headerTargetMode === "defend");
        playerTargetHint.classList.toggle("target-hint-heal", headerTargetMode === "heal");
      }

      renderHeroDefenseSlot(state, renderedState, index);

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

      renderBoardZone(state, renderedState, index);

      renderCardList(
        `player-${player.id}-support`,
        player.supportZone,
        (card) => {
          const isCurrentPlayer = index === renderedState.currentPlayerIndex;
          const selectedUnit = getSelectedUnit(state);
          const canBeSupportTargeted = matchStarted
            && !viewingHistory
            && !aiTurnActive
            && !isCurrentPlayer
            && Boolean(selectedUnit)
            && !selectedUnit.isDefending
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
    document.getElementById("winner-banner").textContent = state.winner ? `${state.winner.nome} venceu` : "Sem vencedor";

    const boardElement = document.querySelector(".board");
    const sideRail = document.getElementById("side-rail");
    const libraryPanel = document.getElementById("library-panel");
    const rulesPanel = document.getElementById("rules-panel");
    const logPanel = document.getElementById("log-panel");
    const historyPanel = document.getElementById("history-panel");
    const toggleLibraryButton = document.getElementById("toggle-library-button");
    const toggleRulesButton = document.getElementById("toggle-rules-button");
    const toggleLogButton = document.getElementById("toggle-log-button");
    const toggleHistoryButton = document.getElementById("toggle-history-button");
    const startButton = document.getElementById("start-button");
    const simulateAiMatchButton = document.getElementById("simulate-ai-match-button");
    const simulateAiMatchCountPicker = document.getElementById("simulate-ai-match-count-picker");
    const simulateAiMatchCountLabel = document.getElementById("simulate-ai-match-count-label");
    const simulateAiMatchCountInput = document.getElementById("simulate-ai-match-count");
    const playerOneAliasInput = document.getElementById("player-1-human-alias");
    const playerTwoAliasInput = document.getElementById("player-2-human-alias");
    const restartButton = document.getElementById("restart-button");
    const aiMatchStrip = document.getElementById("ai-match-strip");
    const aiMatchText = document.getElementById("ai-match-text");
    const toggleAiMatchButton = document.getElementById("toggle-ai-match-button");
    const headlessAiPanel = document.getElementById("headless-ai-panel");
    const sharedDeckButton = document.getElementById("deck-mode-shared");
    const separateDeckButton = document.getElementById("deck-mode-separate");
    const configPanel = document.getElementById("match-config-panel");
    const anySidePanelOpen = isAnySidePanelOpen(state);
    const heroElement = document.querySelector(".hero");
    const headlessMode = isHeadlessAiVsAiMode(state);
    const headlessSimulationReady = !state.isMatchStarted && isAiControlledPlayer(state, 0) && isAiControlledPlayer(state, 1);

    if (boardElement && sideRail && libraryPanel && rulesPanel && logPanel && historyPanel && toggleLibraryButton && toggleRulesButton && toggleLogButton && toggleHistoryButton) {
      boardElement.classList.toggle("board-with-side-rail", anySidePanelOpen);
      boardElement.classList.toggle("is-history-view", viewingHistory);
      boardElement.classList.toggle("is-ai-turn", aiTurnActive);
      sideRail.setAttribute("aria-hidden", String(!anySidePanelOpen));
      libraryPanel.setAttribute("aria-hidden", String(!state.isLibraryOpen));
      rulesPanel.setAttribute("aria-hidden", String(!state.isRulesOpen));
      logPanel.setAttribute("aria-hidden", String(!state.isLogOpen));
      historyPanel.setAttribute("aria-hidden", String(!state.isHistoryOpen));
      toggleLibraryButton.classList.toggle("is-open", state.isLibraryOpen);
      toggleRulesButton.classList.toggle("is-open", state.isRulesOpen);
      toggleLogButton.classList.toggle("is-open", state.isLogOpen);
      toggleHistoryButton.classList.toggle("is-open", state.isHistoryOpen);
      toggleLibraryButton.setAttribute("aria-expanded", String(state.isLibraryOpen));
      toggleRulesButton.setAttribute("aria-expanded", String(state.isRulesOpen));
      toggleLogButton.setAttribute("aria-expanded", String(state.isLogOpen));
      toggleHistoryButton.setAttribute("aria-expanded", String(state.isHistoryOpen));
    }

    [0, 1].forEach((playerIndex) => {
      const selectedController = normalizePlayerControllers(state.playerControllers)[playerIndex];
      const humanButton = document.getElementById(`player-${playerIndex + 1}-controller-human`);
      const aiBaseButton = document.getElementById(`player-${playerIndex + 1}-controller-ai-base`);
      const aiSmartButton = document.getElementById(`player-${playerIndex + 1}-controller-ai-smart`);

      if (humanButton) {
        const isSelected = selectedController === PLAYER_CONTROLLER_TYPES.HUMAN;
        humanButton.disabled = state.isMatchStarted;
        humanButton.classList.toggle("is-selected", isSelected);
        humanButton.setAttribute("aria-pressed", String(isSelected));
      }

      if (aiBaseButton) {
        const isSelected = selectedController === PLAYER_CONTROLLER_TYPES.AI_BASE;
        aiBaseButton.disabled = state.isMatchStarted;
        aiBaseButton.classList.toggle("is-selected", isSelected);
        aiBaseButton.setAttribute("aria-pressed", String(isSelected));
      }

      if (aiSmartButton) {
        const isSelected = selectedController === PLAYER_CONTROLLER_TYPES.AI_SMART;
        aiSmartButton.disabled = state.isMatchStarted;
        aiSmartButton.classList.toggle("is-selected", isSelected);
        aiSmartButton.setAttribute("aria-pressed", String(isSelected));
      }
    });

    [
      { input: playerOneAliasInput, playerIndex: 0 },
      { input: playerTwoAliasInput, playerIndex: 1 }
    ].forEach(({ input, playerIndex }) => {
      if (!input) {
        return;
      }

      const normalizedControllers = normalizePlayerControllers(state.playerControllers);
      const isHuman = normalizedControllers[playerIndex] === PLAYER_CONTROLLER_TYPES.HUMAN;
      input.disabled = state.isMatchStarted || !isHuman;
      input.value = normalizeHumanAliases(state.humanAliases)[playerIndex];
      input.placeholder = getDefaultHumanAlias(playerIndex);
    });

    if (startButton) {
      startButton.hidden = state.isMatchStarted;
      startButton.disabled = state.isMatchStarted;
    }

    if (simulateAiMatchCountPicker && simulateAiMatchCountInput) {
      simulateAiMatchCountPicker.hidden = !headlessSimulationReady;
      simulateAiMatchCountInput.disabled = !headlessSimulationReady;
      simulateAiMatchCountInput.value = String(normalizeHeadlessBatchCount(state.headlessBatchRequestedCount));
      if (simulateAiMatchCountLabel) {
        simulateAiMatchCountLabel.textContent = headlessSimulationReady && normalizePlayerControllers(state.playerControllers)[0] !== normalizePlayerControllers(state.playerControllers)[1]
          ? "Pares espelhados da comparacao"
          : "Partidas da simulacao";
      }
    }

    if (simulateAiMatchButton) {
      simulateAiMatchButton.hidden = !headlessSimulationReady;
      simulateAiMatchButton.disabled = !headlessSimulationReady;
    }

    if (restartButton) {
      restartButton.hidden = !state.isMatchStarted;
      restartButton.disabled = !state.isMatchStarted;
    }

    if (aiMatchStrip && toggleAiMatchButton && aiMatchText) {
      const showAiMatchStrip = state.isMatchStarted && isAiVsAiMatch(state) && !headlessMode;
      aiMatchStrip.hidden = !showAiMatchStrip;
      toggleAiMatchButton.textContent = state.isAiVsAiPaused ? "Continuar IA x IA" : "Pausar IA x IA";
      toggleAiMatchButton.setAttribute("aria-pressed", String(state.isAiVsAiPaused));

      aiMatchText.textContent = viewingHistory
        ? "Visualizando um momento passado em somente leitura."
        : state.winner
        ? `${state.winner.nome} venceu a partida.`
        : state.isAiVsAiPaused
        ? "IA x IA pausado. Use o botao para retomar a partida automatica."
        : state.aiStepText || "IA avaliando o campo.";
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
      configPanel.hidden = state.isMatchStarted;
      configPanel.setAttribute("aria-hidden", String(state.isMatchStarted));
      configPanel.classList.toggle("is-locked", state.isMatchStarted);
    }

    if (heroElement) {
      heroElement.classList.toggle("is-match-started", state.isMatchStarted);
    }

    if (toggleLibraryButton && toggleRulesButton && toggleLogButton && toggleHistoryButton) {
      toggleLibraryButton.hidden = headlessMode;
      toggleRulesButton.hidden = headlessMode;
      toggleLogButton.hidden = headlessMode;
      toggleHistoryButton.hidden = headlessMode;
    }

    if (headlessAiPanel) {
      headlessAiPanel.hidden = !headlessMode;
    }

    if (boardElement) {
      boardElement.hidden = headlessMode;
      boardElement.setAttribute("aria-hidden", String(headlessMode));
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
    renderMatchHistory(state);
    renderHeadlessAiPanel(state);

    document.getElementById("player-bottom-panel").classList.toggle("active", matchStarted && renderedState.currentPlayerIndex === 0 && !renderedState.winner);
    document.getElementById("player-top-panel").classList.toggle("active", matchStarted && renderedState.currentPlayerIndex === 1 && !renderedState.winner);

    const winnerModal = document.getElementById("winner-modal");
    const winnerModalTitle = document.getElementById("winner-modal-title");
    const winnerModalText = document.getElementById("winner-modal-text");

    if (winnerModal && winnerModalTitle && winnerModalText) {
      winnerModal.setAttribute("aria-hidden", String(headlessMode || viewingHistory || !state.isWinnerModalOpen));
      if (state.winner) {
        winnerModalTitle.textContent = `${state.winner.nome} venceu`;
        winnerModalText.textContent = `${state.winner.nome} reduziu a vida rival a zero e venceu a partida.`;
      }
    }

    if (shouldRunHeadlessSimulation(state)) {
      scheduleHeadlessSimulationTick(state);
    } else {
      cancelHeadlessSimulation();
    }

    if (shouldRunAi(state)) {
      scheduleAiTurn(state);
    } else {
      cancelAiTurn(state);
    }
  }

  function bindUI() {
    const refreshRemoteHistoryAndRender = () => {
      const refreshResult = refreshRemoteMatchHistory(gameState);
      if (isPromiseLike(refreshResult)) {
        refreshResult.finally(() => {
          render(gameState);
        });
        return;
      }

      render(gameState);
    };

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

    document.getElementById("toggle-history-button").addEventListener("click", () => {
      toggleExclusiveSidePanel(gameState, "history");
      if (gameState.isHistoryOpen && gameState.historyViewMode === HISTORY_VIEW_MODES.REMOTE && gameState.remoteMatchHistoryStatus === REMOTE_MATCH_HISTORY_LOAD_STATUSES.IDLE) {
        refreshRemoteHistoryAndRender();
        return;
      }
      render(gameState);
    });

    document.getElementById("history-local-tab-button").addEventListener("click", () => {
      gameState.historyViewMode = HISTORY_VIEW_MODES.LOCAL;
      render(gameState);
    });

    document.getElementById("history-remote-tab-button").addEventListener("click", () => {
      gameState.historyViewMode = HISTORY_VIEW_MODES.REMOTE;
      if (gameState.remoteMatchHistoryStatus === REMOTE_MATCH_HISTORY_LOAD_STATUSES.IDLE) {
        refreshRemoteHistoryAndRender();
        return;
      }
      render(gameState);
    });

    document.getElementById("refresh-remote-history-button").addEventListener("click", () => {
      refreshRemoteHistoryAndRender();
    });

    document.getElementById("validate-log-button").addEventListener("click", () => {
      validateCurrentLog(gameState);
      render(gameState);
    });

    document.getElementById("copy-validation-issue-button").addEventListener("click", () => {
      const copyResult = copyFocusedLogValidationIssue(gameState);
      if (copyResult && typeof copyResult.then === "function") {
        copyResult.finally(() => {
          render(gameState);
        });
        return;
      }

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

    [
      { inputId: "player-1-human-alias", playerIndex: 0 },
      { inputId: "player-2-human-alias", playerIndex: 1 }
    ].forEach(({ inputId, playerIndex }) => {
      const input = document.getElementById(inputId);
      if (!input) {
        return;
      }

      const syncAlias = () => {
        if (gameState.isMatchStarted) {
          return;
        }

        gameState.humanAliases = setSessionHumanAlias(playerIndex, input.value);
        render(gameState);
      };

      input.addEventListener("input", syncAlias);
      input.addEventListener("change", syncAlias);
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

    const simulateAiMatchCountInput = document.getElementById("simulate-ai-match-count");
    if (simulateAiMatchCountInput) {
      const syncHeadlessBatchCount = () => {
        if (gameState.isMatchStarted) {
          return;
        }

        gameState.headlessBatchRequestedCount = normalizeHeadlessBatchCount(simulateAiMatchCountInput.value);
        render(gameState);
      };

      simulateAiMatchCountInput.addEventListener("input", syncHeadlessBatchCount);
      simulateAiMatchCountInput.addEventListener("change", syncHeadlessBatchCount);
    }

    document.getElementById("start-button").addEventListener("click", () => {
      if (gameState.isMatchStarted) {
        return;
      }

      cancelHeadlessSimulation();
      cancelAiTurn(gameState);
      gameState = startConfiguredMatch(gameState);
      render(gameState);
    });

    document.getElementById("simulate-ai-match-button").addEventListener("click", () => {
      if (gameState.isMatchStarted || !isAiControlledPlayer(gameState, 0) || !isAiControlledPlayer(gameState, 1)) {
        return;
      }

      cancelHeadlessSimulation();
      cancelAiTurn(gameState);
      const requestedCount = normalizeHeadlessBatchCount(
        simulateAiMatchCountInput ? simulateAiMatchCountInput.value : gameState.headlessBatchRequestedCount
      );
      gameState = startHeadlessAiBatch(gameState, requestedCount);
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
        confirmFn: typeof window !== "undefined" ? window.confirm.bind(window) : null,
        notifyFn: typeof window !== "undefined" ? window.alert.bind(window) : null
      });
      render(gameState);
    });

    document.getElementById("restart-button").addEventListener("click", () => {
      cancelHeadlessSimulation();
      cancelAiTurn(gameState);
      gameState = createRestartState(gameState, {
        notifyFn: typeof window !== "undefined" ? window.alert.bind(window) : null
      });
      render(gameState);
    });

    document.getElementById("winner-restart-button").addEventListener("click", () => {
      cancelHeadlessSimulation();
      cancelAiTurn(gameState);
      gameState = createRestartState(gameState, {
        notifyFn: typeof window !== "undefined" ? window.alert.bind(window) : null
      });
      render(gameState);
    });

    document.getElementById("close-winner-modal-button").addEventListener("click", () => {
      gameState.isWinnerModalOpen = false;
      render(gameState);
    });

    document.getElementById("restore-history-match-button").addEventListener("click", () => {
      const selectedRecord = getSelectedHistoryMatch(gameState);
      if (!selectedRecord) {
        return;
      }

      cancelHeadlessSimulation();
      cancelAiTurn(gameState);
      gameState = restoreMatchFromHistory(selectedRecord, gameState, {
        notifyFn: typeof window !== "undefined" ? window.alert.bind(window) : null,
        getState: () => gameState,
        renderFn: render
      });
      render(gameState);
    });

    document.getElementById("retry-remote-history-sync-button").addEventListener("click", () => {
      const selectedRecord = getSelectedHistoryMatch(gameState);
      if (!selectedRecord) {
        return;
      }

      const retryResult = syncSavedMatchRecordToRemote(gameState, selectedRecord.id, {
        showFeedback: true
      });
      if (isPromiseLike(retryResult)) {
        retryResult.finally(() => {
          render(gameState);
        });
        return;
      }

      render(gameState);
    });

    document.addEventListener("keydown", (event) => {
      if (!["a", "c", "e", "escape"].includes(event.key.toLowerCase())) {
        return;
      }

      const didHandle = handleShortcutAction(gameState, event.key, {
        repeat: event.repeat,
        target: event.target,
        confirmFn: typeof window !== "undefined" ? window.confirm.bind(window) : null,
        notifyFn: typeof window !== "undefined" ? window.alert.bind(window) : null
      });

      if (!didHandle) {
        return;
      }

      event.preventDefault();
      render(gameState);
    });
  }

  let gameState = createInitialState();
  gameState.matchHistory = loadMatchHistory();

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
      APP_VERSION,
      AI_STEP_DELAY_MS,
      HEADLESS_AI_BATCH_SIZE,
      HEADLESS_AI_BATCH_DEFAULT_MATCHES,
      HEADLESS_AI_BATCH_MAX_MATCHES,
      HEADLESS_BATCH_MODES,
      MATCH_KINDS,
      REMOTE_MATCH_SYNC_STATUSES,
      HISTORY_VIEW_MODES,
      REMOTE_MATCH_HISTORY_LOAD_STATUSES,
      REMOTE_MATCH_HISTORY_TABLE,
      MATCH_HISTORY_STORAGE_KEY,
      MAX_SAVED_MATCHES,
      MATCH_PRESENTATION_MODES,
      DECK_MODES,
      PLAYER_CONTROLLER_TYPES,
      LOG_VALIDATION_STATUS,
      LOG_EVENT_TYPES,
      CARD_LIBRARY,
      getSessionPlayerControllers,
      setSessionPlayerController,
      getSessionHumanAliases,
      setSessionHumanAliases,
      setSessionHumanAlias,
      getSessionDeckMode,
      setSessionDeckMode,
      getMatchKind,
      getMatchKindLabel,
      getEffectiveHumanAliases,
      getRemoteHistoryConfig,
      createDeck,
      shuffleDeck,
      createInitialState,
      loadMatchHistory,
      saveMatchHistory,
      createSavedMatchRecord,
      archiveCurrentMatchIfNeeded,
      buildRemoteMatchPayload,
      fetchRemoteMatchHistory,
      refreshRemoteMatchHistory,
      syncSavedMatchRecordToRemote,
      restoreMatchFromHistory,
      getSelectedHistoryMatch,
      getSelectedRemoteHistoryMatch,
      getSelectedHistoryLogEntry,
      selectHistoryMatch,
      selectRemoteHistoryMatch,
      getHistoryRestoreTarget,
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
      getAiControllerForPlayer,
      isAiControlledPlayer,
      isAiVsAiMatch,
      isHeadlessAiVsAiMode,
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
      getNextBaseAiAction,
      getNextSmartAiAction,
      getNextAiActionForController,
      getNextAiAction,
      executeAiAction,
      validateCurrentLog,
      buildLogValidationExportPayload,
      canCopyFocusedLogValidationIssue,
      selectLogValidationIssue,
      copyTextToClipboard,
      copyFocusedLogValidationIssue,
      startHeadlessAiBatch,
      startHeadlessAiMatch,
      finishHeadlessAiMatch,
      cancelHeadlessAiBatch,
      performAiStep,
      performHeadlessSimulationBatch,
      getUnitAttack,
      getAvailableAttackers,
      getDrawPile,
      getDiscardPileForPlayer,
      getPlayerDeckCount,
      getPlayerDeckTotal,
      getGlobalDeckCount,
      getGlobalDiscardCount,
      handleBoardUnitClick,
      enterDefenseMode,
      cancelDefenseMode,
      canUnitEnterDefense,
      canUnitCancelDefense,
      getMitigatedDamage
    };
  }
})();

