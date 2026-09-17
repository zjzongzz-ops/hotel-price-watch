"""
跨平台适配器抽象基类
"""
import random
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

USER_AGENTS = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40"
]

class BaseChannelAdapter(ABC):
    def __init__(self, channel_name: str, channel_key: str):
        self.channel_name = channel_name
        self.channel_key = channel_key

    def get_random_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Connection": "keep-alive"
        }

    @abstractmethod
    async def fetch_quote(
        self, 
        hotel_name: str, 
        city: str, 
        checkin: str, 
        checkout: str,
        benchmark_room: str,
        fallback_base_price: int,
        member_profile: dict
    ) -> Dict[str, Any]:
        """抓取并标准化该渠道该房型的价格"""
        pass
