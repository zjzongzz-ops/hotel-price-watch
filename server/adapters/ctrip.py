"""
携程旅行渠道适配器 (Ctrip Adapter)
核心定位：全国覆盖率第一、商旅退改条款宽容、钻石/黄金会员专享折
"""
import asyncio
from .base import BaseChannelAdapter
from ..cache import get_cached_price, set_cached_price

class CtripAdapter(BaseChannelAdapter):
    def __init__(self):
        super().__init__("携程旅行", "ctrip")

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
        cache_key = f"ctrip_{hotel_name}_{checkin}"
        cached = get_cached_price(cache_key)
        if cached:
            return self._apply_member_rule(cached, member_profile, source=cached.get("source_type", "baseline"))

        base_price = fallback_base_price
        source_type = "baseline"

        # 携程在接入正式企业联盟 API 前，如实标记为基准价格库 (baseline)
        source_type = "baseline"

        raw_result = {
            "platform": self.channel_name,
            "channel_key": self.channel_key,
            "base_price": base_price,
            "breakfast": "无早餐",
            "cancel_policy": "入住当天18:00前可免费取消",
            "status": "available",
            "is_official": False,
            "url": "https://m.ctrip.com"
        }

        set_cached_price(cache_key, raw_result, ttl=7200)
        return self._apply_member_rule(raw_result, member_profile, source=source_type)

    def _apply_member_rule(self, raw: dict, profile: dict, source: str) -> dict:
        base = raw["base_price"]
        tier = profile.get("ctrip_tier", "diamond")
        active_view = profile.get("active_view", "wallet")
        
        wallet_price = base
        discount_text = "携程标准挂牌价"
        
        if active_view == "wallet":
            if tier == "diamond":
                wallet_price = round(base * 0.90)
                discount_text = "携程钻石 9 折"
            elif tier == "gold":
                wallet_price = round(base * 0.95)
                discount_text = "携程黄金 95 折"
            else:
                discount_text = "携程普通用户标价"

        return {
            **raw,
            "wallet_price": wallet_price,
            "discount_text": discount_text,
            "source_type": source
        }
