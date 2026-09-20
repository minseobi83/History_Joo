// 한국사 인물 맞추기 - 게임 로직
(function () {
  "use strict";

  const HINT_PENALTY = 20; // 힌트 하나 더 볼 때마다 깎이는 점수
  const BASE_SCORE = 100; // 문제 하나 맞혔을 때 기본 점수
  const START_LIVES = 3;

  /** @type {{mode:string, era:string, count:number}} */
  const settings = { mode: "인물", era: "전체", count: 10 };

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
    eraButtons: document.getElementById("era-buttons"),
    countButtons: document.getElementById("count-buttons"),
    btnStart: document.getElementById("btn-start"),
    bestScoreBox: document.getElementById("best-score-box"),
    bestScoreText: document.getElementById("best-score-text"),

    progressText: document.getElementById("progress-text"),
    livesBox: document.getElementById("lives-box"),
    scoreBox: document.getElementById("score-box"),
    figureEmoji: document.getElementById("figure-emoji"),
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

  function bindCountButtons() {
    [...el.countButtons.children].forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.count = parseInt(btn.dataset.count, 10);
        [...el.countButtons.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  }

  function bestScoreKey(mode, era) {
    return `history-joo-best-${mode}-${era}`;
  }

  function updateBestScoreDisplay() {
    try {
      const best = localStorage.getItem(bestScoreKey(settings.mode, settings.era));
      if (best) {
        el.bestScoreBox.hidden = false;
        el.bestScoreText.textContent = `🏆 '${settings.mode} · ${settings.era}' 최고 점수: ${best}점`;
      } else {
        el.bestScoreBox.hidden = true;
      }
    } catch (e) {
      el.bestScoreBox.hidden = true;
    }
  }

  function saveBestScore(mode, era, score) {
    try {
      const key = bestScoreKey(mode, era);
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

  function getBestScore(mode, era) {
    try {
      return parseInt(localStorage.getItem(bestScoreKey(mode, era)) || "0", 10);
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
    el.quizTitle.textContent = QUIZ_TITLES[settings.mode] || QUIZ_TITLES["인물"];
    state = {
      mode: settings.mode,
      era: settings.era,
      questions,
      index: 0,
      score: 0,
      lives: START_LIVES,
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

    const q = currentQuestion();
    el.progressText.textContent = `문제 ${state.index + 1}/${state.questions.length}`;
    el.livesBox.textContent = "❤️".repeat(state.lives) + "🖤".repeat(START_LIVES - state.lives);
    el.scoreBox.textContent = `점수 ${state.score}`;
    el.figureEmoji.textContent = q.emoji;

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
    const q = currentQuestion();
    if (state.hintsShown >= q.hints.length || state.answered) {
      el.btnMoreHint.disabled = true;
      el.btnMoreHint.textContent = "💡 힌트 다 봤어요";
    } else {
      el.btnMoreHint.disabled = false;
      el.btnMoreHint.textContent = `💡 힌트 더 보기 (-${HINT_PENALTY}점)`;
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
    const q = currentQuestion();
    if (state.hintsShown < q.hints.length) {
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
      const gained = Math.max(BASE_SCORE - extraHints * HINT_PENALTY, 40);
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
    el.livesBox.textContent = "❤️".repeat(Math.max(state.lives, 0)) + "🖤".repeat(START_LIVES - Math.max(state.lives, 0));
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
    const isNewBest = saveBestScore(state.mode, state.era, state.score);
    const best = getBestScore(state.mode, state.era);

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
    el.endBest.textContent = `'${state.mode} · ${state.era}' 최고 점수: ${best}점`;

    showScreen("end");
  }

  // ---------- 이벤트 바인딩 ----------
  el.btnStart.addEventListener("click", startGame);
  el.btnMoreHint.addEventListener("click", onMoreHint);
  el.btnNext.addEventListener("click", onNext);
  el.btnRestart.addEventListener("click", startGame);
  el.btnHome.addEventListener("click", () => {
    showScreen("start");
    updateBestScoreDisplay();
  });

  bindModeButtons();
  buildEraButtons();
  bindCountButtons();
  updateBestScoreDisplay();
})();
