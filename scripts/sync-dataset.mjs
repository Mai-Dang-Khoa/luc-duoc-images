// Đồng bộ dataset PWA từ dữ liệu luc-duoc hiện tại.
//
// Cách dùng (chạy từ thư mục gốc của repo PWA, nhánh gh-pages):
//   node scripts/sync-dataset.mjs <đường-dẫn-tới-checkout-luc-duoc>
//
// Ví dụ:
//   node scripts/sync-dataset.mjs ../luc-duoc
//
// Script đọc 6 chunk JSON trong <luc-duoc>/data/chunks và tên tiếng Anh
// trong data/names-en.ts, rồi ghi lại data/herbs.js theo đúng định dạng
// PWA đang dùng, kèm thêm trường toxic, warn, src, nameEn, symptomsEn
// cho đủ 200 cây. Ảnh (images[]) giữ nguyên từ data/herbs.js cũ vì các
// file ảnh đã có sẵn trong images/; cây mới chưa có ảnh trên gh-pages
// sẽ có images = [] (thẻ hiện 🌿 giữ chỗ).
//
// QUYẾT ĐỊNH D1 (24/11/2026, Khoa): PWA KHÔNG đăng bài tiếng Anh đầy đủ
// (articleEn) và KHÔNG đăng hướng dẫn dùng (how) — hai thứ đó chỉ có
// trong app, là lý do để người dùng tải app. PWA giữ nameEn + symptomsEn
// (nhãn ngắn cho giao diện song ngữ) và toàn bộ nội dung tiếng Việt.
// Script này cố ý không đọc data/articles-en.ts nữa.
//
// Mọi trường đều lấy verbatim từ chunk của app / bài EN đã dịch —
// không bịa thêm công dụng, triệu chứng hay cảnh báo nào:
//   - description = câu nhận dạng (identify) + câu tính/vị (từ tv)
//   - uses        = trường use tách theo dấu ';'
//   - symptoms    = đảo ngược bảng SYMPTOM_NEEDS của app (lib/symptoms.ts):
//                   cây có symptoms chỉ khi tag actions của nó khớp một
//                   nhu cầu, VÀ cây không bị blocksDailyUse (không độc,
//                   không cảnh báo dùng lâu) — giống hệt bộ lọc triệu
//                   chứng trong app. symptomsEn dùng labelEn nguyên văn
//                   của cùng bảng đó.
//   - caution     = warn (verbatim)
//   - toxic/warn/src = trường cùng tên trong chunk
//   - aliases     = aliases trong chunk (để tìm kiếm gõ tên khác cũng ra)
//   - nameEn      = ENGLISH_NAMES[id] (data/names-en.ts)
//
// Script tự kiểm chứng sau khi tạo: 200 cây, 11 cây độc, mọi cây đều có
// trường toxic (boolean), warn (chuỗi), src (mảng), nameEn không rỗng —
// và KHÔNG cây nào có trường articleEn hay how (quyết định D1). Nếu sai,
// thoát lỗi và không ghi file.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const TINH_ORDER = ['đại nhiệt', 'nóng', 'ấm', 'hơi ấm', 'bình', 'mát', 'hơi hàn', 'hàn', 'lạnh'];
const VI_ORDER = [
  'cay',
  'đắng',
  'hơi đắng',
  'ngọt',
  'ngọt nhẹ',
  'chua',
  'hơi chua',
  'chát',
  'hơi chát',
  'mặn',
  'nhạt',
];
const TINH = new Set(TINH_ORDER);
const VI = new Set(VI_ORDER);

