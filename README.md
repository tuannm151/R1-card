# AI BOX WebUI Card for Home Assistant

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz/)
![Version](https://img.shields.io/badge/version-6.3.0-blue.svg)

Custom Lovelace card điều khiển toàn diện thiết bị AI BOX (Phicomm R1) ngay trong Home Assistant.

**Card name:** `custom:aibox-webui-card`  
**Hỗ trợ:** LAN (WS) · Cloudflare Tunnel (WSS) · Multi-Room

---

## Tính năng

### ♪ Media
- Phát nhạc YouTube / Zing MP3
- Waveform visualizer 2 kiểu: **Classic** (bars mượt) và **Peak Ball** (thanh đẩy + hình tròn rơi)
- Seek bar, repeat, shuffle
- Tìm kiếm bài hát / playlist
- Quản lý playlist (tạo, xóa, xem danh sách)

### ⚙ Control
- Wake Word **"Ô Kề Na Bu"** — bật/tắt + chỉnh độ nhạy
- **30 giọng TTS** tiếng Việt (Chống Điếc AI) + preview giọng
- DLNA / AirPlay / Bluetooth toggle
- LED RGB + đèn viền Edge
- **Audio Engine:** EQ 5 băng tần, presets, Bass Boost, Loudness, Surround
- Dải trầm / cao riêng biệt (DAC Mixer L/R)
- Báo thức nâng cao: giờ, lặp lại, theo ngày trong tuần, volume, YouTube alarm

### 💬 Chat
- Gửi text và nhận phản hồi AI
- Wake Up / Interrupt / End Session
- TikTok Reply toggle
- Ảnh nền chat tuỳ chỉnh

### ✦ System
- CPU / RAM realtime
- MAC Address (xem, random, khôi phục thực)
- OTA Server chọn nguồn firmware
- WiFi: quét, kết nối, xóa mạng đã lưu
- Home Assistant integration (URL, Agent ID, API Key)
- Thông tin kết nối WS / WSS

---

## Yêu cầu

- Home Assistant với Lovelace
- AI BOX firmware v6.x trên Phicomm R1
- Truy cập LAN hoặc qua Cloudflare Tunnel

---

## Cài đặt

### HACS (khuyến nghị)

1. HACS → **Custom repositories**
2. Add: `https://github.com/TriTue2011/R1-card` — Category: **Dashboard**
3. Download → Reload browser (Ctrl+F5)

### Thủ công

1. Copy `aibox-webui-card.js` vào `config/www/aibox-webui-card.js`
2. **Settings → Dashboards → Resources**
3. Add resource: `/local/aibox-webui-card.js` — Type: **JavaScript Module**
4. Reload browser (Ctrl+F5)

---

## Cấu hình

### LAN — 1 loa

```yaml
type: custom:aibox-webui-card
host: 192.168.1.100
mode: auto
```

### Tunnel — 1 loa

```yaml
type: custom:aibox-webui-card
host: 192.168.1.100
tunnel_host: your-tunnel.trycloudflare.com
speaker_tunnel_host: your-speaker-tunnel.trycloudflare.com
mode: auto
```

> Card tự append `?ip=<speaker_ip>` vào tunnel URL.

### Multi-Room — Nhiều loa

```yaml
type: custom:aibox-webui-card
mode: auto
title: AI BOX
rooms:
  - name: "Phòng khách"
    host: "192.168.1.100"
    tunnel_host: your-tunnel.trycloudflare.com
    speaker_tunnel_host: your-speaker-tunnel.trycloudflare.com
  - name: "Phòng ngủ"
    host: "192.168.1.101"
    tunnel_host: your-tunnel.trycloudflare.com
    speaker_tunnel_host: your-speaker-tunnel.trycloudflare.com
```

Nhiều loa dùng chung tunnel domain — card phân biệt qua `?ip=` trong mỗi kết nối.

---

## Tham số cấu hình

### Card (toàn cục)

| Tham số | Mặc định | Mô tả |
|---|---|---|
| `host` | *(hostname)* | IP loa Phicomm R1 |
| `mode` | `auto` | `auto` · `lan` · `tunnel` |
| `title` | `AI BOX` | Tiêu đề hiển thị |
| `default_tab` | `media` | Tab mặc định: `media` / `control` / `chat` / `system` |
| `show_background` | `true` | Hiển thị ảnh nền chat |
| `ws_port` | `8082` | Port WebSocket chính |
| `speaker_port` | `8080` | Port WebSocket loa |
| `http_port` | `8081` | Port HTTP |
| `tunnel_host` | | Domain tunnel cho WS 8082 |
| `tunnel_port` | `443` | Port tunnel |
| `tunnel_path` | `/` | Path tunnel |
| `speaker_tunnel_host` | | Domain tunnel cho Speaker WS 8080 |
| `speaker_tunnel_port` | `443` | Port tunnel speaker |
| `speaker_tunnel_path` | `/` | Path tunnel speaker |
| `reconnect_ms` | `1500` | Thời gian chờ reconnect (ms) |
| `connect_timeout_ms` | `2500` | Timeout mỗi lần thử kết nối (ms) |
| `rooms` | `null` | Mảng room cho multi-device |

### Mỗi room (khi dùng `rooms`)

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `name` | ✅ | Tên phòng hiển thị |
| `host` | ✅ | IP loa |
| `tunnel_host` | | Domain tunnel WS chính |
| `tunnel_port` | | Port tunnel WS (mặc định 443) |
| `tunnel_path` | | Path tunnel WS (mặc định `/`) |
| `speaker_tunnel_host` | | Domain tunnel Speaker WS |
| `speaker_tunnel_port` | | Port tunnel speaker (mặc định 443) |
| `speaker_tunnel_path` | | Path tunnel speaker (mặc định `/`) |

---

## Waveform Visualizer

Khi đang phát nhạc, thanh waveform hiển thị phía trên seek bar. Nhấn nút **`⚬`** / **`≡`** nhỏ góc trái waveform để đổi kiểu:

| Nút | Kiểu | Mô tả |
|---|---|---|
| `⚬` | **Peak Ball** | Thanh bắn lên đẩy hình tròn, hình tròn từ từ rơi xuống |
| `≡` | **Classic** | Thanh nhảy lên xuống mượt mà liên tục |

Waveform tự ẩn khi dừng / tạm dừng nhạc.

---

## Troubleshooting

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Không kết nối được | Sai IP hoặc loa offline | Kiểm tra IP, port 8082/8080 |
| HTTPS không kết nối | Thiếu tunnel | Thêm `tunnel_host` + `speaker_tunnel_host` |
| Overlay "Thiết bị offline" liên tục | Loa tắt hoặc mạng LAN bị chặn | Dùng tunnel hoặc kiểm tra firewall |
| Volume không thay đổi | Speaker WS chưa kết nối | Kiểm tra `speaker_port` hoặc `speaker_tunnel_host` |
| Waveform không hiện | Nhạc chưa phát hoặc `isPlaying = false` | Chắc chắn nhạc đang chạy, không phải pause |

---

## Changelog

### v6.3.0
- Waveform visualizer 2 mode: **Classic** và **Peak Ball** (toggle bằng nút `⚬/≡`)
- Peak Ball: hình tròn đỉnh với vật lý rơi chậm theo trọng lực
- Waveform ẩn hoàn toàn khi dừng / tạm dừng
- Tốc độ animation điều chỉnh cho tự nhiên hơn

### v6.2.x
- Xóa waveform khi không phát nhạc
- Waveform với bars animation động

### v6.1.1
- Fix: Tunnel URL luôn append `?ip=`
- Fix: Stereo protocol đúng format server API

### v6.1.0
- Multi-Room: chọn loa bằng room pills
- IP-based tunnel routing

### v6.0.8
- Fix protocol: DLNA / AirPlay / EQ / Bass / Loudness

---

## License

MIT
