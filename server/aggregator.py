"""
多渠道比价聚合调度器 (Multi-Channel Aggregator)
具备断源熔断、风控降级隔离与全网底价重校准机制
"""
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from .adapters.huazhu import HuazhuAdapter
from .adapters.meituan import MeituanAdapter
from .adapters.ctrip import CtripAdapter

PLATFORM_NAMES = {
    "huazhu": "华住会官方直销",
    "meituan": "美团酒店",
    "ctrip": "携程旅行",
    "fliggy": "飞猪旅行"
}

class HotelPriceAggregator:
    def __init__(self):
        self.adapters = {
            "huazhu": HuazhuAdapter(),
            "meituan": MeituanAdapter(),
            "ctrip": CtripAdapter()
        }

    async def aggregate_quote(
        self,
        hotel: dict,
        checkin: str,
        checkout: str,
        member_profile: dict,
        fail_channel: Optional[str] = None # 用于故障注入与断源模拟 (如 "meituan" / "ctrip")
    ) -> dict:
        hotel_id = hotel["id"]
        hotel_name = hotel["name"]
        city = hotel["city"]
        benchmark_room = hotel["benchmarkRoom"]
        channels_cfg = hotel["channels"]

        tasks = []
        enabled_keys = []

        for key in ["huazhu", "meituan", "ctrip"]:
            ch_data = channels_cfg.get(key)
            if ch_data and ch_data.get("status") == "available":
                # 检查是否被注入断源故障
                if fail_channel and fail_channel == key:
                    async def mock_failed_fetch():
                        raise ConnectionResetError(f"Simulated AntiBot blocking / 403 Forbidden on {key}")
                    tasks.append(mock_failed_fetch())
                else:
                    adapter = self.adapters[key]
                    base_p = ch_data.get("basePrice", 450)
                    tasks.append(
                        adapter.fetch_quote(
                            hotel_name=hotel_name,
                            city=city,
                            checkin=checkin,
                            checkout=checkout,
                            benchmark_room=benchmark_room,
                            fallback_base_price=base_p,
                            member_profile=member_profile
                        )
                    )
                enabled_keys.append(key)

        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        channel_quotes = {}
        valid_quotes = []
        failed_channels = []

        for key, res in zip(enabled_keys, results):
            # 判断是否异常或返回维护态
            if isinstance(res, Exception) or (isinstance(res, dict) and res.get("status") == "maintenance"):
                failed_channels.append(PLATFORM_NAMES.get(key, key))
                channel_quotes[key] = {
                    "platform": PLATFORM_NAMES.get(key, key),
                    "channel_key": key,
                    "base_price": None,
                    "wallet_price": None,
                    "breakfast": "--",
                    "cancel_policy": "--",
                    "status": "maintenance",
                    "status_text": "🔧 渠道维护中 (已启动防爬降级隔离)",
                    "is_official": (key == "huazhu"),
                    "is_lowest": False,
                    "discount_text": "源端风控熔断，已自动隔离且不参与比价",
                    "source_type": "circuit_breaker",
                    "url": None
                }
                continue

            channel_quotes[key] = res
            p = res.get("wallet_price", res.get("base_price"))
            if p is not None and p > 0:
                valid_quotes.append((key, p, res))

        # 重新在有效渠道中计算最低价与最高立省
        lowest_price = None
        lowest_key = ""
        max_savings = 0

        if valid_quotes:
            valid_quotes.sort(key=lambda x: x[1]) # 按实付价升序排序
            lowest_key, lowest_price, lowest_res = valid_quotes[0]
            max_price = max(x[1] for x in valid_quotes)
            max_savings = max(0, max_price - lowest_price)

            # 标记最低价渠道
            channel_quotes[lowest_key]["is_lowest"] = True

        # 生成战术建议
        if lowest_key and lowest_key in channel_quotes:
            best_name = channel_quotes[lowest_key].get("platform", "")
            advice = f"当前全网底价为【{best_name}】实付 ¥{lowest_price}，相比在售渠道最高可省 ¥{max_savings}。"
            if lowest_key == "huazhu":
                advice += " 华住官方直销赠送双份早餐且退改政策更宽容，推荐作为首选。"
        else:
            advice = "当前所有比价渠道均处于维护中或已满房，建议直接致电酒店前台或通过官方微信小程序预订。"

        if failed_channels:
            advice += f" ⚠️ 提示：检测到【{'、'.join(failed_channels)}】触发源端防爬风控/维护熔断，已启动安全降级隔离，该渠道暂不参与底价排行，剩余正常渠道已重新校准底价。"

        return {
            "hotel_id": hotel_id,
            "hotel_name": hotel_name,
            "city": city,
            "benchmark_room": benchmark_room,
            "checkin_date": checkin,
            "checkout_date": checkout,
            "channels": channel_quotes,
            "lowest_channel": lowest_key,
            "lowest_price": lowest_price,
            "max_savings": max_savings,
            "tactical_advice": advice,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

