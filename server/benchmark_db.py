"""
20 家基准酒店后端结构化数据库 (读取自 hotels.json)
"""
import json
import os

JSON_PATH = os.path.join(os.path.dirname(__file__), 'hotels.json')

def load_hotels():
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

BENCHMARK_HOTELS = load_hotels()
