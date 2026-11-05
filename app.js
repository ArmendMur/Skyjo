"use strict";

// ============================================================================
// SkyJo Punkteblock – Hauptlogik (Funktioniert direkt per Doppelklick & GitHub Pages)
// ============================================================================
(() => {
  // Progressive Enhancement: Switch-Polyfill nur für Browser ohne natives <input switch>
  // (Nur über http/https laden, damit lokales Öffnen per file:// niemals durch CORS gestört wird)
  if (
    !("switch" in HTMLInputElement.prototype) &&
    location.protocol.startsWith("http")
  ) {
    import("https://cdn.jsdelivr.net/npm/input-switch-polyfill@1/+esm").catch(() => {});
  }

// Mandatory Fallback für <dialog closedby="any"> in Browsern ohne native closedBy-Unterstützung (z. B. Safari)
if (!("closedBy" in HTMLDialogElement.prototype)) {
  for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      dialog.close();
    });
  }
}

// ============================================================================
// Storage Keys & Konstanten
// ============================================================================
const STORAGE_KEYS = {
  SAVED_PLAYERS: "skyjo_saved_players_v1",
  ACTIVE_GAME: "skyjo_active_game_v1",
  SETTINGS: "skyjo_settings_v1",
  COLOR_SCHEME: "color-scheme",
};

const DEFAULT_TARGET_SCORE = 100;
const DEFAULT_PLAYER_COUNT = 4;

// Minimal gültiges 1x1 MP4-Video (stumm) NUR als Fallback für sehr alte iOS-Versionen (< iOS 16.4) ohne Wake Lock API
const TINY_MP4_DATA_URI =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjc5NSA2YWE5YzgwIC0gSC4yNjQvTVBFRy00 AVCIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDE3IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OHZjPTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz02IGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBubj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfTG9va2FoZWFkPTQwIHJjPWcrfG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAA7//728P4FNjuZ5AAAAM5tb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAABAEAAAE_______________8BAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAAAgbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWkaG9vAAAAHWRhdGEAAAABAAAAAExhdmY1Ny44My4xMDA=";

// ============================================================================
// Anwendungszustand
// ============================================================================
const state = {
  savedPlayers: loadJSON(STORAGE_KEYS.SAVED_PLAYERS, []),
  game: loadJSON(STORAGE_KEYS.ACTIVE_GAME, null),
  settings: {
    keepAwake: true,
    autoDoubling: true,
    ...loadJSON(STORAGE_KEYS.SETTINGS, {}),
  },
  setup: {
    playerCount: DEFAULT_PLAYER_COUNT,
    slots: ["", "", "", ""],
    deleteMode: false,
  },
  roundEditor: {
    editingIndex: null, // null = neue Runde, 0..N = bestehende Runde bearbeiten
    enderIndex: null,
  },
  toastTimer: null,
  lastDeletedPlayer: null,
};

// ============================================================================
// DOM-Referenzen
// ============================================================================
const dom = {
  setupView: document.getElementById("setup-view"),
  gameView: document.getElementById("game-view"),

  // Header & Wake Lock
  headerWakeSwitch: document.getElementById("header-wakelock-switch"),
  settingsWakeSwitch: document.getElementById("settings-wakelock-switch"),
  wakeDot: document.getElementById("wakelock-dot"),
  wakeStatusText: document.getElementById("wakelock-status-text"),
  wakeDetailText: document.getElementById("settings-wakelock-detail"),
  openPlayersBtn: document.getElementById("open-players-btn"),
  openSettingsBtn: document.getElementById("open-settings-btn"),

  // Setup View
  resumeBanner: document.getElementById("resume-game-banner"),
  resumeBannerDetails: document.getElementById("resume-banner-details"),
  resumeGameBtn: document.getElementById("resume-game-btn"),
  setupForm: document.getElementById("setup-form"),
  playerCountGroup: document.getElementById("player-count-group"),
  targetScoreInput: document.getElementById("target-score-input"),
  resetTargetBtn: document.getElementById("reset-target-btn"),
  savedRosterCard: document.getElementById("saved-roster-card"),
  savedRosterSubtitle: document.getElementById("saved-roster-subtitle"),
  toggleDeleteModeBtn: document.getElementById("toggle-delete-mode-btn"),
  savedChipsContainer: document.getElementById("saved-chips-container"),
  savedEmptyHint: document.getElementById("saved-empty-hint"),
  setupQuickAddInput: document.getElementById("setup-quick-add-input"),
  setupQuickAddBtn: document.getElementById("setup-quick-add-btn"),
  activeCountBadge: document.getElementById("active-count-badge"),
  clearAllSlotsBtn: document.getElementById("clear-all-slots-btn"),
  shufflePlayersBtn: document.getElementById("shuffle-players-btn"),
  playerSlotsContainer: document.getElementById("player-slots-container"),
  savedPlayersDatalist: document.getElementById("saved-players-datalist"),
  setupErrorMsg: document.getElementById("setup-error-msg"),

  // Game View
  gameHeading: document.getElementById("game-heading"),
  gameLimitDisplay: document.getElementById("game-limit-display"),
  editLastRoundBtn: document.getElementById("edit-last-round-btn"),
  newGameTopBtn: document.getElementById("new-game-top-btn"),
  gameOverBanner: document.getElementById("game-over-banner"),
  bannerWinnerTitle: document.getElementById("banner-winner-title"),
  bannerLoserSubtitle: document.getElementById("banner-loser-subtitle"),
  bannerRematchBtn: document.getElementById("banner-rematch-btn"),
  bannerChangePlayersBtn: document.getElementById("banner-change-players-btn"),
  leaderGapHint: document.getElementById("leader-gap-hint"),
  standingsList: document.getElementById("standings-list"),
  emptyRoundsState: document.getElementById("empty-rounds-state"),
  historyTableWrapper: document.getElementById("history-table-wrapper"),
  historyThead: document.getElementById("history-thead"),
  historyTbody: document.getElementById("history-tbody"),
  addRoundBtn: document.getElementById("add-round-btn"),

  // Round Dialog
  roundDialog: document.getElementById("round-dialog"),
  roundForm: document.getElementById("round-form"),
  roundDialogTitle: document.getElementById("round-dialog-title"),
  closeRoundDialogBtn: document.getElementById("close-round-dialog-btn"),
  cancelRoundBtn: document.getElementById("cancel-round-btn"),
  enderSection: document.getElementById("ender-section"),
  enderChipsContainer: document.getElementById("ender-chips-container"),
  doublingLiveNotice: document.getElementById("doubling-live-notice"),
  roundInputsContainer: document.getElementById("round-inputs-container"),
  roundFormError: document.getElementById("round-form-error"),
  deleteRoundBtn: document.getElementById("delete-round-btn"),

  // Winner Dialog
  winnerDialog: document.getElementById("winner-dialog"),
  winnerDialogSubtitle: document.getElementById("winner-dialog-subtitle"),
  winnerSpotlight: document.getElementById("winner-spotlight"),
  finalRankingList: document.getElementById("final-ranking-list"),
  matchHighlights: document.getElementById("match-highlights"),
  modalRematchBtn: document.getElementById("modal-rematch-btn"),
  modalNewSetupBtn: document.getElementById("modal-new-setup-btn"),

  // Players Manager Dialog
  playersDialog: document.getElementById("players-dialog"),
  quickAddForm: document.getElementById("quick-add-player-form"),
  quickAddInput: document.getElementById("quick-add-input"),
  savedManagerList: document.getElementById("saved-manager-list"),
  savedManagerEmpty: document.getElementById("saved-manager-empty"),
  resetStatsOnlyBtn: document.getElementById("reset-stats-only-btn"),

  // Settings Dialog
  settingsDialog: document.getElementById("settings-dialog"),
  settingsDoublingSwitch: document.getElementById("settings-doubling-switch"),
  themeSelector: document.getElementById("theme-selector"),
  themeSystemLabel: document.getElementById("theme-system-label"),

  // Toast
  toastRegion: document.getElementById("toast-region"),
};

