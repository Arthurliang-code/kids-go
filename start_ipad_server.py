#!/usr/bin/env python3
# start_ipad_server.py - 专为 iPad 运行打造的局域网独立投送与 Edge-TTS 实时语音合成服务

import http.server
import socketserver
import socket
import os
import subprocess
import urllib.parse
import hashlib

VOICE_MAP = {
    'xiaoxiao': ('zh-CN-XiaoxiaoNeural', '-5%', '+2Hz'),
    'xiaoyi':   ('zh-CN-XiaoyiNeural',   '-5%', '+2Hz'),
    'yunxia':   ('zh-CN-YunxiaNeural',   '-3%', '+0Hz'),
    'yunxi':    ('zh-CN-YunxiNeural',    '-3%', '+0Hz'),
}

def get_lan_ip():
    # 优先使用 macOS Wi-Fi (en0) 硬件真实局域网 IP
    for iface in ['en0', 'en1', 'en2']:
        try:
            out = subprocess.check_output(['ipconfig', 'getifaddr', iface], stderr=subprocess.DEVNULL).decode('utf-8').strip()
            if out:
                return out
        except Exception:
            pass

    # 备选通用套接字探测
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def find_available_port(start_port=8088, max_attempts=20):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("", port))
                return port
            except OSError:
                continue
    return start_port

class KidsGoRequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.mobileconfig': 'application/x-apple-aspen-config',
    }

    def end_headers(self):
        # 防止浏览器缓存旧版 JS/HTML/SW，确保新语音包即时生效
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/tts':
            self.handle_tts(parsed.query)
            return
        super().do_GET()

    def handle_tts(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        text = (params.get('text', [''])[0] or '').strip()
        voice_key = (params.get('voice', ['xiaoxiao'])[0] or 'xiaoxiao').strip()

        if not text:
            self.send_error(400, "Missing text")
            return

        voice_name, rate, pitch = VOICE_MAP.get(voice_key, VOICE_MAP['xiaoxiao'])
        cache_dir = os.path.join(os.getcwd(), 'assets', 'audio', 'cache')
        os.makedirs(cache_dir, exist_ok=True)

        digest = hashlib.md5(f"{voice_name}|{rate}|{pitch}|{text}".encode('utf-8')).hexdigest()
        cache_file = os.path.join(cache_dir, f"{digest}.mp3")

        if not os.path.exists(cache_file) or os.path.getsize(cache_file) < 200:
            edge_tts_bin = '/tmp/edge_tts_venv/bin/edge-tts'
            if not os.path.exists(edge_tts_bin):
                edge_tts_bin = 'edge-tts'
            try:
                subprocess.run([
                    edge_tts_bin,
                    '--voice', voice_name,
                    f'--rate={rate}',
                    f'--pitch={pitch}',
                    '--text', text,
                    '--write-media', cache_file
                ], check=True, timeout=10, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as e:
                self.send_error(502, f"TTS synthesis failed: {e}")
                return

        try:
            with open(cache_file, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, f"Read audio failed: {e}")

class ReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

def main():
    PORT = find_available_port(8088)
    
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_dir)

    ip = get_lan_ip()
    url = f"http://{ip}:{PORT}"

    # 自动同步真实局域网 IP 到 iPad 描述配置文件，确保点击描述文件即可直接在 iPad 上生效
    config_file = os.path.join(project_dir, 'KidsGo_iPad_Installer.mobileconfig')
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                cfg_text = f.read()
            import re
            updated_cfg = re.sub(r'<string>http://[^:]+:\d+</string>', f'<string>{url}</string>', cfg_text)
            if updated_cfg != cfg_text:
                with open(config_file, 'w', encoding='utf-8') as f:
                    f.write(updated_cfg)
        except Exception:
            pass

    print("=" * 60)
    print("🐼 萌宝少儿围棋 · iPad 独立 App 安装与 Neural 语音服务已启动！")
    print("=" * 60)
    print(f"\n📲 请在 iPad 上按照以下【3步】操作，永久添加到 iPad 桌面：\n")
    print(f"  👉 第 1 步：确保 iPad 与电脑连接在同一个 Wi-Fi 网络下")
    print(f"  👉 第 2 步：打开 iPad 自带的 Safari 浏览器，访问：")
    print(f"\n      \033[1;32m{url}\033[0m\n")
    print(f"  👉 第 3 步：点击 Safari 右上角【分享按钮（带向上箭头的方框 ⎋）】")
    print(f"             向下滑动选择 ➔【添加到主屏幕】(Add to Home Screen)")
    print(f"             点击右上角【添加】即可！\n")
    print(f"  💡 备用方法：亦可在 Safari 中直接下载安装【KidsGo_iPad_Installer.mobileconfig】快捷描述文件")
    print("=" * 60)
    print("🌟 成功添加后，iPad 桌面上会生成原生的【萌宝围棋】卡通图标！")
    print("🎙️ 已搭载 Microsoft Edge Neural TTS 中国大陆直连少儿自然语音引擎。")
    print("🛑 需要停止服务时，按键盘 Ctrl + C 即可退出。")
    print("=" * 60 + "\n")

    with ReusableTCPServer(("", PORT), KidsGoRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务已停止。祝小朋友学棋愉快！")

if __name__ == '__main__':
    main()
