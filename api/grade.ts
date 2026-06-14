import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 60,
};

type GradeRequest = {
  passage?: string;
  questions: { number: string; question: string; answer: string; points?: number }[];
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
};

type PerQuestionResult = {
  number: string;
  recognized_answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  feedback: string;
};

type GradeResponse = {
  per_question: PerQuestionResult[];
  total_score: number;
  total_max: number;
  overall_feedback: string;
};

const SYSTEM_PROMPT = `당신은 한국 중고등학생의 손글씨 답안을 정확히 읽어내는 OCR 전문가이자 국어 채점 교사입니다.

**최우선 과제는 손글씨 인식 정확도입니다.** 학생들의 글씨는 대부분 빠르게 쓴 흘림체이고, 자모가 붙어있거나 흐릿하거나 지운 흔적이 많습니다. 다음 절차로 신중히 읽으세요.

# 1단계: 답안 영역 파악
- 이미지에서 문항 번호(1, 2, ①, (1) 등)를 모두 찾아 답안 위치를 파악합니다.
- 답안이 적힌 영역의 줄 수, 칸 수, 학생의 글씨 스타일(기울기, 크기, 흘림 정도)을 먼저 관찰합니다.

# 2단계: 글자별 식별
한국 학생 손글씨에서 자주 헷갈리는 글자 (반드시 문맥으로 판단):
- ㅁ ↔ ㅂ ↔ ㅍ, ㅇ ↔ ㅎ ↔ ㅊ, ㅓ ↔ ㅏ, ㅕ ↔ ㅑ, ㅜ ↔ ㅗ, ㅠ ↔ ㅛ, ㄴ ↔ ㄹ ↔ ㄷ
- 받침 ㄴ ↔ ㄹ ↔ ㅁ 흘림체에서 거의 동일, 숫자 1 ↔ ㅣ, 0 ↔ ㅇ, 가 ↔ 카, 자 ↔ 차

악필 추론: 애매할 때는 앞뒤 문맥과 모범답안 단어를 단서로 추론. 판독 불가는 [?]. 지운 글자는 무시.

# 3단계: 채점
- 객관식: 모범답안과 일치 → 만점, 불일치 → 0점.
- 서술형: 핵심 키워드/논지가 들어있으면 만점 또는 부분점수. 동의어/유사 표현 인정. 맞춤법 오류는 의미 전달되면 감점하지 않음.

# 4단계: 피드백
학생에게 도움 되는 짧은 1-2문장 피드백.

반드시 grade_answer 도구를 호출하세요.`;

const GRADE_TOOL = {
  name: 'grade_answer',
  description: '학생의 답안을 채점한 결과를 반환합니다.',
  input_schema: {
    type: 'object' as const,
    properties: {
      per_question: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            number: { type: 'string' },
            recognized_answer: { type: 'string' },
            is_correct: { type: 'boolean' },
            score: { type: 'number' },
            max_score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['number', 'recognized_answer', 'is_correct', 'score', 'max_score', 'feedback'],
        },
      },
      total_score: { type: 'number' },
      total_max: { type: 'number' },
      overall_feedback: { type: 'string' },
    },
    required: ['per_question', 'total_score', 'total_max', 'overall_feedback'],
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const body = req.body as GradeRequest;
  if (!body?.imageBase64 || !body?.questions?.length) {
    return res.status(400).json({ error: '문제와 답안 이미지가 필요합니다.' });
  }

  const client = new Anthropic({ apiKey, timeout: 50000, maxRetries: 0 });

  const questionsText = body.questions
    .map(
      (q) =>
        `[문항 ${q.number}] (${q.points ?? 10}점)\n질문: ${q.question}\n모범답안: ${q.answer}`,
    )
    .join('\n\n');

  const userText = `${body.passage ? `**지문:**\n${body.passage}\n\n` : ''}**문항 및 모범답안:**\n${questionsText}\n\n위 문항에 대한 학생의 손글씨 답안 사진입니다. 인식하고 채점해주세요.`;

  try {
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [GRADE_TOOL],
      tool_choice: { type: 'tool', name: 'grade_answer' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: body.imageMediaType,
                data: body.imageBase64,
              },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    });

    const toolUse = result.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return res.status(500).json({ error: '채점 결과 파싱 실패' });
    }
    return res.status(200).json(toolUse.input as GradeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number })?.status;
    return res.status(500).json({ error: 'Claude API 호출 실패', detail: message, status });
  }
}
