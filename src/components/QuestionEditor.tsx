import type { Question } from '../types';

type Props = {
  questions: Question[];
  onChange: (next: Question[]) => void;
};

export function QuestionEditor({ questions, onChange }: Props) {
  const update = (id: string, patch: Partial<Question>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const add = () =>
    onChange([
      ...questions,
      {
        id: crypto.randomUUID(),
        number: String(questions.length + 1),
        question: '',
        answer: '',
        points: 10,
      },
    ]);

  const remove = (id: string) => onChange(questions.filter((q) => q.id !== id));

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <div
          key={q.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex w-20 shrink-0 flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">번호</label>
              <input
                value={q.number}
                onChange={(e) => update(q.id, { number: e.target.value })}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <label className="text-xs font-medium text-slate-500">배점</label>
              <input
                type="number"
                min={1}
                value={q.points}
                onChange={(e) => update(q.id, { points: Number(e.target.value) || 0 })}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">문제</label>
              <textarea
                value={q.question}
                onChange={(e) => update(q.id, { question: e.target.value })}
                placeholder="예) 위 글의 주제를 한 문장으로 쓰시오."
                rows={2}
                className="resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <label className="text-xs font-medium text-slate-500">모범답안</label>
              <textarea
                value={q.answer}
                onChange={(e) => update(q.id, { answer: e.target.value })}
                placeholder="예) 자연 보호의 중요성"
                rows={2}
                className="resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <button
              onClick={() => remove(q.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500"
              aria-label="문항 삭제"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-500"
      >
        + 문항 추가
      </button>
    </div>
  );
}
