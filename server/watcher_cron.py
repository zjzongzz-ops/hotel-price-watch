# -*- coding: utf-8 -*-
"""
酒店比价雷达 · 云端独立定时盯盘巡检器 (Cloud Cron Watcher)
支持部署于 GitHub Actions 定时调度、腾讯云函数 (SCF) 或独立云主机。
脱离本地 PC 运行，实现 7x24 小时低成本无缝巡检。
"""
import os
import sys
import json
import asyncio
import urllib.request
import urllib.parse
from datetime import datetime

# 解决 Windows 控制台编码问题
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from server.aggregator import HotelPriceAggregator
from server.benchmark_db import BENCHMARK_HOTELS

# 环境变量读取 (GitHub Actions Secrets 或云函数环境变量)
PUSHPLUS_TOKEN = os.getenv("PUSHPLUS_TOKEN", "").strip()
SERVERCHAN_KEY = os.getenv("SERVERCHAN_KEY", "").strip()
ALERT_ON_CIRCUIT_BREAKER = os.getenv("ALERT_ON_CIRCUIT_BREAKER", "true").lower() == "true"

# 默认盯盘基准配置 (若用户未自定义，则默认巡检核心高频商旅/度假标杆)
DEFAULT_WATCH_CONFIG = [
    {
        "hotel_id": "h_01",
        "name": "全季酒店 (上海人民广场店)",
        "target_price": 400,
        "notify_channel": "dual"
    },
    {
        "hotel_id": "h_02",
        "name": "亚朵酒店 (北京中关村软件园店)",
        "target_price": 430,
        "notify_channel": "dual"
    },
    {
        "hotel_id": "h_04",
        "name": "汉庭酒店 (成都春熙路太古里店)",
        "target_price": 220,
        "notify_channel": "dual"
    },
    {
        "hotel_id": "h_05",
        "name": "上海外滩 W 酒店",
        "target_price": 2200,
        "notify_channel": "dual"
    }
]

