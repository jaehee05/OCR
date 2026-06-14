# 📝 국어 손글씨 채점기

학생이 손으로 쓴 국어 답안 사진을 올리면 Claude Vision API가 OCR + 채점을 한 번에 처리합니다.

## 스택

- Vite + React + TypeScript + Tailwind CSS
- Vercel Serverless Functions (Node)
- Claude Sonnet 4.6 (Vision + Tool Use + Prompt Caching)

## 로컬 개발

```bash
npm install
cp .env.example .env   # ANTHROPIC_API_KEY 채우기
npx vercel dev         # vite + serverless 동시 실행
```

> 프런트만 띄우려면 `npm run dev` 로 돌리되, `/api/grade` 호출은 실패합니다.

## 배포

Vercel에 GitHub 레포 연결 후, 환경변수 `ANTHROPIC_API_KEY` 등록만 하면 끝.

## 동작 원리

1. 학생 답안 사진을 클라이언트에서 1600px 이하로 다운스케일 + JPEG 변환
2. `/api/grade` 가 지문/문항/모범답안과 함께 Claude Sonnet 4.6 에 전달
3. Claude 가 `grade_answer` tool 을 호출해 `{ per_question, total_score, ... }` 구조로 응답
4. 결과 패널에 OCR된 학생 답안 + 점수 + 피드백 표시

손글씨 OCR 자체를 Claude 가 직접 수행하므로, 전통 OCR(예: Tesseract)이 약한 한국어 손글씨도 비교적 안정적으로 처리됩니다.
