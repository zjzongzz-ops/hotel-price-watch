# -*- coding: utf-8 -*-
"""
V2 跨平台酒店身份对齐与双要素验真匹配引擎 (server/matcher.py)
严格遵守证据纪律与质量闸门：
1. 实体对齐：基于品牌、城市、分店特征进行跨平台身份对齐
2. 质量闸门联动：任何生成的非首页深链必须通过 verify_deep_links 实网双要素核验
3. 宁缺毋滥降级：若核验不通过或置信度存疑，强制安全回退至官方搜价入口，严禁乱配错店
"""
import re
from typing import Dict, Any, List, Optional
from datetime import datetime
from difflib import SequenceMatcher

from server.benchmark_db import BENCHMARK_HOTELS
from server.verify_deep_links import verify_single_url, BASE_CHANNEL_HOMEPAGES

HUAZHU_BRANDS = [
    "全季", "汉庭", "桔子水晶", "桔子", "海友", "漫心", "宜必思", "禧玥", "花间堂", "城家"
]

BRAND_DEFAULT_PRICES = {
    "汉庭": 240,
    "海友": 180,
    "全季": 450,
    "桔子": 460,
    "桔子水晶": 620,
    "亚朵": 560,
    "漫心": 580,
    "W 酒店": 2400,
    "W酒店": 2400,
    "香格里拉": 1800,
    "四季": 3500,
    "博舍": 2600,
    "亚特兰蒂斯": 2800,
    "裸心堡": 2200,
    "威斯汀": 1400,
    "金陵饭店": 880,
    "凯悦": 980,
    "安达仕": 1600,
    "白天鹅": 1500
}

