"""
FastAPI 酒店比价雷达后端服务 (Hotel Radar API Service)
提供：
- GET /api/health: 健康检查与探针状态
- GET /api/hotels: 20 家基准酒店清单
- POST /api/quote: 实时多渠道聚合比价查询
- POST /api/notify/test: 微信双通道推送实测
- 静态文件挂载: 托管移动端 H5 前端
"""
import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any

from .models import MemberProfile, PushNotificationPayload, QuoteRequest
from .aggregator import HotelPriceAggregator

# 导入前端数据源 (通过共享 JSON/模块)
import json

app = FastAPI(
    title="酒店比价雷达 API (Hotel Radar Backend)",
    version="2.0.0",
    description="支持国内主流 OTA (携程/美团/华住直销) 聚合比价与微信双通道盯盘"
)

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

aggregator = HotelPriceAggregator()

# 读取 20 家酒店基础配置
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# 简单酒店列表辅助函数
def load_benchmark_hotels():
    # 模拟数据与结构
    from .benchmark_db import BENCHMARK_HOTELS
    return BENCHMARK_HOTELS

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "hotel-radar-api",
        "version": "2.0.0",
        "active_adapters": ["huazhu", "meituan", "ctrip"],
        "pending_adapters": ["fliggy (Phase 0 in-review)"]
    }

@app.get("/api/hotels")
async def list_hotels(city: Optional[str] = None):
    hotels = load_benchmark_hotels()
    if city and city != "全部":
        hotels = [h for h in hotels if h["city"] == city]
    return {
        "total": len(hotels),
        "data": hotels
    }

@app.post("/api/quote")
async def get_hotel_quote(req: QuoteRequest):
    hotels = load_benchmark_hotels()
    target = next((h for h in hotels if h["id"] == req.hotel_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    quote = await aggregator.aggregate_quote(
        hotel=target,
        checkin=req.checkin,
        checkout=req.checkout,
        member_profile=req.member_profile.dict(),
        fail_channel=req.fail_channel
    )
    return quote

@app.post("/api/notify/dispatch")
async def dispatch_push_notification(payload: PushNotificationPayload):
    logs = []
    success = False
    
    title = f"【比价雷达】{payload.hotel_name} 降价提醒"
    content = f"""
    <h3>降价达成提醒！</h3>
    <p>您关注的 <strong>{payload.hotel_name}</strong> 出现全网新底价！</p>
    <ul>
        <li>推荐渠道：<strong>{payload.channel_name}</strong></li>
        <li>当前实付：<strong style="color:#10b981;font-size:18px;">¥{payload.current_lowest_price}</strong></li>
        <li>您的心理底线：¥{payload.target_price}</li>
    </ul>
    <p>建议立即通过 App 锁定房源。</p>
    """
    
    # 1. 尝试主通道: PushPlus
    if payload.pushplus_token:
        logs.append("正在调用主通道 [PushPlus]...")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post("https://www.pushplus.plus/send", json={
                    "token": payload.pushplus_token,
                    "title": title,
                    "content": content,
                    "template": "html"
                })
                data = resp.json()
                if data.get("code") == 200:
                    logs.append("✅ 主通道 [PushPlus] 推送成功！微信已弹出消息。")
                    success = True
                else:
                    logs.append(f"⚠️ 主通道异常 ({data.get('msg')})，自动启动容灾！")
        except Exception as e:
            logs.append(f"⚠️ 主通道网络故障 ({str(e)})，自动切换备用通道！")
            
    # 2. 备用通道: Server酱
    if not success and payload.serverchan_key:
        logs.append("正在调度备用通道 [Server酱 Turbo]...")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(f"https://sctapi.ftqq.com/{payload.serverchan_key}.send", data={
                    "title": title,
                    "desp": content
                })
                data = resp.json()
                if data.get("code") == 0:
                    logs.append("✅ 备用通道 [Server酱] 成功送达！盯盘未哑火。")
                    success = True
                else:
                    logs.append(f"❌ 备用通道响应失败 ({data.get('message')})")
        except Exception as e:
            logs.append(f"❌ 备用通道请求异常 ({str(e)})")
            
    if not payload.pushplus_token and not payload.serverchan_key:
        logs.append("【沙盒模拟】：未配置密钥，模拟 HTTP POST 200 OK 成功响应。")
        success = True

    return {
        "success": success,
        "logs": logs
    }

# V2 路由定义
class V2ParseRequest(BaseModel):
    text: str
    member_profile: Optional[Dict[str, Any]] = None

@app.post("/api/v2/parse")
async def parse_and_compare_hotel(req: V2ParseRequest):
    from .parser import parser
    from .matcher import matcher

    parse_res = parser.parse(req.text)
    if not parse_res["success"]:
        return parse_res

    quote = matcher.match_and_build_quote(
        parsed_entity=parse_res["entity"],
        source_platform=parse_res["platform"],
        source_url=parse_res.get("resolved_url", ""),
        member_profile=req.member_profile
    )

    return {
        "success": True,
        "parsed": parse_res,
        "comparison": quote
    }

@app.get("/api/v2/samples")
async def get_sample_snippets():
    return {
        "samples": [
            {
                "platform": "ctrip",
                "label": "携程样本",
                "badge": "携程精选",
                "text": "【携程旅行】全季酒店(上海人民广场店)，限时立减 50 元，豪华大床房限时特惠，实付仅需¥450起！快来看看：https://m.ctrip.com/webapp/hotel/"
            },
            {
                "platform": "meituan",
                "label": "美团样本",
                "badge": "美团爆款",
                "text": "我在美团发现了宝藏酒店！【汉庭酒店(成都春熙路太古里店)】临近地铁出行方便，大床房仅售220元，长按复制本条消息在美团打开：https://hotel.meituan.com/"
            },
            {
                "platform": "huazhu",
                "label": "华住样本",
                "badge": "官方直销",
                "text": "华住会官方推荐：【桔子水晶酒店(杭州西湖湖滨店)】西湖景区核心地段，铂金会员尊享85折双早礼遇，预订链接：https://m.huazhu.com/"
            },
            {
                "platform": "fliggy",
                "label": "度假样本",
                "badge": "度假民宿",
                "text": "【飞猪度假】莫干山裸心谷度假村 景观大床房 2400元起！https://m.fliggy.com/"
            }
        ]
    }

# 挂载前端静态文件到 / 根路径
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

