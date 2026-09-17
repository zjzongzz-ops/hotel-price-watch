"""
SQLite 价格持久化缓存层 (TTL 控制，防 OTA 风控高频封号)
"""
import sqlite3
import json
import time
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "price_cache.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hotel_prices (
            cache_key TEXT PRIMARY KEY,
            data_json TEXT,
            updated_at INTEGER,
            ttl INTEGER
        )
    """)
    conn.commit()
    conn.close()

init_db()

def get_cached_price(cache_key: str) -> dict | None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT data_json, updated_at, ttl FROM hotel_prices WHERE cache_key = ?", (cache_key,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    data_json, updated_at, ttl = row
    if time.time() - updated_at > ttl:
        return None # 过期
    return json.loads(data_json)

def set_cached_price(cache_key: str, data: dict, ttl: int = 7200):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO hotel_prices (cache_key, data_json, updated_at, ttl)
        VALUES (?, ?, ?, ?)
    """, (cache_key, json.dumps(data, ensure_ascii=False), int(time.time()), ttl))
    conn.commit()
    conn.close()
