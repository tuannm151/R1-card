# R1-card
# 👑 AI BOX WebUI Card

> **Phiên bản:** v6.0.9 · Home Assistant Custom Card

Giao diện điều khiển toàn diện cho thiết bị **AI BOX** tích hợp trực tiếp vào Home Assistant dưới dạng Lovelace custom card. Thiết kế giao diện tím hiện đại, hỗ trợ đầy đủ tính năng điều khiển media, âm thanh, ánh sáng, chatbot AI và nhiều hơn nữa.

---

## ✨ Tính năng nổi bật

| Nhóm | Tính năng |
|------|-----------|
| 🎵 **Media** | Phát nhạc YouTube / Zing MP3, tìm kiếm bài hát, quản lý playlist, thanh tiến trình, waveform animation |
| ⚙ **Control** | Wake Word, DLNA, AirPlay, Bluetooth, LED, Stereo Mode (loa mẹ/con), EQ, Bass Boost, Loudness, Surround |
| 💬 **Chat** | Giao tiếp với AI (text + voice), TikTok Reply, ảnh nền chat, Wake Up / Interrupt session |
| ✦ **System** | Theo dõi CPU/RAM realtime, cấu hình OTA, Home Assistant integration, WiFi scan & quản lý, MAC Address |

---

## 🖥 Giao diện

```
┌─────────────────────────────────────┐
│  👑 AI BOX                 v6.0  ●  │
├──────────┬──────────┬───────┬───────┤
│ ♪ Media  │ ⚙ Control│💬 Chat│✦ Sys  │
├─────────────────────────────────────┤
│                                     │
│   [Thumbnail]   ~~~~waveform~~~~    │
│   Title / Artist                    │
│   ⏮  ▶  ■  ⏭                       │
│   ──────────────── 1:23 / 3:45      │
│   🔍 Tìm bài hát...                 │
│   🔊 Âm lượng ─────────── Mức 8    │
└─────────────────────────────────────┘
```

---

## 📦 Cài đặt

### 1. Tải file

Tải file `aibox-webui-card.js` về máy và đặt vào thư mục:

```
config/www/aibox-webui-card.js
```

### 2. Thêm vào Home Assistant

Vào **Settings → Dashboards → Resources** và thêm:

```
URL:  /local/aibox-webui-card.js
Type: JavaScript Module
```

Hoặc thêm vào `configuration.yaml`:

```yaml
lovelace:
  resources:
    - url: /local/aibox-webui-card.js
      type: module
```

### 3. Thêm card vào Dashboard

```yaml
type: custom:aibox-webui-card
host: "192.168.1.100"       # IP của AI BOX
title: "AI BOX"
```

---

## ⚙ Cấu hình

### Tất cả tùy chọn

```yaml
type: custom:aibox-webui-card

# --- Kết nối cơ bản ---
host: "192.168.1.100"         # IP của thiết bị AI BOX (bắt buộc)
ws_port: 8082                 # WebSocket chính (mặc định: 8082)
speaker_port: 8080            # WebSocket loa (mặc định: 8080)
http_port: 8081               # HTTP port (mặc định: 8081)

# --- Tunnel (dùng khi truy cập từ xa qua HTTPS) ---
tunnel_host: ""               # Host tunnel WSS
tunnel_port: 443              # Port tunnel (mặc định: 443)
tunnel_path: "/"              # Path tunnel (mặc định: /)

speaker_tunnel_host: ""       # Host tunnel loa
speaker_tunnel_port: 443
speaker_tunnel_path: "/"

# --- Chế độ kết nối ---
mode: "auto"                  # auto | lan | tunnel

# --- Giao diện ---
title: "AI BOX"               # Tiêu đề hiển thị
version_badge: "v6.0"         # Badge phiên bản
default_tab: "media"          # Tab mặc định: media | control | chat | system
show_background: true         # Hiển thị ảnh nền trong Chat

# --- Kết nối ---
reconnect_ms: 1500            # Thời gian chờ reconnect (ms)
connect_timeout_ms: 2500      # Timeout kết nối (ms)
```

### Ví dụ cấu hình LAN đơn giản

```yaml
type: custom:aibox-webui-card
host: "192.168.1.88"
title: "AI BOX Phòng Khách"
default_tab: "media"
```

### Ví dụ cấu hình HTTPS + Tunnel

```yaml
type: custom:aibox-webui-card
host: "192.168.1.88"
mode: tunnel
tunnel_host: "mybox.example.com"
tunnel_port: 443
tunnel_path: "/ws"
speaker_tunnel_host: "mybox.example.com"
speaker_tunnel_path: "/spk"
```

---

## 🗂 Tabs

### ♪ Media
- Hiển thị bài hát đang phát (thumbnail xoay, waveform animation)
- Điều khiển: Play/Pause, Stop, Prev, Next, Repeat, Shuffle
- Thanh tiến trình có thể click để seek
- Tìm kiếm: **Songs** (YouTube), **Playlist**, **Zing MP3**, **≡ Playlists**
- Quản lý playlist: tạo, xem, xóa, phát
- Thanh âm lượng (Mức 0–15)

