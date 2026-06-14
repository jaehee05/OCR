import { useState } from 'react';
import { QuestionEditor } from './components/QuestionEditor';
import { ImageDropzone } from './components/ImageDropzone';
import { ResultPanel } from './components/ResultPanel';
import { OcrPanel } from './components/OcrPanel';
import { fileToCompressedImage } from './lib/image';
import type { GradeResponse, OcrResponse, Question } from './types';

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

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrResponse | null>(null);

  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeResponse | null>(null);

  const [showGrading, setShowGrading] = useState(false);

  const onFile = (f: File) => {
    setFile(f);
    setOcr(null);
    setGrade(null);
    setOcrError(null);
    setGradeError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const runOcr = async () => {
    if (!file) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcr(null);
    setGrade(null);
    try {
      const img = await fileToCompressedImage(file);
      const hintBits = [
        passage.trim(),
        ...questions
          .filter((q) => q.question.trim() || q.answer.trim())
          .map((q) => `[${q.number}] ${q.question}${q.answer ? ` (모범답안: ${q.answer})` : ''}`),
      ].filter(Boolean);
      const payload = {
        imageBase64: img.base64,
        imageMediaType: img.mediaType,
        hint: hintBits.length ? hintBits.join('\n') : undefined,
      };
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || '텍스트 인식 실패');
      }
      setOcr(data as OcrResponse);
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcrLoading(false);
    }
  };

  const runGrade = async () => {
    if (!file) return;
    const validQs = questions.filter((q) => q.question.trim() && q.answer.trim());
    if (!validQs.length) {
      setGradeError('채점하려면 문항과 모범답안을 최소 1개 입력하세요.');
      return;
    }
    setGradeLoading(true);
    setGradeError(null);
    setGrade(null);
    try {
      const img = await fileToCompressedImage(file);
      const payload = {
        passage: passage.trim() || undefined,
        questions: validQs.map((q) => ({
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
      setGrade(data as GradeResponse);
    } catch (e) {
      setGradeError(e instanceof Error ? e.message : String(e));
    } finally {
      setGradeLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          📝 국어 손글씨 채점기
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          학생이 노트에 손으로 쓴 답안을 사진으로 올리면 AI가 인식합니다.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">학생 답안 사진</h2>
        <ImageDropzone onFile={onFile} previewUrl={previewUrl} />

        <button
          type="button"
          onClick={runOcr}
          disabled={!file || ocrLoading}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {ocrLoading ? '🔍 인식 중...' : '🔍 텍스트 추출하기'}
        </button>

        {ocrError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {ocrError}
          </div>
        )}
      </section>

      {ocr && (
        <section className="mt-6">
          <OcrPanel
            result={ocr}
            onChange={(next) => setOcr({ ...ocr, raw_text: next })}
          />
        </section>
      )}

      <section className="mt-8">
        <button
          type="button"
          onClick={() => setShowGrading((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <span>🎯 채점도 같이 하기 (선택)</span>
          <span className="text-slate-400">{showGrading ? '▲ 닫기' : '▼ 펼치기'}</span>
        </button>

        {showGrading && (
          <div className="mt-4 space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                지문 <span className="font-normal text-slate-400">(선택)</span>
              </h3>
              <textarea
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                rows={4}
                placeholder="국어 지문을 붙여넣으세요."
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">문항 및 모범답안</h3>
              <QuestionEditor questions={questions} onChange={setQuestions} />
            </div>

            <button
              type="button"
              onClick={runGrade}
              disabled={!file || gradeLoading}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {gradeLoading ? '채점 중...' : '🤖 AI 채점하기'}
            </button>

            {gradeError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {gradeError}
              </div>
            )}

            {grade && <ResultPanel result={grade} />}
          </div>
        )}
      </section>

      <footer className="mt-12 pb-4 text-center text-xs text-slate-400">
        Powered by Claude Haiku 4.5 Vision
      </footer>
    </div>
  );
}
