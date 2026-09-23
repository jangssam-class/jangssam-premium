const OPENAI_URL = "https://api.openai.com/v1/responses";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string"
    },
    slug: {
      type: "string"
    },
    category: {
      type: "string"
    },
    excerpt: {
      type: "string"
    },
    aiSummary: {
      type: "string"
    },
    imageAlt: {
      type: "string"
    },
    imagePrompt: {
      type: "string"
    },
    body: {
      type: "string"
    },
    faq: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: {
            type: "string"
          },
          answer: {
            type: "string"
          }
        },
        required: [
          "question",
          "answer"
        ]
      }
    }
  },
  required: [
    "title",
    "slug",
    "category",
    "excerpt",
    "aiSummary",
    "imageAlt",
    "imagePrompt",
    "body",
    "faq"
  ]
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function extractOutputText(data) {
  if (
    typeof data.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const chunks = [];

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("").trim();
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, {
      error: "POST 요청만 사용할 수 있습니다."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return json(500, {
      error: "OPENAI_API_KEY가 설정되지 않았습니다."
    });
  }

  let input;

  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return json(400, {
      error: "요청 데이터 형식이 올바르지 않습니다."
    });
  }

  const keyword = String(
    input.keyword || ""
  ).trim();

  const audience = String(
    input.audience || "학생·학부모"
  ).trim();

  const requestedCategory = String(
    input.category || "자동 선택"
  ).trim();

  if (!keyword) {
    return json(400, {
      error: "주제/키워드를 입력해주세요."
    });
  }

  if (keyword.length > 200) {
    return json(400, {
      error: "키워드가 너무 깁니다."
    });
  }

  const instructions = `
너는 대한민국 교육 전문 과외 사이트
'장쌤 Premium'의 교육 콘텐츠 작성자다.

학생과 학부모가 실제로 검색하는 질문에
정확하고 실용적으로 답하는 정보성 글을 작성한다.

작성 원칙:

1. 한국어로 작성한다.

2. 검색 의도를 제목 초반에 자연스럽게 반영한다.

3. 과장되거나 낚시성인 제목은 사용하지 않는다.

4. slug는 영문 소문자, 숫자, 하이픈만 사용한다.

5. category는 다음 중 하나를 사용한다.
수학, 영어, 국어, 과학, 검정고시,
코딩, 학습관리, 교육소식

6. 사용자가 카테고리를 지정했다면
가능한 한 해당 카테고리를 사용한다.

7. excerpt는 검색결과와 목록에 사용할
자연스러운 2~3문장으로 작성한다.

8. aiSummary는 학생이나 학부모의 질문에
바로 답하는 핵심답변 2~4문장으로 작성한다.

9. body는 Markdown 형식으로 작성한다.

10. 본문에는 읽기 쉬운 소제목을 사용한다.

11. 본문은 약 2,000자 이상의
충분히 구체적인 교육 콘텐츠로 작성한다.
단순 반복으로 분량을 늘리지 않는다.

12. 학습 수준에 따른 차이가 중요한 주제라면
하위권, 중위권, 상위권 등의 현실적인
학습 방법 차이를 설명한다.

13. 근거 없이 성적 향상이나
검색 노출을 보장하지 않는다.

14. FAQ는 학생과 학부모가 실제로
검색할 가능성이 높은 질문 3~5개를 작성한다.

15. imageAlt는 대표 이미지 내용을
자연스럽게 설명한다.

16. imagePrompt는 대표 이미지 제작용 설명이다.
주제와 관련된 학생 또는 공부 장면을 중심으로 작성한다.

17. 날짜, 카테고리, 추천글, 공개 여부 등
관리자용 정보는 이미지에 포함하지 않는다.

18. 개인 연락처나 상담 링크를 임의로 만들지 않는다.
`;

  const userPrompt = `
주제/핵심 키워드: ${keyword}

주요 독자:
${audience}

희망 카테고리:
${requestedCategory}

장쌤 Premium 관리자 페이지에 바로 입력할 수 있는
교육정보 포스팅 초안을 작성해줘.
`;

  let response;

  try {
    response = await fetch(
      OPENAI_URL,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
          instructions,
          input: userPrompt,
          text: {
            format: {
              type: "json_schema",
              name: "jangssam_post_draft",
              strict: true,
              schema
            }
          }
        })
      }
    );
  } catch (error) {
    return json(502, {
      error: "OpenAI API에 연결하지 못했습니다.",
      detail: error.message
    });
  }

  let data;

  try {
    data = await response.json();
  } catch {
    return json(502, {
      error: "OpenAI API 응답을 읽지 못했습니다."
    });
  }

  if (!response.ok) {
    return json(response.status, {
      error:
        data?.error?.message ||
        "OpenAI API 요청에 실패했습니다."
    });
  }

  const outputText = extractOutputText(data);

  if (!outputText) {
    return json(502, {
      error: "AI가 초안 데이터를 반환하지 않았습니다."
    });
  }

  let draft;

  try {
    draft = JSON.parse(outputText);
  } catch {
    return json(502, {
      error: "AI 초안 JSON을 해석하지 못했습니다."
    });
  }

  draft.slug = String(
    draft.slug || ""
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9-]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );

  return json(200, {
    ok: true,
    draft
  });
}
