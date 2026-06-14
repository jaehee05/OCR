import Anthropic from '@anthropic-ai/sdk';

export const config = {
  maxDuration: 60,
};

type OcrRequest = {
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  hint?: string;
};

type OcrResponse = {
  raw_text: string;
  overall_confidence: 'high' | 'medium' | 'low';
  notes: string;
};

const SYSTEM_PROMPT = `당신은 한국 중고등학생의 손글씨 노트를 정확히 읽어내는 OCR 전문가입니다. 학생들은 대부분 빠르게 흘려 쓰고, 자모가 붙어있거나 흐릿하거나 지운 흔적이 많습니다.

# 작업 절차

**1) 전체 관찰**: 이미지에서 글씨 스타일(기울기, 크기, 흘림 정도), 답안 영역, 문항 번호의 유무, 줄/칸 구조를 먼저 파악합니다.

**2) 글자별 식별** — 한국 학생 손글씨에서 자주 헷갈리는 글자:
- ㅁ↔ㅂ↔ㅍ (네모 변형), ㅇ↔ㅎ↔ㅊ (동그라미+획)
- ㅓ↔ㅏ, ㅕ↔ㅑ (방향), ㅜ↔ㅗ, ㅠ↔ㅛ (위아래)
- ㄴ↔ㄹ↔ㄷ (획 개수), 흘림체 받침 ㄴ↔ㄹ↔ㅁ
- 숫자 1↔ㅣ↔l, 0↔ㅇ↔O, 가↔카, 자↔차

**3) 악필 추론**:
- 애매한 글자는 앞뒤 단어, 전체 문맥, 한국어 어휘 빈도로 추론합니다.
- 정말 판독 불가한 글자는 [?] 로 남기되, 단어 전체에서 의미가 강하게 추정되면 추론한 글자를 적습니다.
- 줄을 긋거나 지운 글자는 **최종 답안만** 읽습니다. 화살표로 삽입한 글자는 위치에 맞게 포함합니다.

**4) 출력 형식**:
- 학생이 쓴 모습을 최대한 그대로 보존합니다.
- 문항 번호가 있으면 \`1) ...\` \`2) ...\` 형태로 줄바꿈 후 다음 답안.
- 문항 번호가 없으면 그냥 줄바꿈으로 답안 구분.
- 노트 여기저기 흩어져 있어도 위→아래, 왼→오 순서로 정리.

**5) 확신도(overall_confidence)**:
- high: 거의 모든 글자가 또렷함.
- medium: 한두 단어가 흐릿하거나 추론에 의존.
- low: 여러 글자가 판독 어렵고 [?] 다수.

**6) notes**: 인식이 어려웠던 부분이나 선생님이 확인하면 좋을 점을 1-2문장. (예: "3번 답안 마지막 받침이 ㄴ/ㄹ 구분 어려움")

반드시 ocr_result 도구를 호출해서 결과를 반환하세요.`;

const OCR_TOOL = {
  name: 'ocr_result',
  description: '손글씨를 인식한 결과를 반환합니다.',
  input_schema: {
    type: 'object' as const,
    properties: {
      raw_text: {
        type: 'string',
        description: '학생이 쓴 손글씨 전체를 OCR한 텍스트. 줄바꿈 그대로 보존.',
      },
      overall_confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: '전체적인 인식 확신도',
      },
      notes: {
        type: 'string',
        description: '판독 어려웠던 부분, 선생님 확인이 필요한 부분 등 1-2문장 메모. 없으면 빈 문자열.',
      },
    },
    required: ['raw_text', 'overall_confidence', 'notes'],
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

  let body: OcrRequest;
  try {
    body = (await req.json()) as OcrRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!body.imageBase64) {
    return json({ error: '이미지가 필요합니다.' }, 400);
  }

  const client = new Anthropic({ apiKey });

  const userText = body.hint
    ? `다음은 참고용 힌트입니다(지문/문제 등). 이걸 보고 학생의 손글씨를 추론할 때 단서로 사용하세요.\n\n${body.hint}\n\n위 사진의 학생 손글씨를 모두 인식해주세요.`
    : '학생이 노트에 손으로 쓴 답안 사진입니다. 전체 텍스트를 인식해주세요.';

  try {
    const result = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [OCR_TOOL],
      tool_choice: { type: 'tool', name: 'ocr_result' },
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
      return json({ error: 'OCR 결과 파싱 실패' }, 500);
    }

    return json(toolUse.input as OcrResponse);
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
