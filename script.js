// Uses your original structure; adds popup-based color choosing, undo that also reverts color choice,
// and a Stop that resets without auto-starting the timer.

document.addEventListener("DOMContentLoaded", () => {
  const COLORS = ["red","orange","yellow","green","blue","purple"];
  const COLOR_NAME = { red:"Red", orange:"Orange", yellow:"Yellow", green:"Green", blue:"Blue", purple:"Purple" };
  const MOVES = ["rock","paper","scissors"];
  const HAND_EMOJI = { rock:"✊", paper:"✋", scissors:"✌️" };

  // --- NEW: per-move color selection + history for undo
  const STATE = {
    selectedColor: null,             // color chosen for the current/last move via popup
    history: []                      // stack of actions: {type:'place', cell, prevOwner, newOwner, prevSelectedColor}
  };

  let gameActive = false, timerId = null, timeLeft = 0, powerUps = {}, CELLS = [];

  /* ===== Toast ===== */
  function toast(msg, ms = 1500) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /* ===== Lightweight popup color chooser ===== */
  function openColorPopup({ title = "Choose a color" } = {}) {
    return new Promise((resolve, reject) => {
      // overlay
      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex;
        align-items:center; justify-content:center; z-index:9999;
      `;
      // dialog
      const box = document.createElement("div");
      box.style.cssText = `
        background:#161a24; color:#e7e9ee; border-radius:12px; padding:16px;
        min-width:280px; max-width:92vw; box-shadow:0 8px 30px rgba(0,0,0,.4);
      `;
      box.innerHTML = `
        <div style="font-weight:700; margin-bottom:10px;">${title}</div>
        <div id="chips" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button id="cancel" class="btn">Cancel</button>
        </div>
      `;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const chips = box.querySelector("#chips");
      const cancel = box.querySelector("#cancel");

      COLORS.forEach(c => {
        const b = document.createElement("button");
        b.className = "btn";
        b.style.cssText = `width:38px; height:38px; border-radius:9px; border:2px solid #30384a; background:${c};`;
        b.addEventListener("click", () => {
          const prevSel = STATE.selectedColor;
          STATE.selectedColor = c;
          // record choose for undo pairing (the actual revert happens when undoing 'place')
          STATE.history.push({ type: "choose", prevSelectedColor: prevSel, newSelectedColor: c });
          cleanup();
          resolve(c);
        });
        chips.appendChild(b);
      });

      function cleanup() { document.body.contains(overlay) && document.body.removeChild(overlay); }
      cancel.addEventListener("click", () => { cleanup(); reject(new Error("cancel")); });
      overlay.addEventListener("click", (e) => { if (e.target === overlay) { cleanup(); reject(new Error("cancel")); } });
    });
  }

  /* ===== Palette (visual only; buttons inert) ===== */
  const palette = document.querySelector(".palette");
  const ui = { wraps:{}, scores:{}, buttons:{} };

  COLORS.forEach((c) => {
    const wrap = document.createElement("div"); wrap.className = "swatch-wrap"; wrap.dataset.color = c;
    const crown = document.createElement("div"); crown.className = "crown"; crown.textContent = "👑";
    const score = document.createElement("div"); score.className = "score"; score.textContent = "0";
    const btn   = document.createElement("button");
    btn.className = "swatch"; btn.style.background = c;

    // NOTE: swatch buttons are now inert (no click handler), only visual for scores/leader crown.

    wrap.append(crown, score, btn);
    palette.appendChild(wrap);
    ui.wraps[c] = wrap; ui.scores[c] = score; ui.buttons[c] = btn;
    powerUps[c] = false;
  });

  /* ===== Grid ===== */
  const grid = document.querySelector(".grid");
  for (let i = 0; i < 20; i++) {
    const cell = document.createElement("div"); cell.className = "box";
    grid.appendChild(cell); CELLS.push(cell);
  }
  function markRandomPowerUps(count = 3) {
    CELLS.forEach(c => c.classList.remove("power-up"));
    [...CELLS].sort(() => Math.random() - 0.5).slice(0, count).forEach(c => c.classList.add("power-up"));
  }

  /* ===== RPS ===== */
  const rpsOverlay = document.querySelector(".rps-overlay");
  const handL = document.getElementById("handL"), handR = document.getElementById("handR");
  const resultLabel = document.getElementById("rpsResult");

  function rpsOutcome(a, d) {
    if (a === d) return "tie";
    if ((a === "rock" && d === "scissors") || (a === "paper" && d === "rock") || (a === "scissors" && d === "paper")) return "attacker";
    return "defender";
  }
  function playRPS(attackerColor, defenderColor) {
    rpsOverlay.hidden = false; resultLabel.textContent = "Rock… Paper… Scissors!";
    return new Promise((resolve) => {
      let ticks = 0;
      const seq = setInterval(() => {
        const aMove = MOVES[Math.floor(Math.random() * 3)], dMove = MOVES[Math.floor(Math.random() * 3)];
        handL.textContent = HAND_EMOJI[dMove]; handR.textContent = HAND_EMOJI[aMove];
        ticks++;
        if (ticks >= 6) {
          clearInterval(seq);
          let attackerMove = aMove, defenderMove = dMove;
          let winner = rpsOutcome(attackerMove, defenderMove);
          while (winner === "tie") {
            attackerMove = MOVES[Math.floor(Math.random() * 3)];
            defenderMove = MOVES[Math.floor(Math.random() * 3)];
            handL.textContent = HAND_EMOJI[defenderMove];
            handR.textContent = HAND_EMOJI[attackerMove];
            winner = rpsOutcome(attackerMove, defenderMove);
          }
          resultLabel.textContent = winner === "attacker"
            ? `${COLOR_NAME[attackerColor]} wins!`
            : `${COLOR_NAME[defenderColor]} defends!`;
          setTimeout(() => { rpsOverlay.hidden = true; resolve(winner); }, 900);
        }
      }, 160);
    });
  }

  /* ===== Confetti ===== */
  function launchConfetti(count = 140) {
    const root = document.querySelector(".confetti-root");
    if (!root) return;
    const colors = ["#ff3b3b","#ffa62b","#ffef5e","#3ddc84","#4aa3ff","#a259ff","#ff79c6"];
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      const size = 6 + Math.floor(Math.random() * 10);
      piece.style.width = size + "px";
      piece.style.height = Math.round(size * 1.4) + "px";
      piece.style.left = (Math.random() * 100) + "vw";
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      const dur   = 1.6 + Math.random() * 1.4;
      const delay = Math.random() * 0.25;
      const drift = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 60) + "px";
      const rot   = (180 + Math.floor(Math.random() * 720)) + "deg";
      piece.style.setProperty("--dur",   dur + "s");
      piece.style.setProperty("--delay", delay + "s");
      piece.style.setProperty("--drift", drift);
      piece.style.setProperty("--rot",   rot);
      root.appendChild(piece);
      setTimeout(() => piece.remove(), (dur + delay) * 1000 + 150);
    }
  }

  /* ===== Scores ===== */
  function paintCell(cell, color) {
    cell.style.backgroundColor = color;
    if (color) {
      cell.dataset.owner = color;
    } else {
      cell.removeAttribute("data-owner");
    }
    updateScores();
  }
  function updateScores() {
    const counts = Object.fromEntries(COLORS.map(c => [c, 0]));
    document.querySelectorAll(".box").forEach(cell => {
      const o = cell.dataset.owner; if (o) counts[o]++;
    });
    let max = 0;
    COLORS.forEach(c => {
      ui.scores[c].textContent = counts[c];
      if (counts[c] > max) max = counts[c];
    });
    COLORS.forEach(c => ui.wraps[c].classList.toggle("leader", max > 0 && counts[c] === max));
    return counts;
  }

  /* ===== Game logic (with popups + undo history) ===== */
  grid.addEventListener("click", async (e) => {
    if (!gameActive) return;
    const cell = e.target.closest(".box"); if (!cell) return;

    const owner = cell.dataset.owner || null;

    // If empty: choose a color BEFORE placing (popup every time).
    if (!owner) {
      try {
        const chosen = await openColorPopup({ title: "Choose a color for this tile" });
        // record and place
        const prevOwner = null;
        const prevSelected = STATE.history.length ? (STATE.history.at(-1).newSelectedColor ?? STATE.selectedColor) : STATE.selectedColor;
        STATE.history.push({
          type: "place",
          cell,
          prevOwner,
          newOwner: chosen,
          prevSelectedColor: prevSelected
        });
        paintCell(cell, chosen);
        playSound("ding");

        // check power-up
        if (cell.classList.contains("power-up")) {
          powerUps[chosen] = true; cell.classList.remove("power-up");
          toast(`${COLOR_NAME[chosen]} found DOUBLE ATTACK!`);
        }
        if (powerUps[chosen]) { triggerDoubleAttack(chosen); powerUps[chosen] = false; }

      } catch { /* cancelled */ }
      return;
    }

    // If owned: resolve RPS first; only ask for color on a win (after the Janken decision).
    const defender = owner;
    // temporary attacker color label for the animation (use last or default)
    const labelColor = STATE.selectedColor || "red";
    const winner = await playRPS(labelColor, defender);

    if (winner === "attacker") {
      try {
        const chosen = await openColorPopup({ title: "You won! Choose a color to capture the tile" });

        const prevOwner = owner;
        const prevSelected = STATE.history.length ? (STATE.history.at(-1).newSelectedColor ?? STATE.selectedColor) : STATE.selectedColor;

        STATE.history.push({
          type: "place",
          cell,
          prevOwner,
          newOwner: chosen,
          prevSelectedColor: prevSelected
        });

        paintCell(cell, chosen);
        launchConfetti(120); playSound("win");

        if (powerUps[chosen]) { triggerDoubleAttack(chosen); powerUps[chosen] = false; }
      } catch {
        // cancelled choose after win: do nothing
      }
    } else {
      playSound("lose");
      const attackerCells = [...document.querySelectorAll(".box")].filter(c => c.dataset.owner === labelColor);
      if (attackerCells.length > 0) {
        const lost = attackerCells[Math.floor(Math.random() * attackerCells.length)];
        paintCell(lost, defender);
        toast(`${COLOR_NAME[labelColor]} lost a tile to ${COLOR_NAME[defender]}!`);
      }
    }
  });

  /* ===== Double Attack ===== */
  function triggerDoubleAttack(color) {
    const empties = [...document.querySelectorAll(".box")].filter(c => !c.dataset.owner);
    if (empties.length === 0) return;
    [...empties].sort(() => Math.random() - 0.5).slice(0, 2).forEach(c => paintCell(c, color));
    toast(`${COLOR_NAME[color]} used DOUBLE ATTACK!`);
    launchConfetti(150);
  }

  /* ===== Teacher Controls ===== */
  document.getElementById("undoBtn").addEventListener("click", () => {
    // Undo both the last placement AND the player's color choice snapshot.
    // We unwind until we pop the last 'place'. Any trailing 'choose' records are rewound as needed.
    if (STATE.history.length === 0) { toast("Nothing to undo"); return; }

    // Pop entries until we revert a placement (while restoring selectedColor appropriately)
    while (STATE.history.length) {
      const action = STATE.history.pop();

      if (action.type === "place") {
        // Revert tile
        paintCell(action.cell, action.prevOwner);
        // Restore selected color snapshot at the time before this placement
        STATE.selectedColor = action.prevSelectedColor ?? null;
        toast("Last move undone");
        return;
      }

      if (action.type === "choose") {
        // Step back the color choice—restore previous selection
        STATE.selectedColor = action.prevSelectedColor ?? null;
        // keep looping to find the matching 'place'
        continue;
      }
    }

    toast("Nothing to undo");
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetBoard();
    // also clear history and selected color on a hard reset
    STATE.history.length = 0;
    STATE.selectedColor = null;
    toast("Board reset");
  });

  /* ===== Sounds ===== */
  function playSound(type) {
    const map = { win:"sfx-win", lose:"sfx-lose", ding:"sfx-ding", end:"sfx-end" };
    const el = document.getElementById(map[type]); if (el) { el.currentTime = 0; el.play(); }
  }

  /* ===== Timer & Game State ===== */
  const startBtn = document.getElementById("startBtn"),
        stopBtn  = document.getElementById("stopBtn"),
        timerEl  = document.getElementById("timer"),
        timeInput= document.getElementById("timeInput"),
        endBanner= document.querySelector(".end-banner"),
        winnerText=document.getElementById("winnerText"),
        playAgainBtn=document.getElementById("playAgain");

  function formatTime(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  function resetBoard() {
    document.querySelectorAll(".box").forEach(c => {
      c.style.backgroundColor = "";
      c.removeAttribute("data-owner");
      c.classList.remove("power-up");
    });
    updateScores(); markRandomPowerUps(3);
  }

  function endGame() {
    gameActive = false; clearInterval(timerId); grid.classList.add("disabled");
    startBtn.disabled = false; stopBtn.disabled = true;
    const counts = updateScores();
    const max = Math.max(...Object.values(counts));
    const leaders = COLORS.filter(c => counts[c] === max && max > 0);
    winnerText.textContent = (max === 0)
      ? "No tiles captured. Draw!"
      : (leaders.length === 1 ? `Winner: ${COLOR_NAME[leaders[0]]}!`
                              : `Tie: ${leaders.map(c => COLOR_NAME[c]).join(" & ")}`);
    endBanner.hidden = false; playSound("end");
  }

  function tick() {
    timeLeft--; timerEl.textContent = formatTime(timeLeft);
    if (timeLeft <= 0) endGame();
  }

  // Start: clears board, clears history, starts the timer (same as before)
  startBtn.addEventListener("click", () => {
    if (gameActive) return;
    resetBoard(); endBanner.hidden = true; gameActive = true;
    grid.classList.remove("disabled");

    // clear history / selection for a new match
    STATE.history.length = 0;
    STATE.selectedColor = null;

    timeLeft = Number(timeInput.value) * 60;
    timerEl.textContent = formatTime(timeLeft);
    startBtn.disabled = true; stopBtn.disabled = false;
    timerId = setInterval(tick, 1000);
  });

  // STOP: now fully resets game but DOES NOT auto-start timer.
  stopBtn.addEventListener("click", () => {
    // stop timer & disable play area
    gameActive = false; clearInterval(timerId); grid.classList.add("disabled");
    startBtn.disabled = false; stopBtn.disabled = true;

    // full reset: board, powerups, overlays, history, selection
    endBanner.hidden = true;
    resetBoard();
    STATE.history.length = 0;
    STATE.selectedColor = null;

    // reset timer display to initial value, but do NOT start
    timerEl.textContent = formatTime(Number(timeInput.value) * 60);
    // (no call to tick / no interval)
  });

  playAgainBtn.addEventListener("click", () => { endBanner.hidden = true; startBtn.click(); });

  /* ===== Theme & Info ===== */
  (function () {
    const root = document.documentElement, btn = document.getElementById("themeToggle");
    const saved = localStorage.getItem("theme");
    if (saved) root.setAttribute("data-theme", saved); else root.setAttribute("data-theme", "light");
    const updateBtn = () => { btn.textContent = root.getAttribute("data-theme") === "dark" ? "☀️ Light" : "🌙 Dark"; };
    updateBtn();
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next); localStorage.setItem("theme", next); updateBtn();
    });
  })();

  const infoBtn = document.getElementById("infoBtn"),
        infoOverlay = document.querySelector(".info-overlay"),
        closeInfo = document.getElementById("closeInfo");
  infoBtn.addEventListener("click", () => infoOverlay.hidden = false);
  closeInfo.addEventListener("click", () => infoOverlay.hidden = true);
  infoOverlay.addEventListener("click", (e) => { if (e.target === infoOverlay) infoOverlay.hidden = true; });

  /* Init */
  updateScores();
  timerEl.textContent = formatTime(Number(timeInput.value) * 60);
});