// ============================================================================
// Hilfsfunktionen: LocalStorage & Datenformatierung
// ============================================================================
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Ignoriere Quota-/Privatmodus-Fehler lautlos
  }
}

function normalizeName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

function skyjoColorClass(score) {
  if (score < 0) return "sp-neg";
  if (score === 0) return "sp-zero";
  if (score <= 8) return "sp-low";
  if (score <= 16) return "sp-mid";
  return "sp-high";
}

// ============================================================================
// Safari / Mobile Display-Wachhalter (Screen Wake Lock API + Fallback)
// ============================================================================
let wakeLockSentinel = null;
let fallbackVideoEl = null;
let wakeLockBlockedByOS = false;

function updateWakeLockUI() {
  dom.headerWakeSwitch.checked = state.settings.keepAwake;
  dom.settingsWakeSwitch.checked = state.settings.keepAwake;

  dom.wakeDot.classList.remove("is-active", "is-pending");

  if (!state.settings.keepAwake) {
    dom.wakeStatusText.textContent = "Display: Aus";
    return;
  }

  const isLocked = Boolean(
    (wakeLockSentinel && !wakeLockSentinel.released) ||
      (fallbackVideoEl && !fallbackVideoEl.paused)
  );

  if (isLocked) {
    dom.wakeDot.classList.add("is-active");
    dom.wakeStatusText.textContent = "Display wach";
    dom.wakeDetailText.textContent =
      "Aktiv: Dein Handy-Display bleibt geöffnet, solange Safari im Vordergrund ist.";
  } else {
    dom.wakeDot.classList.add("is-pending");
    dom.wakeStatusText.textContent = wakeLockBlockedByOS
      ? "Display (Sparmodus?)"
      : "Display an";
    dom.wakeDetailText.textContent = wakeLockBlockedByOS
      ? "Hinweis: iOS blockiert den Wachhalter eventuell wegen aktivem Stromsparmodus. Tippe auf den Bildschirm, um es erneut zu versuchen."
      : "Bereit: Wird beim nächsten Antippen sofort aktiviert, damit dein Display in Safari an bleibt.";
  }
}

async function acquireWakeLock() {
  if (!state.settings.keepAwake || document.visibilityState !== "visible") {
    updateWakeLockUI();
    return;
  }

  // Moderne Browser & iOS Safari ab 16.4: Native Screen Wake Lock API (stört keine Hintergrundmusik!)
  if ("wakeLock" in navigator) {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      updateWakeLockUI();
      return;
    }
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockBlockedByOS = false;
      wakeLockSentinel.addEventListener("release", () => {
        updateWakeLockUI();
      });
      updateWakeLockUI();
      return;
    } catch {
      wakeLockBlockedByOS = true;
      updateWakeLockUI();
      return;
    }
  }

  // Fallback nur für sehr alte Browser ohne navigator.wakeLock
  try {
    if (!fallbackVideoEl) {
      fallbackVideoEl = document.createElement("video");
      fallbackVideoEl.setAttribute("playsinline", "");
      fallbackVideoEl.setAttribute("muted", "");
      fallbackVideoEl.muted = true;
      fallbackVideoEl.loop = true;
      fallbackVideoEl.src = TINY_MP4_DATA_URI;
      fallbackVideoEl.style.position = "fixed";
      fallbackVideoEl.style.width = "1px";
      fallbackVideoEl.style.height = "1px";
      fallbackVideoEl.style.opacity = "0";
      fallbackVideoEl.style.pointerEvents = "none";
      document.body.appendChild(fallbackVideoEl);
    }
    await fallbackVideoEl.play();
    wakeLockBlockedByOS = false;
  } catch {
    wakeLockBlockedByOS = true;
  }
  updateWakeLockUI();
}

async function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
  if (fallbackVideoEl) {
    try {
      fallbackVideoEl.pause();
    } catch {}
  }
  updateWakeLockUI();
}

function setKeepAwakePreference(enabled) {
  state.settings.keepAwake = Boolean(enabled);
  saveJSON(STORAGE_KEYS.SETTINGS, state.settings);
  if (state.settings.keepAwake) {
    acquireWakeLock();
  } else {
    releaseWakeLock();
  }
}

// Re-akquiriere Wake Lock nach Tab-Wechsel oder Sperrbildschirm in Safari
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.settings.keepAwake) {
    acquireWakeLock();
  } else {
    updateWakeLockUI();
  }
});

// Safari verlangt manchmal eine Nutzer-Geste (Touch/Klick), um den Wake Lock zu aktivieren
for (const evtName of ["pointerdown", "touchend", "keydown"]) {
  document.addEventListener(
    evtName,
    () => {
      if (
        state.settings.keepAwake &&
        (!wakeLockSentinel || wakeLockSentinel.released) &&
        (!fallbackVideoEl || fallbackVideoEl.paused)
      ) {
        acquireWakeLock();
      }
    },
    { passive: true }
  );
}

// ============================================================================
// Farbschema (System / Hell / Dunkel) – konform zu modern-web-guidance
// ============================================================================
const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

function updateSystemThemeLabel() {
  const sysText = darkMediaQuery.matches ? "System (Dunkel)" : "System (Hell)";
  dom.themeSystemLabel.textContent = sysText;
}

function syncThemeControlsFromStorage() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEYS.COLOR_SCHEME);
  } catch {}
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (stored === "light" || stored === "dark") {
    meta.content = stored;
    const radio = dom.themeSelector.querySelector(`input[value="${stored}"]`);
    if (radio) radio.checked = true;
  } else {
    meta.content = "light dark";
    const sysRadio = dom.themeSelector.querySelector('input[value="system"]');
    if (sysRadio) sysRadio.checked = true;
  }
  updateSystemThemeLabel();
}

function applyThemeChoice(choice) {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (choice === "light" || choice === "dark") {
    meta.content = choice;
    try {
      localStorage.setItem(STORAGE_KEYS.COLOR_SCHEME, choice);
    } catch {}
  } else {
    meta.content = "light dark";
    try {
      localStorage.removeItem(STORAGE_KEYS.COLOR_SCHEME);
    } catch {}
  }
}

darkMediaQuery.addEventListener("change", updateSystemThemeLabel);
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEYS.COLOR_SCHEME) {
    syncThemeControlsFromStorage();
  }
});

// ============================================================================
// Toast-Benachrichtigungen (inkl. Rückgängig beim Spieler-Löschen)
// ============================================================================
function showToast(message, undoLabel = null, onUndo = null) {
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }
  dom.toastRegion.replaceChildren();

  const card = document.createElement("div");
  card.className = "toast-card";

  const span = document.createElement("span");
  span.textContent = message;
  card.appendChild(span);

  if (undoLabel && typeof onUndo === "function") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-undo-btn";
    btn.textContent = undoLabel;
    btn.addEventListener("click", () => {
      clearTimeout(state.toastTimer);
      dom.toastRegion.replaceChildren();
      onUndo();
    });
    card.appendChild(btn);
  }

  dom.toastRegion.appendChild(card);
  state.toastTimer = setTimeout(() => {
    dom.toastRegion.replaceChildren();
  }, 5500);
}

