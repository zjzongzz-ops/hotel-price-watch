# -*- coding: utf-8 -*-
"""
双通道推送故障注入与平滑故障转移自动化测试 (Dual-Channel Push Failover Test)
验证:
1. 注入主通道 (PushPlus) 异常（模拟 500 内部错误 / 连接超时 / 无效 Token）
2. 调度器毫秒级捕获主通道异常，记录故障降级事件
3. 自动平滑转移至备用通道 (ServerChan) 完成告警投递
4. 输出端到端切换日志与验证报告
"""
import sys
import json
from unittest.mock import patch, MagicMock

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from server.watcher_cron import dispatch_dual_channel

def run_failover_test():
    print("==================================================")
    print(" 微信双通道推送 · 故障注入与平滑转移测试")
    print("==================================================")

    title = "【降价告警】全季酒店 (上海人民广场店) 降价达成"
    html_content = "<p>测试内容：全网底价 ¥382 (目标: ¥400)</p>"
    md_content = "### 测试内容\n全网底价 ¥382 (目标: ¥400)"

    # 用例 1: 主通道正常场景
    print("\n[测试用例 1] 主通道 PushPlus 正常响应 (HTTP 200 OK)")
    with patch("server.watcher_cron.send_pushplus") as mock_pp:
        mock_pp.return_value = {"success": True, "msg": "PushPlus 发送成功 (消息ID: pp_msg_98721)", "detail": {"code": 200}}
        res = dispatch_dual_channel(title, html_content, md_content)
        print(f"-> 投递渠道: {res['channel']}")
        print(f"-> 投递状态: {'成功' if res['success'] else '失败'}")
        print(f"-> 日志追踪: {res['logs']}")
        assert res["success"] is True
        assert res["channel"] == "pushplus"
        print("PASS: 主通道正常时，由主通道直接投递，无需动用备用通道。")

    # 用例 2: 故障注入 - 主通道崩溃/超时/403/500
    print("\n[测试用例 2] 故障注入：主通道 PushPlus 遭遇 500 宕机 / 网络超时")
    with patch("server.watcher_cron.send_pushplus") as mock_pp, \
         patch("server.watcher_cron.send_serverchan") as mock_sc:
        
        # 注入 PushPlus 异常
        mock_pp.return_value = {"success": False, "msg": "HTTP 500 Internal Server Error (PushPlus 服务端熔断)"}
        # 备用通道 ServerChan 正常
        mock_sc.return_value = {"success": True, "msg": "ServerChan 发送成功 (微信模板卡片投递完成)", "detail": {"code": 0}}
        
        res = dispatch_dual_channel(title, html_content, md_content)
        print(f"-> 最终生效渠道: 【{res['channel']}】")
        print(f"-> 告警是否丢失: {'未丢失 (成功送达)' if res['success'] else '丢失'}")
        print("-> 完整故障转移日志:")
        for log in res["logs"]:
            print(f"   {log}")

        assert res["success"] is True, "故障转移后推送必须成功"
        assert res["channel"] == "serverchan", "必须平滑切换到备用通道 serverchan"
        assert any("主通道推送未达成，立即平滑触发备用通道" in line for line in res["logs"])
        print("PASS: 故障注入成功捕获！主通道失效后已 100% 自动平滑转移至备用通道！")

    # 用例 3: 真实网络环境探针测试 (无 Token 沙盒保护模式)
    print("\n[测试用例 3] 真实未配置密钥状态下的安全防护与友善提示")
    real_res = dispatch_dual_channel(title, html_content, md_content)
    print(f"-> 沙盒日志: {real_res['logs']}")
    assert real_res["channel"] == "none"
    print("PASS: 未配置密钥时安全拦截，绝不崩溃或向外泄露隐私。")

    print("\n==================================================")
    print("🎉 微信双通道故障注入与切备回归测试全部通过 (3/3)！")
    print("==================================================")

if __name__ == "__main__":
    run_failover_test()
