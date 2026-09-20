// 한국사 인물 맞추기 - 게임 로직
(function () {
  "use strict";

  const BASE_SCORE = 100; // 문제 하나 맞혔을 때 기본 점수
  const HINT_STEP = 10; // 힌트를 볼 때마다 커지는 차감 점수 단위 (1번째 -10, 2번째 -20, 3번째 -30 ...)

  // 힌트 n개를 추가로 본 경우 누적 차감 점수: 10 + 20 + ... + 10n = 10 * n(n+1)/2
  function cumulativeHintPenalty(extraHints) {
    return HINT_STEP * (extraHints * (extraHints + 1)) / 2;
  }

  // 난이도별 설정: maxHints가 적을수록, 가장 결정적인(마지막) 힌트를 못 보므로 더 어려워짐
  const LEVELS = {
    basic: { label: "초중등(기본)", maxHints: 3, lives: 3 },
    hard: { label: "고등(심화)", maxHints: 2, lives: 2 },
  };

  /** @type {{mode:string, era:string, count:number, level:string}} */
  const settings = { mode: "인물", era: "전체", count: 10, level: "hard" };

  const QUIZ_TITLES = {
    인물: "이 사람은 누구일까요?",
    사건: "이 사건은 무엇일까요?",
  };

  function getDataset() {
    return settings.mode === "사건" ? EVENTS : PEOPLE;
  }

  /** 게임 진행 상태 */
  let state = null;

  // ---------- 화면 요소 ----------
  const screens = {
    start: document.getElementById("screen-start"),
    game: document.getElementById("screen-game"),
    end: document.getElementById("screen-end"),
  };

  const el = {
    modeButtons: document.getElementById("mode-buttons"),
    levelButtons: document.getElementById("level-buttons"),
    eraButtons: document.getElementById("era-buttons"),
    countButtons: document.getElementById("count-buttons"),
    btnStart: document.getElementById("btn-start"),
    bestScoreBox: document.getElementById("best-score-box"),
    bestScoreText: document.getElementById("best-score-text"),

    progressText: document.getElementById("progress-text"),
    livesBox: document.getElementById("lives-box"),
    scoreBox: document.getElementById("score-box"),
    quizTitle: document.getElementById("quiz-title"),
    hintList: document.getElementById("hint-list"),
    btnMoreHint: document.getElementById("btn-more-hint"),
    choices: document.getElementById("choices"),
    feedbackBox: document.getElementById("feedback-box"),
    feedbackText: document.getElementById("feedback-text"),
    factText: document.getElementById("fact-text"),
    btnNext: document.getElementById("btn-next"),

    endMedal: document.getElementById("end-medal"),
    endTitle: document.getElementById("end-title"),
    endSummary: document.getElementById("end-summary"),
    endScore: document.getElementById("end-score"),
    endBest: document.getElementById("end-best"),
    btnRestart: document.getElementById("btn-restart"),
    btnHome: document.getElementById("btn-home"),
    btnHomeGame: document.getElementById("btn-home-game"),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ---------- 시작 화면 설정 ----------
  function buildEraButtons() {
    el.eraButtons.innerHTML = "";
    ERAS.forEach((era) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (era.key === settings.era ? " selected" : "");
      btn.textContent = `${era.emoji} ${era.label}`;
      btn.dataset.era = era.key;
      btn.addEventListener("click", () => {
        settings.era = era.key;
        [...el.eraButtons.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
        updateBestScoreDisplay();
      });
      el.eraButtons.appendChild(btn);
    });
  }

  function bindModeButtons() {
    [...el.modeButtons.children].forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.mode = btn.dataset.mode;
        [...el.modeButtons.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
        updateBestScoreDisplay();
      });
    });
  }

  function bindLevelButtons() {
    [...el.levelButtons.children].forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.level = btn.dataset.level;
        [...el.levelButtons.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
        updateBestScoreDisplay();
      });
    });
  }

  function bindCountButtons() {
    [...el.countButtons.children].forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.count = parseInt(btn.dataset.count, 10);
        [...el.countButtons.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  }

  function bestScoreKey(mode, era, level) {
    return `history-joo-best-${mode}-${era}-${level}`;
  }

  function updateBestScoreDisplay() {
    try {
      const best = localStorage.getItem(bestScoreKey(settings.mode, settings.era, settings.level));
      if (best) {
        el.bestScoreBox.hidden = false;
        el.bestScoreText.textContent = `🏆 '${LEVELS[settings.level].label} · ${settings.mode} · ${settings.era}' 최고 점수: ${best}점`;
      } else {
        el.bestScoreBox.hidden = true;
      }
    } catch (e) {
      el.bestScoreBox.hidden = true;
    }
  }

  function saveBestScore(mode, era, level, score) {
    try {
      const key = bestScoreKey(mode, era, level);
      const prev = parseInt(localStorage.getItem(key) || "0", 10);
      if (score > prev) {
        localStorage.setItem(key, String(score));
        return true;
      }
    } catch (e) {
      /* localStorage 사용 불가 시 조용히 무시 */
    }
    return false;
  }

  function getBestScore(mode, era, level) {
    try {
      return parseInt(localStorage.getItem(bestScoreKey(mode, era, level)) || "0", 10);
    } catch (e) {
      return 0;
    }
  }

  // ---------- 유틸 ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickPool(era) {
    const dataset = getDataset();
    return era === "전체" ? dataset : dataset.filter((p) => p.era === era);
  }

  function buildQuestions(era, count) {
    const pool = pickPool(era);
    const n = Math.min(count, pool.length);
    return shuffle(pool).slice(0, n);
  }

  function buildChoices(answer) {
    const dataset = getDataset();
    const sameEra = dataset.filter((p) => p.era === answer.era && p.id !== answer.id);
    const others = dataset.filter((p) => p.era !== answer.era && p.id !== answer.id);
    const distractors = shuffle(sameEra).slice(0, 3);
    if (distractors.length < 3) {
      distractors.push(...shuffle(others).slice(0, 3 - distractors.length));
    }
    return shuffle([answer, ...distractors]);
  }

  // ---------- 게임 시작 ----------
  function startGame() {
    const questions = buildQuestions(settings.era, settings.count);
    const levelConfig = LEVELS[settings.level] || LEVELS.basic;
    el.quizTitle.textContent = QUIZ_TITLES[settings.mode] || QUIZ_TITLES["인물"];
    state = {
      mode: settings.mode,
      era: settings.era,
      level: settings.level,
      levelConfig,
      questions,
      index: 0,
      score: 0,
      lives: levelConfig.lives,
      correctCount: 0,
      hintsShown: 1,
      answered: false,
    };
    showScreen("game");
    renderQuestion();
  }

  function currentQuestion() {
    return state.questions[state.index];
  }

  function renderQuestion() {
    state.hintsShown = 1;
    state.answered = false;

    el.progressText.textContent = `문제 ${state.index + 1}/${state.questions.length}`;
    el.livesBox.textContent = "❤️".repeat(state.lives) + "🖤".repeat(state.levelConfig.lives - state.lives);
    el.scoreBox.textContent = `점수 ${state.score}`;

    el.feedbackBox.hidden = true;
    renderHints();
    renderChoices();
    updateMoreHintButton();
  }

  function renderHints() {
    const q = currentQuestion();
    el.hintList.innerHTML = "";
    for (let i = 0; i < state.hintsShown; i++) {
      const div = document.createElement("div");
      div.className = "hint-item";
      div.innerHTML = `<span class="hint-num">힌트 ${i + 1}</span>${q.hints[i]}`;
      el.hintList.appendChild(div);
    }
  }

  function updateMoreHintButton() {
    const maxHints = state.levelConfig.maxHints;
    if (state.hintsShown >= maxHints || state.answered) {
      el.btnMoreHint.disabled = true;
      el.btnMoreHint.textContent = "💡 힌트 다 봤어요";
    } else {
      const nextHintCost = HINT_STEP * state.hintsShown;
      el.btnMoreHint.disabled = false;
      el.btnMoreHint.textContent = `💡 힌트 더 보기 (-${nextHintCost}점)`;
    }
  }

  function renderChoices() {
    const q = currentQuestion();
    const choices = buildChoices(q);
    el.choices.innerHTML = "";
    choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = choice.name;
      btn.addEventListener("click", () => onAnswer(choice, btn));
      el.choices.appendChild(btn);
    });
  }

  function onMoreHint() {
    if (state.answered) return;
    if (state.hintsShown < state.levelConfig.maxHints) {
      state.hintsShown++;
      renderHints();
      updateMoreHintButton();
    }
  }

  function onAnswer(choice, btnEl) {
    if (state.answered) return;
    state.answered = true;

    const q = currentQuestion();
    const isCorrect = choice.id === q.id;
    const extraHints = state.hintsShown - 1;

    [...el.choices.children].forEach((b) => {
      b.disabled = true;
      if (b.textContent === q.name) b.classList.add("correct");
    });

    if (isCorrect) {
      const gained = Math.max(BASE_SCORE - cumulativeHintPenalty(extraHints), 40);
      state.score += gained;
      state.correctCount++;
      el.feedbackText.textContent = `🎉 정답이에요! (+${gained}점)`;
    } else {
      btnEl.classList.add("wrong");
      state.lives--;
      el.feedbackText.textContent = `❌ 아쉬워요! 정답은 '${q.name}'이에요.`;
    }

    el.factText.textContent = `📚 ${q.fact}`;
    el.feedbackBox.hidden = false;
    el.scoreBox.textContent = `점수 ${state.score}`;
    el.livesBox.textContent = "❤️".repeat(Math.max(state.lives, 0)) + "🖤".repeat(state.levelConfig.lives - Math.max(state.lives, 0));
    updateMoreHintButton();

    el.btnNext.textContent = state.lives <= 0 ? "결과 보기 ▶" : (state.index + 1 >= state.questions.length ? "결과 보기 ▶" : "다음 문제 ▶");
  }

  function onNext() {
    if (state.lives <= 0 || state.index + 1 >= state.questions.length) {
      endGame();
      return;
    }
    state.index++;
    renderQuestion();
  }

  // ---------- 결과 화면 ----------
  function endGame() {
    const total = state.questions.length;
    const isNewBest = saveBestScore(state.mode, state.era, state.level, state.score);
    const best = getBestScore(state.mode, state.era, state.level);

    let medal = "🥉";
    let title = "다음엔 더 잘할 수 있어요!";
    const ratio = state.correctCount / total;
    if (state.lives <= 0 && state.correctCount < total) {
      medal = "💦";
      title = "아쉽지만 다시 도전해봐요!";
    } else if (ratio === 1) {
      medal = "🥇";
      title = "완벽해요! 역사 마스터!";
    } else if (ratio >= 0.7) {
      medal = "🥈";
      title = "정말 잘했어요!";
    }

    el.endMedal.textContent = medal;
    el.endTitle.textContent = title;
    el.endSummary.textContent = `총 ${total}문제 중 ${state.correctCount}문제를 맞혔어요.`;
    el.endScore.textContent = `최종 점수: ${state.score}점` + (isNewBest ? " 🎊 최고 기록 경신!" : "");
    el.endBest.textContent = `'${state.levelConfig.label} · ${state.mode} · ${state.era}' 최고 점수: ${best}점`;

    showScreen("end");
  }

  // ---------- 이벤트 바인딩 ----------
  el.btnStart.addEventListener("click", startGame);
  el.btnMoreHint.addEventListener("click", onMoreHint);
  el.btnNext.addEventListener("click", onNext);
  el.btnRestart.addEventListener("click", startGame);
  function goHome() {
    showScreen("start");
    updateBestScoreDisplay();
  }
  el.btnHome.addEventListener("click", goHome);
  el.btnHomeGame.addEventListener("click", goHome);

  bindModeButtons();
  bindLevelButtons();
  buildEraButtons();
  bindCountButtons();
  updateBestScoreDisplay();
})();
