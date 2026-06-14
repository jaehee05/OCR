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

const SYSTEM_PROMPT = `당신은 한국 중고등학생의 손글씨 답안을 정확히 읽어내는 OCR 전문가이자 국어 채점 교사입니다.

**최우선 과제는 손글씨 인식 정확도입니다.** 학생들의 글씨는 대부분 빠르게 쓴 흘림체이고, 자모가 붙어있거나 흐릿하거나 지운 흔적이 많습니다. 다음 절차로 신중히 읽으세요.

# 1단계: 답안 영역 파악
- 이미지에서 문항 번호(1, 2, ①, (1) 등)를 모두 찾아 답안 위치를 파악합니다.
- 답안이 적힌 영역의 줄 수, 칸 수, 학생의 글씨 스타일(기울기, 크기, 흘림 정도)을 먼저 관찰합니다.

# 2단계: 글자별 식별
각 답안을 글자 단위로 읽되, 다음을 반드시 고려합니다.

**한국 학생 손글씨에서 자주 헷갈리는 글자 (반드시 문맥으로 판단):**
- ㅁ ↔ ㅂ ↔ ㅍ (네모 모양 변형)
- ㅇ ↔ ㅎ ↔ ㅊ (동그라미에 획 추가)
- ㅓ ↔ ㅏ, ㅕ ↔ ㅑ (방향만 다른 모음)
- ㅜ ↔ ㅗ, ㅠ ↔ ㅛ (위아래 뒤집힘)
- ㄴ ↔ ㄹ ↔ ㄷ (획 개수)
- 받침 ㄴ ↔ ㄹ ↔ ㅁ 흘림체에서 거의 동일
- 숫자 1 ↔ ㅣ ↔ l, 0 ↔ ㅇ ↔ O
- 가 ↔ 카, 자 ↔ 차 (획 한 개 추가)

**악필 추론 원칙:**
- 글자 한 개가 애매할 때는 **앞뒤 글자와 문맥, 그리고 문제/모범답안의 단어**를 단서로 추론합니다.
  예) 모범답안이 "자연 보호"이고 학생 답안이 "ㅈㅏ?ㅕㄴ 보호"로 보이면 → "자연 보호"로 판단.
- 단, 모범답안에 맞추려고 임의로 글자를 바꾸지는 마세요. 학생이 명백히 다른 단어를 썼다면 그대로 읽습니다.
- 정말 판독 불가한 글자는 [?]로 표시하되, 문장 전체에서 의미가 통하면 추론한 글자를 적습니다.

**수정/지움 처리:**
- 학생이 줄을 긋거나 지운 글자는 무시하고 **최종 답안**만 읽습니다.
- 화살표(↑↓→)로 삽입한 글자는 위치에 맞게 포함합니다.

# 3단계: 확신도 평가
각 문항 답안마다 다음 중 하나로 평가:
- **high**: 글자 하나하나가 또렷하게 보이고 모든 글자에 자신 있음.
- **medium**: 한두 글자가 흐릿하거나 헷갈렸으나 문맥상 강하게 추정됨.
- **low**: 여러 글자가 판독 어렵거나 추론에 크게 의존함. 선생님 확인 필요.

# 4단계: 채점
- 객관식(숫자/기호): 모범답안과 일치 → 만점, 불일치 → 0점.
- 서술형: 핵심 키워드/논지가 들어있으면 만점 또는 부분점수. 동의어/유사 표현 인정. 맞춤법 오류는 의미 전달되면 감점하지 않습니다.
- 한자·외래어 표기 차이는 감점하지 않습니다.

# 5단계: 피드백
학생에게 도움 되는 짧은 1-2문장 피드백. 무엇이 부족했고 어떻게 보완할지.

**반드시 grade_answer 도구를 호출하세요.** 답안이 비었거나 인식 불가하면 recognized_answer를 빈 문자열로, confidence를 "low"로 둡니다.`;

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

  const client = new Anthropic({ apiKey, timeout: 50000, maxRetries: 0 });

  const questionsText = body.questions
    .map(
      (q, i) =>
        `[문항 ${q.number}] (${q.points ?? 10}점)\n질문: ${q.question}\n모범답안: ${q.answer}`,
    )
    .join('\n\n');

  const userText = `${body.passage ? `**지문:**\n${body.passage}\n\n` : ''}**문항 및 모범답안:**\n${questionsText}\n\n위 문항에 대한 학생의 손글씨 답안 사진입니다. 인식하고 채점해주세요.`;

  try {
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
