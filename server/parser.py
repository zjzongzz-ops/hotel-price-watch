# -*- coding: utf-8 -*-
"""
V2 智能解析引擎 (server/parser.py)
用于解析用户在手机端复制的各 OTA（携程、美团、华住、飞猪等）分享文本与链接
严格遵循证据纪律：实事求是提取实体，杜绝虚构。
"""
import re
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

KNOWN_CITIES = [
    "上海", "北京", "杭州", "成都", "三亚", "广州", "深圳", "西安", 
    "南京", "武汉", "重庆", "厦门", "青岛", "苏州", "长沙", "天津", 
    "郑州", "昆明", "大连", "珠海", "湖州", "莫干山"
]

KNOWN_BRANDS = [
    "全季", "汉庭", "桔子水晶", "桔子", "亚朵", "W 酒店", "W酒店", 
    "香格里拉", "四季", "博舍", "亚特兰蒂斯", "白天鹅", "裸心堡", 
    "威斯汀", "金陵饭店", "凯悦", "洲际", "安达仕", "喜来登", "万豪"
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
}

class OTAHotelParser:
    def __init__(self):
        pass

    def extract_urls(self, text: str) -> list:
        """提取文本中所有 URL"""
        pattern = r'https?://[^\s\u4e00-\u9fa5<>"\')]+'
        matches = re.findall(pattern, text)
        return [m.strip().rstrip('.,;!?') for m in matches]

    def resolve_redirect_url(self, url: str) -> str:
        """如果为短链或跳转链，跟随重定向获取最终落地 URL"""
        if not url:
            return ""
        short_domains = ["t.ctrip.cn", "dpurl.cn", "tb.cn", "s.meituan.com", "c.tb.cn"]
        is_short = any(sd in url for sd in short_domains)
        if not is_short:
            return url

        try:
            req = urllib.request.Request(url, headers=HEADERS, method='HEAD')
            with urllib.request.urlopen(req, timeout=4) as resp:
                return resp.geturl()
        except Exception:
            try:
                req = urllib.request.Request(url, headers=HEADERS)
                with urllib.request.urlopen(req, timeout=4) as resp:
                    return resp.geturl()
            except Exception:
                return url

    def identify_platform(self, text: str, url: str) -> str:
        """识别来源渠道平台"""
        combined = f"{text} {url}".lower()
        if "ctrip.com" in combined or "携程" in combined or "t.ctrip.cn" in combined:
            return "ctrip"
        if "meituan.com" in combined or "美团" in combined or "dianping.com" in combined or "dpurl.cn" in combined:
            return "meituan"
        if "huazhu.com" in combined or "华住" in combined:
            return "huazhu"
        if "fliggy.com" in combined or "飞猪" in combined or "alitrip" in combined or "taobao.com" in combined:
            return "fliggy"
        return "generic"

    def extract_city(self, text: str, fallback_hotel_name: str = "") -> str:
        """提取城市名称"""
        # 1. 在文本中寻找已知城市
        for city in KNOWN_CITIES:
            if city in text:
                return city
        # 2. 在酒店名中寻找
        for city in KNOWN_CITIES:
            if city in fallback_hotel_name:
                return city
        return "全国"

    def extract_brand(self, text: str, hotel_name: str) -> str:
        """提取酒店品牌"""
        search_target = f"{hotel_name} {text}"
        for b in KNOWN_BRANDS:
            if b in search_target:
                return b
        return "精品酒店"

    def extract_hotel_name(self, text: str) -> str:
        """从分享文案中提取酒店全称"""
        # 先剔除常见的平台前缀标签，如【飞猪度假】、【携程旅行】、【美团酒店】等
        cleaned = re.sub(r'【(?:飞猪|携程|美团|大众点评|华住|去哪儿|同程|艺龙)[^】]*】', '', text)
        cleaned = re.sub(r'\[(?:飞猪|携程|美团|大众点评|华住|去哪儿|同程|艺龙)[^\]]*\]', '', cleaned)

        # 优先匹配显式括号内的酒店名模式
        bracket_patterns = [
            r'【([^】]+?(?:酒店|客栈|度假村|宾馆|饭店|公寓)[^】]*?)】',
            r'「([^」]+?(?:酒店|客栈|度假村|宾馆|饭店|公寓)[^」]*?)」',
            r'\[([^\]]+?(?:酒店|客栈|度假村|宾馆|饭店|公寓)[^\]]*?)\]',
            r'【([^】]{4,25})】'
        ]
        
        for pat in bracket_patterns:
            m = re.search(pat, cleaned)
            if m:
                cand = m.group(1).strip()
                if not any(k in cand for k in ["特惠推荐", "限时立减", "我的订单", "热门推荐"]):
                    return cand

        # 匹配正文中包含酒店关键词的实体词组
        name_pattern = r'([\u4e00-\u9fa5a-zA-Z0-9\(\)（）\·\s]{2,20}?(?:酒店|客栈|度假村|宾馆|饭店|公寓)(?:[\(（][^\)）]+[\)）])?)'
        matches = re.findall(name_pattern, cleaned)
        for cand in matches:
            cand_clean = cand.strip()
            if len(cand_clean) >= 4 and not any(k in cand_clean for k in ["我的酒店", "选择酒店", "预订酒店", "查看酒店"]):
                return cand_clean

        return ""

    def extract_dates(self, text: str) -> tuple:
        """提取入住与离店日期"""
        now = datetime.now()
        checkin_default = now.strftime("%Y-%m-%d")
        checkout_default = (now + timedelta(days=1)).strftime("%Y-%m-%d")

        # 匹配 2026-09-20 或 2026/09/20
        date_iso = re.findall(r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})', text)
        if len(date_iso) >= 2:
            return date_iso[0].replace('/', '-'), date_iso[1].replace('/', '-')
        elif len(date_iso) == 1:
            return date_iso[0].replace('/', '-'), checkout_default

        # 匹配 9月20日 或 9.20
        date_cn = re.findall(r'(\d{1,2})月(\d{1,2})[日号]?', text)
        if len(date_cn) >= 2:
            m1, d1 = int(date_cn[0][0]), int(date_cn[0][1])
            m2, d2 = int(date_cn[1][0]), int(date_cn[1][1])
            cin = f"{now.year}-{m1:02d}-{d1:02d}"
            cout = f"{now.year}-{m2:02d}-{d2:02d}"
            return cin, cout

        return checkin_default, checkout_default

    def extract_room_type(self, text: str) -> str:
        """提取房型规格"""
        room_types = [
            "豪华大床房", "高级大床房", "标准大床房", "大床房", 
            "双床房", "标准双人间", "高级双床房", "家庭房", "行政套房", "套房"
        ]
        for rt in room_types:
            if rt in text:
                return rt
        return "标准大床房 (基准对齐)"

    def extract_price_hint(self, text: str) -> Optional[int]:
        """
        从文案中提取真实房费价格锚点
        严格排除'立减/满减/立省/最高省/优惠/领券/抵扣/红包/返现'等优惠减免数字
        """
        if not text:
            return None

        # 1. 优先提取显式带有房费语义的价格（如：实付¥450、仅售220元、现价¥380、到手价¥420等）
        m_explicit = re.search(r'(?:实付|现价|售价|房费|仅售|仅需|低至|起售|特惠价|到手价|折后价|标价|特价)\s*[¥￥]?\s*(\d{2,5})\s*(?:元|起)?', text)
        if m_explicit:
            val = int(m_explicit.group(1))
            start_pos = m_explicit.start()
            prefix = text[max(0, start_pos - 4):start_pos]
            if not any(k in prefix for k in ["减", "省", "券"]):
                return val

        # 2. 识别文本中所有优惠区块的位置区间
        discount_keywords = ["立减", "满减", "直减", "直降", "减免", "减", "立省", "最高省", "省", "优惠券", "优惠", "抵扣", "抵", "红包", "返现", "返", "折", "打折", "券"]
        discount_spans = []
        discount_regexes = [
            r'(?:限时|领券|会员|专享)?(?:立减|满减|直减|直降|减免|立省|最高省|优惠|抵扣|返现|减|省|抵|返)\s*[¥￥]?\s*\d{1,4}\s*(?:元)?',
            r'满\s*\d{1,4}\s*(?:元)?\s*减\s*\d{1,4}\s*(?:元)?',
            r'\d{1,4}\s*(?:元)?\s*(?:优惠券|代金券|红包|抵用券)',
        ]
        for d_reg in discount_regexes:
            for dm in re.finditer(d_reg, text):
                discount_spans.append((dm.start(), dm.end()))

        def is_in_discount_zone(start: int, end: int) -> bool:
            for ds, de in discount_spans:
                if (start >= ds and start <= de) or (end >= ds and end <= de):
                    return True
                if 0 <= start - de <= 3:
                    return True
            prefix_ctx = text[max(0, start - 8):start]
            if any(k in prefix_ctx for k in discount_keywords):
                return True
            suffix_ctx = text[end:min(len(text), end + 6)]
            if any(k in suffix_ctx for k in ["优惠", "券", "红包", "立减", "抵扣"]):
                return True
            return False

        # 3. 匹配候选金额
        candidates = []
        for m in re.finditer(r'(?:[¥￥]\s*(\d{2,5})|(\d{2,5})\s*元)', text):
            val_str = m.group(1) or m.group(2)
            if not val_str:
                continue
            val = int(val_str)
            start, end = m.start(), m.end()

            if is_in_discount_zone(start, end):
                continue

            if val < 70 and not any(kw in text for kw in ["青旅", "太空舱", "床位", "胶囊"]):
                continue

            candidates.append(val)

        if candidates:
            return candidates[0]

        return None

    def fetch_web_title_if_needed(self, url: str) -> dict:
        """若文案信息不足，对落地页发起轻量嗅探提取标题"""
        if not url:
            return {}
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=4) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
                t_m = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
                title = t_m.group(1).strip() if t_m else ""
                desc_m = re.search(r'<meta[^>]*name=[\"\']description[\"\'][^>]*content=[\"\']([^\"\']*)[\"\']', html, re.IGNORECASE)
                desc = desc_m.group(1).strip() if desc_m else ""
                return {"title": title, "desc": desc}
        except Exception:
            return {}

    def parse(self, raw_text: str) -> Dict[str, Any]:
        """
        全量解析入口
        返回结构化酒店实体
        """
        if not raw_text or not raw_text.strip():
            return {
                "success": False,
                "error": "粘贴文本为空，请输入或粘贴 OTA 酒店分享链接/文案"
            }

        text = raw_text.strip()
        urls = self.extract_urls(text)
        primary_url = urls[0] if urls else ""
        resolved_url = self.resolve_redirect_url(primary_url) if primary_url else ""
        
        platform = self.identify_platform(text, resolved_url)
        hotel_name = self.extract_hotel_name(text)
        
        # 若未从文案中直接提取到酒店名且存在 URL，尝试抓取标题
        web_info = {}
        if not hotel_name and resolved_url:
            web_info = self.fetch_web_title_if_needed(resolved_url)
            web_title = web_info.get("title", "")
            if web_title:
                hotel_name = self.extract_hotel_name(web_title) or web_title.split('-')[0].split('_')[0].strip()

        if not hotel_name:
            # 尝试截取前段文字作为降级名称
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            hotel_name = lines[0][:20] if lines else "待确认酒店"

        city = self.extract_city(f"{text} {web_info.get('title', '')} {web_info.get('desc', '')}", hotel_name)
        brand = self.extract_brand(text, hotel_name)
        checkin, checkout = self.extract_dates(text)
        room_type = self.extract_room_type(text)
        price_hint = self.extract_price_hint(text)

        return {
            "success": True,
            "raw_text": text,
            "platform": platform,
            "resolved_url": resolved_url or primary_url,
            "entity": {
                "hotel_name": hotel_name,
                "city": city,
                "brand": brand,
                "room_type": room_type,
                "checkin_date": checkin,
                "checkout_date": checkout,
                "price_hint": price_hint
            }
        }

parser = OTAHotelParser()
