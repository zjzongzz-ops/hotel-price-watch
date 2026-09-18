"""
美团酒店渠道适配器 (Meituan Adapter)
核心定位：覆盖率广、民宿/低星/单早套餐极具优势，神会员立减抵扣
"""
import asyncio
import httpx
from .base import BaseChannelAdapter
from ..cache import get_cached_price, set_cached_price

class MeituanAdapter(BaseChannelAdapter):
    def __init__(self):
        super().__init__("美团酒店", "meituan")

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
        cache_key = f"meituan_{hotel_name}_{checkin}"
        cached = get_cached_price(cache_key)
        if cached:
            return self._apply_member_rule(cached, member_profile, source=cached.get("source_type", "baseline"))

        base_price = fallback_base_price
        source_type = "baseline"

        # 美团在接入正式分销联盟 API 前，如实标记为基准价格库 (baseline)
        source_type = "baseline"

        raw_result = {
            "platform": self.channel_name,
            "channel_key": self.channel_key,
            "base_price": base_price,
            "breakfast": "含单早",
            "cancel_policy": "入住前1天24:00前可免费取消",
            "status": "available",
            "is_official": False,
            "url": "https://i.meituan.com/awp/h5/hotel/search/search.html"
        }

        set_cached_price(cache_key, raw_result, ttl=7200)
        return self._apply_member_rule(raw_result, member_profile, source=source_type)

    def _apply_member_rule(self, raw: dict, profile: dict, source: str) -> dict:
        base = raw["base_price"]
        tier = profile.get("meituan_tier", "shen")
        active_view = profile.get("active_view", "wallet")
        
        wallet_price = base
        discount_text = "美团公开标价"
        
        if active_view == "wallet":
            if tier == "shen":
                wallet_price = max(1, base - 30)
                discount_text = "美团神会员立减 ¥30"
            else:
                discount_text = "美团普通用户标价"

        return {
            **raw,
            "wallet_price": wallet_price,
            "discount_text": discount_text,
            "source_type": source
        }
