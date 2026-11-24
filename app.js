// Lục Dược — app logic (song ngữ Việt–Anh)
(function () {
  'use strict';
  const HERBS = window.HERBS || [];
  const $ = (id) => document.getElementById(id);

  // --- helpers ---
  function noDiacritics(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }
  function escapeHtml(s) {
    const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
  }
  function storageGet(key, def) {
    try { return JSON.parse(localStorage.getItem('lucduoc_' + key)) || def; } catch (e) { return def; }
  }
  function storageSet(key, val) {
    try { localStorage.setItem('lucduoc_' + key, JSON.stringify(val)); } catch (e) {}
  }

  // --- i18n ---
  // Câu DSHEA chuẩn của FDA (Mỹ), nguyên văn — chỉ hiện ở locale tiếng Anh.
  const DSHEA_NOTICE =
    'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.';
  // Số cấp cứu độc chất ở Mỹ — chỉ hiện ở locale tiếng Anh, trong hộp cảnh báo cây độc.
  const POISON_CONTROL_US =
    'If you suspect poisoning, call Poison Control at 1-800-222-1222 (US) or 911 in an emergency.';

  const STRINGS = {
    vi: {
      title: 'Lục Dược — Tra cứu thảo dược Việt Nam',
      tagline: 'Tra cứu thảo dược Việt Nam',
      install: '📲 Cài đặt app',
      searchPlaceholder: 'Tìm cây thuốc, triệu chứng (gõ không dấu cũng được)...',
      tabBrowse: '📖 Tra cứu',
      tabSymptom: '🩺 Theo bệnh',
      tabFavorites: '⭐ Yêu thích',
      all: 'Tất cả',
      browseEmpty: 'Không tìm thấy cây thuốc phù hợp.',
      symptomHint: 'Chọn triệu chứng để lọc cây thuốc tương ứng:',
      favEmpty: 'Chưa có cây yêu thích nào. Nhấn ⭐ ở trang chi tiết để lưu.',
      footerNote: '⚠️ Thông tin chỉ mang tính tham khảo, KHÔNG thay thế chẩn đoán và điều trị của bác sĩ.',
      photoCredits: 'Nguồn ảnh',
      toxicBadge: '☠️ Độc',
      noPhoto: 'Chưa có ảnh',
      toxicTitle: 'Cây độc.',
      sources: '📚 Nguồn',
      noSource: 'Chưa có nguồn kiểm chứng.',
      intro: '📝 Giới thiệu',
      parts: '🌱 Bộ phận dùng',
      uses: '💊 Công dụng chủ yếu',
      howTitle: '📖 Cách dùng',
      symptomsTitle: '🩺 Hỗ trợ các triệu chứng',
      notes: '📒 Ghi chú cá nhân',
      partsFallback: 'Tham khảo thêm',
      favSave: '☆ Lưu yêu thích',
      favSaved: '⭐ Đã lưu',
      share: '↗ Chia sẻ',
      notePlaceholder: 'Ghi kinh nghiệm dùng, câu hỏi cho thầy thuốc...',
      noteSaved: '✓ Đã lưu',
      copied: 'Đã copy thông tin vào clipboard.',
      themeToDark: 'Chuyển giao diện tối',
      themeToLight: 'Chuyển giao diện sáng',
      langButton: 'EN',
      langAria: 'Chuyển sang tiếng Anh',
      modalCloseAria: 'Đóng',
    },
    en: {
      title: 'Luc Duoc — Vietnamese Herbal Guide',
      tagline: 'Vietnamese herbal reference',
      install: '📲 Install app',
      searchPlaceholder: 'Search herbs or symptoms...',
      tabBrowse: '📖 Browse',
      tabSymptom: '🩺 By symptom',
      tabFavorites: '⭐ Favorites',
      all: 'All',
      browseEmpty: 'No matching herbs found.',
      symptomHint: 'Choose a symptom to filter matching herbs:',
      favEmpty: 'No favorites yet. Tap ⭐ on a herb’s detail page to save it.',
      footerNote: '⚠️ For reference only — not medical advice and not a substitute for a doctor’s diagnosis or treatment.',
      photoCredits: 'Photo credits',
      toxicBadge: '☠️ Toxic',
      noPhoto: 'No photo yet',
      toxicTitle: 'Toxic plant.',
      sources: '📚 Sources',
      noSource: 'No verified source yet.',
      intro: '📝 About this plant',
      parts: '🌱 Part used',
      uses: '💊 Main uses',
      howTitle: '📖 How to use',
      symptomsTitle: '🩺 Traditionally associated with',
      notes: '📒 Personal notes',
      partsFallback: 'Not specified',
      favSave: '☆ Save to favorites',
      favSaved: '⭐ Saved',
      share: '↗ Share',
      notePlaceholder: 'Your experience, questions for a practitioner…',
      noteSaved: '✓ Saved',
      copied: 'Copied to clipboard.',
      themeToDark: 'Switch to dark mode',
      themeToLight: 'Switch to light mode',
      langButton: 'VI',
      langAria: 'Switch to Vietnamese',
      modalCloseAria: 'Close',
    },
  };

  // Ngôn ngữ: lựa chọn đã lưu thắng; chưa có thì theo ngôn ngữ trình duyệt
  // (en → tiếng Anh, còn lại tiếng Việt) — giống app chính.
  function detectLocale() {
    const saved = storageGet('locale', '');
    if (saved === 'en' || saved === 'vi') return saved;
    const langs = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return langs.toLowerCase().startsWith('en') ? 'en' : 'vi';
  }
  let locale = detectLocale();
  function t(key) {
    return (STRINGS[locale] && STRINGS[locale][key]) || STRINGS.vi[key] || '';
  }
  function displayName(h) {
    return locale === 'en' ? (h.nameEn || h.name) : h.name;
  }

  let favorites = storageGet('favorites', []);   // array of herb ids
  let notes = storageGet('notes', {});           // { herbId: text }
  let currentAlpha = '';
  let currentSymptom = '';
  let currentDetailId = null;

  // --- build symptom index ---
  // Khóa theo nhãn tiếng Việt (ổn định qua hai locale); nhãn EN tra theo bảng.
  const symptomMap = {}; // symptom (vi, lowercase) -> [herbIds]
  const symptomViLabel = {}; // symptom (vi, lowercase) -> nhãn VI gốc (viết hoa)
  const symptomEnLabel = {}; // symptom (vi, lowercase) -> EN label
  HERBS.forEach(h => {
    (h.symptoms || []).forEach((sym, i) => {
      const key = sym.toLowerCase();
      if (!symptomMap[key]) symptomMap[key] = [];
      symptomMap[key].push(h.id);
      if (!symptomViLabel[key]) symptomViLabel[key] = sym;
      if (!symptomEnLabel[key] && h.symptomsEn && h.symptomsEn[i]) symptomEnLabel[key] = h.symptomsEn[i];
    });
  });
  // pick top symptoms by count
  const topSymptoms = Object.entries(symptomMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 24)
    .map(([sym]) => sym);

  function symptomLabel(key) {
    return locale === 'en' ? (symptomEnLabel[key] || key) : (symptomViLabel[key] || key);
  }

  // --- render herb card ---
  function herbCard(h) {
    const img = h.images && h.images[0] ? `<img class="thumb" loading="lazy" src="images/${h.images[0]}" alt="${escapeHtml(displayName(h))}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
    const ph = `<div class="thumb-placeholder" style="${img ? 'display:none' : ''}">🌿</div>`;
    const fav = favorites.includes(h.id) ? ' <span class="fav-dot">⭐</span>' : '';
    const toxic = h.toxic ? ` <span class="toxic-badge">${t('toxicBadge')}</span>` : '';
    return `<div class="herb-card" data-id="${h.id}">${img}${ph}<div class="info"><div class="name">${escapeHtml(displayName(h))}${fav}${toxic}</div><div class="sci">${escapeHtml(h.scientific || '')}</div></div></div>`;
  }

  // --- browse tab ---
  function renderAlphaFilter() {
    const letters = [...new Set(HERBS.map(h => noDiacritics(displayName(h))[0]).filter(Boolean))].sort();
    const wrap = $('alphaFilter');
    wrap.innerHTML = `<button class="alpha-btn${currentAlpha ? '' : ' active'}" data-letter="">${t('all')}</button>` +
      letters.map(l => `<button class="alpha-btn${currentAlpha === l ? ' active' : ''}" data-letter="${l}">${l.toUpperCase()}</button>`).join('');
    wrap.querySelectorAll('.alpha-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAlpha = btn.dataset.letter;
        renderBrowse();
      });
    });
  }

  function filteredHerbs() {
    const q = noDiacritics($('searchInput').value.trim());
    return HERBS.filter(h => {
      if (currentAlpha && noDiacritics(displayName(h))[0] !== currentAlpha) return false;
      if (!q) return true;
      const hay = noDiacritics([h.name, h.nameEn, (h.aliases || []).join(' '), h.scientific, h.description, (h.uses || []).join(' '), (h.symptoms || []).join(' '), (h.symptomsEn || []).join(' '), h.parts].join(' '));
      return hay.includes(q);
    });
  }

  function renderBrowse() {
    const list = filteredHerbs();
    $('herbGrid').innerHTML = list.map(herbCard).join('');
    $('browseEmpty').hidden = list.length > 0;
    attachCardClicks($('herbGrid'));
  }

  // --- symptom tab ---
  function renderSymptoms() {
    $('symptomList').innerHTML = topSymptoms.map(s =>
      `<button class="symptom-chip${currentSymptom === s ? ' active' : ''}" data-sym="${s}">${escapeHtml(symptomLabel(s))} (${symptomMap[s].length})</button>`
    ).join('');
    $('symptomList').querySelectorAll('.symptom-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const sym = btn.dataset.sym;
        if (currentSymptom === sym) {
          currentSymptom = '';
          btn.classList.remove('active');
          $('symptomGrid').hidden = true;
        } else {
          currentSymptom = sym;
          $('symptomList').querySelectorAll('.symptom-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const ids = symptomMap[sym];
          const list = HERBS.filter(h => ids.includes(h.id));
          $('symptomGrid').innerHTML = list.map(herbCard).join('');
          $('symptomGrid').hidden = false;
          attachCardClicks($('symptomGrid'));
        }
      });
    });
  }

  // --- favorites tab ---
  function renderFavorites() {
    const list = HERBS.filter(h => favorites.includes(h.id));
    $('favGrid').innerHTML = list.map(herbCard).join('');
    $('favEmpty').hidden = list.length > 0;
    attachCardClicks($('favGrid'));
  }

  // --- detail modal ---
  function openDetail(id) {
    const h = HERBS.find(x => x.id === id);
    if (!h) return;
    currentDetailId = id;
    const isFav = favorites.includes(id);
    const note = notes[id] || '';
    const gallery = (h.images || []).map(f =>
      `<img loading="lazy" src="images/${f}" alt="${escapeHtml(displayName(h))}" onerror="this.style.display='none'">`
    ).join('') || `<div style="padding:40px;text-align:center;color:#5a6f60">${t('noPhoto')}</div>`;

    // Cảnh báo độc dùng cờ toxic + văn bản warn của chính cây đó (từ
    // dataset đã đồng bộ), không đoán bằng từ khóa nữa. Nội dung bài cây
    // chỉ có tiếng Việt (bài EN đầy đủ chỉ có trong app — quyết định D1,
    // 24/11/2026); ở locale EN, hộp cảnh báo thêm số Poison Control Mỹ.
    const warnText = h.warn || '';
    const toxicBox = h.toxic
      ? `<div class="danger-box">☠️ <strong>${t('toxicTitle')}</strong> ${escapeHtml(warnText)}${locale === 'en' ? `<br>${escapeHtml(POISON_CONTROL_US)}` : ''}</div>`
      : '';
    const cautionText = h.caution || '';
    const cautionBox = !h.toxic && cautionText ? `<div class="caution-box">⚠️ ${escapeHtml(cautionText)}</div>` : '';
    const srcList = h.src || [];
    const srcSection = `<div class="detail-section"><h3>${t('sources')}</h3>${srcList.length ? `<ul>${srcList.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : `<p>${t('noSource')}</p>`}</div>`;
    const introText = h.description;
    const partsText = h.parts || t('partsFallback');
    const usesHtml = `<ul>${(h.uses || []).map(u => `<li>${escapeHtml(u)}</li>`).join('')}</ul>`;
    // Hướng dẫn dùng (how) không có trong dataset PWA — chỉ có trong app
    // (quyết định D1) — nên mục Cách dùng không hiện.
    const howText = h.how || '';
    const symptoms = locale === 'en' ? (h.symptomsEn || []) : (h.symptoms || []);
    // Ở locale EN, hiện thêm tên tiếng Việt để đối chiếu với cây thật/ngoài chợ.
    const viNameLine = locale === 'en' && h.nameEn && h.name !== h.nameEn
      ? `<div class="sci-name">${escapeHtml(h.name)}</div>`
      : '';

    $('modalBody').innerHTML = `
      <div class="detail-gallery">${gallery}</div>
      <div class="detail-header">
        <h2>${escapeHtml(displayName(h))}</h2>
        ${h.scientific ? `<div class="sci-name">${escapeHtml(h.scientific)}</div>` : ''}
        ${viNameLine}
        <div class="detail-actions">
          <button class="action-btn ${isFav ? 'faved' : 'primary'}" id="favBtn">${isFav ? t('favSaved') : t('favSave')}</button>
          <button class="action-btn" id="shareBtn">${t('share')}</button>
        </div>
      </div>
      <div class="detail-section">
        <h3>${t('intro')}</h3>
        <p>${escapeHtml(introText)}</p>
      </div>
      <div class="detail-section">
        <h3>${t('parts')}</h3>
        <p>${escapeHtml(partsText)}</p>
      </div>
      <div class="detail-section">
        <h3>${t('uses')}</h3>
        ${usesHtml}
      </div>
      ${howText ? `<div class="detail-section"><h3>${t('howTitle')}</h3><p>${escapeHtml(howText)}</p></div>` : ''}
      ${(symptoms && symptoms.length) ? `<div class="detail-section"><h3>${t('symptomsTitle')}</h3><p>${symptoms.map(s => `<span class="symptom-chip" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 9px;font-size:12px">${escapeHtml(s)}</span>`).join('')}</p></div>` : ''}
      ${toxicBox}
      ${cautionBox}
      ${srcSection}
      <div class="detail-section">
        <h3>${t('notes')}</h3>
        <textarea class="note-area" id="noteArea" placeholder="${escapeHtml(t('notePlaceholder'))}">${escapeHtml(note)}</textarea>
        <div class="note-saved" id="noteSaved" hidden>${t('noteSaved')}</div>
      </div>
    `;
    $('detailModal').hidden = false;
    document.body.style.overflow = 'hidden';

    $('favBtn').addEventListener('click', () => {
      if (favorites.includes(id)) {
        favorites = favorites.filter(x => x !== id);
      } else {
        favorites.push(id);
      }
      storageSet('favorites', favorites);
      $('favBtn').textContent = favorites.includes(id) ? t('favSaved') : t('favSave');
      $('favBtn').classList.toggle('faved', favorites.includes(id));
      $('favBtn').classList.toggle('primary', !favorites.includes(id));
      renderBrowse(); renderFavorites();
    });
    $('shareBtn').addEventListener('click', () => {
      const firstUse = (h.uses || [])[0] || '';
      const brand = locale === 'en' ? 'Luc Duoc' : 'Lục Dược';
      const text = `🌿 ${displayName(h)} — ${brand}\n${firstUse}`;
      if (navigator.share) { navigator.share({ title: displayName(h), text }).catch(() => {}); }
      else { navigator.clipboard && navigator.clipboard.writeText(text); alert(t('copied')); }
    });
    let noteTimer;
    $('noteArea').addEventListener('input', (e) => {
      notes[id] = e.target.value;
      storageSet('notes', notes);
      $('noteSaved').hidden = false;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { $('noteSaved').hidden = true; }, 1500);
    });
  }

  function closeDetail() {
    currentDetailId = null;
    $('detailModal').hidden = true;
    document.body.style.overflow = '';
  }

  function attachCardClicks(container) {
    container.querySelectorAll('.herb-card').forEach(card => {
      card.addEventListener('click', () => openDetail(card.dataset.id));
    });
  }

  // --- apply locale to static UI + re-render ---
  function applyLocale() {
    document.documentElement.lang = locale;
    document.title = t('title');
    const tagline = $('tagline');
    if (tagline) tagline.textContent = t('tagline');
    $('searchInput').placeholder = t('searchPlaceholder');
    document.querySelectorAll('.tab').forEach(tab => {
      const key = tab.dataset.tab === 'browse' ? 'tabBrowse' : tab.dataset.tab === 'symptom' ? 'tabSymptom' : 'tabFavorites';
      tab.textContent = t(key);
    });
    $('browseEmpty').textContent = t('browseEmpty');
    const hint = $('symptomHint');
    if (hint) hint.textContent = t('symptomHint');
    $('favEmpty').textContent = t('favEmpty');
    const footer = $('footerNote');
    if (footer) footer.innerHTML = `${escapeHtml(t('footerNote'))} <a href="ATTRIBUTION.md" target="_blank">${escapeHtml(t('photoCredits'))}</a>`;
    const dshea = $('dsheaNote');
    if (dshea) {
      dshea.textContent = DSHEA_NOTICE;
      dshea.hidden = locale !== 'en';
    }
    const install = $('installBtn');
    if (install) install.textContent = t('install');
    const langBtn = $('langToggle');
    if (langBtn) {
      langBtn.textContent = t('langButton');
      langBtn.setAttribute('aria-label', t('langAria'));
    }
    const close = $('modalClose');
    if (close) close.setAttribute('aria-label', t('modalCloseAria'));
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    // Bộ lọc theo chữ cái/triệu chứng phụ thuộc ngôn ngữ nên đặt lại.
    currentAlpha = '';
    currentSymptom = '';
    $('symptomGrid').hidden = true;
    renderAlphaFilter();
    renderBrowse();
    renderSymptoms();
    renderFavorites();
    if (currentDetailId && !$('detailModal').hidden) openDetail(currentDetailId);
  }

  // --- tabs ---
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'favorites') renderFavorites();
    });
  });

  // --- search ---
  $('searchInput').addEventListener('input', () => {
    $('clearSearch').hidden = !$('searchInput').value;
    renderBrowse();
  });
  $('clearSearch').addEventListener('click', () => {
    $('searchInput').value = '';
    $('clearSearch').hidden = true;
    renderBrowse();
  });

  // --- language toggle ---
  $('langToggle').addEventListener('click', () => {
    locale = locale === 'en' ? 'vi' : 'en';
    storageSet('locale', locale);
    applyLocale();
  });

  // --- modal close ---
  $('modalClose').addEventListener('click', closeDetail);
  $('detailModal').addEventListener('click', (e) => { if (e.target === $('detailModal')) closeDetail(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

  // --- theme (dark mode) ---
  // Giao diện mặc định theo hệ thống (prefers-color-scheme); nút 🌙/☀️
  // đổi tay và nhớ lựa chọn trên máy này (localStorage).
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121a15' : '#2d6a4f');
    const btn = $('themeToggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', theme === 'dark' ? t('themeToLight') : t('themeToDark'));
    }
  }
  function initTheme() {
    let theme = storageGet('theme', '');
    if (theme !== 'dark' && theme !== 'light') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);
  }
  $('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    storageSet('theme', next);
    applyTheme(next);
  });

  // --- install prompt ---
  // Chỉ hiện nút "Cài đặt app" khi trình duyệt cho phép cài (sự kiện
  // beforeinstallprompt). Trên iOS Safari không có sự kiện này — người
  // dùng vẫn cài bằng Chia sẻ → Thêm vào Màn hình chính.
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('installBtn').hidden = false;
  });
  $('installBtn').addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; }).catch(() => {});
    $('installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; });

  // --- init ---
  initTheme();
  applyLocale();

  // --- service worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
