# AI BOX WebUI Card for Home Assistant

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz/)
![Version](https://img.shields.io/badge/version-6.1.1-blue.svg)

Custom Lovelace card điều khiển toàn diện thiết bị AI BOX (Phicomm R1) ngay trong Home Assistant.

**Card name:** `custom:aibox-webui-card`  
**Hỗ trợ:** LAN (WS) + Cloudflare Tunnel (WSS) + Multi-Room

---

## Tính năng

### Media
Phát YouTube / Zing MP3, waveform animation, seek bar, playlist quản lý, search, repeat / shuffle.

### Control
Wake Word "Ô Kề Na Bu", 30 giọng TTS tiếng Việt, DLNA / AirPlay / Bluetooth, Stereo Mode (Master / Receiver với mutex tự động), EQ 5 băng tần + presets, Bass Boost / Loudness / Surround, LED RGB + Edge lighting, báo thức nâng cao với YouTube alarm.

### Chat
Gửi text + voice, Wake Up / Interrupt / End Session, TikTok Reply toggle, ảnh nền chat tùy chỉnh.

### System
CPU / RAM realtime, MAC Address manager (random / real), OTA Server chọn nguồn, WiFi scan & connect, Home Assistant integration config.

---

## Yêu cầu

- Home Assistant (Lovelace)
- AI BOX firmware v6.x trên Phicomm R1
- Truy cập LAN hoặc qua Cloudflare Tunnel

---

## Cài đặt

### HACS (khuyến nghị)

1. HACS → **Custom repositories**
2. Add repo: `https://github.com/TriTue2011/R1-card`
3. Category: **Dashboard**
4. Download → Reload browser (Ctrl+F5)

### Thủ công

1. Copy `aibox-webui-card.js` vào `config/www/aibox-webui-card.js`
2. **Settings** → **Dashboards** → **Resources**
3. Add resource: `/local/aibox-webui-card.js` — Type: **JavaScript Module**
4. Reload browser (Ctrl+F5)

---

## Cấu hình

### LAN — 1 loa

```yaml
type: custom:aibox-webui-card
host: <speaker_ip>
mode: auto
```

### Tunnel — 1 loa

```yaml
type: custom:aibox-webui-card
host: <speaker_ip>
tunnel_host: <your_tunnel_domain>
speaker_tunnel_host: <your_speaker_tunnel_domain>
mode: auto
```

Card tự append `?ip=<speaker_ip>` vào tunnel URL.

> Từ v6.1.1 **không cần** `tunnel_path` hay `speaker_tunnel_path`.

### Multi-Room — Nhiều loa

```yaml
type: custom:aibox-webui-card
mode: auto
rooms:
  - name: "Phòng khách"
    host: "<speaker_ip_1>"
    tunnel_host: <your_tunnel_domain>
    speaker_tunnel_host: <your_speaker_tunnel_domain>
  - name: "Phòng ngủ"
    host: "<speaker_ip_2>"
    tunnel_host: <your_tunnel_domain>
    speaker_tunnel_host: <your_speaker_tunnel_domain>
```

Nhiều loa dùng chung tunnel domain — bridge phân biệt bằng `?ip=` trong mỗi kết nối.

---

## Tham số cấu hình

| Tham số | Mặc định | Mô tả |
|---|---|---|
| `host` | *(auto)* | IP loa Phicomm R1 |
| `mode` | `auto` | `auto` / `lan` / `tunnel` |
| `tunnel_host` | | Domain tunnel cho WS 8082 |
| `tunnel_port` | `443` | Port tunnel |
| `speaker_tunnel_host` | | Domain tunnel cho Speaker WS 8080 |
| `speaker_tunnel_port` | `443` | Port tunnel speaker |
| `ws_port` | `8082` | Port AiBoxPlus WS trên loa |
| `speaker_port` | `8080` | Port Speaker WS trên loa |
| `title` | `AI BOX` | Tiêu đề hiển thị |
| `default_tab` | `media` | Tab mặc định: `media` / `control` / `chat` / `system` |
| `show_background` | `true` | Hiển thị ảnh nền chat |
| `reconnect_ms` | `1500` | Thời gian chờ reconnect (ms) |
| `rooms` | `null` | Mảng room cho multi-device |

### Tham số mỗi room

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `name` | ✅ | Tên hiển thị |
| `host` | ✅ | IP loa |
| `tunnel_host` | | Domain tunnel WS |
| `speaker_tunnel_host` | | Domain tunnel Speaker |

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `No ?ip= param` | Card chưa cập nhật v6.1.1 | Update card |
| HTTPS không kết nối | Thiếu tunnel | Thêm `tunnel_host` + `speaker_tunnel_host` |
| `connection refused` | Loa offline hoặc sai IP | Kiểm tra IP loa, port 8082/8080 |

---

## Changelog

### v6.1.1
- Fix: Tunnel URL luôn append `?ip=` — bỏ `tunnel_path`
- Fix: Orphaned stereo code blocks
- Fix: Stereo protocol đúng format server API

### v6.1.0
- Multi-Room: chọn loa bằng room pills
- IP-based tunnel routing

### v6.0.8
- Fix protocol: DLNA / AirPlay / EQ / Bass / Loudness
- Fix stereo: `stereo_enable`, `stereo_enable_receiver`, `sync_delay_ms`

---

## License

MIT
