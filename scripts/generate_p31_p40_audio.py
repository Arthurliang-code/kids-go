#!/usr/bin/env python3
# scripts/generate_p31_p40_audio.py - 为 31~40 关批量生成微软 Edge Neural 神经网络高清语音包

import os
import re
import json
import asyncio
import subprocess
import edge_tts

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(PROJECT_DIR, 'assets', 'audio')

VOICE_CONFIGS = {
    'xiaoxiao': {'voice': 'zh-CN-XiaoxiaoNeural', 'rate': '-5%', 'pitch': '+2Hz'},
    'xiaoyi':   {'voice': 'zh-CN-XiaoyiNeural',   'rate': '-5%', 'pitch': '+2Hz'},
    'yunxia':   {'voice': 'zh-CN-YunxiaNeural',   'rate': '-3%', 'pitch': '+0Hz'},
    'yunxi':    {'voice': 'zh-CN-YunxiNeural',    'rate': '-3%', 'pitch': '+0Hz'}
}

def clean_text(raw_text):
    if not raw_text:
        return ""
    t = re.sub(r'<[^>]+>', '', raw_text)
    t = re.sub(r'[★*#_`~💡🎉🏆🌿📖🎯✓✗👑🗡️🌸🐢👁️‍🗨️⚡🌊🌀🦅🌾🧘🛡️⚔️🕊️⚖️🎁]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def extract_puzzles():
    node_code = """
    // 先检查 puzzles.js 是否已有 31~40，若无则从 test_p31_p40_candidate.js 提取
    try {
      const { PUZZLE_LEVELS } = require('./js/puzzles.js');
      const p31_40 = PUZZLE_LEVELS.filter(p => p.id >= 31 && p.id <= 40);
      if (p31_40.length === 10) {
        console.log(JSON.stringify(p31_40));
        process.exit(0);
      }
    } catch(e) {}
    const fs = require('fs');
    const content = fs.readFileSync('./scripts/test_p31_p40_candidate.js', 'utf-8');
    const match = content.match(/const P31_40 = (\[[\s\S]*?\]);\s*console\.log/);
    if (!match) throw new Error('Cannot extract P31_40');
    eval('var pArr = ' + match[1]);
    console.log(JSON.stringify(pArr));
    """
    out = subprocess.check_output(['node', '-e', node_code], cwd=PROJECT_DIR).decode('utf-8')
    return json.loads(out)

async def generate_clip(sem, text, voice_name, rate, pitch, out_path, label):
    async with sem:
        if os.path.exists(out_path) and os.path.getsize(out_path) > 500:
            print(f"⏩ [已存在] {label}")
            return
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        try:
            communicate = edge_tts.Communicate(text, voice_name, rate=rate, pitch=pitch)
            await communicate.save(out_path)
            size_kb = os.path.getsize(out_path) / 1024
            print(f"✅ [生成成功] {label} ({size_kb:.1f} KB)")
        except Exception as e:
            print(f"❌ [合成失败] {label}: {e}")

async def main():
    puzzles = extract_puzzles()
    print(f"提取到 {len(puzzles)} 个关卡 (31~40 关)")

    sem = asyncio.Semaphore(5)
    tasks = []

    for p in puzzles:
        pid = p['id']
        intro_text = clean_text(p.get('voiceTip') or p.get('tip'))
        t1_text = clean_text(p['teachingSteps'][0].get('voice') or p['teachingSteps'][0].get('text'))
        t2_text = clean_text(p['teachingSteps'][1].get('voice') or p['teachingSteps'][1].get('text'))
        ans_text = clean_text(p.get('answerSpeech') or p.get('successMsg'))
        win_text = clean_text(p.get('voiceSuccess') or p.get('successMsg'))

        clips = [
            (f"p{pid}_intro", intro_text),
            (f"p{pid}_t1", t1_text),
            (f"p{pid}_t2", t2_text),
            (f"p{pid}_ans", ans_text),
            (f"p{pid}_win", win_text),
        ]

        for pack_key, cfg in VOICE_CONFIGS.items():
            for clip_key, text in clips:
                if not text:
                    continue
                out_path = os.path.join(AUDIO_DIR, pack_key, f"{clip_key}.mp3")
                label = f"{pack_key}/{clip_key}.mp3"
                tasks.append(generate_clip(sem, text, cfg['voice'], cfg['rate'], cfg['pitch'], out_path, label))

    print(f"总计规划生成 {len(tasks)} 条 Edge Neural 神经网络语音片段...")
    await asyncio.gather(*tasks)
    print("\n🎉 全部 31~40 关大局观语音片段生成完毕！")

if __name__ == '__main__':
    asyncio.run(main())

