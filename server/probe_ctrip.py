# -*- coding: utf-8 -*-
import urllib.request
import re
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

url = 'https://m.ctrip.com/webapp/hotel/hoteldetail/436322.html'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=6) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

print("Status:", resp.status, "HTML length:", len(html))
title = re.findall(r'<title>(.*?)</title>', html)
print("Title:", title)

# 查找所有 script 中的 JSON
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
for i, s in enumerate(scripts):
    if '__INITIAL_STATE__' in s or 'window.__' in s or 'hotelInfo' in s:
        print(f"Script #{i} matched, length: {len(s)}")
        print("Preview:", s[:300])
