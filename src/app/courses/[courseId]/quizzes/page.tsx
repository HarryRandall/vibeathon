'use client';

import { useState } from 'react';

const sampleQuestion = {
  prompt: 'Which statement best describes when to use a loop instead of a single conditional?',
  options: [
    'When you need to repeat an action until a condition changes',
    'When you only need to branch once between two paths',
    'When you are declaring a new variable',
    'When printing debug output only',
  ],
  correctIndex: 0,
} as const;

export default function QuizzesPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const correct = submitted && selected === sampleQuestion.correctIndex;
  const wrong = submitted && selected !== null && selected !== sampleQuestion.correctIndex;

  return (
    <div className="user_content mx-auto max-w-3xl">
      <div className="mb-8 border-b border-anu-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Practice quizzes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Exam-style practice generated from your course content. This page demonstrates layout and interaction; question
          generation will plug in once materials are indexed.
        </p>
      </div>

      <div className="rounded-xl border border-anu-border bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-anu-gold">Sample · COMP4610</p>
        <p className="mt-3 text-base font-medium leading-relaxed text-slate-900">{sampleQuestion.prompt}</p>

        <ul className="mt-6 space-y-3">
          {sampleQuestion.options.map((opt, i) => {
            const id = `opt-${i}`;
            const isSelected = selected === i;
            return (
              <li key={id}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                    isSelected
                      ? 'border-anu-gold/60 bg-anu-gold/5 ring-1 ring-anu-gold/30'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${submitted && i === sampleQuestion.correctIndex ? 'border-emerald-400 bg-emerald-50' : ''} ${
                    submitted && isSelected && i !== sampleQuestion.correctIndex ? 'border-red-300 bg-red-50' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="quiz"
                    className="mt-0.5 border-slate-300 text-anu-gold focus:ring-anu-gold"
                    checked={isSelected}
                    onChange={() => !submitted && setSelected(i)}
                    disabled={submitted}
                  />
                  <span className="text-slate-800">{opt}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={selected === null || submitted}
            onClick={() => setSubmitted(true)}
            className="rounded-lg bg-anu-gold px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a6730c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit answer
          </button>
          {submitted && (
            <p className={`text-sm font-medium ${correct ? 'text-emerald-700' : wrong ? 'text-red-700' : ''}`}>
              {correct && 'Correct — great for revision.'}
              {wrong && 'Not quite — review the matching lecture or tutorial.'}
            </p>
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Limitation: quiz quality depends on source coverage; always cross-check with official materials and the course
        outline.
      </p>
    </div>
  );
}
