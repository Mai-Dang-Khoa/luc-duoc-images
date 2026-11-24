# 🌿 Lục Dược — Tra cứu thảo dược Việt Nam

PWA (Web app cài được vào điện thoại) tra cứu **200 loại thảo dược Việt Nam**, với 298 ảnh thực tế, giao diện song ngữ Việt–Anh.

## Tính năng
- 📖 **Tra cứu** — tìm theo tên (gõ không dấu cũng ra, kể cả tên khác), lọc theo chữ cái đầu
- 🌐 **Song ngữ Việt–Anh** — nút EN/VI trên đầu trang; mặc định theo ngôn ngữ trình duyệt. Giao diện, tên cây và nhãn triệu chứng có tiếng Anh; ở bản tiếng Anh, cây độc hiện thêm số Poison Control 1-800-222-1222 / 911 và câu disclaimer chuẩn FDA (DSHEA) ở chân trang. Bài cây tiếng Anh đầy đủ và hướng dẫn dùng chỉ có trong app Lục Dược (không đăng lên web)
- 🩺 **Theo bệnh** — chọn triệu chứng → liệt kê cây thuốc hỗ trợ (cây độc và cây cảnh báo dùng lâu không xuất hiện ở đây, giống app chính)
- ☠️ **Cảnh báo cây độc** — cây độc có nhãn "Độc" ngay trên thẻ và hộp cảnh báo đỏ trên trang chi tiết, kèm văn bản cảnh báo và nguồn của cây
- 🌙 **Giao diện tối** — theo hệ thống, có nút 🌙/☀️ đổi tay (nhớ lựa chọn trên máy)
- 📲 **Cài đặt app** — nút "Cài đặt app" hiện khi trình duyệt cho phép (Android/Chrome; iOS dùng Chia sẻ → Thêm vào Màn hình chính)
- ⭐ **Yêu thích + Ghi chú** — lưu cây yêu thích và ghi chú cá nhân (lưu trên máy, không cần mạng)
- 📴 **Offline** — sau lần mở đầu, dùng được không cần mạng (PWA + Service Worker)
- 📱 **Cài vào màn hình** — mở bằng Chrome → "Thêm vào màn hình chính"

## Đồng bộ dữ liệu
Dataset `data/herbs.js` được tạo lại từ dữ liệu app luc-duoc (không sửa tay). Khi app có dữ liệu mới, chạy từ thư mục gốc của repo này:

```
node scripts/sync-dataset.mjs <đường-dẫn-tới-checkout-luc-duoc>
```

Script đọc 6 chunk trong `<luc-duoc>/data/chunks` cùng tên tiếng Anh (`data/names-en.ts`), giữ nguyên danh sách ảnh từ dataset cũ, và tự kiểm chứng: 200 cây, 11 cây độc, mọi cây đều có `toxic`/`warn`/`src` và tên tiếng Anh, và KHÔNG cây nào có bài tiếng Anh đầy đủ (`articleEn`) hay hướng dẫn dùng (`how`) — hai thứ đó chỉ có trong app (quyết định D1, 24/11/2026). Nhớ đổi số phiên bản cache trong `sw.js` (vd `lucduoc-v3` → `lucduoc-v4`) trước khi đẩy để người đang cài PWA nhận được dữ liệu mới (người dùng cần đóng tab cũ và mở lại để nhận service worker mới).

Lưu ý: icon của PWA vẫn là SVG emoji (🌿) trong `manifest.json` — file PNG nhị phân chưa đẩy được qua công cụ hiện tại nên chưa thay được icon PNG.

## Cảnh báo y tế
⚠️ Thông tin trong app chỉ mang tính tham khảo, **KHÔNG thay thế chẩn đoán và điều trị của bác sĩ**. Một số vị thuốc có độc (như phụ tử, cà độc dược, thiên nam tinh, bán hạ sống) — tuyệt đối không tự dùng.

## Nguồn ảnh
Ảnh từ Wikimedia Commons & iNaturalist (CC0 / CC BY / CC BY-SA). Xem [ATTRIBUTION.md](ATTRIBUTION.md).

## Tech
Vanilla HTML/CSS/JS, không build step. Deploy trên GitHub Pages.
