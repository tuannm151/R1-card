# AI BOX WebUI Card for Home Assistant

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz/)
![Version](https://img.shields.io/badge/version-6.1.1-blue.svg)

Custom Lovelace card điều khiển toàn diện thiết bị AI BOX ngay trong Home Assistant.

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
- AI BOX firmware v6.x
- Truy cập LAN hoặc qua Cloudflare Tunnel
- **Bridge add-on hoặc Docker** (nếu dùng tunnel)

---

## Cài đặt Card

### Cách 1: HACS (khuyến nghị)

1. HACS → **Custom repositories**
2. Add repo: `https://github.com/TriTue2011/R1-card`
3. Category: **Dashboard**
4. Download → Reload browser (Ctrl+F5)

### Cách 2: Thủ công

1. Copy `aibox-webui-card.js` vào `config/www/aibox-webui-card.js`
2. **Settings** → **Dashboards** → **Resources**
3. Add resource: `/local/aibox-webui-card.js` — Type: **JavaScript Module**
4. Reload browser (Ctrl+F5)

---

## Cấu hình Card

### LAN — Truy cập trực tiếp (HTTP)

Khi truy cập HA qua HTTP trong cùng mạng LAN:

```yaml
type: custom:aibox-webui-card
host: 192.168.1.6
mode: auto
```

Card sẽ kết nối trực tiếp `ws://192.168.1.6:8082` và `ws://192.168.1.6:8080`.

### Tunnel — 1 AI BOX

Khi truy cập HA qua HTTPS hoặc từ bên ngoài, cần bridge + Cloudflare Tunnel:

```yaml
type: custom:aibox-webui-card
host: 192.168.1.6
tunnel_host: aiboxque.vhtatn.io.vn
speaker_tunnel_host: spkque.vhtatn.io.vn
mode: auto
```

Card tự append `?ip=192.168.1.6` vào tunnel URL → bridge nhận IP → route đến đúng loa.

> **Lưu ý:** Từ v6.1.1 **không cần** `tunnel_path` hay `speaker_tunnel_path` nữa. Card tự xử lý.

### Multi-Room — Nhiều loa

```yaml
type: custom:aibox-webui-card
mode: auto
rooms:
  - name: "Phòng khách"
    host: "172.16.10.17"
    tunnel_host: aibox.vhtatn.io.vn
    speaker_tunnel_host: spk.vhtatn.io.vn
  - name: "Phòng ngủ"
    host: "172.16.10.16"
    tunnel_host: aibox.vhtatn.io.vn
    speaker_tunnel_host: spk.vhtatn.io.vn
```

Nhiều loa dùng chung tunnel domain — bridge phân biệt bằng `?ip=` trong mỗi kết nối.

---

## Tham số cấu hình

| Tham số | Mặc định | Mô tả |
|---|---|---|
| `host` | *(IP HA)* | IP của AI BOX |
| `mode` | `auto` | `auto` / `lan` / `tunnel` |
| `tunnel_host` | | Domain tunnel cho WS 8082 |
| `tunnel_port` | `443` | Port tunnel (thường 443) |
| `speaker_tunnel_host` | | Domain tunnel cho Speaker WS 8080 |
| `speaker_tunnel_port` | `443` | Port tunnel speaker |
| `ws_port` | `8082` | Port AiBoxPlus WS trên loa |
| `speaker_port` | `8080` | Port Speaker WS trên loa |
| `title` | `AI BOX` | Tiêu đề hiển thị |
| `default_tab` | `media` | Tab mặc định: `media` / `control` / `chat` / `system` |
| `show_background` | `true` | Hiển thị ảnh nền chat |
| `rooms` | `null` | Mảng room cho multi-device (xem bên dưới) |

### Tham số mỗi room

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `name` | ✅ | Tên hiển thị |
| `host` | ✅ | IP loa |
| `tunnel_host` | | Domain tunnel WS |
| `speaker_tunnel_host` | | Domain tunnel Speaker |
| `tunnel_port` | | Port tunnel (mặc định 443) |
| `speaker_tunnel_port` | | Port tunnel speaker (mặc định 443) |

---

## Bridge Setup

Bridge là thành phần trung gian cho phép Cloudflare Tunnel route đến đúng IP loa trong LAN.

```
Card  →  wss://aibox.domain.com?ip=172.16.10.17
      →  Cloudflare Tunnel
      →  http://HA_IP:18082  (bridge)
      →  ws://172.16.10.17:8082  (loa)
```

### Cách 1: HA Add-on (khuyến nghị cho HAOS)

1. Copy folder `aibox_bridge` vào `/addons/`
2. **Settings** → **Add-ons** → **Add-on Store** → menu ⋮ → **Check for updates**
3. Cuộn xuống **Local add-ons** → **AI BOX WebSocket Bridge** → **Install**
4. Tab **Configuration** → thêm IP loa vào `allowed_ips`
5. **Start**

### Cách 2: Docker Compose (cho Docker / Supervised)

```yaml
# docker-compose.yml
services:
  aibox_bridge:
    image: python:3.12-alpine
    container_name: aibox_bridge
    restart: unless-stopped
    network_mode: host
    environment:
      WS_PORT: "18082"
      SPK_PORT: "18080"
      TARGET_WS_PORT: "8082"
      TARGET_SPK_PORT: "8080"
      ALLOWED_IPS: "172.16.10.17,172.16.10.16"
    volumes:
      - ./bridge.py:/app/bridge.py:ro
    working_dir: /app
    command: >
      sh -c "pip install --no-cache-dir --root-user-action=ignore 'websockets>=12.0' -q &&
             python -u bridge.py"
```

> `network_mode: host` bắt buộc để bridge truy cập LAN.

### Cloudflare Tunnel Config

Tạo 2 Public Hostnames trỏ về bridge:

| Hostname | Service |
|---|---|
| `aibox.domain.com` | `http://localhost:18082` |
| `spk.domain.com` | `http://localhost:18080` |

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `No ?ip= param` | Card cũ không tự append `?ip=` | Update card lên v6.1.1+ |
| `connection refused` | Bridge không chạy hoặc sai port | Kiểm tra bridge log, port 18082/18080 |
| HTTPS không kết nối | Thiếu `tunnel_host` | Thêm `tunnel_host` + `speaker_tunnel_host` |
| Bridge không thấy loa | Docker dùng bridge network | Đổi sang `network_mode: host` |
| `Non-UTF-8 \x96` | File bridge.py bị sai encoding | Download lại bridge.py từ repo |
| Nhiều WS mở/đóng liên tục | Card reconnect loop | Kiểm tra tunnel stable, tăng `reconnect_ms` |

---

## Changelog

### v6.1.1
- Fix: Tunnel URL luôn append `?ip=` — không cần `tunnel_path` nữa
- Fix: Xóa orphaned stereo code blocks (syntax error)
- Fix: Stereo protocol đúng format server API

### v6.1.0
- Multi-Room: chọn loa bằng room pills
- IP-based tunnel routing cho nhiều device qua 1 bridge

### v6.0.8
- Fix protocol: DLNA/AirPlay/EQ/Bass/Loudness dùng direct type commands
- Fix stereo: đúng action names `stereo_enable`, `stereo_enable_receiver`
- Fix sync delay: key `sync_delay_ms`

### v6.0.7
- Chat dedup, session state tracking, heartbeat guard timers

### v6.0.5
- Control tab reorganized, volume sync fix

---

## License

MIT
