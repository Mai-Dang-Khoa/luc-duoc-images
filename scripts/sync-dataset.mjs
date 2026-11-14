// Đồng bộ dataset PWA từ dữ liệu luc-duoc hiện tại.
//
// Cách dùng (chạy từ thư mục gốc của repo PWA, nhánh gh-pages):
//   node scripts/sync-dataset.mjs <đường-dẫn-tới-checkout-luc-duoc>
//
// Ví dụ:
//   node scripts/sync-dataset.mjs ../luc-duoc
//
// Script đọc 5 chunk JSON trong <luc-duoc>/data/chunks và ghi lại
// data/herbs.js theo đúng định dạng PWA đang dùng, kèm thêm trường
// toxic, warn, src cho đủ 179 cây. Ảnh (images[]) giữ nguyên từ
// data/herbs.js cũ vì các file ảnh đã có sẵn trong images/.
//
// Mọi trường đều lấy verbatim từ chunk của app — không bịa thêm công
// dụng, triệu chứng hay cảnh báo nào:
//   - description = câu nhận dạng (identify) + câu tính/vị (từ tv)
//   - uses        = trường use tách theo dấu ';'
//   - symptoms    = đảo ngược bảng SYMPTOM_NEEDS của app (lib/symptoms.ts):
//                   cây có symptoms chỉ khi tag actions của nó khớp một
//                   nhu cầu, VÀ cây không bị blocksDailyUse (không độc,
//                   không cảnh báo dùng lâu) — giống hệt bộ lọc triệu
//                   chứng trong app.
//   - caution     = warn (verbatim)
//   - toxic/warn/src = trường cùng tên trong chunk
//   - aliases     = aliases trong chunk (để tìm kiếm gõ tên khác cũng ra)
//
// Script tự kiểm chứng sau khi tạo: 179 cây, 11 cây độc, mọi cây đều có
// trường toxic (boolean), warn (chuỗi), src (mảng). Nếu sai, thoát lỗi
// và không ghi file.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const TINH_ORDER = ['đại nhiệt', 'nóng', 'ấm', 'hơi ấm', 'bình', 'mát', 'hơi hàn', 'hàn', 'lạnh'];
const VI_ORDER = ['cay', 'đắng', 'hơi đắng', 'ngọt', 'chua', 'mặn', 'nhạt'];
const TINH = new Set(TINH_ORDER);
const VI = new Set(VI_ORDER);

