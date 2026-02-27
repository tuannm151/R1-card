# R1-card

# AI BOX WebUI Card -- Home Assistant Custom Card

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz/)
![Version](https://img.shields.io/badge/version-6.0.9-blue.svg)

Custom card điều khiển toàn diện thiết bị AI BOX ngay trong Home
Assistant -- Media, Chat AI, Equalizer, LED, Báo thức, WiFi và nhiều hơn
nữa.

Card name: custom:aibox-webui-card\
Element: aibox-webui-card\
Phiên bản JS: 6.0.9\
Hỗ trợ: LAN (WS) + Tunnel (WSS)

------------------------------------------------------------------------

## TÍNH NĂNG

MEDIA - Phát YouTube / Zing MP3 - Waveform animation - Seek bar -
Playlist / Search - Repeat / Shuffle

CONTROL - Wake Word "Ô Kề Na Bu" - 30 giọng TTS tiếng Việt - DLNA /
AirPlay / Bluetooth - Stereo Mode (Master / Slave) - EQ 5 băng tần -
Bass Boost / Loudness / Surround - LED RGB + Edge - Báo thức nâng cao

CHAT - Text + Voice - Wake / Interrupt / End session - TikTok Reply -
Ảnh nền tùy chỉnh

SYSTEM - CPU / RAM realtime - MAC Address manager - OTA Server - WiFi
scan & connect

------------------------------------------------------------------------

## YÊU CẦU

-   Home Assistant (Lovelace)
-   AI BOX firmware v6.x
-   Truy cập được LAN hoặc Tunnel
-   Cài JS resource hoặc qua HACS

------------------------------------------------------------------------

## CÀI ĐẶT

### Cài thủ công

1.  Copy file aibox-webui-card.js vào: config/www/aibox-webui-card.js

2.  Vào Settings → Dashboards → Resources

3.  Add resource: /local/aibox-webui-card.js Type: JavaScript Module

4.  Reload trình duyệt (Ctrl+F5)

### Cài qua HACS

1.  HACS → Custom repositories
2.  Add repo: https://github.com/TriTue2011/R1-card
3.  Category: Dashboard
4.  Download
5.  Reload browser

------------------------------------------------------------------------

## HAOS SETUP

Bridge: HA_IP:18082 → forward 8082\
HA_IP:18080 → forward 8080

Cloudflared config:

external_hostname: que.vhtatn.io.vn additional_hosts: - hostname:
aiboxque.vhtatn.io.vn service: http://192.168.1.3:18082 - hostname:
spkque.vhtatn.io.vn service: http://192.168.1.3:18080 tunnel_name:
HomeAssistant

### HAOS -- 1 AI BOX

type: custom:aibox-webui-card host: 192.168.1.6 tunnel_host:
aiboxque.vhtatn.io.vn tunnel_path: "/?ip=192.168.1.6"
speaker_tunnel_host: spkque.vhtatn.io.vn speaker_tunnel_path:
"/?ip=192.168.1.6" mode: auto

------------------------------------------------------------------------

## DOCKER SETUP

Bridge phải publish port: 18082:18082 18080:18080

Cloudflared origin: http://192.168.1.3:18082 http://192.168.1.3:18080

### Docker -- 1 AI BOX

type: custom:aibox-webui-card host: 172.16.10.17 tunnel_host:
aibox.vhtatn.io.vn tunnel_path: "/?ip=172.16.10.17" speaker_tunnel_host:
spk.vhtatn.io.vn speaker_tunnel_path: "/?ip=172.16.10.17" mode: auto

------------------------------------------------------------------------

## MULTI ROOM

type: custom:aibox-webui-card mode: auto rooms: - name: Phòng khách
host: 172.16.10.17 tunnel_host: aibox.vhtatn.io.vn speaker_tunnel_host:
spk.vhtatn.io.vn - name: Phòng ngủ host: 172.16.10.16 tunnel_host:
aibox.vhtatn.io.vn speaker_tunnel_host: spk.vhtatn.io.vn

------------------------------------------------------------------------

## TROUBLESHOOTING

connection refused → Sai origin hoặc bridge không listen đúng port

No ?ip= param → Thiếu tunnel_path "/?ip=`<ip>`{=html}"

HTTPS không kết nối → Thiếu tunnel_host hoặc speaker_tunnel_host

------------------------------------------------------------------------

License: MIT