// ============================================================================
// Gespeicherte Spieler verwalten (Speichern, Vorschlagen, Löschen, Statistik)
// ============================================================================
function getSortedSavedPlayers() {
  return [...state.savedPlayers].sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

function saveRoster() {
  saveJSON(STORAGE_KEYS.SAVED_PLAYERS, state.savedPlayers);
}

function upsertSavedPlayer(rawName, markUsed = false) {
  const clean = normalizeName(rawName);
  if (!clean) return null;

  const existing = state.savedPlayers.find(
    (p) => p.name.toLowerCase() === clean.toLowerCase()
  );
  if (existing) {
    existing.name = clean;
    if (markUsed) existing.lastUsedAt = Date.now();
    saveRoster();
    return existing;
  }

  const created = {
    name: clean,
    lastUsedAt: markUsed ? Date.now() : Date.now() - 1000,
    games: 0,
    wins: 0,
    bestRound: null,
  };
  state.savedPlayers.push(created);
  saveRoster();
  return created;
}

function deleteSavedPlayerByName(name) {
  const idx = state.savedPlayers.findIndex(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (idx === -1) return;

  const [removed] = state.savedPlayers.splice(idx, 1);
  state.lastDeletedPlayer = removed;
  saveRoster();

  // Falls der Name gerade in einem Setup-Feld stand, leere dieses Feld
  for (let i = 0; i < state.setup.slots.length; i++) {
    if (normalizeName(state.setup.slots[i]).toLowerCase() === removed.name.toLowerCase()) {
      state.setup.slots[i] = "";
    }
  }

  if (state.savedPlayers.length === 0) {
    state.setup.deleteMode = false;
  }

  renderSetupRosterAndSlots();
  renderPlayersManagerModal();

  showToast(`„${removed.name}“ aus gespeicherten Spielern gelöscht`, "Rückgängig", () => {
    if (!state.lastDeletedPlayer) return;
    state.savedPlayers.push(state.lastDeletedPlayer);
    state.lastDeletedPlayer = null;
    saveRoster();
    renderSetupRosterAndSlots();
    renderPlayersManagerModal();
  });
}

// ============================================================================
// Setup-Ansicht: Spieleranzahl (Standard: 4), Chips & Eingabefelder
// ============================================================================
function initSetupDefaults(prefillFromSaved = true) {
  state.setup.playerCount = DEFAULT_PLAYER_COUNT;
  state.setup.deleteMode = false;

  const countRadio = dom.playerCountGroup.querySelector(
    `input[value="${DEFAULT_PLAYER_COUNT}"]`
  );
  if (countRadio) countRadio.checked = true;

  dom.targetScoreInput.value = String(DEFAULT_TARGET_SCORE);
  dom.resetTargetBtn.hidden = true;

  const sorted = getSortedSavedPlayers();
  state.setup.slots = Array.from({ length: DEFAULT_PLAYER_COUNT }, (_, idx) =>
    prefillFromSaved && sorted[idx] ? sorted[idx].name : ""
  );
}

function setSetupPlayerCount(newCount) {
  const count = Math.min(8, Math.max(2, Number(newCount) || DEFAULT_PLAYER_COUNT));
  state.setup.playerCount = count;

  const radio = dom.playerCountGroup.querySelector(`input[value="${count}"]`);
  if (radio) radio.checked = true;

  while (state.setup.slots.length < count) {
    state.setup.slots.push("");
  }
  if (state.setup.slots.length > count) {
    state.setup.slots.length = count;
  }

  renderSetupRosterAndSlots();
}

function findSlotIndexForName(name) {
  const target = normalizeName(name).toLowerCase();
  if (!target) return -1;
  return state.setup.slots.findIndex(
    (slotVal) => normalizeName(slotVal).toLowerCase() === target
  );
}

function handleSavedChipClick(playerName) {
  if (state.setup.deleteMode) {
    deleteSavedPlayerByName(playerName);
    return;
  }

  dom.setupErrorMsg.hidden = true;
  const existingSlot = findSlotIndexForName(playerName);

  // Bereits ausgewählt -> aus Slot entfernen
  if (existingSlot !== -1) {
    state.setup.slots[existingSlot] = "";
    renderSetupRosterAndSlots();
    return;
  }

  // Ersten freien Slot belegen
  const emptySlot = state.setup.slots.findIndex((s) => !normalizeName(s));
  if (emptySlot !== -1) {
    state.setup.slots[emptySlot] = playerName;
    renderSetupRosterAndSlots();
    return;
  }

  // Falls alle aktuellen Slots voll sind und < 8 Spieler -> automatisch 1 Platz ergänzen
  if (state.setup.playerCount < 8) {
    state.setup.playerCount += 1;
    state.setup.slots.push(playerName);
    const radio = dom.playerCountGroup.querySelector(
      `input[value="${state.setup.playerCount}"]`
    );
    if (radio) radio.checked = true;
    renderSetupRosterAndSlots();
  } else {
    showToast("Maximal 8 Spieler möglich – tippe zuerst einen aktiven Namen ab.");
  }
}

function renderSetupRosterAndSlots() {
  // Paused-Game-Banner prüfen
  if (state.game && !state.game.isFinished) {
    dom.resumeBanner.hidden = false;
    const rNum = state.game.rounds.length + 1;
    dom.resumeBannerDetails.textContent = `${state.game.players.join(", ")} • Runde ${rNum}`;
  } else {
    dom.resumeBanner.hidden = true;
  }

  dom.activeCountBadge.textContent = String(state.setup.playerCount);

  // Datalist aktualisieren
  dom.savedPlayersDatalist.replaceChildren();
  const sortedSaved = getSortedSavedPlayers();
  for (const p of sortedSaved) {
    const opt = document.createElement("option");
    opt.value = p.name;
    dom.savedPlayersDatalist.appendChild(opt);
  }

  // Gespeicherte Spieler Chips rendern
  dom.savedChipsContainer.replaceChildren();
  if (sortedSaved.length === 0) {
    dom.savedEmptyHint.hidden = false;
    dom.toggleDeleteModeBtn.hidden = true;
    dom.savedRosterSubtitle.textContent = "Automatischer Namensspeicher für nächste Runden";
  } else {
    dom.savedEmptyHint.hidden = true;
    dom.toggleDeleteModeBtn.hidden = false;
    dom.toggleDeleteModeBtn.setAttribute(
      "aria-pressed",
      state.setup.deleteMode ? "true" : "false"
    );
    dom.toggleDeleteModeBtn.textContent = state.setup.deleteMode
      ? "Fertig"
      : "Spieler löschen";
    dom.savedRosterSubtitle.textContent = state.setup.deleteMode
      ? "Tippe auf eine Person, um sie dauerhaft aus der Liste zu löschen:"
      : "Antippen zum Aus- oder Abwählen für diese Runde:";

    for (const p of sortedSaved) {
      const seatIdx = findSlotIndexForName(p.name);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "saved-chip";

      if (state.setup.deleteMode) {
        chip.classList.add("is-delete-mode");
        chip.setAttribute("aria-label", `Gespeicherten Spieler ${p.name} löschen`);
        const nameSpan = document.createElement("span");
        nameSpan.textContent = p.name;
        const delIcon = document.createElement("span");
        delIcon.className = "saved-chip-del-icon";
        delIcon.setAttribute("aria-hidden", "true");
        delIcon.textContent = "🗑";
        chip.append(nameSpan, delIcon);
      } else {
        if (seatIdx !== -1) {
          chip.classList.add("is-selected");
          const badge = document.createElement("span");
          badge.className = "saved-chip-seat";
          badge.textContent = String(seatIdx + 1);
          chip.appendChild(badge);
        }
        const nameSpan = document.createElement("span");
        nameSpan.textContent = p.name;
        chip.appendChild(nameSpan);
        chip.setAttribute("aria-pressed", seatIdx !== -1 ? "true" : "false");
      }

      chip.addEventListener("click", () => handleSavedChipClick(p.name));
      dom.savedChipsContainer.appendChild(chip);
    }
  }

  // Spieler-Eingabefelder rendern
  dom.playerSlotsContainer.replaceChildren();
  for (let i = 0; i < state.setup.playerCount; i++) {
    const row = document.createElement("div");
    row.className = "player-slot-row";

    const badge = document.createElement("span");
    badge.className = `seat-badge seat-${i % 8}`;
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = String(i + 1);

    const wrap = document.createElement("div");
    wrap.className = "slot-input-wrapper";

    const label = document.createElement("label");
    const inputId = `player-slot-input-${i}`;
    label.htmlFor = inputId;
    label.className = "visually-hidden";
    label.textContent = `Name von Spieler ${i + 1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.id = inputId;
    input.name = `player_${i}`;
    input.value = state.setup.slots[i] ?? "";
    input.placeholder = `Spieler ${i + 1} – Name eingeben`;
    input.maxLength = 24;
    input.setAttribute("list", "saved-players-datalist");
    input.setAttribute("enterkeyhint", i === state.setup.playerCount - 1 ? "done" : "next");
    input.autocomplete = "off";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "slot-clear-btn";
    clearBtn.setAttribute("aria-label", `Feld Spieler ${i + 1} leeren`);
    clearBtn.textContent = "✕";
    clearBtn.hidden = !input.value.trim();

    input.addEventListener("input", () => {
      state.setup.slots[i] = input.value;
      clearBtn.hidden = !input.value.trim();
      dom.setupErrorMsg.hidden = true;
      refreshSavedChipsSelectionOnly();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        if (i < state.setup.playerCount - 1) {
          e.preventDefault();
          const nextInput = document.getElementById(`player-slot-input-${i + 1}`);
          nextInput?.focus();
        }
      }
    });

    clearBtn.addEventListener("click", () => {
      state.setup.slots[i] = "";
      input.value = "";
      clearBtn.hidden = true;
      refreshSavedChipsSelectionOnly();
      input.focus();
    });

    wrap.append(label, input, clearBtn);
    row.append(badge, wrap);
    dom.playerSlotsContainer.appendChild(row);
  }
}

function refreshSavedChipsSelectionOnly() {
  if (state.setup.deleteMode) return;
  const sortedSaved = getSortedSavedPlayers();
  const buttons = dom.savedChipsContainer.querySelectorAll(".saved-chip");
  buttons.forEach((btn, idx) => {
    const p = sortedSaved[idx];
    if (!p) return;
    const seatIdx = findSlotIndexForName(p.name);
    btn.replaceChildren();
    btn.classList.toggle("is-selected", seatIdx !== -1);
    btn.setAttribute("aria-pressed", seatIdx !== -1 ? "true" : "false");
    if (seatIdx !== -1) {
      const badge = document.createElement("span");
      badge.className = "saved-chip-seat";
      badge.textContent = String(seatIdx + 1);
      btn.appendChild(badge);
    }
    const nameSpan = document.createElement("span");
    nameSpan.textContent = p.name;
    btn.appendChild(nameSpan);
  });
}

// ============================================================================
// Spielstart, Statistik-Synchronisierung & Punktestand-Berechnung
// ============================================================================
function startNewGame(playerNames, targetScore) {
  // Falls ein altes beendetes Spiel Statistik gebucht hatte, bleibt sie erhalten
  const baseTime = Date.now();
  playerNames.forEach((name, idx) => {
    const p = upsertSavedPlayer(name, false);
    // Reihenfolge beibehalten: Platz 1 hat höchsten Timestamp für zukünftige Vorauswahl
    if (p) p.lastUsedAt = baseTime + (playerNames.length - idx);
  });
  saveRoster();

  state.game = {
    id: String(Date.now()),
    createdAt: Date.now(),
    targetScore: targetScore,
    players: [...playerNames],
    rounds: [],
    isFinished: false,
    statsSnapshot: null,
  };

  saveJSON(STORAGE_KEYS.ACTIVE_GAME, state.game);
  acquireWakeLock();
  showView("game");
  renderGameView();
}

function computeTotals(game = state.game) {
  if (!game) return [];
  const totals = game.players.map(() => 0);
  for (const round of game.rounds) {
    round.finalScores.forEach((pts, idx) => {
      totals[idx] += pts;
    });
  }
  return totals;
}

function syncGameCompletionAndStats() {
  const game = state.game;
  if (!game) return false;

  // Zuerst evtl. bisherigen Statistik-Snapshot dieses Spiels zurücknehmen (für saubere Korrekturen)
  if (game.statsSnapshot) {
    for (const entry of game.statsSnapshot.entries) {
      const saved = state.savedPlayers.find(
        (p) => p.name.toLowerCase() === entry.name.toLowerCase()
      );
      if (saved) {
        saved.games = Math.max(0, (saved.games || 0) - 1);
        if (entry.won) {
          saved.wins = Math.max(0, (saved.wins || 0) - 1);
        }
        saved.bestRound = entry.prevBestRound;
      }
    }
    game.statsSnapshot = null;
  }

  const totals = computeTotals(game);
  const reachedLimit = game.rounds.length > 0 && totals.some((t) => t >= game.targetScore);
  const wasFinishedBefore = game.isFinished;
  game.isFinished = reachedLimit;

  if (reachedLimit) {
    const minScore = Math.min(...totals);
    const snapshotEntries = [];

    game.players.forEach((name, pIdx) => {
      const saved = upsertSavedPlayer(name, false);
      if (!saved) return;

      const prevBest = saved.bestRound ?? null;
      const won = totals[pIdx] === minScore;
      saved.games = (saved.games || 0) + 1;
      if (won) saved.wins = (saved.wins || 0) + 1;

      for (const r of game.rounds) {
        const sc = r.finalScores[pIdx];
        if (saved.bestRound === null || saved.bestRound === undefined || sc < saved.bestRound) {
          saved.bestRound = sc;
        }
      }

      snapshotEntries.push({
        name,
        won,
        prevBestRound: prevBest,
      });
    });

    game.statsSnapshot = { entries: snapshotEntries };
    saveRoster();
  } else {
    saveRoster();
  }

  saveJSON(STORAGE_KEYS.ACTIVE_GAME, game);
  return !wasFinishedBefore && reachedLimit;
}

// ============================================================================
// Spielansicht rendern (Rangliste, Fortschrittsbalken, Runden-Tabelle)
// ============================================================================
function showView(viewName) {
  if (viewName === "game" && state.game) {
    dom.setupView.hidden = true;
    dom.gameView.hidden = false;
  } else {
    dom.gameView.hidden = true;
    dom.setupView.hidden = false;
    renderSetupRosterAndSlots();
  }
}

function renderGameView() {
  const game = state.game;
  if (!game) {
    showView("setup");
    return;
  }

  const totals = computeTotals(game);
  const roundCount = game.rounds.length;

  // Kopfbereich
  dom.gameHeading.textContent = game.isFinished
    ? `Endstand (${roundCount} ${roundCount === 1 ? "Runde" : "Runden"})`
    : `Runde ${roundCount + 1}`;
  dom.gameLimitDisplay.textContent = `Verliergrenze: ${game.targetScore} Pkt.`;
  dom.editLastRoundBtn.hidden = roundCount === 0;

  // Sortierte Rangliste berechnen (wenigste Punkte = Platz 1!)
  const rankedPlayers = game.players
    .map((name, seatIdx) => ({
      name,
      seatIdx,
      total: totals[seatIdx],
    }))
    .sort((a, b) => a.total - b.total || a.seatIdx - b.seatIdx);

  const minTotal = rankedPlayers[0]?.total ?? 0;

  // Spielende-Banner aktualisieren
  if (game.isFinished) {
    dom.gameOverBanner.hidden = false;
    const winners = rankedPlayers.filter((p) => p.total === minTotal);
    const busted = rankedPlayers.filter((p) => p.total >= game.targetScore);

    dom.bannerWinnerTitle.textContent =
      winners.length === 1
        ? `${winners[0].name} gewinnt mit ${minTotal} Punkten!`
        : `Gleichstand! ${winners.map((w) => w.name).join(" & ")} (${minTotal} Pkt.)`;

    dom.bannerLoserSubtitle.textContent =
      busted.length > 0
        ? `Über ${game.targetScore} Punkte: ${busted
            .map((b) => `${b.name} (${b.total})`)
            .join(", ")}`
        : "";

    dom.addRoundBtn.textContent = "🔄 Revanche (gleiche Spieler)";
  } else {
    dom.gameOverBanner.hidden = true;
    dom.addRoundBtn.textContent = `＋ Runde ${roundCount + 1} eintragen`;
  }

  // Standings rendern (mit exakter Ranganzeige bei Gleichstand)
  dom.standingsList.replaceChildren();
  let currentRank = 1;
  rankedPlayers.forEach((p, idx) => {
    if (idx > 0 && p.total > rankedPlayers[idx - 1].total) {
      currentRank = idx + 1;
    }

    const row = document.createElement("div");
    row.className = "standing-row";
    if (roundCount > 0 && currentRank === 1 && p.total < game.targetScore) {
      row.classList.add("is-leader");
    }
    if (p.total >= game.targetScore) {
      row.classList.add("is-busted");
    }

    const top = document.createElement("div");
    top.className = "standing-top";

    const identity = document.createElement("div");
    identity.className = "standing-identity";

    const medal = document.createElement("span");
    medal.className = "rank-medal";
    if (roundCount === 0) {
      medal.textContent = `${p.seatIdx + 1}.`;
    } else if (currentRank === 1) {
      medal.textContent = "🥇";
    } else if (currentRank === 2) {
      medal.textContent = "🥈";
    } else if (currentRank === 3) {
      medal.textContent = "🥉";
    } else {
      medal.textContent = `${currentRank}.`;
    }

    const seatDot = document.createElement("span");
    seatDot.className = `seat-badge seat-${p.seatIdx % 8}`;
    seatDot.style.inlineSize = "1.45rem";
    seatDot.style.blockSize = "1.45rem";
    seatDot.style.fontSize = "0.72rem";
    seatDot.setAttribute("aria-hidden", "true");
    seatDot.textContent = String(p.seatIdx + 1);

    const nameEl = document.createElement("span");
    nameEl.className = "standing-name";
    nameEl.textContent = p.name;

    identity.append(medal, seatDot, nameEl);

    const scoreWrap = document.createElement("div");
    scoreWrap.className = "standing-score-wrap";

    const scoreVal = document.createElement("span");
    scoreVal.className = "standing-score";
    scoreVal.textContent = String(p.total);

    const unit = document.createElement("span");
    unit.className = "standing-pts-unit";
    unit.textContent = "Pkt.";

    scoreWrap.append(scoreVal, unit);
    top.append(identity, scoreWrap);

    // Fortschrittsbalken Richtung 100 Punkte
    const pct = Math.max(0, Math.min(100, (p.total / game.targetScore) * 100));
    const track = document.createElement("div");
    track.className = "progress-track";
    const fill = document.createElement("div");
    fill.className = "progress-fill";
    if (pct >= 85) fill.classList.add("pf-danger");
    else if (pct >= 65) fill.classList.add("pf-warn");
    else if (pct >= 40) fill.classList.add("pf-mid");
    else fill.classList.add("pf-safe");
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    // Zusatzinfos unter dem Balken
    const meta = document.createElement("div");
    meta.className = "standing-meta";

    const diffSpan = document.createElement("span");
    if (roundCount === 0) {
      diffSpan.textContent = `Sitzplatz ${p.seatIdx + 1}`;
    } else if (p.total === minTotal) {
      diffSpan.textContent = "👑 Niedrigste Punkte";
    } else {
      const gap = p.total - minTotal;
      diffSpan.textContent = `+${gap} auf Platz 1`;
    }

    const remSpan = document.createElement("span");
    const remaining = game.targetScore - p.total;
    if (remaining <= 0) {
      remSpan.textContent = `💥 Limit (${game.targetScore}) erreicht!`;
    } else if (remaining <= 20) {
      remSpan.textContent = `⚠️ Nur noch ${remaining} bis ${game.targetScore}`;
    } else {
      remSpan.textContent = `Noch ${remaining} bis ${game.targetScore}`;
    }

    meta.append(diffSpan, remSpan);
    row.append(top, track, meta);
    dom.standingsList.appendChild(row);
  });

  // Rundenverlauf-Tabelle rendern
  if (roundCount === 0) {
    dom.emptyRoundsState.hidden = false;
    dom.historyTableWrapper.hidden = true;
  } else {
    dom.emptyRoundsState.hidden = true;
    dom.historyTableWrapper.hidden = false;

    dom.historyThead.replaceChildren();
    const headTr = document.createElement("tr");
    const thRound = document.createElement("th");
    thRound.scope = "col";
    thRound.textContent = "Runde";
    headTr.appendChild(thRound);

    game.players.forEach((name, idx) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = `${name} (${totals[idx]})`;
      headTr.appendChild(th);
    });
    dom.historyThead.appendChild(headTr);

    dom.historyTbody.replaceChildren();
    const running = game.players.map(() => 0);

    game.rounds.forEach((round, rIdx) => {
      const tr = document.createElement("tr");
      tr.title = `Runde ${rIdx + 1} antippen zum Bearbeiten`;

      const rowTh = document.createElement("th");
      rowTh.scope = "row";
      rowTh.textContent = `#${rIdx + 1} ✎`;
      tr.appendChild(rowTh);

      round.finalScores.forEach((pts, pIdx) => {
        running[pIdx] += pts;
        const td = document.createElement("td");
        const stack = document.createElement("div");
        stack.className = "cell-stack";

        const badgeWrap = document.createElement("div");
        const pill = document.createElement("span");
        pill.className = `skyjo-pill ${skyjoColorClass(pts)}`;
        pill.textContent = pts > 0 ? `+${pts}` : String(pts);
        badgeWrap.appendChild(pill);

        if (round.doubledIndex === pIdx) {
          const x2 = document.createElement("span");
          x2.className = "doubled-tag";
          x2.title = `Verdoppelt von ${round.rawScores[pIdx]} auf ${pts}`;
          x2.textContent = "×2";
          badgeWrap.appendChild(x2);
        }

        const sub = document.createElement("span");
        sub.className = "cell-subtotal";
        sub.textContent = `∑ ${running[pIdx]}`;

        stack.append(badgeWrap, sub);
        td.appendChild(stack);
        tr.appendChild(td);
      });

      tr.addEventListener("click", () => openRoundDialog(rIdx));
      dom.historyTbody.appendChild(tr);
    });
  }
}

