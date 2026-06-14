import { useRef, useState } from 'react';

type Props = {
  onFile: (file: File) => void;
  previewUrl: string | null;
};

export function ImageDropzone({ onFile, previewUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    onFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition ${
          dragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-300 bg-white hover:border-indigo-300'
        }`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="학생 답안"
            className="max-h-[480px] rounded-md object-contain"
          />
        ) : (
          <div className="text-center text-slate-500">
            <div className="text-3xl">📄</div>
            <p className="mt-2 text-sm font-medium">학생 답안 사진을 끌어다 놓거나 클릭</p>
            <p className="mt-1 text-xs text-slate-400">JPG / PNG / WEBP</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          파일 선택
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          📷 카메라
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
