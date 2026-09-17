# -*- coding: utf-8 -*-
"""
GitHub Actions 运行记录与巡检心跳批量导出工具 (B3 专用)
用法：
  python -m server.export_actions_logs --repo your-username/hotel-price-watch --token YOUR_GITHUB_TOKEN
"""
import sys
import os
import json
import argparse
import urllib.request
from datetime import datetime, timedelta

def export_actions_runs(repo: str, token: str = None, days: int = 3):
    print(f"[*] 开始检索 GitHub 仓库 [{repo}] 最近 {days} 天的 Actions 运行记录...")
    url = f"https://api.github.com/repos/{repo}/actions/runs?per_page=50"
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "HotelRadar-LogExporter"}
    if token:
        headers["Authorization"] = f"token {token}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[!] 请求 GitHub API 失败: {e}")
        print("💡 提示：私有仓必须传入 --token 个人访问令牌 (PAT)")
        return

    runs = data.get("workflow_runs", [])
    cutoff = datetime.utcnow() - timedelta(days=days)
    filtered = []

    for r in runs:
        created_at_dt = datetime.strptime(r["created_at"], "%Y-%m-%dT%H:%M:%SZ")
        if created_at_dt >= cutoff:
            filtered.append({
                "run_id": r["id"],
                "name": r["name"],
                "event": r["event"],
                "status": r["status"],
                "conclusion": r["conclusion"],
                "created_at": r["created_at"],
                "html_url": r["html_url"],
                "run_duration_sec": r.get("run_duration_ms", 0) // 1000 if "run_duration_ms" in r else None
            })

    output_file = os.path.join(os.path.dirname(__file__), f"actions_runs_last_{days}d.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)

    print(f"[+] 导出成功！共提取 {len(filtered)} 条最近 {days} 天的运行记录。")
    print(f"[+] 结果已保存至: {output_file}")
    
    # 打印前 5 条摘要
    print("\n--- 运行摘要记录 ---")
    for item in filtered[:5]:
        print(f"[{item['created_at']}] ID: {item['run_id']} | 状态: {item['status']}/{item['conclusion']} | 触发方式: {item['event']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="导出 GitHub Actions 巡检运行记录")
    parser.add_argument("--repo", required=True, help="GitHub 仓库名，例如: username/hotel-price-watch")
    parser.add_argument("--token", default=os.getenv("GITHUB_TOKEN"), help="GitHub Personal Access Token (私有仓必填)")
    parser.add_argument("--days", type=int, default=3, help="导出最近天数，默认 3 天")
    args = parser.parse_args()

    export_actions_runs(args.repo, args.token, args.days)
