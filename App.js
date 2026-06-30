/* ============================================================
   app.js
   ------------------------------------------------------------
   This is the "brain" of the frontend. Since there's no backend
   to handle different URLs, we do simple client-side routing
   using the URL hash (e.g. #/upload, #/quiz, #/dashboard).

   Flow:
     1. renderRoute() looks at window.location.hash
     2. It calls the matching "page" function (e.g. pageUpload())
     3. That function builds an HTML string and injects it into
        the <main id="app"> element in index.html
     4. We attach event listeners (forms, buttons) after injecting

   This is the same basic idea every frontend framework (React,
   Vue) automates for you — here we do it by hand so it's easy
   to understand exactly what's happening.
============================================================ */

const App = document.getElementById("app");

function navigate(hash) {
  window.location.hash = hash;
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", () => {
  renderRoute();
  initSettingsModal();
});

function renderRoute() {
  const hash = window.location.hash || "#/";
  const [, route, param, sub] = hash.split("/"); // "#/flashcards/3" -> ["", "flashcards", "3"]

  if (!route || route === "") return pageHome();
  if (route === "upload") return pageUpload();
  if (route === "flashcards" && param) return pageFlashcards(param);
  if (route === "quiz" && !param) return pageQuizSetup();
  if (route === "quiz" && param === "take" && sub) return pageTakeQuiz(sub);
  if (route === "quiz" && param) return pageQuizResultRedirect(param); // safety fallback
  if (route === "explain") return pageExplain();
  if (route === "dashboard") return pageDashboard();

  return pageHome();
}

