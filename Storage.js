/* ============================================================
   storage.js
   ------------------------------------------------------------
   Since this is a FRONTEND-ONLY app (no backend, no Flask,
   no real database), we use the browser's localStorage as our
   "database". localStorage just saves text data on the user's
   own computer, inside their browser, and it stays there even
   after closing the tab/browser.

   Everything is stored as JSON strings under simple keys:
     - "studybuddy_notes"
     - "studybuddy_flashcards"
     - "studybuddy_quizzes"
     - "studybuddy_attempts"
     - "studybuddy_explanations"
     - "studybuddy_settings"   (API key + provider choice)

   Every function below does: read JSON -> modify -> save JSON.
   This file is the ONLY place that touches localStorage directly,
   so the rest of the app just calls easy functions like
   Storage.saveNote(...) without worrying about JSON parsing.
============================================================ */

const Storage = (() => {
  const KEYS = {
    notes: "studybuddy_notes",
    flashcards: "studybuddy_flashcards",
    quizzes: "studybuddy_quizzes",
    attempts: "studybuddy_attempts",
    explanations: "studybuddy_explanations",
    settings: "studybuddy_settings",
  };

  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error("Storage read error:", e);
      return fallback;
    }
  }

  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function _newId(list) {
    return list.length ? Math.max(...list.map((i) => i.id)) + 1 : 1;
  }

  function nowString() {
    return new Date().toLocaleString();
  }

  /* ---------------- Settings (API key / provider) ---------------- */
  function getSettings() {
    return _get(KEYS.settings, { provider: "openai", apiKey: "" });
  }
  function saveSettings(settings) {
    _set(KEYS.settings, settings);
  }

  /* ---------------- Notes ---------------- */
  function getNotes() {
    return _get(KEYS.notes, []);
  }
  function saveNote(title, content) {
    const notes = getNotes();
    const note = { id: _newId(notes), title, content, createdAt: nowString() };
    notes.unshift(note);
    _set(KEYS.notes, notes);
    return note;
  }
  function getNote(id) {
    return getNotes().find((n) => n.id === Number(id));
  }

  /* ---------------- Flashcards ---------------- */
  function getFlashcards() {
    return _get(KEYS.flashcards, []);
  }
  function saveFlashcards(noteId, cards) {
    const all = getFlashcards();
    let nextId = _newId(all);
    const saved = cards.map((c) => ({
      id: nextId++,
      noteId,
      question: c.question,
      answer: c.answer,
      timesReviewed: 0,
      createdAt: nowString(),
    }));
    _set(KEYS.flashcards, [...all, ...saved]);
    return saved;
  }
  function getFlashcardsForNote(noteId) {
    return getFlashcards().filter((f) => f.noteId === Number(noteId));
  }
  function markReviewed(flashcardId) {
    const all = getFlashcards();
    const card = all.find((c) => c.id === Number(flashcardId));
    if (card) card.timesReviewed += 1;
    _set(KEYS.flashcards, all);
  }

  /* ---------------- Quizzes ---------------- */
  function getQuizzes() {
    return _get(KEYS.quizzes, []);
  }
  function saveQuiz(topic, questions, noteId = null) {
    const quizzes = getQuizzes();
    const quiz = {
      id: _newId(quizzes),
      topic,
      noteId,
      createdAt: nowString(),
      questions: questions.map((q, idx) => ({ qid: idx + 1, ...q })),
    };
    quizzes.unshift(quiz);
    _set(KEYS.quizzes, quizzes);
    return quiz;
  }
  function getQuiz(id) {
    return getQuizzes().find((q) => q.id === Number(id));
  }

  /* ---------------- Quiz Attempts ---------------- */
  function getAttempts() {
    return _get(KEYS.attempts, []);
  }
  function saveAttempt(quizId, topic, score, total) {
    const attempts = getAttempts();
    const attempt = {
      id: _newId(attempts),
      quizId,
      topic,
      score,
      total,
      takenAt: nowString(),
    };
    attempts.unshift(attempt);
    _set(KEYS.attempts, attempts);
    return attempt;
  }

  /* ---------------- Explanations ---------------- */
  function getExplanations() {
    return _get(KEYS.explanations, []);
  }
  function saveExplanation(topic, explanation) {
    const list = getExplanations();
    const item = { id: _newId(list), topic, explanation, createdAt: nowString() };
    list.unshift(item);
    _set(KEYS.explanations, list);
    return item;
  }

  /* ---------------- Dashboard stats ---------------- */
  function getDashboardStats() {
    const notes = getNotes();
    const flashcards = getFlashcards();
    const attempts = getAttempts();

    const avgScore = attempts.length
      ? (
          attempts.reduce((sum, a) => sum + (a.score / a.total) * 100, 0) /
          attempts.length
        ).toFixed(1)
      : 0;

    return {
      totalNotes: notes.length,
      totalFlashcards: flashcards.length,
      totalQuizzesTaken: attempts.length,
      avgScore,
      recentAttempts: attempts.slice(0, 8),
    };
  }

  function clearAllData() {
    Object.values(KEYS).forEach((k) => {
      if (k !== KEYS.settings) localStorage.removeItem(k);
    });
  }

  return {
    getSettings, saveSettings,
    getNotes, saveNote, getNote,
    getFlashcards, saveFlashcards, getFlashcardsForNote, markReviewed,
    getQuizzes, saveQuiz, getQuiz,
    getAttempts, saveAttempt,
    getExplanations, saveExplanation,
    getDashboardStats, clearAllData,
  };
})();