// Bảng nhu cầu — khớp lib/symptoms.ts (SYMPTOM_NEEDS) của app.
// Chỉ sửa khi app đổi bảng này.
const SYMPTOM_NEEDS = [
  { labelVi: 'Ho', tags: ['chỉ ho', 'hoá đàm', 'tiêu đờm', 'tuyên phế', 'nhuận phế'] },
  { labelVi: 'Mất ngủ', tags: ['an thần', 'dưỡng tâm'] },
  { labelVi: 'Đầy bụng', tags: ['tiêu thực', 'hành khí', 'lý khí', 'kiện tỳ'] },
  { labelVi: 'Đau nhức', tags: ['chỉ thống', 'trừ phong thấp', 'khu phong'] },
  { labelVi: 'Cảm', tags: ['giải biểu', 'phát hãn', 'tán hàn', 'giải cơ'] },
  { labelVi: 'Nóng trong', tags: ['thanh nhiệt', 'giải độc'] },
  { labelVi: 'Tiểu buốt', tags: ['lợi tiểu', 'lợi thuỷ', 'lợi thấp'] },
  { labelVi: 'Mệt, kém ăn', tags: ['bổ', 'bổ khí', 'bổ tỳ', 'kiện tỳ'] },
  { labelVi: 'Chảy máu', tags: ['chỉ huyết', 'lương huyết'] },
  { labelVi: 'Buồn nôn', tags: ['chống nôn'] },
  { labelVi: 'Khát', tags: ['sinh tân', 'tư âm'] },
  { labelVi: 'Mờ mắt', tags: ['minh mục', 'bổ can thận'] },
  { labelVi: 'Kinh nguyệt', tags: ['điều kinh', 'hoạt huyết', 'ôn kinh'] },
  { labelVi: 'Táo bón', tags: ['nhuận tràng'] },
  { labelVi: 'Đi ngoài', tags: ['thu liễm', 'táo thấp'] },
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
  if (blocksDailyUse(plant)) return [];
  const actions = plant.actions || [];
  return SYMPTOM_NEEDS.filter((need) => need.tags.some((tag) => actions.includes(tag))).map(
    (need) => need.labelVi,
  );
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

function main() {
  const lucDuoc = resolve(process.argv[2] || '../luc-duoc');
  const pwaRoot = resolve(new URL('..', import.meta.url).pathname);
  const chunksDir = join(lucDuoc, 'data', 'chunks');
  const chunkFiles = ['00-core.json', '01-dongy.json', '02-thuocnam.json', '03-hoa.json', '04-them.json'];
  for (const f of chunkFiles) {
    assert.ok(existsSync(join(chunksDir, f)), `thiếu chunk ${f} trong ${chunksDir}`);
  }
  const plants = chunkFiles.flatMap((f) =>
    JSON.parse(readFileSync(join(chunksDir, f), 'utf8')),
  );

  // Ảnh giữ nguyên từ dataset cũ (file đã có trong images/).
  const oldPath = join(pwaRoot, 'data', 'herbs.js');
  const oldSrc = readFileSync(oldPath, 'utf8');
  const oldMatch = oldSrc.match(/window\.HERBS = (\[[\s\S]*\]);?\s*$/);
  assert.ok(oldMatch, 'không parse được data/herbs.js cũ');
  const oldHerbs = JSON.parse(oldMatch[1]);
  const oldImages = new Map(oldHerbs.map((h) => [h.id, h.images || []]));

  const unknownTv = new Set();
  const herbs = plants.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: p.aliases || [],
    scientific: p.sci || '',
    description: descriptionFor(p, unknownTv),
    uses: (p.use || '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean),
    symptoms: symptomsFor(p),
    parts: p.part || '',
    caution: p.warn || '',
    warn: p.warn || '',
    src: p.src || [],
    toxic: p.toxic === true,
    images: oldImages.get(p.id) || [],
  }));

  // Sắp xếp theo tên gõ không dấu, như dataset cũ.
  herbs.sort((a, b) => fold(a.name).localeCompare(fold(b.name)));

  // --- kiểm chứng trước khi ghi ---
  assert.equal(herbs.length, 179, `số cây: ${herbs.length}, cần 179`);
  const ids = new Set(herbs.map((h) => h.id));
  assert.equal(ids.size, 179, 'trùng id');
  const toxicCount = herbs.filter((h) => h.toxic).length;
  assert.equal(toxicCount, 11, `số cây độc: ${toxicCount}, cần 11`);
  for (const h of herbs) {
    assert.equal(typeof h.toxic, 'boolean', `${h.id}: thiếu toxic`);
    assert.equal(typeof h.warn, 'string', `${h.id}: thiếu warn`);
    assert.ok(h.warn.length > 0, `${h.id}: warn rỗng`);
    assert.ok(Array.isArray(h.src), `${h.id}: thiếu src`);
    assert.ok(h.description.length > 0, `${h.id}: description rỗng`);
    assert.ok(h.parts.length > 0, `${h.id}: parts rỗng`);
  }
  const withSrc = herbs.filter((h) => h.src.length > 0).length;
  const withSymptoms = herbs.filter((h) => h.symptoms.length > 0).length;
  const imageCount = herbs.reduce((n, h) => n + h.images.length, 0);
  if (unknownTv.size > 0) {
    console.warn('Cảnh báo: tv chưa phân loại tính/vị:', [...unknownTv].join(', '));
  }

  const out =
    '// Lục Dược — herb database (auto-generated)\n' +
    '// Tạo lại bằng: node scripts/sync-dataset.mjs <đường-dẫn-tới-checkout-luc-duoc>\n' +
    '// Nguồn: data/chunks của app luc-duoc. Không sửa tay file này.\n' +
    'window.HERBS = ' +
    JSON.stringify(herbs, null, 1) +
    ';\n';
  writeFileSync(join(pwaRoot, 'data', 'herbs.js'), out);
  console.log(
    `Đã ghi data/herbs.js: ${herbs.length} cây · ${toxicCount} cây độc · ${withSrc} cây có nguồn · ${withSymptoms} cây có triệu chứng · ${imageCount} ảnh`,
  );
}

main();