// ============================================================================
// Runden-Dialog: Punkte eintragen, ± Minus-Button & SkyJo-Verdopplungsregel
// ============================================================================
function parseScoreText(rawText) {
  const cleaned = String(rawText ?? "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;
  if (!/^-?\d+$/.test(cleaned)) return NaN;
  return Number.parseInt(cleaned, 10);
}

function evaluateRoundDoubling(rawScores, enderIndex) {
  if (
    !state.settings.autoDoubling ||
    enderIndex === null ||
    enderIndex === undefined ||
    enderIndex < 0
  ) {
    return { doubledIndex: null, finalScores: [...rawScores] };
  }

  const enderScore = rawScores[enderIndex];
  if (typeof enderScore !== "number" || Number.isNaN(enderScore) || enderScore <= 0) {
    return { doubledIndex: null, finalScores: [...rawScores] };
  }

  const otherScores = rawScores.filter((_, idx) => idx !== enderIndex);
  if (otherScores.some((s) => typeof s !== "number" || Number.isNaN(s))) {
    return { doubledIndex: null, finalScores: [...rawScores] };
  }

  const minOther = Math.min(...otherScores);
  // Offizielle SkyJo-Regel: Rundenbeender muss ALLEIN die niedrigste Punktzahl haben (< minOther)
  if (enderScore >= minOther) {
    const finalScores = [...rawScores];
    finalScores[enderIndex] = enderScore * 2;
    return { doubledIndex: enderIndex, finalScores };
  }

  return { doubledIndex: null, finalScores: [...rawScores] };
}

function updateLiveDoublingPreview() {
  const game = state.game;
  if (!game || !state.settings.autoDoubling || state.roundEditor.enderIndex === null) {
    dom.doublingLiveNotice.hidden = true;
    return;
  }

  const inputs = [...dom.roundInputsContainer.querySelectorAll(".score-input")];
  const parsed = inputs.map((inp) => parseScoreText(inp.value));
  const enderIdx = state.roundEditor.enderIndex;
  const enderName = game.players[enderIdx];
  const enderVal = parsed[enderIdx];

  if (enderVal === null || Number.isNaN(enderVal)) {
    dom.doublingLiveNotice.hidden = false;
    dom.doublingLiveNotice.className = "doubling-notice is-safe";
    dom.doublingLiveNotice.textContent = `${enderName} hat die Runde beendet – trage alle Punkte ein, um die Verdopplungsregel zu prüfen.`;
    return;
  }

  if (enderVal <= 0) {
    dom.doublingLiveNotice.hidden = false;
    dom.doublingLiveNotice.className = "doubling-notice is-safe";
    dom.doublingLiveNotice.textContent = `✓ ${enderName} hat ${enderVal} Punkte (≤ 0 werden bei SkyJo nie verdoppelt).`;
    return;
  }

  const otherValid = parsed.filter((v, idx) => idx !== enderIdx && v !== null && !Number.isNaN(v));
  if (otherValid.length < game.players.length - 1) {
    dom.doublingLiveNotice.hidden = false;
    dom.doublingLiveNotice.className = "doubling-notice is-safe";
    dom.doublingLiveNotice.textContent = `${enderName} hat ${enderVal} Punkte – warte auf restliche Spielerpunkte…`;
    return;
  }

  const minOther = Math.min(...otherValid);
  if (enderVal >= minOther) {
    dom.doublingLiveNotice.hidden = false;
    dom.doublingLiveNotice.className = "doubling-notice is-doubled";
    dom.doublingLiveNotice.textContent = `⚡ Nicht allein niedrigste Punktzahl! Positive Punkte von ${enderName} werden verdoppelt (${enderVal} × 2 = ${enderVal * 2} Pkt.).`;
  } else {
    dom.doublingLiveNotice.hidden = false;
    dom.doublingLiveNotice.className = "doubling-notice is-safe";
    dom.doublingLiveNotice.textContent = `✓ ${enderName} hat allein die niedrigste Punktzahl (${enderVal} Pkt.) – keine Verdopplung!`;
  }
}

function openRoundDialog(roundIndex = null) {
  const game = state.game;
  if (!game) return;

  state.roundEditor.editingIndex = roundIndex;
  const existingRound = roundIndex !== null ? game.rounds[roundIndex] : null;
  state.roundEditor.enderIndex = existingRound ? existingRound.enderIndex ?? null : null;

  const displayRoundNumber = roundIndex !== null ? roundIndex + 1 : game.rounds.length + 1;
  dom.roundDialogTitle.textContent =
    roundIndex !== null
      ? `Runde ${displayRoundNumber} bearbeiten`
      : `Runde ${displayRoundNumber} eintragen`;

  dom.deleteRoundBtn.hidden = roundIndex === null;
  dom.roundFormError.hidden = true;

  // Rundenbeender-Auswahl nur anzeigen, wenn in Einstellungen aktiviert
  dom.enderSection.hidden = !state.settings.autoDoubling;
  dom.enderChipsContainer.replaceChildren();

  if (state.settings.autoDoubling) {
    game.players.forEach((name, idx) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ender-chip";
      const isSelected = state.roundEditor.enderIndex === idx;
      chip.setAttribute("aria-pressed", isSelected ? "true" : "false");
      chip.textContent = name;

      chip.addEventListener("click", () => {
        state.roundEditor.enderIndex =
          state.roundEditor.enderIndex === idx ? null : idx;
        for (const [bIdx, bEl] of [...dom.enderChipsContainer.children].entries()) {
          bEl.setAttribute(
            "aria-pressed",
            state.roundEditor.enderIndex === bIdx ? "true" : "false"
          );
        }
        updateLiveDoublingPreview();
      });

      dom.enderChipsContainer.appendChild(chip);
    });
  }

  // Aktuelle Zwischenstände vor dieser Runde berechnen
  const totalsBefore = game.players.map(() => 0);
  const limitIdx = roundIndex !== null ? roundIndex : game.rounds.length;
  for (let r = 0; r < limitIdx; r++) {
    game.rounds[r].finalScores.forEach((pts, pIdx) => {
      totalsBefore[pIdx] += pts;
    });
  }

  // Eingabezeilen für alle Spieler aufbauen
  dom.roundInputsContainer.replaceChildren();
  game.players.forEach((name, idx) => {
    const row = document.createElement("div");
    row.className = "round-player-row";

    const info = document.createElement("div");
    info.className = "round-player-info";

    const label = document.createElement("label");
    const inputId = `round-score-input-${idx}`;
    label.htmlFor = inputId;
    label.className = "round-player-label";
    label.textContent = name;

    const currentSub = document.createElement("span");
    currentSub.className = "round-player-current";
    currentSub.textContent = `Bisher: ${totalsBefore[idx]} Pkt.`;

    info.append(label, currentSub);

    const controls = document.createElement("div");
    controls.className = "score-entry-controls";

    const signBtn = document.createElement("button");
    signBtn.type = "button";
    signBtn.className = "sign-toggle-btn";
    signBtn.setAttribute("aria-label", `Minus/Plus wechseln für ${name}`);
    signBtn.textContent = "±";

    const input = document.createElement("input");
    input.type = "text";
    input.id = inputId;
    input.className = "score-input";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.setAttribute("autocorrect", "off");
    input.spellcheck = false;
    input.placeholder = "0";
    input.setAttribute(
      "enterkeyhint",
      idx === game.players.length - 1 ? "done" : "next"
    );

    if (existingRound) {
      const rawVal = existingRound.rawScores[idx];
      input.value = String(rawVal);
      signBtn.classList.toggle("is-negative", rawVal < 0);
    }

    if (idx === 0) {
      input.autofocus = true;
    }

    signBtn.addEventListener("click", () => {
      const cur = input.value.trim();
      if (cur.startsWith("-")) {
        input.value = cur.slice(1);
        signBtn.classList.remove("is-negative");
      } else if (cur === "" || cur === "+") {
        input.value = "-";
        signBtn.classList.add("is-negative");
      } else {
        input.value = `-${cur.replace(/^\+/, "")}`;
        signBtn.classList.add("is-negative");
      }
      dom.roundFormError.hidden = true;
      updateLiveDoublingPreview();
      input.focus();
    });

    input.addEventListener("input", () => {
      // Erlaube optionales führendes Minus und Ziffern
      let v = input.value.replace(/[^\d-]/g, "");
      if (v.indexOf("-") > 0) {
        v = v.replace(/-/g, "");
      }
      const minusCount = (input.value.match(/-/g) || []).length;
      if (input.value.startsWith("-") && !v.startsWith("-") && minusCount > 0) {
        v = `-${v}`;
      }
      input.value = v;
      signBtn.classList.toggle("is-negative", v.startsWith("-"));
      dom.roundFormError.hidden = true;
      updateLiveDoublingPreview();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        if (idx < game.players.length - 1) {
          e.preventDefault();
          const next = document.getElementById(`round-score-input-${idx + 1}`);
          next?.focus();
          next?.select();
        }
      }
    });

    controls.append(signBtn, input);
    row.append(info, controls);
    dom.roundInputsContainer.appendChild(row);
  });

  updateLiveDoublingPreview();
  dom.roundDialog.showModal();
}

