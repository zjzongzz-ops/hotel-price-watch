import { openBottomSheet, closeBottomSheet } from "./animations.js";

export function initV2Parser(state, elements, onHotelParsed, showToast) {
  const btnOpen = document.getElementById("btnOpenV2Parser");
  const modal = document.getElementById("v2ParserModal");
  const overlay = document.getElementById("v2ModalOverlay");
  const btnClose = document.getElementById("btnCloseV2Parser");
  const sampleChips = document.getElementById("v2SampleChips");
  const inputText = document.getElementById("v2InputText");
  const btnClipboard = document.getElementById("btnReadClipboard");
  const btnParse = document.getElementById("btnStartParse");
  const feedbackBox = document.getElementById("v2ParseFeedback");

  if (!btnOpen || !modal) return;

  let cachedSamples = [];

  // 1. 加载官方示例样本
  fetch("/api/v2/samples")
    .then(r => r.json())
    .then(data => {
      if (data && data.samples) {
        cachedSamples = data.samples;
        renderSampleChips(data.samples);
      }
    })
    .catch(() => {
      // 离线或异常时兜底默认
      cachedSamples = [
        {
          platform: "ctrip",
          label: "携程精选",
          text: "【携程旅行】全季酒店(上海人民广场店)，豪华大床房限时特惠，实付仅需¥450起！快来看看：https://m.ctrip.com/webapp/hotel/"
        },
        {
          platform: "meituan",
          label: "美团爆款",
          text: "我在美团发现了宝藏酒店！【汉庭酒店(成都春熙路太古里店)】临近地铁出行方便，大床房仅售220元，长按复制本条消息在美团打开：https://hotel.meituan.com/"
        },
        {
          platform: "huazhu",
          label: "华住直销",
          text: "华住会官方推荐：【桔子水晶酒店(杭州西湖湖滨店)】西湖景区核心地段，铂金会员尊享85折双早礼遇，预订链接：https://m.huazhu.com/"
        },
        {
          platform: "fliggy",
          label: "度假样本",
          text: "【飞猪度假】莫干山裸心谷度假村 景观大床房 2400元起！https://m.fliggy.com/"
        }
      ];
      renderSampleChips(cachedSamples);
    });

  function renderSampleChips(samples) {
    if (!sampleChips) return;
    sampleChips.innerHTML = "";
    samples.forEach(s => {
      const chip = document.createElement("button");
      chip.className = "v2-sample-chip";
      chip.innerText = s.label;
      chip.addEventListener("click", () => {
        inputText.value = s.text;
        inputText.focus();
        showToast(`已填入【${s.label}】测试样本`);
      });
      sampleChips.appendChild(chip);
    });
  }

  // 2. 模态框展开与收起
  function openModal() {
    openBottomSheet(modal, overlay);
    feedbackBox.classList.add("hidden");
    feedbackBox.innerText = "";
  }

  function closeModal() {
    closeBottomSheet(modal, overlay);
  }

  btnOpen.addEventListener("click", openModal);
  btnClose.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  // 3. 读取手机系统剪贴板
  btnClipboard.addEventListener("click", async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          inputText.value = text.trim();
          showToast("📋 成功读取剪贴板内容！");
        } else {
          showToast("剪贴板中未发现有效文字，请手动粘贴");
        }
      } else {
        showToast("💡 浏览器剪贴板权限受限，请长按输入框粘贴");
      }
    } catch (e) {
      showToast("💡 请长按文本框粘贴分享文案");
    }
  });

  // 4. 发起 V2 解析与跨平台比价
  btnParse.addEventListener("click", async () => {
    const raw = inputText.value.trim();
    if (!raw) {
      showToast("⚠️ 请先粘贴 OTA 分享文案或链接");
      inputText.focus();
      return;
    }

    feedbackBox.classList.remove("hidden");
    feedbackBox.innerHTML = `
      <div class="v2-loading-spinner"></div>
      <span>正在展开短链、清洗实体并跨平台检索全网比价...</span>
    `;
    btnParse.disabled = true;

    try {
      const resp = await fetch("/api/v2/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonSafeStringify({
          text: raw,
          member_profile: state.profile
        })
      });

      const res = await resp.json();
      if (!res.success) {
        feedbackBox.innerHTML = `❌ 解析失败: ${res.error || "未能识别出有效酒店实体"}`;
        btnParse.disabled = false;
        return;
      }

      const quote = res.comparison;
      feedbackBox.innerHTML = `✅ 成功识别【${quote.hotel_name}】(${quote.city})！正在生成比价卡片...`;

      setTimeout(() => {
        closeModal();
        btnParse.disabled = false;
        if (onHotelParsed) {
          onHotelParsed(quote);
        }
        showToast(`🎉 成功解析【${quote.hotel_name}】，已置顶生成比价卡片！`, 3000);
      }, 500);

    } catch (err) {
      feedbackBox.innerHTML = `❌ 网络异常: ${err.message}`;
      btnParse.disabled = false;
    }
  });
}

function jsonSafeStringify(obj) {
  return JSON.stringify(obj);
}
