import type { OcrResponse } from '../types';

type Props = {
  result: OcrResponse;
  onChange: (next: string) => void;
};

const CONFIDENCE_STYLES: Record<OcrResponse['overall_confidence'], { label: string; cls: string }> = {
  high: { label: '인식 확신도: 높음', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { label: '인식 확신도: 보통', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: '인식 확신도: 낮음 — 확인 필요', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export function OcrPanel({ result, onChange }: Props) {
  const conf = CONFIDENCE_STYLES[result.overall_confidence];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.raw_text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">📝 인식된 답안</h2>
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${conf.cls}`}>
          {conf.label}
        </span>
      </div>

      <textarea
        value={result.raw_text}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(6, Math.min(20, result.raw_text.split('\n').length + 1))}
        spellCheck={false}
        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm leading-relaxed text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none"
      />

      {result.notes && (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          💡 <span className="font-medium">메모:</span> {result.notes}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          📋 복사
        </button>
      </div>
    </div>
  );
}