// ============================================================================
// Siegerehrung-Dialog rendern
// ============================================================================
function openWinnerCelebrationDialog() {
  const game = state.game;
  if (!game) return;

  const totals = computeTotals(game);
  const ranked = game.players
    .map((name, seatIdx) => ({ name, seatIdx, total: totals[seatIdx] }))
    .sort((a, b) => a.total - b.total || a.seatIdx - b.seatIdx);

  const minTotal = ranked[0].total;
  const winners = ranked.filter((p) => p.total === minTotal);

  dom.winnerDialogSubtitle.textContent = `Nach ${game.rounds.length} ${
    game.rounds.length === 1 ? "Runde" : "Runden"
  } wurde die ${game.targetScore}-Punkte-Grenze erreicht`;

  // Spotlight
  dom.winnerSpotlight.replaceChildren();
  const trophy = document.createElement("div");
  trophy.className = "winner-trophy-big";
  trophy.setAttribute("aria-hidden", "true");
  trophy.textContent = "🏆";

  const title = document.createElement("h3");
  title.className = "winner-name-big";
  title.textContent =
    winners.length === 1
      ? `${winners[0].name} gewinnt!`
      : `${winners.map((w) => w.name).join(" & ")} gewinnen!`;

  const sub = document.createElement("p");
  sub.className = "winner-score-big";
  sub.textContent = `Mit starken ${minTotal} Gesamtpunkten`;

  dom.winnerSpotlight.append(trophy, title, sub);

  // Komplette Abschlusstabelle
  dom.finalRankingList.replaceChildren();
  let rankNum = 1;
  ranked.forEach((p, idx) => {
    if (idx > 0 && p.total > ranked[idx - 1].total) {
      rankNum = idx + 1;
    }
    const item = document.createElement("div");
    item.className = "final-rank-item";

    const left = document.createElement("span");
    const medal =
      rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : rankNum === 3 ? "🥉" : `${rankNum}.`;
    left.textContent = `${medal} ${p.name}`;

    const right = document.createElement("span");
    right.textContent = `${p.total} Pkt.${p.total >= game.targetScore ? " 💥" : ""}`;

    item.append(left, right);
    dom.finalRankingList.appendChild(item);
  });

  // Match-Highlights (Beste Einzelrunde & Höchste Einzelrunde)
  dom.matchHighlights.replaceChildren();
  let bestVal = Infinity;
  let bestHolder = "";
  let worstVal = -Infinity;
  let worstHolder = "";

  game.rounds.forEach((r, rIdx) => {
    r.finalScores.forEach((sc, pIdx) => {
      if (sc < bestVal) {
        bestVal = sc;
        bestHolder = `${game.players[pIdx]} (R${rIdx + 1})`;
      }
      if (sc > worstVal) {
        worstVal = sc;
        worstHolder = `${game.players[pIdx]} (R${rIdx + 1})`;
      }
    });
  });

  if (Number.isFinite(bestVal)) {
    dom.matchHighlights.appendChild(
      createHighlightBox("🌟 Beste Einzelrunde", `${bestVal} Pkt. – ${bestHolder}`)
    );
  }
  if (Number.isFinite(worstVal)) {
    dom.matchHighlights.appendChild(
      createHighlightBox("🔥 Teuerste Runde", `+${worstVal} Pkt. – ${worstHolder}`)
    );
  }

  if (!dom.winnerDialog.open) {
    dom.winnerDialog.showModal();
  }
}

