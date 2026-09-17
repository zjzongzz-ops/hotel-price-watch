"""
Pydantic 数据模型定义 (支持断源降级与熔断状态)
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class ChannelPrice(BaseModel):
    platform: str
    channel_key: str
    base_price: Optional[int] = None
    wallet_price: Optional[int] = None
    breakfast: str = "--"
    cancel_policy: str = "--"
    status: str = "available" # "available" | "sold_out" | "maintenance" | "pending"
    status_text: Optional[str] = None # 如 "🔧 渠道维护中 (防爬降级隔离)"
    is_official: bool = False
    is_lowest: bool = False
    discount_text: str = ""
    source_type: str = "live" # "live" | "cached" | "baseline" | "circuit_breaker"
    url: Optional[str] = "#"

class HotelQuoteResponse(BaseModel):
    hotel_id: str
    hotel_name: str
    benchmark_room: str
    checkin_date: str
    checkout_date: str
    channels: Dict[str, ChannelPrice]
    lowest_channel: str
    lowest_price: Optional[int] = None
    max_savings: int = 0
    tactical_advice: str
    updated_at: str

class MemberProfile(BaseModel):
    active_view: str = "wallet"
    ctrip_tier: str = "diamond"   # normal, gold, diamond
    meituan_tier: str = "shen"    # normal, shen
    huazhu_tier: str = "platinum" # normal, gold, platinum

class QuoteRequest(BaseModel):
    hotel_id: str
    checkin: str = "2026-09-16"
    checkout: str = "2026-09-17"
    member_profile: MemberProfile = MemberProfile()
    fail_channel: Optional[str] = None # 用于断源熔断演示: 如 'meituan', 'ctrip'

class PushNotificationPayload(BaseModel):
    hotel_name: str
    target_price: int
    current_lowest_price: int
    channel_name: str
    pushplus_token: Optional[str] = None
    serverchan_key: Optional[str] = None

