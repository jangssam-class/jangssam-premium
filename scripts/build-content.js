const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const site = 'https://jangssam-premium.netlify.app';
const dataPath = path.join(root, 'content', 'posts.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const rawPosts = (data.posts || []).filter(p => p.published !== false).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
const seenSlugs = new Set();
const posts = rawPosts.filter(p => { const slug=String(p.slug||'').trim(); if(!slug || seenSlugs.has(slug)) return false; seenSlugs.add(slug); return true; });
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
function postHtml(p) {
  const url=`${site}/posts/${encodeURIComponent(p.slug)}.html`;
  const image=p.image ? (p.image.startsWith('http')?p.image:`${site}${p.image.startsWith('/')?'':'/'}${p.image}`) : `${site}/이미지/seo-share.png`;
  const articleSchema={"@type":"Article",headline:p.title,description:p.excerpt,datePublished:p.date,dateModified:p.modified||p.date,mainEntityOfPage:url,image:[image],author:{"@type":"Organization",name:"장쌤의과외교실"},publisher:{"@type":"EducationalOrganization",name:"장쌤의과외교실","logo":{"@type":"ImageObject","url":`${site}/이미지/로고.png`}}};
  const breadcrumbSchema={"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"홈",item:site+"/"},{"@type":"ListItem",position:2,name:"교육정보",item:site+"/blog.html"},{"@type":"ListItem",position:3,name:p.title,item:url}]};
  const faqItems=Array.isArray(p.faq)?p.faq.filter(x=>x&&x.question&&x.answer):[];
  const graph=[articleSchema,breadcrumbSchema];
  if(faqItems.length) graph.push({"@type":"FAQPage",mainEntity:faqItems.map(x=>({"@type":"Question",name:x.question,acceptedAnswer:{"@type":"Answer",text:x.answer}}))});
  const schema={"@context":"https://schema.org","@graph":graph};
  const answerHtml=p.aiSummary?`<section class="ai-answer" aria-labelledby="quick-answer-title"><h2 id="quick-answer-title">한눈에 답하기</h2><p>${inline(p.aiSummary)}</p></section>`:'';
  const faqHtml=faqItems.length?`<section class="article-faq" aria-labelledby="faq-title"><h2 id="faq-title">자주 묻는 질문</h2>${faqItems.map(x=>`<h3>${esc(x.question)}</h3><p>${inline(x.answer)}</p>`).join('')}</section>`:'';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} | 장쌤의과외교실</title><meta name="description" content="${esc(p.excerpt)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:site_name" content="장쌤의과외교실"><meta property="og:locale" content="ko_KR"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.excerpt)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="../blog.css"><link rel="icon" href="../이미지/favicon-32.png" type="image/png"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></head><body class="post-page"><header class="blog-header"><div class="blog-header-inner"><a class="blog-logo" href="../index.html"><img alt="장쌤의과외교실 로고" src="../이미지/로고.png"><span>장쌤의과외교실</span></a><nav class="blog-nav"><a href="../blog.html">교육정보</a><a href="../지역별과외찾기.html">지역별 과외</a><a class="consult" href="../상담신청.html">상담 신청</a></nav></div></header><main class="article-main"><article class="article-shell"><header class="article-header"><span class="post-category">${esc(p.category)}</span><h1>${esc(p.title)}</h1><p class="article-excerpt">${esc(p.excerpt)}</p><div class="post-meta">${esc(p.date)} · 장쌤 교육정보</div></header>${p.image?`<figure class="article-image"><img src="${esc(p.image)}" alt="${esc(p.imageAlt||p.title)}"></figure>`:''}<div class="article-content">${answerHtml}${markdown(p.body)}${faqHtml}</div></article><aside class="article-cta"><strong>학생에게 맞는 학습 방향이 궁금하신가요?</strong><p>현재 학습 상태와 목표를 확인한 뒤 필요한 수업 방향을 차근차근 안내해드립니다.</p><a href="../상담신청.html">무료 상담 신청</a></aside><a class="back-link" href="../blog.html">교육정보 목록으로 돌아가기</a></main><footer class="blog-footer">© 2026 장쌤의과외교실. All rights reserved.</footer></body></html>`;
}
const postsDir=path.join(root,'posts'); fs.mkdirSync(postsDir,{recursive:true});
for(const file of fs.readdirSync(postsDir)){ if(file.endsWith('.html')) fs.unlinkSync(path.join(postsDir,file)); }
for(const p of posts) fs.writeFileSync(path.join(postsDir,`${p.slug}.html`),postHtml(p),'utf8');
// homepage latest cards
const indexPath=path.join(root,'index.html'); let index=fs.readFileSync(indexPath,'utf8');
const cards=posts.slice(0,3).map(p=>`<a class="jj-blog-home-card" href="posts/${encodeURIComponent(p.slug)}.html"><span class="jj-blog-tag">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><time datetime="${esc(p.date)}">${esc(p.date.replace(/-/g,'.'))}</time></a>`).join('\n');
index=index.replace(/<!-- CMS_HOME_POSTS_START -->[\s\S]*?<!-- CMS_HOME_POSTS_END -->/,`<!-- CMS_HOME_POSTS_START -->\n<div class="jj-blog-home-grid">\n${cards}\n</div>\n<!-- CMS_HOME_POSTS_END -->`);
fs.writeFileSync(indexPath,index,'utf8');
// sitemap
const staticUrls=['/','/blog.html','/화상수업.html','/지역별과외찾기.html','/상담신청.html','/regions/','/regions/seoul-tutoring.html','/regions/gyeonggi-tutoring.html','/regions/incheon-tutoring.html','/regions/busan-tutoring.html','/regions/daegu-tutoring.html','/regions/daejeon-tutoring.html','/regions/gwangju-tutoring.html','/regions/ulsan-tutoring.html','/regions/online-tutoring.html'];
const urls=[...staticUrls.map(u=>({loc:site+u,lastmod:new Date().toISOString().slice(0,10)})),...posts.map(p=>({loc:`${site}/posts/${encodeURIComponent(p.slug)}.html`,lastmod:p.date}))];
fs.writeFileSync(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>`  <url><loc>${xml(u.loc)}</loc><lastmod>${xml(u.lastmod)}</lastmod></url>`).join('\n')+'\n</urlset>\n','utf8');
// RSS
const items=posts.slice(0,30).map(p=>`<item><title>${xml(p.title)}</title><link>${site}/posts/${encodeURIComponent(p.slug)}.html</link><guid>${site}/posts/${encodeURIComponent(p.slug)}.html</guid><pubDate>${new Date(`${p.date}T00:00:00+09:00`).toUTCString()}</pubDate><description>${xml(p.excerpt)}</description><category>${xml(p.category)}</category></item>`).join('\n');
fs.writeFileSync(path.join(root,'rss.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>장쌤의과외교실 교육정보</title><link>${site}/blog.html</link><description>학생과 학부모를 위한 공부법과 교육정보</description><language>ko</language>${items}</channel></rss>\n`,'utf8');
console.log(`Generated ${posts.length} posts, sitemap.xml, rss.xml, and homepage cards.`);