function createHighlightBox(label, value) {
  const box = document.createElement("div");
  box.className = "highlight-box";
  const lbl = document.createElement("span");
  lbl.className = "highlight-label";
  lbl.textContent = label;
  const val = document.createElement("span");
  val.className = "highlight-val";
  val.textContent = value;
  box.append(lbl, val);
  return box;
}

// ============================================================================
// Gespeicherte-Spieler-Dialog (Verwaltung, Löschen & Statistik)
// ============================================================================
function renderPlayersManagerModal() {
  const sorted = getSortedSavedPlayers();
  dom.savedManagerList.replaceChildren();

  if (sorted.length === 0) {
    dom.savedManagerEmpty.hidden = false;
    dom.resetStatsOnlyBtn.hidden = true;
    return;
  }

  dom.savedManagerEmpty.hidden = true;
  dom.resetStatsOnlyBtn.hidden = false;

  for (const p of sorted) {
    const row = document.createElement("div");
    row.className = "saved-manager-row";

    const meta = document.createElement("div");
    meta.className = "saved-manager-meta";

    const nameEl = document.createElement("span");
    nameEl.className = "saved-manager-name";
    nameEl.textContent = p.name;

    const statsEl = document.createElement("span");
    statsEl.className = "saved-manager-stats";
    const games = p.games || 0;
    const wins = p.wins || 0;
    const bestPart =
      p.bestRound !== null && p.bestRound !== undefined
        ? ` • Beste Runde: ${p.bestRound} Pkt.`
        : "";
    statsEl.textContent = `${games} ${
      games === 1 ? "Spiel" : "Spiele"
    } • 🏆 ${wins} ${wins === 1 ? "Sieg" : "Siege"}${bestPart}`;

    meta.append(nameEl, statsEl);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-delete-saved";
    delBtn.textContent = "🗑 Löschen";
    delBtn.setAttribute("aria-label", `${p.name} aus gespeicherten Spielern löschen`);
    delBtn.addEventListener("click", () => deleteSavedPlayerByName(p.name));

    row.append(meta, delBtn);
    dom.savedManagerList.appendChild(row);
  }
}

