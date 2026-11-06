#!/usr/bin/env python3
# scripts/generate_prompt_and_error_audio.py - 为萌宝少儿围棋全量生成提示音、错误引导与专属陷阱神经网络语音包

import os
import re
import asyncio
import edge_tts

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(PROJECT_DIR, 'assets', 'audio')

VOICE_CONFIGS = {
    'xiaoxiao': {'voice': 'zh-CN-XiaoxiaoNeural', 'rate': '-5%', 'pitch': '+2Hz'},
    'xiaoyi':   {'voice': 'zh-CN-XiaoyiNeural',   'rate': '-5%', 'pitch': '+2Hz'},
    'yunxia':   {'voice': 'zh-CN-YunxiaNeural',   'rate': '-3%', 'pitch': '+0Hz'},
    'yunxi':    {'voice': 'zh-CN-YunxiNeural',    'rate': '-3%', 'pitch': '+0Hz'}
}

# 8 大全局交互与规则提示音
UNIVERSAL_PROMPTS = {
    'hint_coach': "熊猫导师为你支招啦！快看看棋盘上金色光圈提示的最佳落子点吧！",
    'err_choice_badge': "请直接点击棋盘上发光的 A 或 B 徽章做大局决定哦！",
    'err_occupied': "这里已经有棋子啦，请下在空的交叉点上哦！",
    'err_suicide': "这里不能下哦：不能在没有气的地方自杀，请另找生路吧！",
    'err_false_eye': "注意看！这只眼的斜角缺少保护，对手随时能破掉，是假眼哦！",
    'err_not_eye': "这里不是眼位哦！眼位是被棋子包围的空位，快找找看真正的眼位吧！",
    'err_goal': "这一步没有达到最佳效果呢，可以点看原理图解复习一下技巧哦！",
    'err_liberty': "唔~ 这个点不是它的气哦，仔细看跟它上下左右直接连着的十字线！",
}

# 全部 40 关针对性答错/陷阱提示音（当小朋友点击错误落子或陷阱点时，导师温柔指出棋理）
PUZZLE_WRONG_PROMPTS = {
    1: "唔~ 这个点不是小黑棋的气哦，仔细看跟它上下左右十字相连的四个空位！",
    2: "注意看！角上的白棋两面是墙壁，只有两口气哦，请点出那两个空交叉点！",
    3: "哎呀！白棋最后一口气在正右边，快下在正右边把白棋提掉！",
    4: "哎呀！走在这里没能叫吃白棋哦，再想想哪一步能让白棋只剩一口气！",
    5: "下在斜角没法救小黑棋哦，要下在正右边紧挨着的那口气上！",
    6: "请找一找被四颗白棋堵在正中间、黑棋不能下的禁着点空位哦！",
    7: "哎呀！如果直接挡在上方门缝，白棋就溜走啦！应该先下在白棋正右边把大门关紧哦！",
    8: "哎呀！如果往外推白棋就逃跑啦！应该下在白棋正右边，把它往黑棋怀抱里赶哦！",
    9: "哎呀！下在旁边就只剩一只眼啦！要下在正中间的天元点才能隔出两只真眼哦！",
    10: "方向反啦！如果从右边打吃白棋就逃跑啦，看右上角有黑棋埋伏，应该从白棋正下方打吃！",
    11: "从外面打吃只能捉住一只白棋，它往回一连就逃跑啦！请走在正中间同时打吃两边哦！",
    12: "贴着白棋打吃是下策哦，白棋钻空子就逃跑啦！请在斜前方下一子，用飞枷大网罩住它！",
    13: "直接叫吃是抓不到白棋的，要先往虎口里扑进去送吃倒扑哦！",
    14: "下在这里虽然也是气，但直接切断要害，一步提吃3颗白子才是最佳妙手哦！",
    15: "下得太远啦，白棋自己连成坚固的城堡啦！要抢先挖在中间切断哦！",
    16: "注意看！这只眼的斜角缺少保护，对手随时能破掉，是假眼哦！",
    17: "点在旁边偏了哦！白棋立刻抢占中心做活啦！一定要抢占正中间的急所！",
    18: "走偏啦！大猪嘴的破眼急所在二路关键交叉点哦！",
    19: "硬冲会被白棋挡住哦！要像小老鼠偷油一样从一路妙手潜入！",
    20: "下在旁边会被白棋立刻吃掉哦！要坚决立下，让白棋两边都不能进！",
    21: "点在边上的空位没打中命门！白棋抢占中心就能做活啦！一定要点在丁字正中心！",
    22: "下偏啦！刀把五的核心急所在正中间！",
    23: "点在花瓣上啦！白棋抢占花蕊就活棋啦！一定要点在正中间花蕊！",
    24: "挡在三路太靠上了，白棋会从二路溜走！必须堵在二路！",
    25: "哎呀！填在公气上了！填公气会自己紧自己的气！必须从外面收紧白棋的外气！",
    26: "从外面紧气太慢啦！必须扑入虎口紧白棋的气！",
    27: "从上方硬冲会被白棋反弹撞碎！要在二路下水托连络！",
    28: "方向打错啦！打到另一边白棋逃脱啦！要拐弯打吃！",
    29: "退后啦！要在最前沿勇敢扳过去压制白棋！",
    30: "偏了一格！断点正中心在天元！",
    31: "哎呀！选择 A 贪吃死子只得 1 目小利；而选择 B 占星位开拆足足能圈出 12 目大庄园！快试试点 B 吧！",
    32: "哎呀！选择 A 提两颗小死子只得 2 目小利；而选择 B 占右上大角足足能圈出 15 目大庄园！快试试点 B 吧！",
    33: "哎呀！选择 A 贪吃一颗死子只得 1 目小利；而选择 B 抢占金角足足能圈出 10 目大庄园！快试试点 B 吧！",
    34: "哎呀！下在二路三路太慢啦，大局要抢先占据星位大场哦！",
    35: "哎呀！选择 A 贪吃一子只得 1 目小利；而选择 B 抢占大场足足能圈出 12 目大庄园！快试试点 B 吧！",
    36: "哎呀！选择 A 贪吃一子只得 1 目小利；而选择 B 宽阔大场足足能圈出 15 目大庄园！快试试点 B 吧！",
    37: "哎呀！落子靠边太拘泥局部啦，中腹广阔大场更能形成立体大庄园！",
    38: "哎呀！往后退让只守住几个点，在外围勇于立起厚势才能控制大局！",
    39: "哎呀！往外逃跑容易被白棋截杀，顺势就地做活才是最稳妥的大局判断！",
    40: "哎呀！被对手牵着鼻子走会错失良机，抢占中腹要津才能赢下全局！"
}

