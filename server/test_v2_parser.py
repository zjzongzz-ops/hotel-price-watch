# -*- coding: utf-8 -*-
"""
V2 解析与匹配引擎自动化回归测试 (test_v2_parser.py)
验证内容：
1. 携程、美团、华住典型手机分享文案与短链的精准提取
2. 跨平台实体匹配与基准对齐
3. 动态非基准库酒店的启发式三渠道价格生成
4. 质量闸门双要素验真（确保生成的每一个链接均符合小歪质检标准，0 违规错链）
"""
import sys
import os
import json

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from server.parser import parser
from server.matcher import matcher
from server.verify_deep_links import verify_single_url

def run_tests():
    print("==================================================")
    print(" 酒店比价雷达 · V2 解析与跨平台匹配引擎自动化回归")
    print("==================================================")

    test_cases = [
        {
            "name": "携程典型分享文案 (含限时立减 50 元干扰)",
            "text": "【携程旅行】全季酒店(上海人民广场店)，限时立减 50 元，豪华大床房限时特惠，实付仅需¥450起！快来看看：https://m.ctrip.com/webapp/hotel/",
            "expected_platform": "ctrip",
            "expected_city": "上海",
            "expected_brand": "全季",
            "expected_price": 450,
            "expected_match_type": "benchmark_aligned",
            "expected_ctrip_price": 437,  # 486 * 0.90 (钻石 9 折)
            "expected_meituan_price": 442, # 472 - 30 (神会员减 30)
            "expected_huazhu_price": 382   # round(450 * 0.85) (铂金 85 折)
        },
        {
            "name": "美团口令分享文案 (含领券立减 30 元干扰)",
            "text": "我在美团发现了宝藏酒店！【汉庭酒店(成都春熙路太古里店)】领券立减30元，临近地铁出行方便，大床房仅售220元，长按复制本条消息在美团打开：https://hotel.meituan.com/",
            "expected_platform": "meituan",
            "expected_city": "成都",
            "expected_brand": "汉庭",
            "expected_price": 220,
            "expected_match_type": "benchmark_aligned"
        },
        {
            "name": "华住直营官方分享文案",
            "text": "华住会官方推荐：【桔子水晶酒店(杭州西湖湖滨店)】西湖景区核心地段，铂金会员尊享85折双早礼遇，预订链接：https://m.huazhu.com/",
            "expected_platform": "huazhu",
            "expected_city": "杭州",
            "expected_brand": "桔子水晶",
            "expected_price": None,
            "expected_match_type": "benchmark_aligned"
        },
        {
            "name": "非基准库全新未知酒店 (启发式比价与弱匹配防虚高)",
            "text": "【飞猪度假】莫干山裸心谷度假村 景观大床房 2400元起！https://m.fliggy.com/",
            "expected_platform": "fliggy",
            "expected_city": "莫干山",
            "expected_hotel": "莫干山裸心谷度假村",
            "expected_price": 2400,
            "expected_match_type": "dynamic_heuristic"
        }
    ]

    all_passed = True

    for idx, tc in enumerate(test_cases, 1):
        print(f"\n[测试用例 {idx}] {tc['name']}")
        parse_res = parser.parse(tc["text"])
        
        assert parse_res["success"], f"解析失败: {parse_res.get('error')}"
        entity = parse_res["entity"]
        platform = parse_res["platform"]
        
        print(f" -> 识别来源平台: {platform} (预期: {tc['expected_platform']})")
        print(f" -> 提取酒店名称: {entity['hotel_name']}")
        print(f" -> 提取城市/商圈: {entity['city']} (预期: {tc['expected_city']})")
        print(f" -> 提取品牌归属: {entity['brand']}")
        print(f" -> 提取价格锚点: ¥{entity.get('price_hint')}")

        assert platform == tc["expected_platform"], f"平台识别错误: {platform} != {tc['expected_platform']}"
        assert tc["expected_city"] in entity["city"], f"城市提取错误: {entity['city']} != {tc['expected_city']}"
        if "expected_hotel" in tc:
            assert tc["expected_hotel"] in entity["hotel_name"], f"酒店提取错误: {entity['hotel_name']} != {tc['expected_hotel']}"
        if tc["expected_price"] is not None:
            assert entity.get("price_hint") == tc["expected_price"], f"价格锚点抓取错误(混淆了立减折扣金额): 期望 ¥{tc['expected_price']}，实际得到 ¥{entity.get('price_hint')}"

        # 跨平台匹配与比价构建
        quote = matcher.match_and_build_quote(
            parsed_entity=entity,
            source_platform=platform,
            source_url=parse_res.get("resolved_url", "")
        )

        assert quote["success"], "跨平台比价构建失败"
        print(f" -> 匹配置信度: {quote['match_confidence']} ({quote['match_type']}) | 启发式: {quote.get('is_heuristic')}")
        print(f" -> 全网底价渠道: 【{quote['lowest_channel']}】 ¥{quote['lowest_price']}")
        print(f" -> 战术建议: {quote['tactical_advice']}")

        assert quote["match_type"] == tc["expected_match_type"], f"匹配类型不符: {quote['match_type']} != {tc['expected_match_type']}"
        if tc["expected_match_type"] == "dynamic_heuristic":
            assert quote.get("is_heuristic") is True, "启发式推算未标注 is_heuristic"
            assert quote["match_confidence"] < 0.75, f"启发式匹配置信度虚高硬编码: {quote['match_confidence']}"
        else:
            assert quote["match_confidence"] >= 0.75, f"基准库高置信度应 >= 0.75: {quote['match_confidence']}"

        # 验证会员规则统一性 (用例 1 显式对账)
        if "expected_ctrip_price" in tc:
            c_p = quote["channels"]["ctrip"]["wallet_price"]
            m_p = quote["channels"]["meituan"]["wallet_price"]
            h_p = quote["channels"]["huazhu"]["wallet_price"]
            assert c_p == tc["expected_ctrip_price"], f"携程会员价格规则未统一: {c_p} != {tc['expected_ctrip_price']}"
            assert m_p == tc["expected_meituan_price"], f"美团会员价格规则未统一: {m_p} != {tc['expected_meituan_price']}"
            assert h_p == tc["expected_huazhu_price"], f"华住会员价格规则未统一: {h_p} != {tc['expected_huazhu_price']}"

        # 严格质量闸门验真：核查每一个渠道返回的 URL
        for ch_k, ch_v in quote["channels"].items():
            u = ch_v["url"]
            v_res = verify_single_url(ch_k, entity["hotel_name"], entity["city"], entity["brand"], u)
            assert v_res["valid"], f"质量闸门拦截：发现违规或错配链接: {u}"
            print(f"    - [{ch_k.upper()}] 实付 ¥{ch_v['wallet_price']} | 链接态: {ch_v['link_type']} | 质检: PASS")

        print("PASS: 该用例解析、匹配、会员对账与质量闸门核验全部通过！")

    print("\n==================================================")
    print("🎉 V2 引擎全套自动化回归测试全部通过 (4/4)！")
    print("==================================================")
    return 0

if __name__ == "__main__":
    sys.exit(run_tests())
