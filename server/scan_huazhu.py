# -*- coding: utf-8 -*-
import urllib.request
import re
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
}

url = 'https://m.huazhu.com/hotel/detail?HotelId=2000001'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=6) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

print("Title:", re.findall(r'<title>(.*?)</title>', html))
# 查找是否有包含价钱数字的标记，如 ¥ 或 元
price_matches = re.findall(r'(\¥\s*\d+|\d+\s*元|price[\"\'\:\s]+\d+)', html, re.IGNORECASE)
print("Price snippets found:", set(price_matches[:15]))
# 查找所有 script 标签的 src
srcs = re.findall(r'<script[^>]+src=[\"\']([^\"\']+)[\"\']', html)
print("Script sources:", srcs[:5])
