# -*- coding: utf-8 -*-
import urllib.request
import re
import json
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

url = 'https://m.huazhu.com/hotel/detail?HotelId=2000001'
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=6) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        print(f"Status: {resp.status}, HTML length: {len(html)}")
        
        # 查找包含酒店数据或价格的 JSON
        matches = re.findall(r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});', html, re.DOTALL)
        if matches:
            print("Found __INITIAL_STATE__!")
            data = json.loads(matches[0])
            print("Keys in state:", list(data.keys()))
        else:
            # 查找所有 script 中的 json
            scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
            for i, s in enumerate(scripts):
                if 'lowestprice' in s.lower() or 'roomprice' in s.lower() or 'hoteldetail' in s.lower():
                    print(f"Script #{i} matched keyword, snippet: {s[:300]}")
except Exception as e:
    print("Probe error:", e)