// Bảng nhu cầu — khớp lib/symptoms.ts (SYMPTOM_NEEDS) của app, cả
// labelVi và labelEn nguyên văn. Chỉ sửa khi app đổi bảng này.
const SYMPTOM_NEEDS = [
  { labelVi: 'Ho', labelEn: 'Cough', tags: ['chỉ ho', 'hoá đàm', 'tiêu đờm', 'tuyên phế', 'nhuận phế'] },
  { labelVi: 'Mất ngủ', labelEn: 'Trouble sleeping', tags: ['an thần', 'dưỡng tâm'] },
  { labelVi: 'Đầy bụng', labelEn: 'Bloating', tags: ['tiêu thực', 'hành khí', 'lý khí', 'kiện tỳ'] },
  { labelVi: 'Đau nhức', labelEn: 'Aches', tags: ['chỉ thống', 'trừ phong thấp', 'khu phong'] },
  { labelVi: 'Cảm', labelEn: 'Cold', tags: ['giải biểu', 'phát hãn', 'tán hàn', 'giải cơ'] },
  { labelVi: 'Nóng trong', labelEn: 'Inner heat', tags: ['thanh nhiệt', 'giải độc'] },
  { labelVi: 'Tiểu buốt', labelEn: 'Painful urination', tags: ['lợi tiểu', 'lợi thuỷ', 'lợi thấp'] },
  { labelVi: 'Mệt, kém ăn', labelEn: 'Fatigue, poor appetite', tags: ['bổ', 'bổ khí', 'bổ tỳ', 'kiện tỳ'] },
  { labelVi: 'Chảy máu', labelEn: 'Bleeding', tags: ['chỉ huyết', 'lương huyết'] },
  { labelVi: 'Buồn nôn', labelEn: 'Nausea', tags: ['chống nôn'] },
  { labelVi: 'Khát', labelEn: 'Thirst', tags: ['sinh tân', 'tư âm'] },
  { labelVi: 'Mờ mắt', labelEn: 'Blurred vision', tags: ['minh mục', 'bổ can thận'] },
  { labelVi: 'Kinh nguyệt', labelEn: 'Menstruation', tags: ['điều kinh', 'hoạt huyết', 'ôn kinh'] },
  { labelVi: 'Táo bón', labelEn: 'Constipation', tags: ['nhuận tràng'] },
  { labelVi: 'Đi ngoài', labelEn: 'Loose stools', tags: ['thu liễm', 'táo thấp'] },
];

const LONG_USE_MARKERS = ['lau', 'keo dai', 'dai ngay', 'lien tuc', 'khong dung qua'];

