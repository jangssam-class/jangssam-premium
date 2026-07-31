(() => {
  const article = document.getElementById('article');
  const slug = new URLSearchParams(location.search).get('slug');
  const escapeHtml = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const inline = text => escapeHtml(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  function markdown(md=''){
    const lines=String(md).replace(/\r/g,'').split('\n'); let html='', list=null;
    const close=()=>{if(list){html+=`</${list}>`;list=null;}};
    for(const raw of lines){const line=raw.trim();if(!line){close();continue;}
      let m;if((m=line.match(/^(#{2,4})\s+(.+)$/))){close();const n=m[1].length;html+=`<h${n}>${inline(m[2])}</h${n}>`;}
      else if((m=line.match(/^[-*]\s+(.+)$/))){if(list!=='ul'){close();list='ul';html+='<ul>';}html+=`<li>${inline(m[1])}</li>`;}
      else if((m=line.match(/^\d+\.\s+(.+)$/))){if(list!=='ol'){close();list='ol';html+='<ol>';}html+=`<li>${inline(m[1])}</li>`;}
      else if(line.startsWith('> ')){close();html+=`<blockquote>${inline(line.slice(2))}</blockquote>`;}
      else{close();html+=`<p>${inline(line)}</p>`;}}
    close();return html;
  }
  fetch('content/posts.json',{cache:'no-store'}).then(r=>r.json()).then(data=>{
    const post=(data.posts||[]).find(p=>p.slug===slug&&p.published!==false);if(!post)throw new Error('not found');
    document.title=`${post.title} | 장쌤의과외교실`;
    const desc=document.querySelector('meta[name="description"]');if(desc)desc.content=post.excerpt||post.title;
    article.innerHTML=`<header class="article-header"><span class="post-category">${escapeHtml(post.category)}</span><h1>${escapeHtml(post.title)}</h1><p class="article-excerpt">${escapeHtml(post.excerpt)}</p><div class="post-meta">${escapeHtml(post.date)} · 장쌤 교육정보</div></header>${post.image?`<figure class="article-image"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.imageAlt || post.title)}"></figure>`:''}<div class="article-content">${markdown(post.body)}</div>`;
  }).catch(()=>{article.innerHTML='<div class="article-error"><h1>글을 찾을 수 없습니다.</h1><p>주소가 잘못되었거나 비공개로 전환된 글입니다.</p><a href="blog.html">교육정보로 돌아가기</a></div>';});
})();
