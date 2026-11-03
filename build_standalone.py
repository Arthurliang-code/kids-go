#!/usr/bin/env python3
# build_standalone.py - 将【萌宝少儿围棋】全量代码、样式、图标与微软 Neural 神经网络语音包打包为单一本地离线 HTML 应用及 iPad 离线桌面安装包

import os
import re
import json
import base64
import subprocess
import uuid

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

VOICE_PACKS = ['xiaoxiao', 'xiaoyi', 'yunxia', 'yunxi']

def compress_mp3_to_base64(mp3_path, bitrate='24k'):
    """使用 ffmpeg 将语音压缩为高清晰度 24kHz 单声道 MP3 并转为 Base64 Data URI"""
    try:
        out_bytes = subprocess.check_output([
            '/opt/homebrew/bin/ffmpeg',
            '-y', '-i', mp3_path,
            '-ac', '1',
            '-ar', '24000',
            '-b:a', bitrate,
            '-f', 'mp3',
            'pipe:1'
        ], stderr=subprocess.DEVNULL)
    except Exception:
        with open(mp3_path, 'rb') as f:
            out_bytes = f.read()
    b64 = base64.b64encode(out_bytes).decode('ascii')
    return f"data:audio/mp3;base64,{b64}"

def read_text(rel_path):
    with open(os.path.join(PROJECT_DIR, rel_path), 'r', encoding='utf-8') as f:
        return f.read()

def read_b64(rel_path):
    with open(os.path.join(PROJECT_DIR, rel_path), 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')

def build_html_bundle(packs_to_include, bitrate='24k'):
    index_html = read_text('index.html')
    style_css = read_text('css/style.css')
    icon_192_b64 = read_b64('assets/icons/icon-192.png')
    icon_data_uri = f"data:image/png;base64,{icon_192_b64}"

    # 收集并压缩内嵌语音包
    inline_packs = {}
    audio_root = os.path.join(PROJECT_DIR, 'assets', 'audio')
    for pack in packs_to_include:
        pack_dir = os.path.join(audio_root, pack)
        if not os.path.isdir(pack_dir):
            continue
        inline_packs[pack] = {}
        for fname in sorted(os.listdir(pack_dir)):
            if fname.endswith('.mp3'):
                clip_key = os.path.splitext(fname)[0]
                full_path = os.path.join(pack_dir, fname)
                inline_packs[pack][clip_key] = compress_mp3_to_base64(full_path, bitrate=bitrate)

    # 替换图标与样式表为内嵌版本
    html = index_html
    html = re.sub(r'<link rel="apple-touch-icon"[^>]*>', '', html)
    html = re.sub(r'<link rel="manifest"[^>]*>', '', html)
    html = html.replace(
        '<link rel="stylesheet" href="css/style.css">',
        f'<link rel="apple-touch-icon" href="{icon_data_uri}">\n  <style>\n{style_css}\n  </style>'
    )

    # 如果只内嵌了晓晓音色（如轻量桌面描述文件版），保持下拉框同步提示
    if len(packs_to_include) == 1:
        html = re.sub(
            r'<select id="selectVoicePack"[^>]*>.*?</select>',
            '''<select id="selectVoicePack" class="voice-pack-select" title="切换配音老师">
              <option value="xiaoxiao" selected>🌟 晓晓老师 (温暖故事音)</option>
            </select>''',
            html,
            flags=re.DOTALL
        )

    # 组装全部 JS 脚本与内嵌音频字典
    js_files = [
        'js/audio.js',
        'js/voice.js',
        'js/go-engine.js',
        'js/puzzles.js',
        'js/ai.js',
        'js/app.js'
    ]
    combined_js = [
        "window.IS_STANDALONE_HTML = true;",
        f"window.INLINE_VOICE_PACKS = {json.dumps(inline_packs, ensure_ascii=False)};"
    ]
    for jf in js_files:
        combined_js.append(f"// ====== {jf} ======\n" + read_text(jf))

    scripts_block = "<script>\n" + "\n\n".join(combined_js) + "\n</script>"

    # 替换原有的外部 script 引用
    html = re.sub(
        r'<!-- 模块化脚本加载 -->.*?</body>',
        f'<!-- 单文件全量离线内嵌脚本与神经网络语音包 -->\n{scripts_block}\n</body>',
        html,
        flags=re.DOTALL
    )
    return html

def build_mobileconfig(standalone_html_str, icon_b64):
    html_b64 = base64.b64encode(standalone_html_str.encode('utf-8')).decode('ascii')
    data_url = f"data:text/html;charset=utf-8;base64,{html_b64}"
    clip_uuid = str(uuid.uuid4())
    profile_uuid = str(uuid.uuid4())

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>FullScreen</key>
            <true/>
            <key>Icon</key>
            <data>{icon_b64}</data>
            <key>IgnoreManifestScope</key>
            <true/>
            <key>IsRemovable</key>
            <true/>
            <key>Label</key>
            <string>萌宝围棋</string>
            <key>PayloadDescription</key>
            <string>萌宝少儿围棋 iPad 纯本地离线独立 App（内嵌神经网络真人语音）</string>
            <key>PayloadDisplayName</key>
            <string>萌宝围棋 (离线版)</string>
            <key>PayloadIdentifier</key>
            <string>com.kidsgo.offline.webclip.{clip_uuid}</string>
            <key>PayloadType</key>
            <string>com.apple.webClip.managed</string>
            <key>PayloadUUID</key>
            <string>{clip_uuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Precomposed</key>
            <true/>
            <key>URL</key>
            <string>{data_url}</string>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>安装后将在 iPad 桌面生成全屏独立运行的【萌宝围棋】App 图标，已内嵌全部题库与晓晓老师神经网络语音，无需电脑和网络即可随时运行！</string>
    <key>PayloadDisplayName</key>
    <string>萌宝少儿围棋 (iPad 纯离线独立桌面版)</string>
    <key>PayloadIdentifier</key>
    <string>com.kidsgo.offline.profile.{profile_uuid}</string>
    <key>PayloadOrganization</key>
    <string>Kids Go Studio</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>{profile_uuid}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
"""

def main():
    print("📦 正在打包【萌宝少儿围棋_iPad离线单文件版.html】（含全部 4 套微软 Neural 语音包）...")
    full_html = build_html_bundle(VOICE_PACKS, bitrate='24k')
    out_html_path = os.path.join(PROJECT_DIR, '萌宝少儿围棋_iPad离线单文件版.html')
    with open(out_html_path, 'w', encoding='utf-8') as f:
        f.write(full_html)
    size_mb = os.path.getsize(out_html_path) / (1024 * 1024)
    print(f"✅ 单文件离线 HTML 生成完毕: {out_html_path} ({size_mb:.2f} MB)")

    print("📲 正在打包【KidsGo_iPad_Offline.mobileconfig】（iPad 桌面全屏纯离线 App 描述文件）...")
    lite_html = build_html_bundle(['xiaoxiao'], bitrate='20k')
    icon_b64 = read_b64('assets/icons/icon-192.png')
    mobileconfig_xml = build_mobileconfig(lite_html, icon_b64)
    out_cfg_path = os.path.join(PROJECT_DIR, 'KidsGo_iPad_Offline.mobileconfig')
    with open(out_cfg_path, 'w', encoding='utf-8') as f:
        f.write(mobileconfig_xml)
    cfg_size_mb = os.path.getsize(out_cfg_path) / (1024 * 1024)
    print(f"✅ iPad 桌面纯离线安装包生成完毕: {out_cfg_path} ({cfg_size_mb:.2f} MB)")

if __name__ == '__main__':
    main()