function setActiveNav(route) {
  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

function flashMessage(message, type = "success") {
  const wrap = document.createElement("div");
  wrap.className = `flash flash-${type}`;
  wrap.textContent = message;
  App.prepend(wrap);
  setTimeout(() => wrap.remove(), 4000);
}

/* ================= HOME ================= */
function pageHome() {
  setActiveNav("");
  const stats = Storage.getDashboardStats();
  App.innerHTML = `
    <section class="hero">
      <h1>Study smarter, not harder 🚀</h1>
      <p>Upload your notes, let AI turn them into flashcards and quizzes,
         and track your progress — 100% in your browser, no backend needed.</p>
    </section>

    <section class="card-grid">
      <a href="#/upload" class="feature-card">
        <span class="feature-icon">📝</span><h3>Upload Notes</h3>
        <p>Paste or upload your notes and let AI generate flashcards automatically.</p>
      </a>
      <a href="#/quiz" class="feature-card">
        <span class="feature-icon">❓</span><h3>Quiz Mode</h3>
        <p>Test yourself with AI-generated multiple-choice questions.</p>
      </a>
      <a href="#/explain" class="feature-card">
        <span class="feature-icon">💡</span><h3>Explain a Topic</h3>
        <p>Confused about something? Get a simple, student-friendly explanation.</p>
      </a>
      <a href="#/dashboard" class="feature-card">
        <span class="feature-icon">📊</span><h3>Dashboard</h3>
        <p>Track your notes, flashcards, quizzes and average score over time.</p>
      </a>
    </section>

    <section class="quick-stats">
      <div class="stat-box"><strong>${stats.totalNotes}</strong><span>Notes Uploaded</span></div>
      <div class="stat-box"><strong>${stats.totalFlashcards}</strong><span>Flashcards Created</span></div>
      <div class="stat-box"><strong>${stats.totalQuizzesTaken}</strong><span>Quizzes Taken</span></div>
      <div class="stat-box"><strong>${stats.avgScore}%</strong><span>Average Score</span></div>
    </section>
  `;
}

/* ================= UPLOAD NOTES ================= */
function pageUpload() {
  setActiveNav("upload");
  const notes = Storage.getNotes();

  App.innerHTML = `
    <h1>📝 Upload Your Notes</h1>
    <p class="subtitle">Paste your notes below, or upload a .txt file. AI will generate flashcards for you.</p>

    <form id="upload-form" class="form-card">
      <label for="title">Title</label>
      <input type="text" id="title" placeholder="e.g. Photosynthesis - Chapter 4" required>

      <label for="content">Notes (paste text)</label>
      <textarea id="content" rows="10" placeholder="Paste your notes here..."></textarea>

      <label for="file">...or upload a .txt file instead</label>
      <input type="file" id="file" accept=".txt">

      <button type="submit" class="btn-primary" id="upload-btn">✨ Generate Flashcards</button>
    </form>

    ${notes.length ? `
      <h2 class="section-title">Your Uploaded Notes</h2>
      <div class="list-grid">
        ${notes.map(n => `
          <a href="#/flashcards/${n.id}" class="list-item">
            <strong>${escapeHtml(n.title)}</strong>
            <span class="muted">${n.createdAt}</span>
          </a>`).join("")}
      </div>` : ""}
  `;

  document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    let content = document.getElementById("content").value.trim();
    const file = document.getElementById("file").files[0];
    const btn = document.getElementById("upload-btn");

    if (file) {
      content = await file.text();
    }
    if (!title || !content) {
      flashMessage("Please provide both a title and some notes content.", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "⏳ Generating flashcards...";
    try {
      const note = Storage.saveNote(title, content);
      const cards = await AI.generateFlashcards(content, 8);
      Storage.saveFlashcards(note.id, cards);
      flashMessage(`Generated ${cards.length} flashcards from your notes!`);
      navigate(`#/flashcards/${note.id}`);
    } catch (err) {
      flashMessage(err.message, "error");
      btn.disabled = false;
      btn.textContent = "✨ Generate Flashcards";
    }
  });
}

/* ================= FLASHCARDS ================= */
function pageFlashcards(noteId) {
  setActiveNav("upload");
  const note = Storage.getNote(noteId);
  const cards = Storage.getFlashcardsForNote(noteId);

  if (!note) {
    App.innerHTML = `<p>Note not found. <a href="#/upload">Go back</a></p>`;
    return;
  }

  App.innerHTML = `
    <h1>📇 Flashcards: ${escapeHtml(note.title)}</h1>
    <p class="subtitle">Click a card to flip it. ${cards.length} flashcards generated.</p>

    <div class="flashcard-grid">
      ${cards.map(c => `
        <div class="flashcard" data-id="${c.id}">
          <div class="flashcard-inner">
            <div class="flashcard-front"><span class="card-label">Q</span><p>${escapeHtml(c.question)}</p></div>
            <div class="flashcard-back"><span class="card-label">A</span><p>${escapeHtml(c.answer)}</p></div>
          </div>
        </div>`).join("")}
    </div>

    <a href="#/upload" class="btn-secondary">← Upload More Notes</a>
    <a href="#/quiz?note=${note.id}" class="btn-primary" id="quiz-on-note">Take a Quiz on This →</a>
  `;

  document.querySelectorAll(".flashcard").forEach((card) => {
    card.addEventListener("click", () => {
      card.classList.toggle("flipped");
      Storage.markReviewed(card.dataset.id);
    });
  });

  document.getElementById("quiz-on-note").addEventListener("click", (e) => {
    e.preventDefault();
    sessionStorage.setItem("prefillNoteId", note.id);
    navigate("#/quiz");
  });
}

/* ================= QUIZ SETUP ================= */
function pageQuizSetup() {
  setActiveNav("quiz");
  const notes = Storage.getNotes();
  const prefillNoteId = sessionStorage.getItem("prefillNoteId") || "";
  sessionStorage.removeItem("prefillNoteId");

  App.innerHTML = `
    <h1>❓ Quiz Mode</h1>
    <p class="subtitle">Pick one of your uploaded notes, or type any topic, and AI will generate a 5-question quiz.</p>

    <form id="quiz-form" class="form-card">
      <label for="topic">Enter a topic (used if no note is selected)</label>
      <input type="text" id="topic" placeholder="e.g. Newton's Laws of Motion">

      ${notes.length ? `
        <label for="note-select">...or choose one of your uploaded notes</label>
        <select id="note-select">
          <option value="">-- No note, use topic above --</option>
          ${notes.map(n => `<option value="${n.id}" ${String(n.id) === prefillNoteId ? "selected" : ""}>${escapeHtml(n.title)}</option>`).join("")}
        </select>` : ""}

      <button type="submit" class="btn-primary" id="quiz-btn">✨ Generate Quiz</button>
    </form>
  `;

  document.getElementById("quiz-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const topicInput = document.getElementById("topic").value.trim();
    const noteSelect = document.getElementById("note-select");
    const noteId = noteSelect ? noteSelect.value : "";
    const btn = document.getElementById("quiz-btn");

    let sourceText = topicInput;
    let topic = topicInput;
    if (noteId) {
      const note = Storage.getNote(noteId);
      sourceText = note.content;
      topic = note.title;
    }

    if (!sourceText) {
      flashMessage("Please enter a topic or choose a note to quiz yourself on.", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "⏳ Generating quiz...";
    try {
      const questions = await AI.generateQuiz(sourceText, 5);
      const quiz = Storage.saveQuiz(topic, questions, noteId || null);
      navigate(`#/quiz/take/${quiz.id}`);
    } catch (err) {
      flashMessage(err.message, "error");
      btn.disabled = false;
      btn.textContent = "✨ Generate Quiz";
    }
  });
}

/* ================= TAKE QUIZ ================= */
function pageTakeQuiz(quizId) {
  setActiveNav("quiz");
  const quiz = Storage.getQuiz(quizId);
  if (!quiz) {
    App.innerHTML = `<p>Quiz not found. <a href="#/quiz">Go back</a></p>`;
    return;
  }

  App.innerHTML = `
    <h1>🧪 Quiz: ${escapeHtml(quiz.topic)}</h1>
    <p class="subtitle">Answer all ${quiz.questions.length} questions, then submit to see your score.</p>

    <form id="take-quiz-form" class="form-card">
      ${quiz.questions.map((q, idx) => `
        <div class="quiz-question">
          <p class="q-text"><strong>${idx + 1}.</strong> ${escapeHtml(q.question)}</p>
          <div class="options">
            <label><input type="radio" name="q${q.qid}" value="A" required> ${escapeHtml(q.optionA)}</label>
            <label><input type="radio" name="q${q.qid}" value="B"> ${escapeHtml(q.optionB)}</label>
            <label><input type="radio" name="q${q.qid}" value="C"> ${escapeHtml(q.optionC)}</label>
            <label><input type="radio" name="q${q.qid}" value="D"> ${escapeHtml(q.optionD)}</label>
          </div>
        </div>`).join("")}
      <button type="submit" class="btn-primary">Submit Quiz</button>
    </form>
  `;

  document.getElementById("take-quiz-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    let score = 0;
    const results = quiz.questions.map((q) => {
      const chosen = formData.get(`q${q.qid}`);
      const isCorrect = chosen === q.correctOption;
      if (isCorrect) score++;
      return { question: q.question, chosen, correct: q.correctOption, isCorrect,
        options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD } };
    });

    Storage.saveAttempt(quiz.id, quiz.topic, score, quiz.questions.length);
    renderQuizResult(quiz, results, score);
  });
}

