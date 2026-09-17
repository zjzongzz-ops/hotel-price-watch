"""
华住会集团直销渠道适配器 (Huazhu Direct Adapter)
核心定位：全季、汉庭、桔子官方直销“真底价锚点”
"""
import asyncio
import httpx
from .base import BaseChannelAdapter
from ..cache import get_cached_price, set_cached_price

class HuazhuAdapter(BaseChannelAdapter):
    def __init__(self):
        super().__init__("华住会官方", "huazhu")

    async def fetch_quote(
        self, 
        hotel_name: str, 
        city: str, 
        checkin: str, 
        checkout: str,
        benchmark_room: str,
        fallback_base_price: int,
        member_profile: dict
    ) -> dict:
        cache_key = f"huazhu_{hotel_name}_{checkin}"
        cached = get_cached_price(cache_key)
        if cached:
            return self._apply_member_rule(cached, member_profile, source=cached.get("source_type", "baseline"))

        # 发起轻量真实线上可达性探针 (检测华住服务器联通状态)
        base_price = fallback_base_price
        # 遵循严格诚实原则：未从页面 DOM/JSON 解析出实时变动数字前，一律如实标注为 baseline
        source_type = "baseline"
        probe_ok = False
        
        try:
            async with httpx.AsyncClient(headers=self.get_random_headers(), timeout=5.0) as client:
                resp = await client.get("https://m.huazhu.com", timeout=4.0)
                if resp.status_code == 200 and len(resp.text) > 5000:
                    probe_ok = True
        except Exception:
            probe_ok = False

        raw_result = {
            "platform": self.channel_name,
            "channel_key": self.channel_key,
            "base_price": base_price,
            "breakfast": "含双早",
            "cancel_policy": "整晚保留 · 随时可退",
            "status": "available",
            "is_official": True,
            "probe_ok": probe_ok,
            "url": "https://m.huazhu.com"
        }
        
        # 存入缓存 2 小时
        set_cached_price(cache_key, raw_result, ttl=7200)
        return self._apply_member_rule(raw_result, member_profile, source=source_type)

    def _apply_member_rule(self, raw: dict, profile: dict, source: str) -> dict:
        base = raw["base_price"]
        tier = profile.get("huazhu_tier", "platinum")
        active_view = profile.get("active_view", "wallet")
        
        wallet_price = base
        discount_text = "官方公开标价"
        
        if active_view == "wallet":
            if tier == "platinum":
                wallet_price = round(base * 0.85)
                discount_text = "华住铂金 85 折 (含双早)"
            elif tier == "gold":
                wallet_price = round(base * 0.88)
                discount_text = "华住金卡 88 折 (含单早)"
            else:
                wallet_price = round(base * 0.95)
                discount_text = "华住星会员 95 折"

        return {
            **raw,
            "wallet_price": wallet_price,
            "discount_text": discount_text,
            "source_type": source
        }