class CrossPlatformMatcher:
    def __init__(self):
        self.benchmark_hotels = BENCHMARK_HOTELS

    def _similarity(self, a: str, b: str) -> float:
        """计算两字符串相似度"""
        return SequenceMatcher(None, a, b).ratio()

    def find_benchmark_match(self, hotel_name: str, city: str, brand: str) -> tuple:
        """
        在 20 家基准库中寻找高置信度同名分店
        返回: (matched_hotel, confidence_score)
        严格防范张冠李戴：分店名/地标关键词若不一致，判定为未命中基准库
        """
        best_match = None
        best_score = 0.0

        clean_name = re.sub(r'[\(\)（）\·\s]', '', hotel_name).lower()

        # 提取分店/地标特征词 (如 "人民广场", "春熙路", "裸心谷", "中关村")
        branch_pat = r'[\(（]([^\)）]+)[\)）]'
        input_branch_m = re.search(branch_pat, hotel_name)
        input_branch = input_branch_m.group(1).strip().lower() if input_branch_m else ""

        for h in self.benchmark_hotels:
            h_clean = re.sub(r'[\(\)（）\·\s]', '', h["name"]).lower()

            # 1. 检查括号分店词冲突
            h_branch_m = re.search(branch_pat, h["name"])
            h_branch = h_branch_m.group(1).strip().lower() if h_branch_m else ""

            if input_branch and h_branch:
                b1 = input_branch.replace("店", "").replace("分店", "")
                b2 = h_branch.replace("店", "").replace("分店", "")
                if b1 not in b2 and b2 not in b1:
                    continue  # 分店名明显冲突，绝对不视作同一分店
            elif input_branch and not h_branch:
                b1 = input_branch.replace("店", "").replace("分店", "")
                if b1 not in h_clean:
                    continue
            elif not input_branch and h_branch:
                b2 = h_branch.replace("店", "").replace("分店", "")
                if b2 not in clean_name:
                    continue

            # 2. 检查地标特定词冲突 (例如 "裸心谷" vs "裸心堡", "大雁塔" vs "钟楼")
            conflict_detected = False
            for pair in [("裸心谷", "裸心堡"), ("大雁塔", "小雁塔"), ("东站", "西站"), ("南站", "北站")]:
                if (pair[0] in clean_name and pair[1] in h_clean) or (pair[1] in clean_name and pair[0] in h_clean):
                    conflict_detected = True
                    break
            if conflict_detected:
                continue

            score = self._similarity(clean_name, h_clean)

            # 城市一致性加权
            if city and (city in h["city"] or h["city"] in city):
                score += 0.15
            else:
                score -= 0.30

            # 品牌一致性加权
            if brand and (brand in h["brand"] or h["brand"] in brand):
                score += 0.15

            if score > best_score:
                best_score = score
                best_match = h

        # 置信度阈值：>= 0.75 且分店/品牌一致方可视为有效命中
        if best_match and best_score >= 0.75:
            return best_match, min(1.0, round(best_score, 2))
        return None, round(max(0.0, best_score), 2)

    def match_and_build_quote(
        self, 
        parsed_entity: dict, 
        source_platform: str, 
        source_url: str = "",
        member_profile: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        综合跨平台匹配与比价卡片构建入口
        """
        if not member_profile:
            member_profile = {
                "active_view": "wallet",
                "ctrip_tier": "diamond",
                "meituan_tier": "shen",
                "huazhu_tier": "platinum"
            }

        hotel_name = parsed_entity.get("hotel_name", "待确认酒店")
        city = parsed_entity.get("city", "全国")
        brand = parsed_entity.get("brand", "精品酒店")
        room_type = parsed_entity.get("room_type", "标准大床房")
        checkin_date = parsed_entity.get("checkin_date", datetime.now().strftime("%Y-%m-%d"))
        checkout_date = parsed_entity.get("checkout_date", datetime.now().strftime("%Y-%m-%d"))
        price_hint = parsed_entity.get("price_hint")

        # 1. 尝试基准库匹配
        bench_match, confidence = self.find_benchmark_match(hotel_name, city, brand)
        is_aligned = (bench_match is not None and confidence >= 0.75)
        match_type = "benchmark_aligned" if is_aligned else "dynamic_heuristic"
        match_confidence = confidence if is_aligned else round(confidence, 2)
        is_heuristic = not is_aligned

        channels = {}
        is_huazhu_brand = any(hb in hotel_name or hb in brand for hb in HUAZHU_BRANDS)

        if is_aligned:
            # 命中基准库，继承其精准房型与基准价格配置
            anchor_base = bench_match.get("channels", {}).get("ctrip", {}).get("basePrice", 450)
            if price_hint:
                anchor_base = price_hint

            # 携程
            ctrip_base = bench_match["channels"].get("ctrip", {}).get("basePrice", anchor_base)
            ctrip_url = bench_match["channels"].get("ctrip", {}).get("url") or BASE_CHANNEL_HOMEPAGES["ctrip"]
            channels["ctrip"] = self._build_channel_item(
                platform="携程旅行",
                channel_key="ctrip",
                base_price=ctrip_base,
                url=ctrip_url,
                breakfast="无早餐",
                cancel="入住当天18:00前可免费取消",
                hotel_name=hotel_name,
                city=city,
                brand=brand,
                profile=member_profile
            )

            # 美团
            meituan_base = bench_match["channels"].get("meituan", {}).get("basePrice", round(anchor_base * 0.96))
            meituan_url = bench_match["channels"].get("meituan", {}).get("url") or BASE_CHANNEL_HOMEPAGES["meituan"]
            channels["meituan"] = self._build_channel_item(
                platform="美团酒店",
                channel_key="meituan",
                base_price=meituan_base,
                url=meituan_url,
                breakfast="含单早",
                cancel="入住前1天24:00前可免费取消",
                hotel_name=hotel_name,
                city=city,
                brand=brand,
                profile=member_profile
            )

            # 华住
            hz_data = bench_match["channels"].get("huazhu")
            if is_huazhu_brand or (hz_data and isinstance(hz_data, dict)):
                hz_base = hz_data.get("basePrice") if isinstance(hz_data, dict) else anchor_base
                hz_base = hz_base or anchor_base
                hz_url = (hz_data.get("url") if isinstance(hz_data, dict) else None) or BASE_CHANNEL_HOMEPAGES["huazhu"]
                channels["huazhu"] = self._build_channel_item(
                    platform="华住会官方",
                    channel_key="huazhu",
                    base_price=hz_base,
                    url=hz_url,
                    breakfast="含双早",
                    cancel="整晚保留 · 随时可退",
                    hotel_name=hotel_name,
                    city=city,
                    brand=brand,
                    profile=member_profile,
                    is_official=True
                )
        else:
            # 未命中基准库，执行动态启发式推算
            anchor_base = price_hint or BRAND_DEFAULT_PRICES.get(brand, 450)

            # 携程通道
            channels["ctrip"] = self._build_channel_item(
                platform="携程旅行",
                channel_key="ctrip",
                base_price=anchor_base,
                url=source_url if source_platform == "ctrip" and source_url else BASE_CHANNEL_HOMEPAGES["ctrip"],
                breakfast="无早餐",
                cancel="入住当天18:00前可退",
                hotel_name=hotel_name,
                city=city,
                brand=brand,
                profile=member_profile
            )

            # 美团通道
            channels["meituan"] = self._build_channel_item(
                platform="美团酒店",
                channel_key="meituan",
                base_price=round(anchor_base * 0.96),
                url=source_url if source_platform == "meituan" and source_url else BASE_CHANNEL_HOMEPAGES["meituan"],
                breakfast="含单早",
                cancel="入住前1天可退",
                hotel_name=hotel_name,
                city=city,
                brand=brand,
                profile=member_profile
            )

            # 华住直销（若为华住旗下品牌）
            if is_huazhu_brand:
                channels["huazhu"] = self._build_channel_item(
                    platform="华住会官方",
                    channel_key="huazhu",
                    base_price=anchor_base,
                    url=source_url if source_platform == "huazhu" and source_url else BASE_CHANNEL_HOMEPAGES["huazhu"],
                    breakfast="含双早",
                    cancel="整晚保留 · 随时可退",
                    hotel_name=hotel_name,
                    city=city,
                    brand=brand,
                    profile=member_profile,
                    is_official=True
                )

        # 计算最低价与战术建议
        valid_quotes = []
        for k, v in channels.items():
            wp = v.get("wallet_price") or v.get("base_price")
            if wp and v.get("status") == "available":
                valid_quotes.append((k, wp, v))

        lowest_key = ""
        lowest_price = None
        max_savings = 0

        if valid_quotes:
            valid_quotes.sort(key=lambda x: x[1])
            lowest_key, lowest_price, lowest_item = valid_quotes[0]
            max_p = max(x[1] for x in valid_quotes)
            max_savings = max(0, max_p - lowest_price)
            channels[lowest_key]["is_lowest"] = True

        best_name = channels[lowest_key]["platform"] if lowest_key else ""
        if is_heuristic:
            tactical_advice = f"⚠️ 该酒店未收录于基准房型库，报价由平台公开规则及佣金模型启发式推算（推算置信度 {int(match_confidence*100)}%）。当前推算底价为【{best_name}】实付 ¥{lowest_price}，相比在售渠道最高可省 ¥{max_savings}。请核实房型与最终结算价。"
        else:
            tactical_advice = f"当前全网底价为【{best_name}】实付 ¥{lowest_price}，相比在售渠道最高可省 ¥{max_savings}。"
            if lowest_key == "huazhu":
                tactical_advice += " 华住官方直销赠送双份早餐且退改政策更宽容，推荐作为首选。"

        # 生成 30 天走势模拟数据
        trend30d = self._generate_30d_trend(lowest_price or 450)

        return {
            "success": True,
            "hotel_id": f"v2_dyn_{int(datetime.now().timestamp())}",
            "hotel_name": hotel_name,
            "city": city,
            "brand": brand,
            "room_type": room_type,
            "source_platform": source_platform,
            "match_confidence": match_confidence,
            "match_type": match_type,
            "is_heuristic": is_heuristic,
            "is_weak_match": is_heuristic,
            "channels": channels,
            "lowest_channel": lowest_key,
            "lowest_price": lowest_price,
            "max_savings": max_savings,
            "tactical_advice": tactical_advice,
            "trend30d": trend30d,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def _build_channel_item(
        self, 
        platform: str, 
        channel_key: str, 
        base_price: int, 
        url: str, 
        breakfast: str, 
        cancel: str, 
        hotel_name: str, 
        city: str, 
        brand: str, 
        profile: dict,
        is_official: bool = False
    ) -> dict:
        """
        构建单渠道报价对象并严格执行【质量闸门实网校验】
        若传入深链未通过实网双要素核验，强制回退至平台基准入口！
        """
        # 联动质量闸门质检器
        check_res = verify_single_url(channel_key, hotel_name, city, brand, url)
        final_url = url
        is_verified_deep_link = False

        if check_res.get("is_deep_link"):
            if check_res.get("valid"):
                is_verified_deep_link = True
            else:
                # 质检未过，严格执行宁缺毋滥安全降级！
                final_url = BASE_CHANNEL_HOMEPAGES.get(channel_key, "https://m.ctrip.com/webapp/hotel/")
                is_verified_deep_link = False

        # 计算会员到手价 (与 server/adapters 及 js/member.js 保持统一规则)
        base_price = int(base_price or 450)
        tier = profile.get(f"{channel_key}_tier") or profile.get(channel_key) or "normal"
        active_view = profile.get("active_view") or profile.get("activeView") or "wallet"
        wallet_price = base_price
        discount_text = "公开标价"

        if active_view == "wallet":
            if channel_key == "huazhu":
                if tier == "platinum":
                    wallet_price = round(base_price * 0.85)
                    discount_text = "华住铂金 85 折 (含双早)"
                elif tier == "gold":
                    wallet_price = round(base_price * 0.88)
                    discount_text = "华住金卡 88 折 (含单早)"
                else:
                    wallet_price = round(base_price * 0.95)
                    discount_text = "华住星会员 95 折"
            elif channel_key == "meituan":
                if tier in ["shen", "gold"]:
                    wallet_price = max(1, base_price - 30)
                    discount_text = "美团神会员立减 ¥30"
                else:
                    discount_text = "美团普通标价"
            elif channel_key == "ctrip":
                if tier == "diamond":
                    wallet_price = round(base_price * 0.90)
                    discount_text = "携程钻石 9 折"
                elif tier == "gold":
                    wallet_price = round(base_price * 0.95)
                    discount_text = "携程黄金 95 折"
                else:
                    discount_text = "携程普通标价"

        return {
            "platform": platform,
            "channel_key": channel_key,
            "base_price": base_price,
            "basePrice": base_price,
            "wallet_price": wallet_price,
            "walletPrice": wallet_price,
            "discount_text": discount_text,
            "breakfast": breakfast,
            "cancel_policy": cancel,
            "cancelPolicy": cancel,
            "status": "available",
            "is_official": is_official,
            "isOfficial": is_official,
            "is_lowest": False,
            "url": final_url,
            "is_verified_deep_link": is_verified_deep_link,
            "link_type": "deep_link" if is_verified_deep_link else "base_portal_search",
            "source_type": "baseline"
        }

    def _generate_30d_trend(self, base_price: int) -> list:
        """生成 30 天预测价格日历数据"""
        from datetime import timedelta
        trend = []
        now = datetime.now()
        day_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

        for i in range(30):
            d = now + timedelta(days=i)
            weekday_idx = d.weekday() # 0 = 周一, 6 = 周日
            day_str = day_names[weekday_idx]
            
            # 周五周六上浮 20%~45%
            if weekday_idx in [4, 5]:
                ratio = 1.30 + ((i % 3) * 0.05)
                tag = "周末上浮"
            elif weekday_idx in [1, 2]:
                ratio = 0.95
                tag = "周中特惠"
            else:
                ratio = 1.0
                tag = "平日价"

            price = round(base_price * ratio)
            trend.append({
                "date": d.strftime("%Y-%m-%d"),
                "displayDate": d.strftime("%m/%d"),
                "dayOfWeek": day_str,
                "price": price,
                "tag": tag,
                "isWeekend": (weekday_idx in [4, 5])
            })
        return trend

matcher = CrossPlatformMatcher()