function renderQuizResult(quiz, results, score) {
  const total = results.length;
  App.innerHTML = `
    <h1>🏁 Quiz Result: ${escapeHtml(quiz.topic)}</h1>
    <div class="score-banner">You scored <strong>${score} / ${total}</strong> (${((score/total)*100).toFixed(1)}%)</div>

    <div class="results-list">
      ${results.map((r, idx) => `
        <div class="result-item ${r.isCorrect ? "correct" : "incorrect"}">
          <p class="q-text"><strong>${idx + 1}. ${escapeHtml(r.question)}</strong></p>
          <p>Your answer: <span class="answer-chip">${r.chosen || "No answer"} - ${escapeHtml(r.options[r.chosen] || "")}</span></p>
          ${!r.isCorrect ? `<p>Correct answer: <span class="answer-chip correct-chip">${r.correct} - ${escapeHtml(r.options[r.correct])}</span></p>` : ""}
        </div>`).join("")}
    </div>

    <a href="#/quiz" class="btn-primary">Take Another Quiz</a>
    <a href="#/dashboard" class="btn-secondary">View Dashboard</a>
  `;
}

function pageQuizResultRedirect() {
  navigate("#/quiz");
}

/* ================= EXPLAIN TOPIC ================= */
function pageExplain() {
  setActiveNav("explain");
  const history = Storage.getExplanations().slice(0, 6);

  App.innerHTML = `
    <h1>💡 Explain This Topic</h1>
    <p class="subtitle">Confused about something? Type it below and get a simple, student-friendly explanation.</p>

    <form id="explain-form" class="form-card">
      <label for="explain-topic">Topic</label>
      <input type="text" id="explain-topic" placeholder="e.g. What is recursion?" required>
      <button type="submit" class="btn-primary" id="explain-btn">✨ Explain Simply</button>
    </form>

    <div id="explanation-result"></div>

    ${history.length ? `
      <h2 class="section-title">Recently Explained Topics</h2>
      <div class="list-grid">
        ${history.map(h => `
          <div class="list-item">
            <strong>${escapeHtml(h.topic)}</strong>
            <span class="muted">${h.createdAt}</span>
            <p>${escapeHtml(h.explanation.slice(0, 120))}${h.explanation.length > 120 ? "..." : ""}</p>
          </div>`).join("")}
      </div>` : ""}
  `;

  document.getElementById("explain-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = document.getElementById("explain-topic").value.trim();
    const btn = document.getElementById("explain-btn");
    if (!topic) return;

    btn.disabled = true;
    btn.textContent = "⏳ Thinking...";
    try {
      const explanation = await AI.explainTopic(topic);
      Storage.saveExplanation(topic, explanation);
      document.getElementById("explanation-result").innerHTML = `
        <div class="explanation-box">
          <h3>Explanation: ${escapeHtml(topic)}</h3>
          <p>${escapeHtml(explanation)}</p>
        </div>`;
    } catch (err) {
      flashMessage(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ Explain Simply";
    }
  });
}