// ============================================================================
// Event-Listener verdrahten
// ============================================================================
function bindEvents() {
  // Dialog-Schließen-Buttons
  document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close-dialog");
      document.getElementById(id)?.close();
    });
  });

  // returnValue-Reset bei allen Dialogen (gemäß modern-web-guidance)
  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.addEventListener("close", () => {
      dlg.returnValue = "";
    });
  });

  // Header-Buttons & Wake-Lock-Switches
  dom.headerWakeSwitch.addEventListener("change", (e) => {
    setKeepAwakePreference(e.target.checked);
  });
  dom.settingsWakeSwitch.addEventListener("change", (e) => {
    setKeepAwakePreference(e.target.checked);
  });

  dom.openPlayersBtn.addEventListener("click", () => {
    renderPlayersManagerModal();
    dom.playersDialog.showModal();
  });

  dom.openSettingsBtn.addEventListener("click", () => {
    dom.settingsDoublingSwitch.checked = state.settings.autoDoubling;
    syncThemeControlsFromStorage();
    updateWakeLockUI();
    dom.settingsDialog.showModal();
  });

  dom.settingsDoublingSwitch.addEventListener("change", (e) => {
    state.settings.autoDoubling = Boolean(e.target.checked);
    saveJSON(STORAGE_KEYS.SETTINGS, state.settings);
  });

  dom.themeSelector.addEventListener("change", (e) => {
    if (e.target.name === "colorSchemePref") {
      applyThemeChoice(e.target.value);
    }
  });

  // Setup: Spieleranzahl-Radios (2 bis 8)
  dom.playerCountGroup.addEventListener("change", (e) => {
    if (e.target.name === "playerCount") {
      setSetupPlayerCount(Number(e.target.value));
    }
  });

  // Setup: Verliergrenze (Standard 100)
  dom.targetScoreInput.addEventListener("input", () => {
    dom.targetScoreInput.value = dom.targetScoreInput.value.replace(/\D/g, "");
    dom.resetTargetBtn.hidden =
      dom.targetScoreInput.value === String(DEFAULT_TARGET_SCORE);
  });

  dom.resetTargetBtn.addEventListener("click", () => {
    dom.targetScoreInput.value = String(DEFAULT_TARGET_SCORE);
    dom.resetTargetBtn.hidden = true;
  });

  // Setup: Gespeicherte Spieler Löschen-Modus umschalten
  dom.toggleDeleteModeBtn.addEventListener("click", () => {
    state.setup.deleteMode = !state.setup.deleteMode;
    renderSetupRosterAndSlots();
  });

  // Setup: Namen direkt oben in der "Gespeicherte Spieler"-Karte merken & einfügen
  const handleSetupQuickAdd = () => {
    const clean = normalizeName(dom.setupQuickAddInput.value);
    if (!clean) {
      dom.setupQuickAddInput.focus();
      return;
    }
    upsertSavedPlayer(clean, true);
    dom.setupQuickAddInput.value = "";
    state.setup.deleteMode = false;

    // Direkt in freien Platz am Tisch setzen, falls noch nicht ausgewählt
    if (findSlotIndexForName(clean) === -1) {
      const emptySlot = state.setup.slots.findIndex((s) => !normalizeName(s));
      if (emptySlot !== -1) {
        state.setup.slots[emptySlot] = clean;
      } else if (state.setup.playerCount < 8) {
        state.setup.playerCount += 1;
        state.setup.slots.push(clean);
        const radio = dom.playerCountGroup.querySelector(
          `input[value="${state.setup.playerCount}"]`
        );
        if (radio) radio.checked = true;
      }
    }

    dom.setupErrorMsg.hidden = true;
    renderSetupRosterAndSlots();
    showToast(`„${clean}“ gespeichert!`);
    dom.setupQuickAddInput.focus();
  };

  dom.setupQuickAddBtn.addEventListener("click", handleSetupQuickAdd);
  dom.setupQuickAddInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      handleSetupQuickAdd();
    }
  });

  // Setup: Alle Slots leeren / Sitzreihenfolge mischen
  dom.clearAllSlotsBtn.addEventListener("click", () => {
    state.setup.slots = state.setup.slots.map(() => "");
    dom.setupErrorMsg.hidden = true;
    renderSetupRosterAndSlots();
    document.getElementById("player-slot-input-0")?.focus();
  });

  dom.shufflePlayersBtn.addEventListener("click", () => {
    const filled = state.setup.slots.map(normalizeName).filter(Boolean);
    if (filled.length < 2) {
      showToast("Trage mindestens 2 Namen ein, um die Reihenfolge zu mischen.");
      return;
    }
    for (let i = state.setup.slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.setup.slots[i], state.setup.slots[j]] = [
        state.setup.slots[j],
        state.setup.slots[i],
      ];
    }
    renderSetupRosterAndSlots();
    showToast("🎲 Sitzreihenfolge wurde gemischt!");
  });

  // Setup: Pausiertes Spiel fortsetzen
  dom.resumeGameBtn.addEventListener("click", () => {
    showView("game");
    renderGameView();
  });

  // Setup: Formular absenden -> Spiel starten
  dom.setupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const slotInputs = [...dom.playerSlotsContainer.querySelectorAll("input")];
    if (slotInputs.length > 0) {
      state.setup.slots = slotInputs.map((inp) => inp.value);
    }
    const cleanedNames = state.setup.slots.map(normalizeName);

    // Prüfe auf leere Felder
    const emptyIdx = cleanedNames.findIndex((n) => !n);
    if (emptyIdx !== -1) {
      dom.setupErrorMsg.textContent = `Bitte trage noch einen Namen für Spieler ${
        emptyIdx + 1
      } ein (oder wähle oben weniger Spieler).`;
      dom.setupErrorMsg.hidden = false;
      document.getElementById(`player-slot-input-${emptyIdx}`)?.focus();
      return;
    }

    // Prüfe auf doppelte Namen
    const seen = new Set();
    for (let i = 0; i < cleanedNames.length; i++) {
      const key = cleanedNames[i].toLowerCase();
      if (seen.has(key)) {
        dom.setupErrorMsg.textContent = `Der Name „${cleanedNames[i]}“ ist doppelt eingetragen. Bitte verwende eindeutige Namen.`;
        dom.setupErrorMsg.hidden = false;
        document.getElementById(`player-slot-input-${i}`)?.focus();
        return;
      }
      seen.add(key);
    }

    const parsedLimit = Number.parseInt(dom.targetScoreInput.value, 10);
    const targetScore =
      Number.isFinite(parsedLimit) && parsedLimit >= 10
        ? parsedLimit
        : DEFAULT_TARGET_SCORE;

    dom.setupErrorMsg.hidden = true;
    startNewGame(cleanedNames, targetScore);
  });

  // Laufendes Spiel: Buttons
  dom.addRoundBtn.addEventListener("click", () => {
    if (state.game?.isFinished) {
      startNewGame(state.game.players, state.game.targetScore);
    } else {
      openRoundDialog(null);
    }
  });

  dom.editLastRoundBtn.addEventListener("click", () => {
    if (state.game && state.game.rounds.length > 0) {
      openRoundDialog(state.game.rounds.length - 1);
    }
  });

  const goToSetupForNewPlayers = () => {
    initSetupDefaults(true);
    showView("setup");
  };

  dom.newGameTopBtn.addEventListener("click", goToSetupForNewPlayers);
  dom.bannerChangePlayersBtn.addEventListener("click", goToSetupForNewPlayers);
  dom.modalNewSetupBtn.addEventListener("click", () => {
    dom.winnerDialog.close();
    goToSetupForNewPlayers();
  });

  const triggerRematch = () => {
    if (!state.game) return;
    dom.winnerDialog.close();
    startNewGame(state.game.players, state.game.targetScore);
    showToast("🔄 Neue Partie mit denselben Spielern gestartet!");
  };

  dom.bannerRematchBtn.addEventListener("click", triggerRematch);
  dom.modalRematchBtn.addEventListener("click", triggerRematch);

  // Runden-Dialog: Abbrechen, Löschen & Speichern
  dom.closeRoundDialogBtn.addEventListener("click", () => dom.roundDialog.close());
  dom.cancelRoundBtn.addEventListener("click", () => dom.roundDialog.close());

  dom.deleteRoundBtn.addEventListener("click", () => {
    const idx = state.roundEditor.editingIndex;
    if (!state.game || idx === null) return;
    state.game.rounds.splice(idx, 1);
    syncGameCompletionAndStats();
    dom.roundDialog.close();
    renderGameView();
    showToast(`Runde ${idx + 1} wurde gelöscht.`);
  });

  dom.roundForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const game = state.game;
    if (!game) return;

    const inputs = [...dom.roundInputsContainer.querySelectorAll(".score-input")];
    const rawScores = [];

    for (let i = 0; i < inputs.length; i++) {
      const val = parseScoreText(inputs[i].value);
      if (val === null || Number.isNaN(val) || val < -30 || val > 200) {
        dom.roundFormError.textContent = `Bitte gib eine gültige Punktzahl für ${game.players[i]} ein (z. B. -2, 0 oder 14).`;
        dom.roundFormError.hidden = false;
        inputs[i].focus();
        inputs[i].select();
        return;
      }
      rawScores.push(val);
    }

    const { doubledIndex, finalScores } = evaluateRoundDoubling(
      rawScores,
      state.roundEditor.enderIndex
    );

    const roundRecord = {
      rawScores,
      finalScores,
      enderIndex: state.roundEditor.enderIndex,
      doubledIndex,
    };

    if (state.roundEditor.editingIndex !== null) {
      game.rounds[state.roundEditor.editingIndex] = roundRecord;
    } else {
      game.rounds.push(roundRecord);
    }

    const justFinished = syncGameCompletionAndStats();
    dom.roundDialog.close();
    renderGameView();

    if (justFinished) {
      openWinnerCelebrationDialog();
    }
  });

  // Gespeicherte-Spieler-Dialog: Direkt hinzufügen & Statistik zurücksetzen
  dom.quickAddForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const clean = normalizeName(dom.quickAddInput.value);
    if (!clean) return;
    upsertSavedPlayer(clean, true);
    dom.quickAddInput.value = "";
    renderPlayersManagerModal();
    renderSetupRosterAndSlots();
    showToast(`„${clean}“ wurde gespeichert.`);
  });

  dom.resetStatsOnlyBtn.addEventListener("click", () => {
    for (const p of state.savedPlayers) {
      p.games = 0;
      p.wins = 0;
      p.bestRound = null;
    }
    if (state.game) {
      state.game.statsSnapshot = null;
      saveJSON(STORAGE_KEYS.ACTIVE_GAME, state.game);
    }
    saveRoster();
    renderPlayersManagerModal();
    showToast("Statistik zurückgesetzt – alle gespeicherten Namen bleiben erhalten.");
  });
}

// ============================================================================
// App-Initialisierung
// ============================================================================
function init() {
  syncThemeControlsFromStorage();
  dom.settingsDoublingSwitch.checked = state.settings.autoDoubling;
  initSetupDefaults(true);
  bindEvents();

  // Falls noch eine laufende (unbeendete) Partie offen war, direkt wiederherstellen
  if (state.game && !state.game.isFinished && state.game.rounds.length > 0) {
    showView("game");
    renderGameView();
  } else {
    showView("setup");
  }

  // Wake Lock direkt beim Laden versuchen (und bei erster Berührung nachziehen)
  if (state.settings.keepAwake) {
    acquireWakeLock();
  } else {
    updateWakeLockUI();
  }
}

init();
})();
