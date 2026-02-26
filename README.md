# R1-card
# AI BOX WebUI Card – Home Assistant Custom Card

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz/)
![Version](https://img.shields.io/badge/version-6.0.9-blue.svg)

Thẻ (custom card) điều khiển toàn diện thiết bị **AI BOX** ngay trong Home Assistant – Media, Chat AI, Equalizer, Đèn LED, Báo thức, WiFi và nhiều hơn nữa.

> Card name: `custom:aibox-webui-card` (element: `aibox-webui-card`).  
> Phiên bản trong file JS: **6.0.9** – giao diện tím hiện đại, hỗ trợ LAN WS và Tunnel WSS.

---

## ✨ Tính năng chính

- **Media**
  - Phát nhạc YouTube / Zing MP3, waveform animation, thumbnail xoay
  - Tìm kiếm bài hát, quản lý Playlist
  - Điều khiển Play/Pause/Stop/Prev/Next, Repeat, Shuffle
  - Thanh tiến trình có thể click để seek

- **Control**
  - Wake Word **"Ô Kề Na Bu"** với điều chỉnh độ nhạy
  - **Chống Điếc AI** – nhận diện giọng nói 99% + TTS 30 giọng tiếng Việt
  - Bật/tắt **DLNA / AirPlay / Bluetooth / LED**
  - **Stereo Mode** – cấu hình loa mẹ / loa con, scan IP, sync delay
  - **Audio Engine**: EQ 5 băng tần, Bass Boost, Loudness, Surround, Dải Trung-Cao
  - **Lighting Control**: Đèn Chính (RGB) + Đèn Viền (Edge), 6 chế độ firmware
  - **Báo thức**: thêm/sửa/xóa, lặp lại hàng ngày/tuần, tùy chọn nhạc YouTube

- **Chat**
  - Giao tiếp với AI qua text + voice
  - Nút **Wake Up / Interrupt / End Session**
  - **TikTok Reply** – phản hồi TikTok Live
  - Ảnh nền chat tuỳ chỉnh

- **System**
  - Biểu đồ **CPU & RAM** realtime
  - Quản lý **MAC Address** (real / random / custom)
  - Cấu hình **OTA Server**, **Home Assistant integration**
  - **WiFi**: scan, kết nối, quản lý mạng đã lưu

- **Giao diện**
  - Nền tím gradient hiện đại, dot kết nối realtime
  - Tự thích ứng mobile (responsive)

---

## ✅ Yêu cầu

- Home Assistant có **Lovelace Dashboards**.
- Thiết bị **AI BOX** đang chạy và có thể truy cập từ mạng LAN (hoặc qua tunnel).
- Cài theo dạng **Resource (JavaScript module)** hoặc qua **HACS (Custom repository)**.

---

## 📦 Cài đặt

### Cách 1: Cài thủ công (khuyến nghị khi test nhanh)

1. Tải file [`aibox-webui-card.js`](https://github.com/TriTue2011/R1-card/blob/main/aibox-webui-card.js) về máy và đặt vào:
   - `config/www/aibox-webui-card.js`
2. Vào **Settings → Dashboards → Resources** (hoặc *Cài đặt → Bảng điều khiển → Tài nguyên*)
3. **Add resource**
   - URL: `/local/aibox-webui-card.js`
   - Type: **JavaScript Module**
4. Reload trình duyệt (Ctrl+F5) hoặc restart Home Assistant nếu cần.

### Cách 2: Cài qua HACS (Custom repository)

1. Vào **HACS → 3 Chấm góc trên bên phải (⋮) → Custom repositories**
2. Thêm repo: `https://github.com/TriTue2011/R1-card`
3. Chọn Category: **Dashboard**
4. Quay lại HACS, tìm `AI BOX WebUI Card` và **Download**
5. Reload trình duyệt (Ctrl+F5)

---

## 🧩 Cấu hình (Lovelace)

### Cấu hình tối thiểu

```yaml
type: custom:aibox-webui-card
host: "192.168.1.100"
```

### Ví dụ kết nối LAN đơn giản

```yaml
type: custom:aibox-webui-card
host: "192.168.1.100"
title: "AI BOX Phòng Khách"
default_tab: "media"
```

### Ví dụ HTTPS + Tunnel WSS

```yaml
type: custom:aibox-webui-card
host: "192.168.1.100"
mode: tunnel
tunnel_host: "mybox.example.com"
tunnel_port: 443
tunnel_path: "/ws"
speaker_tunnel_host: "mybox.example.com"
speaker_tunnel_path: "/spk"
```

### Full option

```yaml
type: custom:aibox-webui-card   # Tên custom element đã define trong file JS

# ===============================
# 🔌 KẾT NỐI
# ===============================

host: "192.168.1.100"           # IP của thiết bị AI BOX (bắt buộc)
ws_port: 8082                   # WebSocket chính (mặc định: 8082)
speaker_port: 8080              # WebSocket loa / audio engine (mặc định: 8080)
http_port: 8081                 # HTTP port (mặc định: 8081)

# ===============================
# 🌐 TUNNEL (dùng khi truy cập từ HTTPS)
# ===============================

tunnel_host: ""                 # Host tunnel WSS (để trống nếu không dùng)
tunnel_port: 443                # Port tunnel (mặc định: 443)
tunnel_path: "/"                # Path tunnel (mặc định: /)

speaker_tunnel_host: ""         # Host tunnel riêng cho loa
speaker_tunnel_port: 443
speaker_tunnel_path: "/"

# ===============================
# ⚙ CHẾ ĐỘ KẾT NỐI
# ===============================

mode: "auto"                    # auto | lan | tunnel
                                # auto: HTTP → thử LAN trước, fallback tunnel
                                #        HTTPS → tunnel only

# ===============================
# 🎨 GIAO DIỆN
# ===============================

title: "AI BOX"                 # Tiêu đề hiển thị trên card
version_badge: "v6.0"           # Badge phiên bản góc phải tiêu đề
default_tab: "media"            # Tab mặc định: media | control | chat | system
show_background: true           # Hiển thị ảnh nền trong tab Chat

# ===============================
# 🔄 KẾT NỐI LẠI
# ===============================

reconnect_ms: 1500              # Thời gian chờ reconnect khi mất kết nối (ms)
connect_timeout_ms: 2500        # Timeout mỗi lần thử kết nối (ms)
```

### Bảng tùy chọn

| Tùy chọn | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `host` | string | `""` | IP thiết bị AI BOX **(bắt buộc)** |
| `ws_port` | number | `8082` | WebSocket chính |
| `speaker_port` | number | `8080` | WebSocket loa / audio |
| `http_port` | number | `8081` | HTTP port |
| `tunnel_host` | string | `""` | Host tunnel WSS |
| `tunnel_port` | number | `443` | Port tunnel |
| `tunnel_path` | string | `"/"` | Path tunnel |
| `speaker_tunnel_host` | string | `""` | Host tunnel loa |
| `speaker_tunnel_port` | number | `443` | Port tunnel loa |
| `speaker_tunnel_path` | string | `"/"` | Path tunnel loa |
| `mode` | string | `"auto"` | `auto` / `lan` / `tunnel` |
| `title` | string | `"AI BOX"` | Tiêu đề card |
| `version_badge` | string | `"v6.0"` | Badge phiên bản |
| `default_tab` | string | `"media"` | Tab mặc định khi mở |
| `show_background` | boolean | `true` | Hiện ảnh nền Chat |
| `reconnect_ms` | number | `1500` | Thời gian reconnect (ms) |
| `connect_timeout_ms` | number | `2500` | Timeout kết nối (ms) |

---

## 🎤 Danh sách 30 giọng AI tiếng Việt

<details>
<summary>Xem danh sách đầy đủ</summary>

| # | Tên | # | Tên | # | Tên |
|---|-----|---|-----|---|-----|
| 1 | Ngọc Anh | 11 | Mai Anh | 21 | Hải Đăng |
| 2 | Minh Anh | 12 | Bảo Châu | 22 | Tuấn Kiệt |
| 3 | Khánh An | 13 | Tú Linh | 23 | Nhật Minh |
| 4 | Bảo Ngọc | 14 | An Nhiên | 24 | Anh Dũng |
| 5 | Thanh Mai | 15 | Minh Khang | 25 | Trung Kiên |
| 6 | Hà My | 16 | Hoàng Nam | 26 | Khánh Duy |
| 7 | Thùy Dung | 17 | Gia Huy | 27 | Phúc An |
| 8 | Diệu Linh | 18 | Đức Anh | 28 | Thành Đạt |
| 9 | Lan Anh | 19 | Quang Minh | 29 | Hữu Phước |
| 10 | Ngọc Hà | 20 | Bảo Long | 30 | Thiên Ân |

</details>

---

## 🔌 Kiến trúc kết nối

```
Home Assistant (Browser)
        │
        ├── WS ws://[host]:8082    ← Kênh chính (điều khiển, media, chat, alarm…)
        │
        └── WS ws://[host]:8080    ← Kênh loa (âm lượng, EQ, bass, surround…)
```

- **`auto`**: HTTP → thử LAN trước, fallback tunnel; HTTPS → tunnel only
- **`lan`**: Chỉ dùng WS LAN (không dùng được khi HTTPS)
- **`tunnel`**: Chỉ dùng WSS tunnel (bắt buộc khi HA dùng HTTPS)
- Tự động reconnect sau `reconnect_ms` ms khi mất kết nối

---

## 🛠️ Troubleshooting

- **Không thấy card / báo "Custom element doesn't exist"**
  - Kiểm tra đã add Resource đúng URL `/local/aibox-webui-card.js`
  - Kiểm tra Resource type là **JavaScript Module**
  - Ctrl+F5 để xóa cache trình duyệt

- **Không kết nối được (dot đỏ)**
  - Kiểm tra `host` đúng IP của AI BOX và thiết bị cùng mạng LAN
  - Nếu dùng HTTPS phải cấu hình `tunnel_host` với WSS

- **Âm lượng không thay đổi**
  - Kiểm tra `speaker_port` (mặc định 8080) đang mở trên thiết bị

- **EQ không có hiệu lực**
  - Bật toggle **Equalizer Enable** trước khi chỉnh băng tần

- **Stereo lệch tiếng**
  - Điều chỉnh **Sync Delay** (0–2000ms) trên loa con

- **Cập nhật version mà không đổi**
  - Trình duyệt còn cache: Ctrl+F5 hoặc mở tab ẩn danh để test
  - Nếu dùng HACS: update trong HACS rồi reload

---

## 🙏 Credits

- Phát triển bởi **TriTue2011**
- WebSocket API tương thích firmware AI BOX v6.x

---

## 📄 License

MIT License (xem file `LICENSE`).