/* ================= DASHBOARD ================= */
function pageDashboard() {
  setActiveNav("dashboard");
  const stats = Storage.getDashboardStats();

  App.innerHTML = `
    <h1>📊 Your Progress Dashboard</h1>

    <section class="quick-stats">
      <div class="stat-box"><strong>${stats.totalNotes}</strong><span>Notes Uploaded</span></div>
      <div class="stat-box"><strong>${stats.totalFlashcards}</strong><span>Flashcards Created</span></div>
      <div class="stat-box"><strong>${stats.totalQuizzesTaken}</strong><span>Quizzes Taken</span></div>
      <div class="stat-box"><strong>${stats.avgScore}%</strong><span>Average Score</span></div>
    </section>

    <h2 class="section-title">Recent Quiz Attempts</h2>
    ${stats.recentAttempts.length ? `
      <table class="data-table">
        <thead><tr><th>Topic</th><th>Score</th><th>Percentage</th><th>Date</th></tr></thead>
        <tbody>
          ${stats.recentAttempts.map(a => `
            <tr>
              <td>${escapeHtml(a.topic)}</td>
              <td>${a.score} / ${a.total}</td>
              <td>${((a.score/a.total)*100).toFixed(1)}%</td>
              <td>${a.takenAt}</td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<p>No quizzes taken yet. <a href="#/quiz">Take your first quiz →</a></p>`}

    <button id="clear-data-btn" class="btn-secondary" style="margin-top:24px;">🗑️ Clear All My Data</button>
  `;

  document.getElementById("clear-data-btn").addEventListener("click", () => {
    if (confirm("This will permanently delete all your notes, flashcards, quizzes and progress from this browser. Continue?")) {
      Storage.clearAllData();
      flashMessage("All data cleared.");
      navigate("#/");
    }
  });
}

/* ================= SETTINGS MODAL (API key) ================= */
function initSettingsModal() {
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("settings-btn");
  const closeBtn = document.getElementById("settings-close");
  const form = document.getElementById("settings-form");
  const providerSelect = document.getElementById("provider-select");
  const apiKeyInput = document.getElementById("api-key-input");

  const settings = Storage.getSettings();
  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey;

  openBtn.addEventListener("click", () => modal.classList.add("open"));
  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    Storage.saveSettings({
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
    });
    modal.classList.remove("open");
    flashMessage("Settings saved!");
  });
}

/* ================= Utility ================= */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}