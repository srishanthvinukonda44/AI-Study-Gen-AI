/* ============================================================
   ai.js
   ------------------------------------------------------------
   This file talks DIRECTLY to the AI provider's API from the
   browser using fetch(). There is no backend server in between.

   IMPORTANT (be ready to explain this in an interview):
   Calling an AI API straight from frontend JavaScript means the
   API key is visible in the browser (anyone could open DevTools
   and see it). That's fine for a personal/learning project, but
   in a real product you'd put a small backend in between to hide
   the key and control costs.

   Supported providers: "openai" and "gemini".
   The user enters their own key in the Settings panel; it's
   saved only in their own browser's localStorage.
============================================================ */

const AI = (() => {
  function _extractJson(text) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    return (match ? match[1] : text).trim();
  }

  async function _callOpenAI(prompt, apiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful study assistant for students." },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  }

  async function _callGemini(prompt, apiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  async function ask(prompt) {
    const settings = Storage.getSettings();
    if (!settings.apiKey) {
      throw new Error("Please add your AI API key in Settings (top right) first.");
    }
    if (settings.provider === "gemini") {
      return _callGemini(prompt, settings.apiKey);
    }
    return _callOpenAI(prompt, settings.apiKey);
  }

  /* -------- Feature 1: Flashcards from notes -------- */
  async function generateFlashcards(noteText, numCards = 8) {
    const prompt = `
You are creating study flashcards from a student's notes.
Read the notes below and create exactly ${numCards} flashcards.
Each flashcard must have a short, clear "question" and a concise "answer".
Cover the most important concepts only.

Respond with ONLY valid JSON, in this exact format, no extra text:
{
  "flashcards": [
    {"question": "...", "answer": "..."}
  ]
}

NOTES:
"""
${noteText}
"""`;
    const raw = await ask(prompt);
    const data = JSON.parse(_extractJson(raw));
    return data.flashcards;
  }

  /* -------- Feature 2: Multiple-choice quiz -------- */
  async function generateQuiz(topicOrNotes, numQuestions = 5) {
    const prompt = `
You are creating a multiple-choice quiz for a student to test their knowledge.

Topic / source material:
"""
${topicOrNotes}
"""

Create exactly ${numQuestions} multiple-choice questions.
Each question must have 4 options (A, B, C, D) and only ONE correct answer.
Make the wrong options plausible, not silly.

Respond with ONLY valid JSON, in this exact format, no extra text:
{
  "questions": [
    {
      "question": "...",
      "optionA": "...",
      "optionB": "...",
      "optionC": "...",
      "optionD": "...",
      "correctOption": "A"
    }
  ]
}`;
    const raw = await ask(prompt);
    const data = JSON.parse(_extractJson(raw));
    return data.questions;
  }

  /* -------- Feature 3: Explain a topic simply -------- */
  async function explainTopic(topic) {
    const prompt = `
Explain the following topic to a student in very simple, easy-to-understand words.
Use short sentences, a friendly tone, and a real-life analogy if it helps.
Keep it under 200 words. Do not use markdown headings, just plain explanatory text.
You may use simple bullet points if listing steps.

Topic: ${topic}`;
    const text = await ask(prompt);
    return text.trim();
  }

  return { generateFlashcards, generateQuiz, explainTopic };
})();