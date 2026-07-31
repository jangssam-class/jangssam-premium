(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const lockBody = () => document.body.classList.add("modal-open");
  const unlockBody = () => {
    const opened = $$(".open, .active").some((el) =>
      ["curriculumModal", "heroInfoModal", "subjectModal", "teacherModal", "regionModal", "mobileMenu"]
        .includes(el.id)
    );
    if (!opened) document.body.classList.remove("modal-open");
  };

  const openLayer = (el, options = {}) => {
    if (!el) return;

    const { lockScroll = true } = options;

    el.classList.add("open", "active");
    el.setAttribute("aria-hidden", "false");

    if (lockScroll) {
      lockBody();
    }
  };

  const closeLayer = (el) => {
    if (!el) return;
    el.classList.remove("open", "active");
    el.setAttribute("aria-hidden", "true");
    setTimeout(unlockBody, 0);
  };

  document.addEventListener("DOMContentLoaded", () => {
    /* 모바일 메뉴 */
    const menuBtn = $("#mobileMenuBtn");
    const menu = $("#mobileMenu");
    const menuClose = $("#mobileMenuClose");
    const menuOverlay = $("#mobileMenuOverlay");

    const openMenu = () => {
      if (!menu) return;
      menu.classList.add("active", "open");
      menuOverlay?.classList.add("active");
      menu.setAttribute("aria-hidden", "false");
      menuBtn?.setAttribute("aria-expanded", "true");
      lockBody();
    };

    const closeMenu = () => {
      menu?.classList.remove("active", "open");
      menuOverlay?.classList.remove("active");
      menu?.setAttribute("aria-hidden", "true");
      menuBtn?.setAttribute("aria-expanded", "false");
      setTimeout(unlockBody, 0);
    };

    menuBtn?.addEventListener("click", openMenu);
    menuClose?.addEventListener("click", closeMenu);
    menuOverlay?.addEventListener("click", closeMenu);
    $$(".mobile-navbar a").forEach((link) => link.addEventListener("click", closeMenu));

    /* 헤더 스크롤 */
    const header = $("#mainHeader");
    const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 20);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    /* 부드러운 이동 */
    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");
        if (!href || href === "#") return;
        const target = $(href);
        if (!target) return;
        event.preventDefault();
        const headerHeight = header?.offsetHeight || 0;
        const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
        window.scrollTo({ top, behavior: "smooth" });
      });
    });

    /* 숫자 카운터 */
    const counters = $$(".counter");
    const animateCounter = (el) => {
      if (el.dataset.animated === "true") return;
      el.dataset.animated = "true";
      const target = Number(el.dataset.target || 0);
      const suffix = el.dataset.suffix || "";
      const duration = 1200;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = `${Math.floor(target * eased).toLocaleString("ko-KR")}${suffix}`;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      counters.forEach((counter) => observer.observe(counter));
    } else {
      counters.forEach(animateCounter);
    }

    /* 커리큘럼 모달 */
    const curriculumModal = $("#curriculumModal");
    $("#curriculumBtn")?.addEventListener("click", (event) => {
      event.preventDefault();
      openLayer(curriculumModal);
    });
    $("#closeModal")?.addEventListener("click", () => closeLayer(curriculumModal));
    curriculumModal?.addEventListener("click", (event) => {
      if (event.target === curriculumModal) closeLayer(curriculumModal);
    });

    $$(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => {
        $$(".tab-btn").forEach((btn) => btn.classList.remove("active"));
        $$(".tab-content").forEach((content) => content.classList.remove("active"));
        button.classList.add("active");
        $(`#${button.dataset.tab}`)?.classList.add("active");
      });
    });

    /* 히어로 안내 팝업 */
    const heroInfo = {
      question: {
        badge: "REAL-TIME Q&A",
        title: "실시간 질문 가능",
        text: "수업 중 이해되지 않는 내용은 바로 질문하고 해결할 수 있습니다. 학생의 학습 흐름이 끊기지 않도록 꼼꼼하게 설명합니다."
      },
      personal: {
        badge: "PERSONAL CLASS",
        title: "1:1 맞춤 수업",
        text: "학생의 현재 수준과 목표, 학습 습관을 분석해 개인별 진도와 설명 방식으로 수업을 진행합니다."
      },
      online: {
        badge: "ONLINE CLASS",
        title: "온라인 수업",
        text: "지역에 관계없이 화상으로 수업할 수 있습니다. 화면 공유와 실시간 피드백을 활용해 대면수업처럼 체계적으로 진행합니다."
      }
    };

    const heroModal = $("#heroInfoModal");
    $$(".hero-info-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const info = heroInfo[button.dataset.info];
        if (!info) return;
        $("#heroInfoBadge").textContent = info.badge;
        $("#heroInfoTitle").textContent = info.title;
        $("#heroInfoText").textContent = info.text;
        openLayer(heroModal);
      });
    });
    $("#heroInfoClose")?.addEventListener("click", () => closeLayer(heroModal));
    heroModal?.addEventListener("click", (event) => {
      if (event.target === heroModal) closeLayer(heroModal);
    });
    $("#heroInfoConsult")?.addEventListener("click", () => closeLayer(heroModal));

    /* FAQ */
    $$(".faq-question").forEach((question) => {
      question.setAttribute("aria-expanded", "false");
      question.addEventListener("click", () => {
        const item = question.closest(".faq-item");
        const isOpen = item?.classList.contains("active");

        $$(".faq-item").forEach((other) => {
          other.classList.remove("active");
          $(".faq-question", other)?.setAttribute("aria-expanded", "false");
        });

        if (!isOpen) {
          item?.classList.add("active");
          question.setAttribute("aria-expanded", "true");
        }
      });
    });

    /* 과목별 상세 모달 */
    const subjectData = {
      social: {
        badge: "SOCIAL STUDIES",
        title: "사회 맞춤 수업",
        intro: "핵심 개념과 자료 해석 능력을 함께 키워 학교 시험에 대비합니다.",
        goal: "교과서 핵심 개념을 정확히 이해하고 지도·그래프·통계 자료를 스스로 해석하는 힘을 기릅니다.",
        method: "단원 흐름 설명 후 대표 문제와 학교별 기출 유형을 단계적으로 풀이합니다.",
        management: "오답 원인을 분류하고 핵심 용어 복습과 단원별 확인 문제를 제공합니다.",
        target: "사회 개념이 헷갈리거나 서술형·자료 분석 문제에서 어려움을 겪는 학생"
      },
      history: {
        badge: "HISTORY",
        title: "역사 맞춤 수업",
        intro: "사건을 외우는 데서 끝나지 않고 시대 흐름과 인과관계를 이해합니다.",
        goal: "시대별 핵심 사건과 인물, 제도의 변화를 연결해 설명할 수 있도록 합니다.",
        method: "연표와 지도, 이야기식 설명을 활용하고 기출 문제로 중요도를 확인합니다.",
        management: "누적 복습과 핵심 키워드 테스트로 장기 기억을 돕습니다.",
        target: "암기 부담이 크거나 사건 순서와 시대 구분이 어려운 학생"
      },
      essay: {
        badge: "ESSAY",
        title: "논술 맞춤 수업",
        intro: "읽기·요약·근거 제시·글쓰기의 전 과정을 체계적으로 훈련합니다.",
        goal: "글의 핵심을 파악하고 자신의 생각을 논리적인 문장과 구조로 표현합니다.",
        method: "제시문 독해, 개요 작성, 초고 작성, 첨삭과 재작성 순서로 진행합니다.",
        management: "학생별 자주 틀리는 표현과 문장 습관을 기록해 반복 교정합니다.",
        target: "독해력과 표현력을 함께 키우거나 수행평가·논술을 준비하는 학생"
      },
      ged: {
        badge: "GED",
        title: "검정고시 맞춤 수업",
        intro: "과목별 기초 개념부터 기출 문제까지 합격 목표에 맞춰 준비합니다.",
        goal: "취약 과목을 빠르게 보완하고 시험에 자주 나오는 핵심 유형을 익힙니다.",
        method: "진단 후 과목별 우선순위를 정하고 개념·기출·실전 모의고사를 반복합니다.",
        management: "주간 진도표와 오답 관리로 시험일까지 학습량을 체계적으로 조절합니다.",
        target: "중졸·고졸 검정고시를 처음 준비하거나 특정 과목 보완이 필요한 학습자"
      },
      coding: {
        badge: "CODING",
        title: "코딩 맞춤 수업",
        intro: "기초 문법부터 웹사이트와 프로젝트 제작까지 실습 중심으로 배웁니다.",
        goal: "코드를 이해하고 직접 수정하며 자신만의 결과물을 완성합니다.",
        method: "HTML·CSS·JavaScript·Python을 수준에 맞춰 설명하고 프로젝트로 적용합니다.",
        management: "과제 코드 리뷰와 오류 원인 분석을 통해 스스로 해결하는 습관을 만듭니다.",
        target: "코딩 입문자, 학교 과제 준비 학생, 홈페이지·포트폴리오 제작을 원하는 학습자"
      },
      math: {
        badge: "MATHEMATICS",
        title: "수학 맞춤 수업",
        intro: "개념 이해부터 유형 적용과 심화 문제까지 학생 수준에 맞게 진행합니다.",
        goal: "공식을 외우기보다 원리를 이해하고 문제에 적용하는 힘을 기릅니다.",
        method: "개념 설명, 대표 예제, 유사 문제, 오답 재풀이 순서로 학습합니다.",
        management: "단원별 성취도와 오답 유형을 기록해 취약 부분을 반복 보완합니다.",
        target: "수학 기초가 부족하거나 내신·심화·선행 학습이 필요한 학생"
      },
      english: {
        badge: "ENGLISH",
        title: "영어 맞춤 수업",
        intro: "문법·독해·어휘·회화를 목표에 맞춰 균형 있게 지도합니다.",
        goal: "문장 구조를 이해하고 읽기와 쓰기, 말하기에 자신감을 갖도록 합니다.",
        method: "레벨 진단 후 문법과 독해를 연결하고 반복 말하기와 작문을 병행합니다.",
        management: "어휘 테스트와 문장 누적 복습, 오답 기록으로 학습을 관리합니다.",
        target: "학교 내신, 수능, 기초 영어, 회화 실력 향상이 필요한 학생"
      },
      korean: {
        badge: "KOREAN",
        title: "국어 맞춤 수업",
        intro: "문해력과 독해력을 바탕으로 학교 시험과 서술형 문제에 대비합니다.",
        goal: "글의 구조와 핵심 내용을 파악하고 근거를 들어 답하는 힘을 기릅니다.",
        method: "지문 분석, 핵심 문장 찾기, 문제 풀이, 서술형 답안 작성으로 진행합니다.",
        management: "독해 과정과 오답 근거를 확인해 학생별 약점을 보완합니다.",
        target: "긴 글 읽기가 어렵거나 비문학·문학·서술형 대비가 필요한 학생"
      },
      science: {
        badge: "SCIENCE",
        title: "과학 맞춤 수업",
        intro: "과학 개념을 현상과 연결해 이해하고 응용 문제 해결력을 키웁니다.",
        goal: "핵심 원리를 설명하고 그래프·실험·계산 문제에 적용하도록 합니다.",
        method: "개념 시각화, 대표 실험 분석, 유형 문제 풀이 순서로 진행합니다.",
        management: "단원별 개념 확인과 오답 복습으로 취약 내용을 누적 관리합니다.",
        target: "과학 개념이 추상적으로 느껴지거나 내신·탐구 문제 대비가 필요한 학생"
      },
      custom: {
        badge: "CUSTOM CURRICULUM",
        title: "맞춤 커리큘럼",
        intro: "학생의 목표와 학습 성향을 분석해 전용 학습 계획을 설계합니다.",
        goal: "현재 수준에서 가장 필요한 학습을 우선하고 꾸준한 성장을 만듭니다.",
        method: "상담과 진단을 바탕으로 과목, 진도, 과제량, 수업 방식을 개별 설정합니다.",
        management: "주간 학습 결과와 변화 과정을 확인하고 필요할 때 계획을 조정합니다.",
        target: "여러 과목 관리, 학습 습관 개선, 장기적인 성적 향상이 필요한 학생"
      }
    };

    const subjectModal = $("#subjectModal");
    $$(".subject-detail-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const data = subjectData[button.dataset.subject];
        if (!data) return;
        $("#subjectModalBadge").textContent = data.badge;
        $("#subjectModalTitle").textContent = data.title;
        $("#subjectModalIntro").textContent = data.intro;
        $("#subjectGoal").textContent = data.goal;
        $("#subjectMethod").textContent = data.method;
        $("#subjectManagement").textContent = data.management;
        $("#subjectTarget").textContent = data.target;
        openLayer(subjectModal);
      });
    });
    $("#subjectModalClose")?.addEventListener("click", () => closeLayer(subjectModal));
    subjectModal?.addEventListener("click", (event) => {
      if (event.target === subjectModal) closeLayer(subjectModal);
    });

    /* 선생님 목록 */
    const teachers = [
      ["김OO", "여성", "수학 · 과학", ["서울"], "초등·중등", "방문 · 화상", "평일 저녁", "7년", "개념을 쉽게 풀어 설명하고 오답 원인을 꼼꼼히 찾아주는 선생님입니다."],
      ["이OO", "남성", "영어 · 국어", ["서울", "전국"], "중등·고등", "방문 · 화상", "평일·주말", "9년", "학생의 독해 과정과 문장 구조를 차근차근 잡아줍니다."],
      ["박OO", "여성", "초등 전과목", ["경기"], "초등", "방문 · 화상", "평일 오후", "6년", "아이의 눈높이에 맞춘 친절한 설명과 학습 습관 관리가 강점입니다."],
      ["최OO", "남성", "수학", ["경기", "전국"], "중등·고등", "방문 · 화상", "평일 저녁", "10년", "내신과 심화 문제를 학생 수준에 맞춰 단계적으로 지도합니다."],
      ["정OO", "여성", "영어 회화 · 문법", ["인천", "전국"], "초등·중등·성인", "방문 · 화상", "평일·주말", "8년", "말하기 자신감과 문법 기초를 함께 키우는 수업을 진행합니다."],
      ["강OO", "남성", "과학 · 수학", ["인천"], "중등·고등", "방문", "주말", "5년", "실험과 실제 사례를 활용해 과학 원리를 쉽게 이해시킵니다."],
      ["윤OO", "여성", "국어 · 논술", ["부산", "전국"], "초등·중등", "방문 · 화상", "평일 오후", "11년", "문해력과 글쓰기의 기본기를 차분하게 키워줍니다."],
      ["장OO", "남성", "코딩 · 수학", ["부산", "전국"], "초등·중등·고등", "방문 · 화상", "평일·주말", "8년", "직접 만드는 프로젝트를 통해 코딩 원리를 자연스럽게 익히게 합니다."],
      ["한OO", "여성", "영어", ["대구", "전국"], "중등·고등", "방문 · 화상", "평일 저녁", "7년", "내신 문법과 독해를 연결해 시험 실력을 안정적으로 높입니다."],
      ["송OO", "남성", "수학 · 검정고시", ["대구"], "중등·고등·성인", "방문 · 화상", "평일·주말", "12년", "기초가 약한 학생도 따라올 수 있도록 핵심부터 반복 지도합니다."],
      ["오OO", "여성", "사회 · 역사", ["대전", "전국"], "중등·고등", "방문 · 화상", "평일 저녁", "6년", "시대 흐름과 자료 분석을 연결해 암기 부담을 줄여줍니다."],
      ["배OO", "남성", "과학", ["대전"], "중등·고등", "방문", "주말", "9년", "개념과 계산, 탐구 문제를 균형 있게 지도합니다."],
      ["신OO", "여성", "초등 영어 · 국어", ["광주", "전국"], "초등", "방문 · 화상", "평일 오후", "5년", "기초 읽기와 표현 능력을 재미있게 키우는 수업을 합니다."],
      ["임OO", "남성", "수학", ["광주"], "중등·고등", "방문 · 화상", "평일 저녁", "8년", "학생이 풀이 과정을 스스로 설명하도록 지도합니다."],
      ["조OO", "여성", "논술 · 국어", ["울산", "전국"], "초등·중등·고등", "방문 · 화상", "평일·주말", "10년", "독해와 요약, 글쓰기 첨삭을 체계적으로 진행합니다."],
      ["문OO", "남성", "코딩", ["울산", "전국"], "초등·중등·고등·성인", "화상", "평일 저녁", "7년", "웹사이트와 Python 프로젝트 중심으로 실습합니다."],
      ["서OO", "여성", "영어", ["전국"], "초등·중등", "화상", "평일 오후", "6년", "화상수업에서도 적극적인 질문과 반복 연습을 이끌어냅니다."],
      ["권OO", "남성", "수학 · 과학", ["전국"], "중등·고등", "화상", "평일·주말", "13년", "전국 화상수업으로 내신과 수능 기초를 관리합니다."],
      ["노OO", "여성", "검정고시", ["전국"], "중등·고등·성인", "화상", "평일", "9년", "검정고시 과목별 핵심과 기출문제를 효율적으로 정리합니다."],
      ["홍OO", "남성", "사회 · 역사", ["서울", "경기"], "중등·고등", "방문 · 화상", "주말", "7년", "자료 분석과 서술형 답안 작성에 강한 수업을 제공합니다."],
      ["유OO", "여성", "영어 · 논술", ["서울", "전국"], "초등·중등", "방문 · 화상", "평일 오후", "8년", "영어 독해와 글쓰기 표현을 함께 키웁니다."],
      ["백OO", "남성", "수학", ["부산"], "고등", "방문 · 화상", "평일 저녁", "11년", "고등 수학의 개념 연결과 내신 문제 분석을 전문으로 합니다."],
      ["남OO", "여성", "국어", ["부산", "전국"], "중등·고등", "방문 · 화상", "평일·주말", "7년", "문학과 비문학 독해 과정을 학생별로 세밀하게 교정합니다."],
      ["고OO", "남성", "코딩", ["대구", "전국"], "중등·고등·성인", "화상", "평일 저녁", "6년", "HTML, CSS, JavaScript 프로젝트 수업을 진행합니다."],
      ["양OO", "여성", "초등 전과목", ["경기", "인천"], "초등", "방문", "평일 오후", "9년", "학습 습관과 기초 개념을 함께 잡아주는 선생님입니다."],
      ["안OO", "남성", "과학 · 검정고시", ["대전", "전국"], "중등·고등·성인", "화상", "주말", "8년", "과학 기초와 검정고시 실전 문제를 명확하게 설명합니다."],
      ["하OO", "여성", "영어 회화", ["광주", "전국"], "초등·중등·성인", "화상", "평일·주말", "5년", "부담 없는 반복 말하기로 영어 자신감을 키웁니다."],
      ["전OO", "남성", "수학 · 코딩", ["울산", "전국"], "중등·고등", "방문 · 화상", "평일 저녁", "10년", "논리적 사고와 문제 해결 과정을 중심으로 지도합니다."]
    ].map((t, index) => ({
      id: index + 1,
      name: t[0],
      gender: t[1],
      subject: t[2],
      regions: t[3],
      grades: t[4],
      methods: t[5],
      availability: t[6],
      experience: t[7],
      intro: t[8],
      style: "진단 결과를 바탕으로 개념 설명과 문제 적용, 복습 확인을 단계별로 진행합니다.",
      target: `${t[4]} 과정에서 ${t[2]} 학습이 필요한 학생`,
      status: index % 4 === 0 ? "상담 마감 임박" : "상담 가능"
    }));

    const teacherGrid = $("#teacherGrid");
    const regionButtons = $$(".teacher-region-btn");
    const loadMoreBtn = $("#teacherLoadMoreBtn");
    const teacherEmpty = $("#teacherEmpty");
    const loadMoreWrap = $("#teacherLoadMoreWrap");
    let selectedRegion = "전체";
    let visibleLimit = 8;

    const filteredTeachers = () => {
      if (selectedRegion === "전체") return teachers;
      if (selectedRegion === "전국") return teachers.filter((teacher) => teacher.regions.includes("전국"));
      return teachers.filter((teacher) => teacher.regions.includes(selectedRegion));
    };

    const renderTeachers = () => {
      if (!teacherGrid) return;
      const filtered = filteredTeachers();
      const visible = filtered.slice(0, visibleLimit);

      teacherGrid.innerHTML = visible.map((teacher) => `
        <article class="teacher-card">
          <div class="teacher-card-top">
            <div class="teacher-avatar">${teacher.name.charAt(0)}</div>
            <div>
              <span class="teacher-sample-badge">예시 프로필</span>
              <h3>${teacher.name} 선생님</h3>
              <strong>${teacher.subject}</strong>
            </div>
          </div>
          <div class="teacher-card-tags">
            <span>${teacher.gender} 튜터</span>
            <span>${teacher.grades}</span>
            <span>${teacher.methods}</span>
          </div>
          <p>${teacher.intro}</p>
          <div class="teacher-card-bottom">
            <span class="teacher-card-status">${teacher.status}</span>
            <button type="button" class="teacher-profile-btn" data-teacher-id="${teacher.id}">프로필 보기</button>
          </div>
        </article>
      `).join("");

      $("#teacherVisibleCount").textContent = `${visible.length}명`;
      $("#teacherTotalCount").textContent = `총 ${filtered.length}명`;
      $("#teacherResultText").textContent =
        selectedRegion === "전체"
          ? "전국 담당 선생님을 확인하고 있습니다."
          : selectedRegion === "전국"
            ? "전국 화상수업 선생님을 확인하고 있습니다."
            : `${selectedRegion} 지역 담당 선생님을 확인하고 있습니다.`;

      const isEmpty = filtered.length === 0;
      teacherEmpty?.classList.toggle("active", isEmpty);
      if (teacherEmpty) teacherEmpty.style.display = isEmpty ? "" : "none";
      if (loadMoreWrap) loadMoreWrap.style.display = isEmpty ? "none" : "";

      if (loadMoreBtn) {
        loadMoreBtn.style.display = visible.length < filtered.length ? "" : "none";
      }

      $$(".teacher-profile-btn", teacherGrid).forEach((button) => {
        button.addEventListener("click", () => openTeacherModal(Number(button.dataset.teacherId)));
      });
    };

    regionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        regionButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        selectedRegion = button.dataset.region || "전체";
        visibleLimit = 8;
        renderTeachers();
      });
    });

    loadMoreBtn?.addEventListener("click", () => {
      visibleLimit += 8;
      renderTeachers();
    });

    $("#teacherShowOnline")?.addEventListener("click", () => {
      selectedRegion = "전국";
      visibleLimit = 8;
      regionButtons.forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.region === "전국")
      );
      renderTeachers();
    });

    const teacherModal = $("#teacherModal");
    const openTeacherModal = (id) => {
      const teacher = teachers.find((item) => item.id === id);
      if (!teacher) return;
      $("#teacherModalAvatar").textContent = teacher.name.charAt(0);
      $("#teacherModalName").textContent = `${teacher.name} 선생님`;
      $("#teacherModalSubject").textContent = `${teacher.subject} 전문`;
      $("#teacherModalGender").textContent = `${teacher.gender} 튜터`;
      $("#teacherModalStatus").textContent = teacher.status;
      $("#teacherModalIntro").textContent = teacher.intro;
      $("#teacherModalStyle").textContent = teacher.style;
      $("#teacherModalTarget").textContent = teacher.target;
      $("#teacherModalRegions").textContent = teacher.regions.join(" · ");
      $("#teacherModalGrades").textContent = teacher.grades;
      $("#teacherModalMethods").textContent = teacher.methods;
      $("#teacherModalAvailability").textContent = teacher.availability;
      $("#teacherModalExperience").textContent = teacher.experience;
      $("#teacherModalConsultTitle").textContent = `${teacher.name} 선생님 상담 신청`;
      openLayer(teacherModal);
    };

    $("#teacherModalClose")?.addEventListener("click", () => closeLayer(teacherModal));
    $("#teacherModalOverlay")?.addEventListener("click", () => closeLayer(teacherModal));

    renderTeachers();

    /* 지역별 상세 모달 */
    const regionData = {
      seoul: {
        name: "서울",
        districts: ["강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구", "동대문구", "동작구", "마포구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구"],
        schools: ["서울고", "경기고", "휘문고", "중동고", "숙명여고", "한영고"]
      },
      gyeonggi: {
        name: "경기",
        districts: ["수원시", "성남시", "고양시", "용인시", "화성시", "부천시", "안산시", "안양시", "남양주시", "평택시", "의정부시", "파주시", "김포시", "광주시", "광명시", "하남시"],
        schools: ["수원고", "분당고", "백석고", "용인고", "동탄고", "평촌고"]
      },
      incheon: {
        name: "인천",
        districts: ["중구", "동구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구"],
        schools: ["인천고", "송도고", "연수고", "부평고", "계양고", "가림고"]
      },
      busan: {
        name: "부산",
        districts: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
        schools: ["부산고", "동래고", "해운대고", "부산진고", "금정고", "대연고"]
      },
      daegu: {
        name: "대구",
        districts: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군", "군위군"],
        schools: ["대구고", "경북고", "대륜고", "수성고", "달성고", "대구여고"]
      },
      daejeon: {
        name: "대전",
        districts: ["동구", "중구", "서구", "유성구", "대덕구"],
        schools: ["대전고", "충남고", "유성고", "대덕고", "서대전고", "대전여고"]
      },
      gwangju: {
        name: "광주",
        districts: ["동구", "서구", "남구", "북구", "광산구"],
        schools: ["광주고", "상무고", "광덕고", "문성고", "광주여고", "수완고"]
      },
      ulsan: {
        name: "울산",
        districts: ["중구", "남구", "동구", "북구", "울주군"],
        schools: ["울산고", "학성고", "신정고", "현대고", "무거고", "울산여고"]
      }
    };

    const regionModal = $("#regionModal");
    let currentRegionKey = "seoul";
    let selectedDistrict = "";

    const renderRegion = (key) => {
      const data = regionData[key];
      if (!data) return;
      currentRegionKey = key;
      selectedDistrict = "";

      $("#regionModalTitle").textContent = `${data.name} 지역별 과외 찾기`;
      $("#regionModalDescription").textContent = `${data.name} 지역과 학교를 선택해 맞춤 상담을 신청하세요.`;
      $("#selectedRegionText").textContent = `${data.name} 지역 과외`;

      const districtList = $("#regionDistrictList");
      const schoolList = $("#regionSchoolList");
      if (districtList) {
        districtList.innerHTML = data.districts
          .map((name) => `<button type="button" class="region-chip" data-district="${name}">${name}</button>`)
          .join("");
      }
      if (schoolList) {
        schoolList.innerHTML = data.schools
          .map((name) => `<button type="button" class="region-school-item" data-school="${name}">${name}</button>`)
          .join("");
      }

      $$(".region-chip", districtList).forEach((button) => {
        button.addEventListener("click", () => {
          $$(".region-chip", districtList).forEach((btn) => btn.classList.remove("active"));
          button.classList.add("active");
          selectedDistrict = button.dataset.district || "";
          $("#selectedRegionText").textContent = `${data.name} ${selectedDistrict} 과외`;
        });
      });

      $$(".region-school-item", schoolList).forEach((button) => {
        button.addEventListener("click", () => {
          $$(".region-school-item", schoolList).forEach((btn) => btn.classList.remove("active"));
          button.classList.add("active");
          $("#selectedRegionText").textContent = `${data.name} ${button.dataset.school} 맞춤 과외`;
        });
      });

      $$(".region-tab-btn").forEach((button) =>
        button.classList.toggle("active", button.dataset.region === key)
      );
    };

    const openRegionModal = (key = "seoul") => {
      renderRegion(regionData[key] ? key : "seoul");

      /*
       * 지역별 과외 찾기 팝업은 body 스크롤을 잠그지 않습니다.
       * 따라서 팝업을 열어도 브라우저 스크롤바가 사라지지 않습니다.
       */
      openLayer(regionModal, { lockScroll: false });
    };

    $$(".footer-region-btn").forEach((button) => {
      button.addEventListener("click", () => openRegionModal(button.dataset.region));
    });
    $("#footerAllRegionBtn")?.addEventListener("click", () => openRegionModal("seoul"));
    $$(".region-tab-btn").forEach((button) => {
      button.addEventListener("click", () => renderRegion(button.dataset.region));
    });
    $("#regionModalClose")?.addEventListener("click", () => closeLayer(regionModal));
    $("#regionModalOverlay")?.addEventListener("click", () => closeLayer(regionModal));
    renderRegion("seoul");

    /* ESC로 열린 창 닫기 */
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeMenu();
      [curriculumModal, heroModal, subjectModal, teacherModal, regionModal].forEach(closeLayer);
    });

    /* 상담 링크에 선택 지역 정보 추가(가능한 경우) */
    $("#regionConsultBtn")?.addEventListener("click", () => {
      try {
        sessionStorage.setItem("selectedTutoringRegion",
          $("#selectedRegionText")?.textContent?.trim() || regionData[currentRegionKey].name
        );
      } catch (_) {
        // 저장이 차단되어도 상담 링크 이동은 정상 진행
      }
    });
  });
})();
