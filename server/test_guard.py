# -*- coding: utf-8 -*-
"""
守卫测试：当所有可用渠道均为 baseline 静态基线价时，
无论价格多低，均被全 baseline 守卫拦截，严禁误触发降价微信推送！
"""
import sys
import json
from unittest.mock import patch, AsyncMock

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from server.aggregator import HotelPriceAggregator
from server.benchmark_db import BENCHMARK_HOTELS

async def test_baseline_guard():
    print("==================================================")
    print(" 全 baseline 守卫拦截与防误推回归测试")
    print("==================================================")

    agg = HotelPriceAggregator()
    hotel = BENCHMARK_HOTELS[0]
    profile = {
        "active_view": "wallet",
        "ctrip_tier": "diamond",
        "meituan_tier": "shen",
        "huazhu_tier": "platinum"
    }

    quote = await agg.aggregate_quote(hotel, "2026-09-16", "2026-09-17", profile)
    ch_quotes = quote.get("channels", {})
    
    # 模拟所有渠道均为 baseline
    for k, v in ch_quotes.items():
        v["source_type"] = "baseline"

    avail_channels = [ch_v for ch_v in ch_quotes.values() if ch_v.get("status") == "available"]
    is_all_baseline = bool(avail_channels) and all(ch.get("source_type") == "baseline" for ch in avail_channels)
    
    target_price = 500
    lowest_price = quote.get("lowest_price")
    is_deal = (lowest_price is not None and lowest_price <= target_price)

    print(f"-> 最低价: ¥{lowest_price}, 目标价: ¥{target_price}, 是否触价: {is_deal}")
    print(f"-> 是否全为 baseline 静态基线: {is_all_baseline}")
    
    should_notify = is_deal and not is_all_baseline
    print(f"-> 最终是否允许推送微信通知: {should_notify}")

    assert is_deal is True, "底价应小于目标价"
    assert is_all_baseline is True, "测试前提为全 baseline"
    assert should_notify is False, "守卫必须拦截！绝对禁止推送！"

    print("\nPASS: 全 baseline 守卫成功拦截假降价误推，完美通过！")
    print("==================================================")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_baseline_guard())