### ⚙ Control
- **Wake Word** "Ô Kề Na Bu" với điều chỉnh độ nhạy (0.0–1.0)
- **Chống Điếc AI** – nhận diện giọng nói 99% + đổi giọng TTS (30 giọng)
- **Chọn giọng AI** – 30 giọng tiếng Việt với nút preview
- **DLNA / AirPlay / Bluetooth / LED** – bật/tắt toggle
- **Stereo Mode** – cấu hình loa mẹ/con, scan IP, sync delay (0–2000ms)
- **Audio Engine:**
  - *Equalizer*: 5 băng tần (60Hz → 14KHz), 5 preset (Flat/Bass/Vocal/Rock/Jazz)
  - *Bass Boost* + *Loudness* với slider strength/gain
  - *Dải Trung-Cao*: Bass Vol & High Vol (±20 dB)
  - *Surround*: Width/Presence/Space với preset Cinema/Wide Space
- **Lighting Control:**
  - *Đèn Chính*: bật/tắt, cường độ sáng, tốc độ, 6 chế độ firmware
  - *Đèn Viền (Edge)*: bật/tắt, cường độ
- **Báo thức**: thêm/sửa/xóa, lặp lại (một lần/hàng ngày/hàng tuần), tùy chọn YouTube

### 💬 Chat
- Gửi tin nhắn text đến AI
- Nút **Wake Up / Interrupt / End Session** điều khiển phiên voice
- Nút **Test Mic** kiểm tra microphone
- **TikTok Reply** – bật/tắt chế độ phản hồi TikTok Live
- Ảnh nền chat tuỳ chỉnh

### ✦ System
- Biểu đồ CPU & RAM realtime
- **MAC Address** – xem, random (giả mạo), khôi phục MAC thực
- **OTA Server** – chọn server cập nhật firmware
- **Home Assistant** – cấu hình URL, Agent ID, API Key
- **WiFi** – scan, kết nối mạng mới, quản lý mạng đã lưu
- Thông tin kết nối (LAN WS / Tunnel WSS)

---

## 🔌 Kiến trúc kết nối

```
Home Assistant (Browser)
        │
        ├── WS ws://[host]:8082    ← Kênh chính (điều khiển, media, chat)
        │
        └── WS ws://[host]:8080    ← Kênh loa (âm lượng, EQ, audio engine)
```

- **Chế độ `auto`**: HTTP → thử LAN trước, fallback tunnel; HTTPS → tunnel only
- **Chế độ `lan`**: Chỉ dùng WS LAN
- **Chế độ `tunnel`**: Chỉ dùng WSS tunnel (bắt buộc khi dùng HTTPS)
- Tự động reconnect sau `reconnect_ms` ms khi mất kết nối

---

## 🎤 Danh sách giọng AI (30 giọng tiếng Việt)

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

## 🛠 WebSocket API (tham khảo)

Card giao tiếp với thiết bị qua JSON WebSocket. Một số action chính:

```json
// Media
{ "action": "play_song", "video_id": "..." }
{ "action": "pause" }
{ "action": "resume" }
{ "action": "next" }
{ "action": "seek", "position": 60 }

// Volume
{ "type": "set_vol", "vol": 8 }

// Chat
{ "action": "chat_wake_up" }
{ "action": "chat_send_text", "text": "Xin chào" }

// EQ
{ "type": "set_eq_enable", "enable": true }
{ "type": "set_eq_bandlevel", "band": 0, "level": 800 }

// Alarm
{ "action": "alarm_add", "hour": 7, "minute": 0, "repeat": "daily" }
```

---

## 📋 Yêu cầu

- **Home Assistant** 2023.x trở lên
- **Lovelace** mode (auto hoặc yaml)
- Thiết bị **AI BOX** chạy firmware tương thích với WebSocket API v6.x
- Trình duyệt hỗ trợ **WebSocket** và **Web Components**

---

## 🐛 Xử lý sự cố

| Vấn đề | Giải pháp |
|--------|-----------|
| Không kết nối được | Kiểm tra `host` và `ws_port`, đảm bảo AI BOX và HA cùng mạng LAN |
| HTTPS báo lỗi kết nối | Cần cấu hình `tunnel_host` với WSS, không dùng WS LAN qua HTTPS |
| Âm lượng không thay đổi | Kiểm tra `speaker_port` (mặc định 8080) đang mở trên thiết bị |
| EQ không có hiệu lực | Bật toggle **Equalizer Enable** trước khi chỉnh băng tần |
| Stereo lệch tiếng | Điều chỉnh **Sync Delay** (0–2000ms) trên loa con |

---

## 📄 License

MIT License — Tự do sử dụng, chỉnh sửa và phân phối.

---

<div align="center">
Made with 💜 for the AI BOX community
</div>
