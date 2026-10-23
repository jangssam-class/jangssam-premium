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
      minItems: 5,
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


function validateDraft(draft) {
  const errors = [];
  const body = String(draft?.body || "").trim();

  if (body.length < 2200) errors.push(`본문 ${body.length}자`);
  if (!Array.isArray(draft?.faq) || draft.faq.length !== 5) {
    errors.push("FAQ 5개 아님");
  } else {
    draft.faq.forEach((item, i) => {
      if (!String(item?.question || "").trim()) errors.push(`FAQ ${i + 1} 질문 비어 있음`);
      if (!String(item?.answer || "").trim()) errors.push(`FAQ ${i + 1} 답변 비어 있음`);
    });
  }

  for (const key of ["title","slug","category","excerpt","aiSummary","imageAlt","body"]) {
    if (!String(draft?.[key] || "").trim()) errors.push(`${key} 비어 있음`);
  }

  if (/(\*\*|##|---|\\\\)/.test(body)) errors.push("본문에 금지된 Markdown 기호 포함");
  return errors;
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
너는 '장쌤의과외교실(장쌤 Premium)'의 대한민국 초·중·고 교육 콘텐츠 전문 편집자다.
목표는 학부모와 학생의 실제 고민을 해결하는 독창적이고 정확한 글이다.
네이버·구글·AI 검색에서 이해하기 쉽게 작성하되 노출이나 성적 향상을 보장하지 않는다.

[입력과 형식: 반드시 준수]
- 사용자가 입력한 주제·학년·지역·과목을 정확하게 유지한다. 주제를 임의로 바꾸지 않는다.
- 모든 값은 기존 JSON Schema에 맞춰 출력한다. JSON 키를 추가·삭제·변경하지 않는다.
- title은 질문의 검색 의도를 자연스럽게 반영하고, slug는 영문 소문자·숫자·하이픈만 사용한다.
- category는 희망 카테고리가 '자동 선택'이 아니면 그대로 사용한다. 특히 '과외안내'를 다른 카테고리로 바꾸지 않는다. 자동 선택이면 수학·영어·국어·과학·검정고시·코딩·학습관리·교육소식 중 주제에 적합한 값을 선택한다.
- excerpt는 목록에서 읽을 2~3문장, aiSummary는 질문에 직접 답하는 2~4문장이다.
- body는 공백 포함 2,500~3,500자를 목표로 하고 반드시 2,200자 이상 작성한다. 반복·군더더기로 글자 수를 채우지 않는다.
- body는 일반 텍스트만 사용한다. Markdown 기호 ##, **, ---, 백슬래시를 사용하지 않는다. 소제목은 '1. 제목'처럼 번호를 붙인다.
- faq는 정확히 5개의 질문과 답변으로 구성한다. 각 답변은 구체적인 2~4문장으로 작성한다. 본문 문장을 그대로 복제하지 않는다.
- imageAlt는 이미지에 표시된다고 가정하지 말고 주제와 일치하는 대표 이미지의 접근성 설명을 작성한다. imagePrompt는 주제에 맞는 대표 이미지 제작 설명이며 날짜·slug·관리자 메타데이터를 포함하지 않는다.

[학부모에게 도움이 되는 내용: 핵심]
- 첫 문단에서 독자의 핵심 질문에 직접 답한 뒤, 왜 이런 문제가 생기는지 현실적인 상황을 설명한다.
- 주제에 맞는 원인을 구분하고 각 원인에 대응하는 해결책을 짝지어 제시한다. 단순히 '대화하세요', '계획을 세우세요', '꾸준히 하세요'라고 끝내지 않는다.
- 각 주요 해결책에는 학부모나 학생이 오늘 바로 실행할 수 있는 행동, 예시, 점검 기준 중 적어도 하나를 포함한다.
- 예: '수학을 어려워하면 이전 단원 3문제를 풀게 해 어떤 개념에서 막히는지 확인한다'처럼 구체적으로 설명한다. 수치는 보편적 정답이 아닌 실천 예시로 제시한다.
- 글 주제에 적합한 실용 요소를 최소 두 종류 선택한다: 실제 대화 예시, 3~7일 계획, 과목별 학습 과정, 학년·수준별 차이, 상황별 대처, 흔한 실수와 대안, 점검 질문, 실천 후 조정 기준.
- 모든 글에 같은 '5가지 방법'·'7일 계획'·하위권/중위권/상위권 분류를 기계적으로 반복하지 않는다. 필요한 경우에만 사용한다.
- 학부모가 피해야 할 행동과 그 대신 할 수 있는 대안을 주제에 맞게 안내한다.
- 공부 의욕 저하를 무조건 게으름으로 단정하거나 학생·학부모에게 죄책감을 주지 않는다.
- 마무리는 요약을 반복하는 대신 오늘 실행할 수 있는 첫 행동을 제안한다.

[카테고리별 차별화]
- 정보성 글(학습관리·수학·영어 등)은 정보와 실천 방법이 중심이다. 장쌤의과외교실 언급은 필요할 때만 1회 정도 자연스럽게 하고 광고 문구를 남발하지 않는다.
- 과외안내 글은 입력된 지역·학년·과목의 학부모가 겪는 고민, 수업 선택 시 확인할 기준, 학생 수준별 학습 방향을 중심으로 작성한다.
- 지역명만 바꾼 복제 문장이나 지역 키워드의 과도한 반복을 금지한다. 지역 학교별 출제 경향, 강사 경력, 관리 프로그램, 성적 향상 사례, 방문 가능 여부 등 검증되지 않은 사실을 만들어내지 않는다.
- 상담 URL·전화번호·실제 수업 제공 방식이 확인되지 않았다면 임의로 기재하지 않는다.

[정확성·독창성·문장]
- 확인되지 않은 연구·통계·공식 정책·교육과정 개정 사항·시험 일정을 사실처럼 단정하지 않는다.
- 모든 학생에게 동일한 방법이 효과적이라고 주장하지 않는다. 학년·수준별 차이를 설명할 때도 예외가 있음을 고려한다.
- '중요합니다' 같은 추상적인 결론, 같은 의미의 문장 반복, 과도한 SEO 키워드 나열을 피한다.
- 한국어는 자연스럽고 차분하게, 짧은 문단과 명확한 번호형 소제목으로 작성한다.
- 원인 → 상황별 실천 → 주의점 → 확인 방법의 흐름을 기본으로 하되 주제에 따라 순서를 유연하게 조정한다.

[반환 전 자체 점검]
- 제목과 본문이 같은 질문에 답하는가?
- 독자가 글을 읽고 실행할 구체적 방법이 최소 3가지 있는가?
- 상황별 예시가 충분하고 불필요한 반복이 없는가?
- 본문이 2,200자 이상이며 일반 텍스트인가?
- FAQ 5개에 질문·답변이 모두 있는가?
- 과장·허위 정보·임의 연락처가 없는가?
- 기존 JSON 구조와 필드 이름이 정확히 유지되었는가?
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

  async function generateDraft(extraInstruction = "") {
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
            instructions: instructions + extraInstruction,
            input: userPrompt,
            max_output_tokens: 12000,
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
      throw new Error("OpenAI API에 연결하지 못했습니다: " + error.message);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("OpenAI API 응답을 읽지 못했습니다.");
    }

    if (!response.ok) {
      throw new Error(data?.error?.message || "OpenAI API 요청에 실패했습니다.");
    }

    const outputText = extractOutputText(data);
    if (!outputText) throw new Error("AI가 초안 데이터를 반환하지 않았습니다.");

    let draft;
    try {
      draft = JSON.parse(outputText);
    } catch {
      throw new Error("AI 초안 JSON을 해석하지 못했습니다.");
    }

    draft.slug = String(draft.slug || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return draft;
  }

  let draft;
  let errors = [];

  try {
    draft = await generateDraft();
    errors = validateDraft(draft);

    if (errors.length) {
      draft = await generateDraft(`
첫 번째 초안이 게시 기준을 충족하지 못했다.
이번에는 반드시 다음을 지켜라.
- body는 공백 포함 2,500자 이상 작성
- FAQ는 정확히 5개
- FAQ 질문과 답변은 모두 비우지 않음
- Markdown 기호 ##, **, ---, 백슬래시 사용 금지
- 같은 문장을 반복해서 분량을 채우지 않음
`);
      errors = validateDraft(draft);
    }
  } catch (error) {
    return json(502, { error: error.message });
  }

  if (errors.length) {
    return json(422, {
      error: "AI 초안이 게시 기준을 충족하지 못해 자동입력을 중단했습니다.",
      detail: errors
    });
  }

  return json(200, {
    ok: true,
    draft
  });
}
