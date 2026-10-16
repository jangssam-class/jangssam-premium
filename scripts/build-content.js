const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const site = 'https://jangssam-premium.netlify.app';
const dataPath = path.join(root, 'content', 'posts.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const rawPosts = (data.posts || []).filter(p => p.published !== false).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
const seenSlugs = new Set();
const duplicateSlugs = [];
const posts = rawPosts.filter(p => {
  const slug=String(p.slug||'').trim();
  if(!slug) return false;
  if(seenSlugs.has(slug)){ duplicateSlugs.push(slug); return false; }
  seenSlugs.add(slug); return true;
});
if(duplicateSlugs.length) console.warn('[게시글 자동화 경고] 중복 slug 제외:', [...new Set(duplicateSlugs)].join(', '));
// Safety guard: never silently publish a post whose main body is missing.
const emptyBodyPosts = posts.filter(p => !String(p.body || '').trim());
if(emptyBodyPosts.length){
  console.error('[게시글 자동화 오류] 본문이 비어 있는 공개 게시글:', emptyBodyPosts.map(p => p.slug || p.title || '(slug 없음)').join(', '));
  process.exit(1);
}
const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xml = (v='') => esc(v);
const inline = (text='') => esc(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
function markdown(md='') {
  const lines=String(md).replace(/\r/g,'').split('\n'); let html='', list=null;
  const close=()=>{ if(list){ html+=`</${list}>`; list=null; } };
  for (const raw of lines) { const line=raw.trim(); if(!line){ close(); continue; }
    let m;
    if((m=line.match(/^(#{2,4})\s+(.+)$/))){ close(); const n=m[1].length; html+=`<h${n}>${inline(m[2])}</h${n}>`; }
    else if((m=line.match(/^[-*]\s+(.+)$/))){ if(list!=='ul'){ close(); list='ul'; html+='<ul>'; } html+=`<li>${inline(m[1])}</li>`; }
    else if((m=line.match(/^\d+\.\s+(.+)$/))){ if(list!=='ol'){ close(); list='ol'; html+='<ol>'; } html+=`<li>${inline(m[1])}</li>`; }
    else if(line.startsWith('> ')){ close(); html+=`<blockquote>${inline(line.slice(2))}</blockquote>`; }
    else { close(); html+=`<p>${inline(line)}</p>`; }
  }
  close(); return html;
}
function plainText(md='') {
  return String(md)
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/[#>*_`\[\]()!-]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
// GEO/AEO: 기존 콘텐츠에 실제 서비스 페이지와 탐색 경로를 연결합니다.
// 신규 게시글에도 빌드할 때 자동 적용됩니다. 기존 본문/FAQ는 변경하지 않습니다.
// 전용 안내 페이지는 포스팅 개수와 무관하게 학년·과목별로 공유합니다.
const gradeDefs = [
  {key:'elementary', label:'초등학생', pattern:/초등|초[1-6](?!\d)/},
  {key:'middle', label:'중학생', pattern:/중학생|중등|중[1-3](?!\d)/},
  {key:'high', label:'고등학생', pattern:/고등학생|고등|고[1-3](?!\d)|수능/}
];
const subjectDefs = [
  {key:'math', label:'수학', pattern:/수학|연산|계산/,
   focus:'개념 이해와 풀이 과정 점검', advice:'학생이 풀이 과정을 설명하도록 하고, 계산 실수와 개념 부족을 구분해 복습합니다.'},
  {key:'english', label:'영어', pattern:/영어|영단어|어휘|문법/,
   focus:'어휘·문법·독해의 연결', advice:'어휘와 문장 구조를 확인하고, 학습한 내용을 독해와 표현에 적용하는 과정을 점검합니다.'},
  {key:'korean', label:'국어', pattern:/국어|독해력|문해력/,
   focus:'글의 핵심과 근거를 파악하는 독해', advice:'글의 중심 생각과 근거를 찾고, 학생이 자신의 말로 내용을 정리하도록 돕습니다.'},
  {key:'science', label:'과학', pattern:/과학|물리|화학|생명과학|지구과학/,
   focus:'과학 개념과 현상의 연결', advice:'용어를 암기하는 데 그치지 않고, 개념을 실제 현상과 문제 상황에 연결합니다.'},
  {key:'coding', label:'코딩', pattern:/코딩|프로그래밍|파이썬|스크래치/,
   focus:'작은 프로젝트를 통한 문제 해결', advice:'기초 문법을 익힌 뒤 간단한 프로젝트를 만들며 오류를 찾고 수정하는 과정을 연습합니다.'}
];
const gradeFocus = {
  elementary:'기초 개념과 학습 습관을 차근차근 점검합니다.',
  middle:'학교 진도와 취약 개념, 복습 계획을 함께 확인합니다.',
  high:'학교 내신과 학습 목표에 맞춰 개념·적용·복습을 점검합니다.'
};
const allGuides = gradeDefs.flatMap(grade => subjectDefs.map(subject => ({
  key:`${grade.key}-${subject.key}`, grade:grade.label, subject:subject.label,
  focus:subject.focus, advice:`${gradeFocus[grade.key]} ${subject.advice}`
})));
const legacyGuideKeys = new Set(['middle-math','middle-english','elementary-math','high-english']);
function classifyPost(p) {
  // 본문이 아니라 제목을 기준으로 분류합니다. 카테고리 '학습관리'만으로 과목을 추측하지 않습니다.
  const title = String(p.title || '');
  if (/검정고시/.test(title)) return null; // 검정고시는 별도 서비스 기준 검증 후 확대
  const grade = gradeDefs.find(g => g.pattern.test(title));
  const subjects = subjectDefs.filter(s => s.pattern.test(title));
  if (!grade || subjects.length !== 1) return null;
  return allGuides.find(g => g.key === `${grade.key}-${subjects[0].key}`) || null;
}
const guideCounts = new Map(allGuides.map(g => [g.key,0]));
for (const p of posts) {
  const g = classifyPost(p);
  if (g) guideCounts.set(g.key, guideCounts.get(g.key)+1);
}
// 관련 글이 없는 조합은 얇은 페이지를 대량 생성하지 않습니다. 기존 4개 주소는 유지합니다.
const tutoringGuides = allGuides.filter(g => guideCounts.get(g.key)>0 || legacyGuideKeys.has(g.key));
function learningLinks(p) {
  const guide = classifyPost(p);
  const guideLink = guide
    ? `<li><a href="../tutoring/${guide.key}.html">${esc(guide.grade)} ${esc(guide.subject)} 과외 안내 및 수업 방식 비교</a></li>`
    : '<li><a href="../index.html#subject">학년·과목별 수업 안내</a></li>';
  return `<section class="learning-links" aria-labelledby="learning-links-heading">
    <h2 id="learning-links-heading">관련 과외·수업 안내</h2>
    <p>공부 방법을 실제 수업에 적용하고 싶다면 수업 방식과 비용을 비교한 뒤 상담을 통해 학습 방향을 확인해 보세요.</p>
    <ul>
      ${guideLink}
      <li><a href="../index.html#contact">수업료·상담 안내 확인</a></li>
      <li><a href="../지역별과외찾기.html">지역별 과외 안내</a></li>
    </ul>
  </section>`;
}

function postHtml(p) {
  const autoSummary = String(p.aiSummary || p.excerpt || plainText(p.body).slice(0,220)).trim();
  const url=`${site}/posts/${encodeURIComponent(p.slug)}.html`;
  const image=p.image ? (p.image.startsWith('http')?p.image:`${site}${p.image.startsWith('/')?'':'/'}${p.image}`) : `${site}/이미지/seo-share.png`;
  const articleSchema={"@type":"Article",headline:p.title,description:p.excerpt,datePublished:p.date,dateModified:p.modified||p.date,mainEntityOfPage:url,image:[image],author:{"@type":"Organization",name:"장쌤의과외교실"},publisher:{"@type":"EducationalOrganization",name:"장쌤의과외교실","logo":{"@type":"ImageObject","url":`${site}/이미지/로고.png`}}};
  const breadcrumbSchema={"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"홈",item:site+"/"},{"@type":"ListItem",position:2,name:"교육정보",item:site+"/blog.html"},{"@type":"ListItem",position:3,name:p.title,item:url}]};
  const fixedFaqItems=[1,2,3,4,5].map(i=>({
    question:String(p[`faq${i}Question`]||'').trim(),
    answer:String(p[`faq${i}Answer`]||'').trim()
  })).filter(x=>x.question&&x.answer);
  const legacyFaqItems=Array.isArray(p.faq)?p.faq.filter(x=>x&&x.question&&x.answer):[];
  const faqItems=fixedFaqItems.length?fixedFaqItems:legacyFaqItems;
  const graph=[articleSchema,breadcrumbSchema];
  if(faqItems.length) graph.push({"@type":"FAQPage",mainEntity:faqItems.map(x=>({"@type":"Question",name:x.question,acceptedAnswer:{"@type":"Answer",text:x.answer}}))});
  const schema={"@context":"https://schema.org","@graph":graph};
  const answerHtml=autoSummary?`<section class="ai-answer" aria-labelledby="quick-answer-title"><h2 id="quick-answer-title">한눈에 답하기</h2><p>${inline(autoSummary)}</p></section>`:'';
  const faqHtml=faqItems.length?`<section class="article-faq" aria-labelledby="faq-title"><h2 id="faq-title">자주 묻는 질문</h2>${faqItems.map(x=>`<h3>${esc(x.question)}</h3><p>${inline(x.answer)}</p>`).join('')}</section>`:'';
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(p.title)} | 장쌤의과외교실</title>
  <meta name="description" content="${esc(p.excerpt)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="장쌤의과외교실">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.excerpt)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="../blog.css">
  <style>
  .post-breadcrumb{font-size:13px;line-height:1.7;color:#64748b;margin-bottom:20px;overflow-wrap:anywhere}
  .post-breadcrumb a{color:#2867bd;text-decoration:none}
  .learning-links{margin-top:35px;padding:24px;border:1px solid #dce7f6;border-radius:16px;background:#f5f9ff}
  .learning-links h2{margin:0 0 12px;font-size:21px;color:#153d76}
  .learning-links p{margin:0 0 12px;line-height:1.7}
  .learning-links ul{margin:0;padding-left:22px;line-height:2}
  .learning-links a{color:#155ac4;font-weight:700}
  @media(max-width:600px){.learning-links{padding:18px}.learning-links h2{font-size:18px}}
  </style>
  <link rel="icon" href="../이미지/favicon-32.png" type="image/png">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>
  <script defer src="../analytics/visitor-tracker.js"></script>
</head>
<body class="post-page">

<header class="blog-header">
  <div class="blog-header-inner">
    <a class="blog-logo" href="../index.html">
      <img alt="장쌤의과외교실 로고" src="../이미지/로고.png">
      <span>장쌤의과외교실</span>
    </a>

    <nav class="blog-nav">
      <a href="../blog.html">교육정보</a>
      <a href="../지역별과외찾기.html">지역별 과외</a>
      <a class="consult" href="../상담신청.html">상담 신청</a>
    </nav>
  </div>
</header>

<main class="article-main">
  <article class="article-shell">
    <nav class="post-breadcrumb" aria-label="현재 위치"><a href="../index.html">장쌤의 과외교실</a> &gt; <a href="../blog.html">교육정보</a> &gt; <span>${esc(p.title)}</span></nav>

    <header class="article-header">
      <span class="post-category">${esc(p.category)}</span>
      <h1>${esc(p.title)}</h1>
      <p class="article-excerpt">${esc(p.excerpt)}</p>
      <div class="post-meta">${esc(p.date)} · 장쌤 교육정보</div>
    </header>

    ${p.image?`<figure class="article-image">
      <img src="${esc(p.image)}" alt="${esc(p.imageAlt||p.title)}">
    </figure>`:''}

    <div class="article-content">
      ${answerHtml}
      ${markdown(p.body)}
      ${faqHtml}
      ${learningLinks(p)}
    </div>

  </article>

  <aside class="article-cta">
    <strong>학생에게 맞는 학습 방향이 궁금하신가요?</strong>
    <p>현재 학습 상태와 목표를 확인한 뒤 필요한 수업 방향을 차근차근 안내해드립니다.</p>
    <a href="../상담신청.html">무료 상담 신청</a>
  </aside>

  <a class="back-link" href="../blog.html">교육정보 목록으로 돌아가기</a>
</main>

<footer class="blog-footer">
  © 2026 장쌤의과외교실. All rights reserved.
</footer>

</body>
</html>`;
}
const postsDir=path.join(root,'posts'); fs.mkdirSync(postsDir,{recursive:true});
for(const file of fs.readdirSync(postsDir)){ if(file.endsWith('.html')) fs.unlinkSync(path.join(postsDir,file)); }
for(const p of posts) fs.writeFileSync(path.join(postsDir,`${p.slug}.html`),postHtml(p),'utf8');
// 과외 전용 페이지 자동 생성: 각 안내 페이지는 실제 posts.json 슬러그를 사용합니다.
const guideDir = path.join(root, 'tutoring');
fs.mkdirSync(guideDir, {recursive:true});
const tuition = {
  '초등학생': [[256000,236000],[384000,354000],[512000,472000]],
  '중학생': [[296000,268000],[444000,402000],[592000,536000]],
  '고등학생': [[336000,308000],[504000,462000],[672000,616000]]
};
// 지역 페이지는 기존에 운영 중인 광역 안내 페이지에만 연결합니다.
// 학년·과목별 페이지를 지역별로 복제하지 않으며 방문 가능 여부는 상담으로 확인합니다.
const regionGuides = [
  ['서울', 'seoul'], ['경기', 'gyeonggi'], ['인천', 'incheon'],
  ['부산', 'busan'], ['대구', 'daegu'], ['대전', 'daejeon'],
  ['광주', 'gwangju'], ['울산', 'ulsan']
];
const regionDir = path.join(root, 'regions');
const activeRegions = regionGuides.filter(([, slug]) =>
  fs.existsSync(path.join(regionDir, `${slug}-tutoring.html`))
);
const regionToGuideLinks = tutoringGuides.map(g =>
  `<a href="../tutoring/${g.key}.html">${esc(g.grade)} ${esc(g.subject)} 과외 안내</a>`
).join('\n');
const regionFromGuideLinks = activeRegions.map(([name, slug]) =>
  `<a href="../regions/${slug}-tutoring.html">${esc(name)} 지역 과외 안내</a>`
).join('\n');

const won = n => Number(n).toLocaleString('ko-KR')+'원';
function guideHtml(g) {
  const related = posts.filter(p => classifyPost(p)?.key === g.key).slice(0,8);
  const title = `${g.grade} ${g.subject} 과외 안내 | 방문·화상 수업 비교 | 장쌤의과외교실`;
  const desc = `${g.grade} ${g.subject} 과외를 알아보는 학부모를 위한 학습 방향, 방문·화상 수업 비교와 주 2회 수업료 안내.`;
  const url = `${site}/tutoring/${g.key}.html`;
  const rows = (tuition[g.grade]||[]).map((pair,i) => `<tr><th scope="row">주 2회 ${[60,90,120][i]}분</th><td>${won(pair[0])}</td><td>${won(pair[1])}</td></tr>`).join('\n');
  const links = related.length ? related.map(p => `<article class="related-card"><span class="related-tag">${esc(p.category || '교육정보')}</span><h3><a href="../posts/${encodeURIComponent(p.slug)}.html">${esc(p.title)}</a></h3><p>${esc(String(p.excerpt || plainText(p.body)).slice(0,125))}</p><a class="related-more" href="../posts/${encodeURIComponent(p.slug)}.html" aria-label="${esc(p.title)} 자세히 보기">게시물 읽기 →</a></article>`).join('\n') : '<p>이 과목과 학년에 해당하는 교육정보를 준비하고 있습니다.</p>';
  const graph = {'@context':'https://schema.org','@graph':[
    {'@type':'Service',name:`${g.grade} ${g.subject} 과외`,description:desc,provider:{'@type':'Organization',name:'장쌤의과외교실',url:site},url,serviceType:'방문 및 화상 과외'},
    {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'홈',item:site+'/'},{'@type':'ListItem',position:2,name:'과외 안내',item:site+'/'},{'@type':'ListItem',position:3,name:`${g.grade} ${g.subject} 과외`,item:url}]}
  ]};
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <script type="application/ld+json">${JSON.stringify(graph).replace(/</g,'\\u003c')}</script>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f4f7fd;color:#173357;font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;line-height:1.75}
    a{color:#1457b4}header{background:white;border-bottom:1px solid #dce5f3;padding:17px max(20px,calc((100vw - 980px)/2))}
    header a{text-decoration:none;font-weight:800;color:#123b75}main{max-width:980px;margin:28px auto 65px;padding:0 18px}
    section{background:white;border:1px solid #dce5f3;border-radius:20px;padding:26px;margin:20px 0}
    h1{font-size:clamp(27px,4vw,37px);line-height:1.35}h2{font-size:23px;margin:0 0 12px}p{margin:8px 0 14px}
    .hero{background:linear-gradient(125deg,#163d7c,#285fd0);color:white}.hero p{color:#edf4ff}
    .table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:420px}th,td{border-bottom:1px solid #e1e8f3;padding:13px;text-align:left}thead{background:#edf3ff}
    ul{padding-left:23px}li{margin:9px 0}
    .related-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:14px}
    .related-card{padding:20px;border:1px solid #dce5f3;border-radius:14px;background:#f8fbff}
    .related-card h3{font-size:18px;line-height:1.5;margin:8px 0}
    .related-card p{font-size:14px;color:#465d7c;line-height:1.65}
    .related-tag{font-size:12px;font-weight:700;color:#2858a0}
    .related-more{display:inline-block;margin-top:4px;font-size:14px;font-weight:700}
    .region-guide-links{display:flex;flex-wrap:wrap;gap:10px}.region-guide-links a{display:inline-block;padding:9px 13px;background:#edf3ff;border:1px solid #dce5f3;border-radius:10px;text-decoration:none;font-weight:700}
    .cta{background:#183f80;color:white;text-align:center}.cta a{display:inline-block;background:white;color:#173b78;border-radius:12px;padding:12px 25px;font-weight:800;text-decoration:none}
    @media(max-width:600px){section{padding:20px}h2{font-size:20px}}
  </style>
  <script defer src="../analytics/visitor-tracker.js"></script>
</head>
<body>
<header><a href="../index.html">장쌤의과외교실</a>　<a href="../blog.html">교육정보</a>　<a href="../지역별과외찾기.html">지역별 과외</a></header>
<main>
  <nav aria-label="현재 위치"><a href="../index.html">홈</a> &gt; ${esc(g.grade)} ${esc(g.subject)} 과외</nav>
  <section class="hero">
    <h1>${esc(g.grade)} ${esc(g.subject)} 과외, 어떻게 선택할까요?</h1>
    <p>${esc(g.grade)} ${esc(g.subject)} 학습에서는 ${esc(g.focus)}을(를) 확인하는 것이 중요합니다. 방문과 화상 수업을 비교하고 아이에게 맞는 학습 계획을 세워 보세요.</p>
  </section>
  <section><h2>학습 방향과 선택 기준</h2><p>${esc(g.advice)}</p><p>현재 학습 수준, 수업 목표, 질문 습관과 피드백 방식을 함께 살펴보는 것이 좋습니다.</p></section>
  <section><h2>방문 과외와 화상 과외 비교</h2><p><strong>방문 과외</strong>는 같은 공간에서 풀이 과정을 확인하고 지도받는 방식입니다.</p><p><strong>화상 과외</strong>는 이동 없이 온라인으로 수업하며 화면 공유 등으로 학습 내용을 확인하는 방식입니다.</p><p>어느 방식이 더 적합한지는 학생의 학습 습관과 가정 환경에 따라 달라집니다.</p></section>
  <section><h2>${esc(g.grade)} 주 2회 수업료</h2><div class="table-wrap"><table><thead><tr><th scope="col">수업시간</th><th scope="col">방문</th><th scope="col">화상</th></tr></thead><tbody>${rows}</tbody></table></div><p>※ 월 수업료 기준입니다. 고등학생 표는 1~2학년 기준이며 고3 금액은 별도 확인이 필요합니다.</p></section>
  <section><h2>학부모가 자주 묻는 질문</h2><details><summary>주 2회 수업으로 충분한가요?</summary><p>수업 외 복습 시간과 현재 학습 수준에 따라 달라집니다. 수업 횟수뿐 아니라 학습 계획을 함께 확인해 보세요.</p></details><details><summary>60분과 90분 중 어떤 수업이 적합할까요?</summary><p>집중 지속 시간과 다루어야 할 내용의 양에 따라 선택하는 것이 좋습니다.</p></details><details><summary>방문과 화상 중 무엇이 좋을까요?</summary><p>학습 습관과 피드백 방식, 수업 환경을 비교해 결정해 보세요.</p></details></section>
  <section><h2>관련 교육정보</h2><p>관련 학년과 과목으로 분류된 실제 교육정보를 확인할 수 있습니다.</p><div class="related-grid">${links}</div></section>
  <section class="region-guide"><h2>지역별 과외 안내</h2><p>지역별 안내에서 상담 지역을 확인할 수 있습니다. 방문 수업 가능 여부는 주소와 일정에 따라 달라질 수 있으며, 화상 수업도 비교해 보세요.</p><div class="region-guide-links">${regionFromGuideLinks}</div></section>
  <section class="cta"><h2>우리 아이 학습 방향 상담</h2><p>학습 상황을 바탕으로 적합한 수업 방향을 안내합니다.</p><a href="../상담신청.html">상담 신청하기</a></section>
</main>
</body>
</html>`;
}
for (const g of tutoringGuides) {
  fs.writeFileSync(path.join(guideDir,`${g.key}.html`),guideHtml(g),'utf8');
}
// 기존 지역별 페이지에 학년·과목 안내 연결을 자동 삽입합니다.
// 재빌드 시 중복 삽입되지 않도록 주석 마커 사이의 영역을 교체합니다.
const regionBlock = `<!-- TUTORING_GUIDES_START -->
<section class="grade-subject-guide" aria-labelledby="grade-subject-guide-heading">
  <div class="wrap">
    <div class="section-head"><h2 id="grade-subject-guide-heading">학년·과목별 과외 안내</h2>
      <p>학습 목표와 수업 방식, 월 수업료를 비교할 수 있습니다. 실제 방문 수업 가능 여부는 상담을 통해 확인해 주세요.</p></div>
    <div class="region-links">${regionToGuideLinks}</div>
  </div>
</section>
<!-- TUTORING_GUIDES_END -->`;
for (const [, slug] of activeRegions) {
  const file = path.join(regionDir, `${slug}-tutoring.html`);
  let html = fs.readFileSync(file, 'utf8');
  const markers = /<!-- TUTORING_GUIDES_START -->[\s\S]*?<!-- TUTORING_GUIDES_END -->/;
  if (markers.test(html)) html = html.replace(markers, regionBlock);
  else if (html.includes('<section class="cta">')) html = html.replace('<section class="cta">', regionBlock + '\n<section class="cta">');
  else throw new Error(`[지역 연결 오류] 삽입 위치를 찾을 수 없습니다: ${file}`);
  fs.writeFileSync(file, html, 'utf8');
}

// homepage latest cards
const indexPath=path.join(root,'index.html'); let index=fs.readFileSync(indexPath,'utf8');
const cards=posts.slice(0,3).map(p=>`<a class="jj-blog-home-card" href="posts/${encodeURIComponent(p.slug)}.html"><span class="jj-blog-tag">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><time datetime="${esc(p.date)}">${esc(p.date.replace(/-/g,'.'))}</time></a>`).join('\n');
index=index.replace(/<!-- CMS_HOME_POSTS_START -->[\s\S]*?<!-- CMS_HOME_POSTS_END -->/,`<!-- CMS_HOME_POSTS_START -->\n<div class="jj-blog-home-grid">\n${cards}\n</div>\n<!-- CMS_HOME_POSTS_END -->`);
fs.writeFileSync(indexPath,index,'utf8');
// sitemap
const staticUrls=[...tutoringGuides.map(g => `/tutoring/${g.key}.html`),'/','/blog.html','/화상수업.html','/지역별과외찾기.html','/상담신청.html','/regions/','/regions/seoul-tutoring.html','/regions/gyeonggi-tutoring.html','/regions/incheon-tutoring.html','/regions/busan-tutoring.html','/regions/daegu-tutoring.html','/regions/daejeon-tutoring.html','/regions/gwangju-tutoring.html','/regions/ulsan-tutoring.html','/regions/online-tutoring.html'];
const urls=[...staticUrls.map(u=>({loc:site+u,lastmod:new Date().toISOString().slice(0,10)})),...posts.map(p=>({loc:`${site}/posts/${encodeURIComponent(p.slug)}.html`,lastmod:p.modified||p.date}))];
fs.writeFileSync(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>`  <url><loc>${xml(u.loc)}</loc><lastmod>${xml(u.lastmod)}</lastmod></url>`).join('\n')+'\n</urlset>\n','utf8');
// RSS
const items=posts.slice(0,30).map(p=>`<item><title>${xml(p.title)}</title><link>${site}/posts/${encodeURIComponent(p.slug)}.html</link><guid>${site}/posts/${encodeURIComponent(p.slug)}.html</guid><pubDate>${new Date(`${p.date}T00:00:00+09:00`).toUTCString()}</pubDate><description>${xml(p.excerpt)}</description><category>${xml(p.category)}</category></item>`).join('\n');
fs.writeFileSync(path.join(root,'rss.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>장쌤의과외교실 교육정보</title><link>${site}/blog.html</link><description>학생과 학부모를 위한 공부법과 교육정보</description><language>ko</language>${items}</channel></rss>\n`,'utf8');
console.log(`[게시글 자동화 완료] 게시글 ${posts.length}개, 과외 안내 ${tutoringGuides.length}개 생성, sitemap.xml + rss.xml 갱신.`);
