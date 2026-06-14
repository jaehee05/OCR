import { useMemo, useState } from 'react';
import { QuestionEditor } from './components/QuestionEditor';
import { ImageDropzone } from './components/ImageDropzone';
import { ResultPanel } from './components/ResultPanel';
import { fileToCompressedImage } from './lib/image';
import type { GradeResponse, Question } from './types';

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: crypto.randomUUID(),
    number: '1',
    question: '',
    answer: '',
    points: 10,
  },
];

export default function App() {
  const [passage, setPassage] = useState('');
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResponse | null>(null);

  const canSubmit = useMemo(() => {
    if (!file) return false;
    return questions.some((q) => q.question.trim() && q.answer.trim());
  }, [file, questions]);

  const onFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const img = await fileToCompressedImage(file);
      const payload = {
        passage: passage.trim() || undefined,
        questions: questions
          .filter((q) => q.question.trim() && q.answer.trim())
          .map((q) => ({
            number: q.number,
            question: q.question,
            answer: q.answer,
            points: q.points,
          })),
        imageBase64: img.base64,
        imageMediaType: img.mediaType,
      };
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || '채점 실패');
      }
      setResult(data as GradeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          📝 국어 손글씨 채점기
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          학생이 손으로 쓴 답안을 사진으로 올리면 AI가 인식하고 채점합니다.
        </p>
      </header>

      <main className="grid flex-1 gap-6 lg:grid-cols-2">
        <section className="space-y-5">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              지문 <span className="font-normal text-slate-400">(선택)</span>
            </h2>
            <textarea
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              rows={5}
              placeholder="국어 지문을 붙여넣으세요. (없어도 채점 가능)"
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">문항 및 모범답안</h2>
            <QuestionEditor questions={questions} onChange={setQuestions} />
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">학생 답안 사진</h2>
            <ImageDropzone onFile={onFile} previewUrl={previewUrl} />
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? '채점 중...' : '🤖 AI 채점하기'}
          </button>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {result && <ResultPanel result={result} />}
        </section>
      </main>

      <footer className="mt-10 text-center text-xs text-slate-400">
        Powered by Claude Sonnet 4.6 Vision
      </footer>
    </div>
  );
}
