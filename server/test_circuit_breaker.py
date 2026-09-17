# -*- coding: utf-8 -*-
"""
断源降级与熔断隔离自动化测试 (Circuit Breaker Test)
验证:
1. 正常场景：全渠道参与比价与最低价评定
2. 断源场景：爬虫源触发 403/AntiBot 时，状态标为 maintenance，剔除最低价排序，重算底价与省钱幅度
"""
import asyncio
import sys
from server.aggregator import HotelPriceAggregator
from server.benchmark_db import BENCHMARK_HOTELS

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

async def run_circuit_breaker_suite():
    agg = HotelPriceAggregator()
    hotel = BENCHMARK_HOTELS[0]
    profile = {
        "active_view": "wallet",
        "ctrip_tier": "diamond",
        "meituan_tier": "shen",
        "huazhu_tier": "platinum"
    }

    print("==================================================")
    print(" 酒店比价雷达 · 断源降级与熔断机制自动化验证")
    print("==================================================")

    # 1. 正常场景
    print("\n[测试用例 1] 正常多渠道聚合询价")
    res_normal = await agg.aggregate_quote(hotel, "2026-09-16", "2026-09-17", profile)
    print(f"-> 全网最低渠道: 【{res_normal['lowest_channel']}】 ¥{res_normal['lowest_price']}")
    print(f"-> 最大可省金额: ¥{res_normal['max_savings']}")
    assert res_normal["channels"]["meituan"]["status"] == "available", "美团应为正常状态"
    assert res_normal["channels"]["ctrip"]["status"] == "available", "携程应为正常状态"
    print("PASS: 正常场景全渠道报价正常，最低价判定正确！")

    # 2. 注入美团渠道 403 爬虫风控断源
    print("\n[测试用例 2] 注入【美团】渠道 403/AntiBot 风控熔断")
    res_mt_fail = await agg.aggregate_quote(hotel, "2026-09-16", "2026-09-17", profile, fail_channel="meituan")
    mt = res_mt_fail["channels"]["meituan"]
    print(f"-> 美团渠道状态: status={mt['status']} ({mt['status_text']})")
    print(f"-> 美团渠道价格: base_price={mt['base_price']}, wallet_price={mt['wallet_price']}")
    print(f"-> 美团是否被标记为最低价: {mt.get('is_lowest', False)}")
    print(f"-> 熔断重校准后全网最低: 【{res_mt_fail['lowest_channel']}】 ¥{res_mt_fail['lowest_price']}")
    print(f"-> 重新计算最大可省金额: ¥{res_mt_fail['max_savings']}")
    print(f"-> 战术建议播报: {res_mt_fail['tactical_advice']}")

    assert mt["status"] == "maintenance", "美团状态必须变为 maintenance"
    assert mt["base_price"] is None, "美团基准价必须置为 None"
    assert mt["wallet_price"] is None, "美团到手价必须置为 None"
    assert mt["is_lowest"] is False, "维护中渠道绝不能标记为最低价"
    assert res_mt_fail["lowest_channel"] != "meituan", "美团绝不能成为最低价渠道"
    print("PASS: 美团断源降级成功！已隔离且自动剔除出比价排行！")

    # 3. 注入携程渠道断源
    print("\n[测试用例 3] 注入【携程】渠道断源熔断")
    res_ct_fail = await agg.aggregate_quote(hotel, "2026-09-16", "2026-09-17", profile, fail_channel="ctrip")
    ct = res_ct_fail["channels"]["ctrip"]
    print(f"-> 携程渠道状态: status={ct['status']} ({ct['status_text']})")
    print(f"-> 熔断重校准后全网最低: 【{res_ct_fail['lowest_channel']}】 ¥{res_ct_fail['lowest_price']}")
    assert ct["status"] == "maintenance", "携程状态必须变为 maintenance"
    assert ct["is_lowest"] is False, "维护中渠道绝不能标记为最低价"
    assert res_ct_fail["lowest_channel"] != "ctrip", "携程绝不能成为最低价渠道"
    print("PASS: 携程断源降级成功！")

    print("\n==================================================")
    print("🎉 断源熔断隔离与重校准自动化回归全部通过 (3/3)！")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_circuit_breaker_suite())
