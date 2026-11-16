#!/usr/bin/env python3
# scripts/generate_p41_p50_and_review_audio.py - 为第41~50关连环实战题库、步间引导与局后复盘生成 Edge Neural 语音包

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

EXTRA_CLIPS = {
    'step_continue': "走对第一步啦！快看看对手的应对，继续完成下一招吧！",
    'review_best': "这一步真是神来之笔！是整盘棋里最闪亮的一手妙招哦！",
    'review_mistake': "哎呀，这一步错过了一个更好的机会，快看看棋盘上金色光圈推荐的位置吧！",
    'review_no_mistake': "这一局你下得非常稳健，几乎没有明显的大失误哦！"
}

WRONG_TEXTS_41_50 = {
    41: "先直接堵下边只能追一颗白棋，要下在它们共同的交叉点同时双打吃两边哦！",
    42: "方向反啦！把白棋赶向空旷处它就跑掉啦，要往黑棋伏兵的方向赶哦！",
    43: "直接叫吃会让白棋连出去的，先勇敢往虎口里扑进去送吃倒扑！",
    44: "先从里面粘会被白棋冲出去，要从上边挤住打吃逼它连成大团子！",
    45: "直接点里面会让白棋轻松做出两只眼，一定要先从外侧缩小眼位再点中心！",
    46: "先退缩会被白棋抢先扳过来，官子要勇敢先手一线扳进去再粘牢！",
    47: "先下旁边会放跑左边白棋哦，要抢占底线中间咽喉的金鸡独立要点！",
    48: "先挡右边会让白棋从下方溜走，要先从下方打吃把它往黑棋高墙方向赶！",
    49: "先走边上会让白棋抢占拐角做活，一定要先点入最关键的拐角命门！",
    50: "先在中央抢先手打吃逼白棋表态，再趁势切断它的退路才是连环妙手哦！"
}

def clean_text(raw_text):
    if not raw_text:
        return ""
    t = re.sub(r'<[^>]+>', '', raw_text)
    t = re.sub(r'[★*#_`~💡🎉🏆🌿📖🎯✓✗👑🗡️🌸🐢👁️‍🗨️⚡🌊🌀🦅🌾🧘🛡️⚔️🕊️⚖️🎁🔥🌪️🪃✂️🧱🐓🕸️💥【】]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def extract_puzzles():
    node_code = """
    const { PUZZLE_LEVELS } = require('./js/puzzles.js');
    const p41_50 = PUZZLE_LEVELS.filter(p => p.id >= 41 && p.id <= 50);
    console.log(JSON.stringify(p41_50));
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
    print(f"提取到 {len(puzzles)} 个连环实战关卡 (41~50 关)")

    sem = asyncio.Semaphore(5)
    tasks = []

    clips = []
    for k, v in EXTRA_CLIPS.items():
        clips.append((k, clean_text(v)))

    for p in puzzles:
        pid = p['id']
        intro_text = clean_text(p.get('voiceTip') or p.get('tip'))
        t1_text = clean_text(p['teachingSteps'][0].get('voice') or p['teachingSteps'][0].get('text'))
        t2_text = clean_text(p['teachingSteps'][1].get('voice') or p['teachingSteps'][1].get('text'))
        ans_text = clean_text(p.get('answerSpeech') or p.get('explain') or p.get('successMsg'))
        win_text = clean_text(p.get('voiceSuccess') or p.get('successMsg'))
        wrong_text = clean_text(WRONG_TEXTS_41_50.get(pid, ''))

        clips.extend([
            (f"p{pid}_intro", intro_text),
            (f"p{pid}_t1", t1_text),
            (f"p{pid}_t2", t2_text),
            (f"p{pid}_ans", ans_text),
            (f"p{pid}_win", win_text),
            (f"p{pid}_wrong", wrong_text),
        ])

    for pack_key, cfg in VOICE_CONFIGS.items():
        for clip_key, text in clips:
            if not text:
                continue
            out_path = os.path.join(AUDIO_DIR, pack_key, f"{clip_key}.mp3")
            label = f"{pack_key}/{clip_key}.mp3"
            tasks.append(generate_clip(sem, text, cfg['voice'], cfg['rate'], cfg['pitch'], out_path, label))

    print(f"总计规划生成 {len(tasks)} 条 Edge Neural 神经网络语音片段...")
    await asyncio.gather(*tasks)
    print("\n🎉 全部 41~50 关及局后复盘语音片段生成完毕！")

if __name__ == '__main__':
    asyncio.run(main())
