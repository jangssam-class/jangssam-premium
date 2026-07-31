(() => {
  const state = { posts: [], category: '전체', query: '', page: 1, pageSize: 9 };
  const grid = document.getElementById('postGrid');
  const featuredGrid = document.getElementById('featuredGrid');
  const featuredArea = document.getElementById('featuredArea');
  const categories = document.getElementById('categoryButtons');
  const empty = document.getElementById('emptyMessage');
  const count = document.getElementById('postCount');

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const formatDate = (value) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  };

  const image = (post) => post.image
    ? `<div class="post-thumb"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.imageAlt || post.title)}" loading="lazy"></div>`
    : `<div class="post-thumb post-thumb-fallback"><span>${escapeHtml(post.category)}</span></div>`;

  const card = (post, featured = false) => `
    <a class="post-card${featured ? ' featured-card' : ''}" href="post.html?slug=${encodeURIComponent(post.slug)}">
      ${image(post)}
      <div class="post-card-body">
        <span class="post-category">${escapeHtml(post.category)}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="post-meta">${formatDate(post.date)} · 장쌤 교육정보</div>
      </div>
    </a>`;

  function getFilteredPosts() {
    const query = state.query.trim().toLowerCase();
    return state.posts.filter((post) => {
      const categoryMatches = state.category === '전체' || post.category === state.category;
      const searchText = `${post.title} ${post.excerpt} ${post.category} ${post.body}`.toLowerCase();
      return categoryMatches && (!query || searchText.includes(query));
    });
  }

  function renderPagination(total) {
    let pagination = document.getElementById('blogPagination');
    if (!pagination) {
      pagination = document.createElement('nav');
      pagination.id = 'blogPagination';
      pagination.className = 'blog-pagination';
      pagination.setAttribute('aria-label', '교육정보 페이지 이동');
      grid.insertAdjacentElement('afterend', pagination);
    }

    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      pagination.hidden = true;
      return;
    }

    pagination.hidden = false;
    pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      return `<button type="button" data-page="${page}" class="${page === state.page ? 'active' : ''}" aria-label="${page}페이지">${page}</button>`;
    }).join('');
  }

  function render() {
    const filtered = getFilteredPosts();
    const start = (state.page - 1) * state.pageSize;
    const visible = filtered.slice(start, start + state.pageSize);
    grid.innerHTML = visible.map((post) => card(post)).join('');
    empty.style.display = filtered.length ? 'none' : 'block';
    count.textContent = `총 ${filtered.length}개의 글`;
    renderPagination(filtered.length);
  }

  fetch('content/posts.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      state.posts = (data.posts || [])
        .filter((post) => post.published !== false)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

      const categoryList = ['전체', ...new Set(state.posts.map((post) => post.category))];
      categories.innerHTML = categoryList.map((category, index) => `
        <button type="button" data-category="${escapeHtml(category)}" class="${index === 0 ? 'active' : ''}">${escapeHtml(category)}</button>`).join('');

      const featured = state.posts.filter((post) => post.featured).slice(0, 3);
      if (featured.length) {
        featuredArea.hidden = false;
        featuredGrid.innerHTML = featured.map((post) => card(post, true)).join('');
      }
      render();
    })
    .catch((error) => {
      console.error(error);
      grid.innerHTML = '<div class="load-error">교육정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
    });

  categories.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    categories.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.category = button.dataset.category;
    state.page = 1;
    render();
  });

  document.getElementById('blogSearch').addEventListener('submit', (event) => {
    event.preventDefault();
    state.query = document.getElementById('searchInput').value;
    state.page = 1;
    render();
  });

  document.getElementById('searchInput').addEventListener('input', (event) => {
    state.query = event.target.value;
    state.page = 1;
    render();
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('#blogPagination button');
    if (!button) return;
    state.page = Number(button.dataset.page) || 1;
    render();
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
