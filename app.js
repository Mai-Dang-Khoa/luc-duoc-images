// Lục Dược — app logic
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

  let favorites = storageGet('favorites', []);   // array of herb ids
  let notes = storageGet('notes', {});           // { herbId: text }
  let currentAlpha = '';
  let currentSymptom = '';

  // --- build symptom index ---
  const symptomMap = {}; // symptom -> [herbIds]
  HERBS.forEach(h => {
    (h.symptoms || []).forEach(sym => {
      const key = sym.toLowerCase();
      if (!symptomMap[key]) symptomMap[key] = [];
      symptomMap[key].push(h.id);
    });
  });
  // pick top symptoms by count
  const topSymptoms = Object.entries(symptomMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 24)
    .map(([sym]) => sym);

  // --- render herb card ---
  function herbCard(h) {
    const img = h.images && h.images[0] ? `<img class="thumb" loading="lazy" src="images/${h.images[0]}" alt="${escapeHtml(h.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
    const ph = `<div class="thumb-placeholder" style="${img ? 'display:none' : ''}">🌿</div>`;
    const fav = favorites.includes(h.id) ? ' <span class="fav-dot">⭐</span>' : '';
    const toxic = h.toxic ? ' <span class="toxic-badge">☠️ Độc</span>' : '';
    return `<div class="herb-card" data-id="${h.id}">${img}${ph}<div class="info"><div class="name">${escapeHtml(h.name)}${fav}${toxic}</div><div class="sci">${escapeHtml(h.scientific || '')}</div></div></div>`;
  }

  // --- browse tab ---
  function renderAlphaFilter() {
    const letters = [...new Set(HERBS.map(h => noDiacritics(h.name)[0]).filter(Boolean))].sort();
    const wrap = $('alphaFilter');
    wrap.innerHTML = '<button class="alpha-btn active" data-letter="">Tất cả</button>' +
      letters.map(l => `<button class="alpha-btn" data-letter="${l}">${l.toUpperCase()}</button>`).join('');
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
      if (currentAlpha && noDiacritics(h.name)[0] !== currentAlpha) return false;
      if (!q) return true;
      const hay = noDiacritics([h.name, (h.aliases || []).join(' '), h.scientific, h.description, (h.uses || []).join(' '), (h.symptoms || []).join(' '), h.parts].join(' '));
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
      `<button class="symptom-chip" data-sym="${s}">${escapeHtml(s)} (${symptomMap[s].length})</button>`
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
    const isFav = favorites.includes(id);
    const note = notes[id] || '';
    const gallery = (h.images || []).map(f =>
      `<img loading="lazy" src="images/${f}" alt="${escapeHtml(h.name)}" onerror="this.style.display='none'">`
    ).join('') || '<div style="padding:40px;text-align:center;color:#5a6f60">Chưa có ảnh</div>';

    // Cảnh báo độc dùng cờ toxic + văn bản warn của chính cây đó (từ
    // dataset đã đồng bộ), không đoán bằng từ khóa nữa.
    const toxicBox = h.toxic
      ? `<div class="danger-box">☠️ <strong>Cây độc.</strong> ${escapeHtml(h.warn || h.caution || '')}</div>`
      : '';
    const cautionBox = !h.toxic && h.caution ? `<div class="caution-box">⚠️ ${escapeHtml(h.caution)}</div>` : '';
    const srcList = h.src || [];
    const srcSection = `<div class="detail-section"><h3>📚 Nguồn</h3>${srcList.length ? `<ul>${srcList.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : '<p>Chưa có nguồn kiểm chứng.</p>'}</div>`;

    $('modalBody').innerHTML = `
      <div class="detail-gallery">${gallery}</div>
      <div class="detail-header">
        <h2>${escapeHtml(h.name)}</h2>
        ${h.scientific ? `<div class="sci-name">${escapeHtml(h.scientific)}</div>` : ''}
        <div class="detail-actions">
          <button class="action-btn ${isFav ? 'faved' : 'primary'}" id="favBtn">${isFav ? '⭐ Đã lưu' : '☆ Lưu yêu thích'}</button>
          <button class="action-btn" id="shareBtn">↗ Chia sẻ</button>
        </div>
      </div>
      <div class="detail-section">
        <h3>📝 Giới thiệu</h3>
        <p>${escapeHtml(h.description)}</p>
      </div>
      <div class="detail-section">
        <h3>🌱 Bộ phận dùng</h3>
        <p>${escapeHtml(h.parts || 'Tham khảo thêm')}</p>
      </div>
      <div class="detail-section">
        <h3>💊 Công dụng chủ yếu</h3>
        <ul>${(h.uses || []).map(u => `<li>${escapeHtml(u)}</li>`).join('')}</ul>
      </div>
      ${(h.symptoms && h.symptoms.length) ? `<div class="detail-section"><h3>🩺 Hỗ trợ các triệu chứng</h3><p>${h.symptoms.map(s => `<span class="symptom-chip" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 9px;font-size:12px">${escapeHtml(s)}</span>`).join('')}</p></div>` : ''}
      ${toxicBox}
      ${cautionBox}
      ${srcSection}
      <div class="detail-section">
        <h3>📒 Ghi chú cá nhân</h3>
        <textarea class="note-area" id="noteArea" placeholder="Ghi kinh nghiệm dùng, câu hỏi cho thầy thuốc...">${escapeHtml(note)}</textarea>
        <div class="note-saved" id="noteSaved" hidden>✓ Đã lưu</div>
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
      $('favBtn').textContent = favorites.includes(id) ? '⭐ Đã lưu' : '☆ Lưu yêu thích';
      $('favBtn').classList.toggle('faved', favorites.includes(id));
      $('favBtn').classList.toggle('primary', !favorites.includes(id));
      renderBrowse(); renderFavorites();
    });
    $('shareBtn').addEventListener('click', () => {
      const text = `🌿 ${h.name} — Lục Dược\n${(h.uses || [])[0] || ''}`;
      if (navigator.share) { navigator.share({ title: h.name, text }).catch(() => {}); }
      else { navigator.clipboard && navigator.clipboard.writeText(text); alert('Đã copy thông tin vào clipboard.'); }
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
    $('detailModal').hidden = true;
    document.body.style.overflow = '';
  }

  function attachCardClicks(container) {
    container.querySelectorAll('.herb-card').forEach(card => {
      card.addEventListener('click', () => openDetail(card.dataset.id));
    });
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
      btn.setAttribute('aria-label', theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối');
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
  renderAlphaFilter();
  renderBrowse();
  renderSymptoms();
  renderFavorites();

  // --- service worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