function fold(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Khớp lib/caution.ts cautionsLongUse + blocksDailyUse của app.
function blocksDailyUse(plant) {
  if (plant.toxic) return true;
  const text = fold(plant.warn || '');
  return LONG_USE_MARKERS.some((m) => text.includes(m));
}

function symptomsFor(plant) {
  if (blocksDailyUse(plant)) return { vi: [], en: [] };
  const actions = plant.actions || [];
  const matched = SYMPTOM_NEEDS.filter((need) => need.tags.some((tag) => actions.includes(tag)));
  return { vi: matched.map((need) => need.labelVi), en: matched.map((need) => need.labelEn) };
}

function descriptionFor(plant, unknownTv) {
  const parts = [];
  const identify = (plant.identify || '').trim();
  if (identify) parts.push(identify.endsWith('.') ? identify : identify + '.');
  const tinh = TINH_ORDER.filter((tag) => (plant.tv || []).includes(tag));
  const vi = VI_ORDER.filter((tag) => (plant.tv || []).includes(tag));
  for (const tag of plant.tv || []) {
    if (!TINH.has(tag) && !VI.has(tag)) unknownTv.add(tag);
  }
  if (tinh.length && vi.length) parts.push(`Tính ${tinh.join(', ')}, vị ${vi.join(', ')}.`);
  else if (tinh.length) parts.push(`Tính ${tinh.join(', ')}.`);
  else if (vi.length) parts.push(`Vị ${vi.join(', ')}.`);
  return parts.join(' ');
}

// Đọc file .ts chỉ chứa hằng số bằng tính năng type-stripping có sẵn
// của Node 22.6+ (không cần biên dịch): file names-en.ts không import
// module nào khác.
async function importTsRecord(file, constName) {
  const mod = await import(pathToFileURL(file).href);
  return mod[constName];
}

async function main() {
  const lucDuoc = resolve(process.argv[2] || '../luc-duoc');
  const pwaRoot = resolve(new URL('..', import.meta.url).pathname);
  const chunksDir = join(lucDuoc, 'data', 'chunks');
  const chunkFiles = [
    '00-core.json',
    '01-dongy.json',
    '02-thuocnam.json',
    '03-hoa.json',
    '04-them.json',
    '05-bo-sung-200.json',
  ];
  for (const f of chunkFiles) {
    assert.ok(existsSync(join(chunksDir, f)), `thiếu chunk ${f} trong ${chunksDir}`);
  }
  const plants = chunkFiles.flatMap((f) =>
    JSON.parse(readFileSync(join(chunksDir, f), 'utf8')),
  );

  // Tên tiếng Anh từ app (đủ 200/200 từ vòng 6). Bài tiếng Anh
  // (articles-en.ts) cố ý KHÔNG đọc — giữ trong app (quyết định D1).
  const englishNames = await importTsRecord(
    join(lucDuoc, 'data', 'names-en.ts'),
    'ENGLISH_NAMES',
  );

  // Ảnh giữ nguyên từ dataset cũ (file đã có trong images/).
  const oldPath = join(pwaRoot, 'data', 'herbs.js');
  const oldSrc = readFileSync(oldPath, 'utf8');
  const oldMatch = oldSrc.match(/window\.HERBS = (\[[\s\S]*\]);?\s*$/);
  assert.ok(oldMatch, 'không parse được data/herbs.js cũ');
  const oldHerbs = JSON.parse(oldMatch[1]);
  const oldImages = new Map(oldHerbs.map((h) => [h.id, h.images || []]));

  const unknownTv = new Set();
  const herbs = plants.map((p) => {
    const sym = symptomsFor(p);
    return {
      id: p.id,
      name: p.name,
      nameEn: englishNames[p.id] || '',
      aliases: p.aliases || [],
      scientific: p.sci || '',
      description: descriptionFor(p, unknownTv),
      uses: (p.use || '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
      symptoms: sym.vi,
      symptomsEn: sym.en,
      parts: p.part || '',
      caution: p.warn || '',
      warn: p.warn || '',
      src: p.src || [],
      toxic: p.toxic === true,
      images: oldImages.get(p.id) || [],
    };
  });

  // Sắp xếp theo tên gõ không dấu, như dataset cũ.
  herbs.sort((a, b) => fold(a.name).localeCompare(fold(b.name)));

  // --- kiểm chứng trước khi ghi ---
  assert.equal(herbs.length, 200, `số cây: ${herbs.length}, cần 200`);
  const ids = new Set(herbs.map((h) => h.id));
  assert.equal(ids.size, 200, 'trùng id');
  const toxicCount = herbs.filter((h) => h.toxic).length;
  assert.equal(toxicCount, 11, `số cây độc: ${toxicCount}, cần 11`);
  for (const h of herbs) {
    assert.equal(typeof h.toxic, 'boolean', `${h.id}: thiếu toxic`);
    assert.equal(typeof h.warn, 'string', `${h.id}: thiếu warn`);
    assert.ok(h.warn.length > 0, `${h.id}: warn rỗng`);
    assert.ok(Array.isArray(h.src), `${h.id}: thiếu src`);
    assert.ok(h.description.length > 0, `${h.id}: description rỗng`);
    assert.ok(h.parts.length > 0, `${h.id}: parts rỗng`);
    assert.ok(h.nameEn.length > 0, `${h.id}: thiếu tên tiếng Anh`);
    // Quyết định D1: PWA không đăng bài EN đầy đủ và hướng dẫn dùng.
    assert.ok(!('articleEn' in h), `${h.id}: lọt bài tiếng Anh vào PWA`);
    assert.ok(!('how' in h), `${h.id}: lọt cách dùng vào PWA`);
    assert.equal(
      h.symptoms.length,
      h.symptomsEn.length,
      `${h.id}: symptoms và symptomsEn lệch số lượng`,
    );
  }
  const withSrc = herbs.filter((h) => h.src.length > 0).length;
  const withSymptoms = herbs.filter((h) => h.symptoms.length > 0).length;
  const withImages = herbs.filter((h) => h.images.length > 0).length;
  const imageCount = herbs.reduce((n, h) => n + h.images.length, 0);
  if (unknownTv.size > 0) {
    console.warn('Cảnh báo: tv chưa phân loại tính/vị:', [...unknownTv].join(', '));
  }

  const out =
    '// Lục Dược — herb database (auto-generated)\n' +
    '// Tạo lại bằng: node scripts/sync-dataset.mjs <đường-dẫn-tới-checkout-luc-duoc>\n' +
    '// Nguồn: data/chunks + data/names-en.ts của app luc-duoc. Không sửa tay file này.\n' +
    '// Bài tiếng Anh đầy đủ và hướng dẫn dùng chỉ có trong app (quyết định D1, 24/11/2026).\n' +
    'window.HERBS = ' +
    JSON.stringify(herbs, null, 1) +
    ';\n';
  writeFileSync(join(pwaRoot, 'data', 'herbs.js'), out);
  console.log(
    `Đã ghi data/herbs.js: ${herbs.length} cây · ${toxicCount} cây độc · ${withSrc} cây có nguồn · ${withSymptoms} cây có triệu chứng · ${withImages} cây có ảnh (${imageCount} ảnh) · 200/200 cây có tên tiếng Anh (bài EN + cách dùng chỉ có trong app)`,
  );
}

main();