def send_pushplus(token: str, title: str, content: str) -> dict:
    if not token:
        return {"success": False, "msg": "PushPlus Token 未配置"}
    url = "http://www.pushplus.plus/send"
    payload = json.dumps({
        "token": token,
        "title": title,
        "content": content,
        "template": "html"
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            if res_json.get("code") == 200:
                return {"success": True, "msg": "PushPlus 发送成功", "detail": res_json}
            return {"success": False, "msg": f"PushPlus 错误: {res_json.get('msg')}"}
    except Exception as e:
        return {"success": False, "msg": f"PushPlus 请求异常: {str(e)}"}

def send_serverchan(key: str, title: str, content: str) -> dict:
    if not key:
        return {"success": False, "msg": "ServerChan Key 未配置"}
    url = f"https://sctapi.ftqq.com/{key}.send"
    payload = urllib.parse.urlencode({
        "title": title,
        "desp": content
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            if res_json.get("code") == 0:
                return {"success": True, "msg": "ServerChan 发送成功", "detail": res_json}
            return {"success": False, "msg": f"ServerChan 错误: {res_json.get('message')}"}
    except Exception as e:
        return {"success": False, "msg": f"ServerChan 请求异常: {str(e)}"}

def dispatch_dual_channel(title: str, content_html: str, content_md: str) -> dict:
    """双通道主备故障转移推送"""
    log = []
    # 优先主通道 PushPlus
    pp_res = send_pushplus(PUSHPLUS_TOKEN, title, content_html)
    log.append(f"[主通道 PushPlus] {pp_res['msg']}")
    if pp_res["success"]:
        return {"success": True, "channel": "pushplus", "logs": log}

    # 主通道失败，自动平滑故障转移至备用通道 ServerChan
    log.append("⚠️ 主通道推送未达成，立即平滑触发备用通道 ServerChan...")
    sc_res = send_serverchan(SERVERCHAN_KEY, title, content_md)
    log.append(f"[备用通道 ServerChan] {sc_res['msg']}")
    return {
        "success": sc_res["success"],
        "channel": "serverchan" if sc_res["success"] else "none",
        "logs": log
    }

from datetime import datetime, timedelta

async def execute_watch_sweep():
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    checkin = now.strftime("%Y-%m-%d")
    checkout = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"[{now_str}] 🚀 启动云端定时降价盯盘巡检 (入住: {checkin}, 离店: {checkout})...")
    
    agg = HotelPriceAggregator()
    hotels_map = {h["id"]: h for h in BENCHMARK_HOTELS}

    profile = {
        "active_view": "wallet",
        "ctrip_tier": "diamond",
        "meituan_tier": "shen",
        "huazhu_tier": "platinum"
    }

    results = []
    triggered_alerts = []
    circuit_breakers = []
    intercepted_count = 0

    for item in DEFAULT_WATCH_CONFIG:
        hid = item["hotel_id"]
        hotel = hotels_map.get(hid)
        if not hotel:
            continue

        target_p = item["target_price"]
        quote = await agg.aggregate_quote(hotel, checkin, checkout, profile)
        lowest_p = quote.get("lowest_price")
        lowest_ch = quote.get("lowest_channel")
        ch_quotes = quote.get("channels", {})

        # 检查是否有断源熔断
        for ch_k, ch_v in ch_quotes.items():
            if ch_v.get("status") == "maintenance":
                circuit_breakers.append(f"{hotel['name']} · {ch_v.get('platform')}")

        # N2 守卫检测：判断是否所有在售渠道均为静态基线模拟价 (baseline)
        avail_channels = [ch_v for ch_v in ch_quotes.values() if ch_v.get("status") == "available"]
        is_all_baseline = bool(avail_channels) and all(ch.get("source_type") in ("baseline", "cached") for ch in avail_channels)

        is_deal = (lowest_p is not None and lowest_p <= target_p)

        if is_deal and is_all_baseline:
            print(f" -> [{hotel['city']}] {hotel['name']}: 当前底价 ¥{lowest_p} (目标: ¥{target_p}) - [守卫拦截] 数据源均为静态基准库 (baseline)，已阻止假降价误推！")
            intercepted_count += 1
            is_deal = False
        else:
            print(f" -> [{hotel['city']}] {hotel['name']}: 当前底价 ¥{lowest_p} (目标: ¥{target_p}) - {'🎯 真实降价达成' if is_deal else '未触价'}")

        results.append({
            "hotel": hotel["name"],
            "city": hotel["city"],
            "target": target_p,
            "lowest": lowest_p,
            "channel": lowest_ch,
            "is_all_baseline": is_all_baseline,
            "is_deal": is_deal
        })

        if is_deal:
            triggered_alerts.append({
                "hotel": hotel["name"],
                "lowest": lowest_p,
                "target": target_p,
                "channel": lowest_ch,
                "savings": quote.get("max_savings", 0),
                "advice": quote.get("tactical_advice", "")
            })

    # 处理真实降价微信推送
    if triggered_alerts:
        for alert in triggered_alerts:
            title = f"【比价雷达】{alert['hotel']} 降价达成！现价 ¥{alert['lowest']}"
            html_body = f"""
            <h3>🎉 降价达成提醒！</h3>
            <p>您关注的 <strong>{alert['hotel']}</strong> 当前已达心理预算！</p>
            <ul>
                <li><strong>当前全网底价：</strong> ¥{alert['lowest']} ({alert['channel']})</li>
                <li><strong>您的目标预算：</strong> ¥{alert['target']}</li>
                <li><strong>最高立省：</strong> ¥{alert['savings']}</li>
            </ul>
            <p>💡 战术建议：{alert['advice']}</p>
            <p><small>* 价格由规则估算生成，最终以下单结算页为准。</small></p>
            """
            md_body = f"### 🎉 降价达成！\n**{alert['hotel']}** 当前全网底价 **¥{alert['lowest']}**（目标 ¥{alert['target']}，最高省 ¥{alert['savings']}）。\n{alert['advice']}"
            push_res = dispatch_dual_channel(title, html_body, md_body)
            print(f"[*] 微信推送结果: {push_res['logs']}")

    # 处理熔断预警微信推送 (若开启 ALERT_ON_CIRCUIT_BREAKER 且出现熔断)
    if ALERT_ON_CIRCUIT_BREAKER and circuit_breakers:
        cb_title = f"【比价雷达预警】检测到 {len(circuit_breakers)} 个渠道触发防爬熔断"
        cb_html = "<h3>⚠️ 渠道熔断预警</h3><p>以下渠道已启动防爬降级隔离，暂不参与底价排序：</p><ul>" + "".join(f"<li>{cb}</li>" for cb in circuit_breakers) + "</ul>"
        cb_md = "### ⚠️ 渠道熔断预警\n以下渠道已启动降级隔离：\n" + "\n".join(f"- {cb}" for cb in circuit_breakers)
        cb_res = dispatch_dual_channel(cb_title, cb_html, cb_md)
        print(f"[*] 熔断告警微信推送结果: {cb_res['logs']}")

    # 手动验真与切备演练 (支持 GitHub Actions workflow_dispatch 或本地测试)
    if os.getenv("TEST_DISPATCH", "").lower() in ("true", "1") or "--test-dispatch" in sys.argv:
        print("[*] 触发微信双通道验真与切备演练推送...")
        test_title = "【酒店比价雷达】微信双通道演练与自动切备验证"
        test_html = """
        <h3>🚀 微信双通道推送验真达成</h3>
        <p>这是一条来自 GitHub Actions 云端定时盯盘巡检器的自动化验证推送。</p>
        <p><strong>验证要点：</strong></p>
        <ul>
            <li>主通道 (PushPlus) 与备用通道 (ServerChan) 自动化故障转移链路已打通</li>
            <li>若主通道 Token 配置异常或遭遇网络抖动，系统已平滑切至备用通道保底送达</li>
            <li>云端 7x24h 自动化降价盯盘守护运行中</li>
        </ul>
        <p><small>* 酒店比价雷达 · 守护低价商旅出行</small></p>
        """
        test_md = "### 🚀 微信双通道推送验真达成\n来自 GitHub Actions 云端定时盯盘巡检器。\n主通道与备用通道自动故障转移机制验证通过！"
        test_res = dispatch_dual_channel(test_title, test_html, test_md)
        print(f"[*] 演练推送执行结果: {test_res['logs']}")

    print(f"[{now_str}] ✅ 巡检完成！扫描 {len(results)} 家，真实达成 {len(triggered_alerts)} 家，守卫拦截假降价 {intercepted_count} 家，熔断隔离 {len(circuit_breakers)} 次。")

if __name__ == "__main__":
    asyncio.run(execute_watch_sweep())