def clean_text(raw_text):
    if not raw_text:
        return ""
    t = re.sub(r'<[^>]+>', '', raw_text)
    t = re.sub(r'[★*#_`~💡🎉🏆🌿📖🎯✓✗👑🗡️🌸🐢👁️‍🗨️⚡🌊🌀🦅🌾🧘🛡️⚔️🕊️⚖️🎁【】]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

async def generate_clip(sem, text, voice_name, rate, pitch, out_path, label):
    async with sem:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        try:
            communicate = edge_tts.Communicate(text, voice_name, rate=rate, pitch=pitch)
            await communicate.save(out_path)
            size_kb = os.path.getsize(out_path) / 1024
            print(f"✅ [生成成功] {label} ({size_kb:.1f} KB)")
        except Exception as e:
            print(f"❌ [合成失败] {label}: {e}")

async def main():
    sem = asyncio.Semaphore(5)
    tasks = []

    # 1. 组装全局通用提示音片段
    all_clips = []
    for clip_name, text in UNIVERSAL_PROMPTS.items():
        all_clips.append((clip_name, clean_text(text)))

    # 2. 组装40关专属错误引导片段
    for pid, text in PUZZLE_WRONG_PROMPTS.items():
        all_clips.append((f"p{pid}_wrong", clean_text(text)))

    print(f"总计规划生成 {len(all_clips)} 种提示音片段 × 4 套音色 = {len(all_clips) * 4} 个高保真 MP3 文件...")

    for pack_key, cfg in VOICE_CONFIGS.items():
        for clip_key, text in all_clips:
            out_path = os.path.join(AUDIO_DIR, pack_key, f"{clip_key}.mp3")
            label = f"{pack_key}/{clip_key}.mp3"
            tasks.append(generate_clip(sem, text, cfg['voice'], cfg['rate'], cfg['pitch'], out_path, label))

    await asyncio.gather(*tasks)
    print("\n🎉 全部提示音与错误引导语音片段生成完毕！")

if __name__ == '__main__':
    asyncio.run(main())

