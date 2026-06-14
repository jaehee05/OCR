import Anthropic from '@anthropic-ai/sdk';

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

const SYSTEM_PROMPT = `당신은 한국 중고등학생의 국어 답안을 채점하는 전문 국어 교사입니다.

학생이 손글씨로 작성한 답안 사진을 받게 됩니다. 다음 순서로 작업하세요:

1. **손글씨 인식**: 학생 손글씨를 최대한 정확히 한글로 읽어냅니다.
   - 흐릿하거나 지운 글자도 문맥상 추론하되, 확실하지 않으면 [?]로 표시합니다.
   - 학생이 답안을 수정한 흔적이 있으면 최종 답안만 읽습니다.

2. **문항 매칭**: 인식된 답안을 각 문항 번호에 매칭합니다.

3. **채점**:
   - 객관식(숫자/기호): 모범답안과 정확히 일치 → 만점
   - 서술형: 모범답안의 핵심 키워드/논지가 포함되면 부분점수 또는 만점. 동의어/유사 표현은 인정.
   - 한자/외래어 표기 사소한 차이는 감점하지 않음.
   - 맞춤법 오류는 의미 전달이 되면 감점하지 않음 (국어 문법 문항이 아닌 한).

4. **피드백**: 학생에게 도움이 되는 짧고 구체적인 피드백 (1-2문장).

반드시 grade_answer 도구를 호출해서 결과를 반환하세요.`;

const GRADE_TOOL = {
  name: 'grade_answer',
  description: '학생의 답안을 채점한 결과를 반환합니다.',
  input_schema: {
    type: 'object' as const,
    properties: {
      per_question: {
        type: 'array',
        description: '각 문항별 채점 결과',
        items: {
          type: 'object',
          properties: {
            number: { type: 'string', description: '문항 번호' },
            recognized_answer: { type: 'string', description: '학생이 쓴 답안을 OCR한 텍스트' },
            is_correct: { type: 'boolean', description: '정답 여부 (부분정답 포함 X, 만점만 true)' },
            score: { type: 'number', description: '이 문항에서 받은 점수' },
            max_score: { type: 'number', description: '이 문항 만점' },
            feedback: { type: 'string', description: '학생을 위한 1-2문장 피드백' },
          },
          required: ['number', 'recognized_answer', 'is_correct', 'score', 'max_score', 'feedback'],
        },
      },
      total_score: { type: 'number', description: '전체 획득 점수' },
      total_max: { type: 'number', description: '전체 만점' },
      overall_feedback: { type: 'string', description: '전체적인 총평 (2-3문장)' },
    },
    required: ['per_question', 'total_score', 'total_max', 'overall_feedback'],
  },
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body: GradeRequest;
  try {
    body = (await req.json()) as GradeRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!body.imageBase64 || !body.questions?.length) {
    return json({ error: '문제와 답안 이미지가 필요합니다.' }, 400);
  }

  const client = new Anthropic({ apiKey });

  const questionsText = body.questions
    .map(
      (q, i) =>
        `[문항 ${q.number}] (${q.points ?? 10}점)\n질문: ${q.question}\n모범답안: ${q.answer}`,
    )
    .join('\n\n');

  const userText = `${body.passage ? `**지문:**\n${body.passage}\n\n` : ''}**문항 및 모범답안:**\n${questionsText}\n\n위 문항에 대한 학생의 손글씨 답안 사진입니다. 인식하고 채점해주세요.`;

  try {
    const result = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
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
      return json({ error: '채점 결과 파싱 실패', raw: result }, 500);
    }

    return json(toolUse.input as GradeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: 'Claude API 호출 실패', detail: message }, 500);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
