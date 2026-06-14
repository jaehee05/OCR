import type { GradeResponse } from '../types';

type Props = {
  result: GradeResponse;
};

export function ResultPanel({ result }: Props) {
  const pct = result.total_max > 0 ? Math.round((result.total_score / result.total_max) * 100) : 0;
  const gradeColor =
    pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-indigo-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">채점 결과</h2>
          <div className="text-right">
            <div className={`text-4xl font-bold ${gradeColor}`}>
              {result.total_score}
              <span className="text-xl text-slate-400"> / {result.total_max}</span>
            </div>
            <div className="text-sm text-slate-500">{pct}점</div>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {result.overall_feedback}
        </p>
      </div>

      <div className="space-y-3">
        {result.per_question.map((q) => (
          <div
            key={q.number}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-700">
                  문항 {q.number}
                </span>
                {q.is_correct ? (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    ⭕ 정답
                  </span>
                ) : (
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                    ❌ 오답
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-slate-700">
                {q.score} / {q.max_score}점
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs font-medium text-slate-400">학생 답안 (OCR)</div>
              <div className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {q.recognized_answer || <span className="text-slate-400">(빈 답안)</span>}
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{q.feedback}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
