/**
 * 移动端 H5 酒店比价雷达主程序 (App Orchestrator)
 */

import { HOTELS_DATA } from "./data.js";
import { 
  loadMemberProfile, 
  saveMemberProfile, 
  calcChannelPrice, 
  findBestChannel 
} from "./member.js";
import { renderCalendarGrid } from "./calendar.js";
import { 
  loadNotifierConfig, 
  saveNotifierConfig, 
  loadWatchList, 
  toggleWatchHotel, 
  sendDualChannelNotification 
} from "./notifier.js";
import { 
  initEntranceAnimations, 
  animateHotelCards, 
  openBottomSheet, 
  closeBottomSheet,
  pulseElement 
} from "./animations.js";
import { initV2Parser } from "./parser_ui.js";

// 全局运行态
let state = {
  hotels: [...HOTELS_DATA],
  filteredHotels: [...HOTELS_DATA],
  profile: loadMemberProfile(),
  selectedCity: "全部",
  selectedCategory: "全部",
  searchKeyword: "",
  activeHotel: null,
  activeTab: "radar" // "radar" | "calendar" | "watch" | "member"
};

// DOM 元素引用
const elements = {
  hotelList: document.getElementById("hotelList"),
  cityPills: document.getElementById("cityPills"),
  categoryPills: document.getElementById("categoryPills"),
  searchInput: document.getElementById("searchInput"),
  resultCount: document.getElementById("resultCount"),
  memberViewToggle: document.getElementById("memberViewToggle"),
  memberStatusSummary: document.getElementById("memberStatusSummary"),
  
  // 底部抽屉 (比价与日历)
  detailSheet: document.getElementById("detailSheet"),
  sheetOverlay: document.getElementById("sheetOverlay"),
  sheetCloseBtn: document.getElementById("sheetCloseBtn"),
  sheetHotelName: document.getElementById("sheetHotelName"),
  sheetHotelMeta: document.getElementById("sheetHotelMeta"),
  sheetChannels: document.getElementById("sheetChannels"),
  sheetCalendarContainer: document.getElementById("sheetCalendarContainer"),
  sheetWatchBtn: document.getElementById("sheetWatchBtn"),
  
  // 会员设置模态框
  memberModal: document.getElementById("memberModal"),
  memberModalOverlay: document.getElementById("memberModalOverlay"),
  closeMemberModalBtn: document.getElementById("closeMemberModalBtn"),
  saveMemberBtn: document.getElementById("saveMemberBtn"),
  selectCtripTier: document.getElementById("selectCtripTier"),
  selectMeituanTier: document.getElementById("selectMeituanTier"),
  selectHuazhuTier: document.getElementById("selectHuazhuTier"),
  
  // 盯盘模态框
  watchModal: document.getElementById("watchModal"),
  watchModalOverlay: document.getElementById("watchModalOverlay"),
  closeWatchModalBtn: document.getElementById("closeWatchModalBtn"),
  saveWatchCfgBtn: document.getElementById("saveWatchCfgBtn"),
  testPushBtn: document.getElementById("testPushBtn"),
  pushPlusTokenInput: document.getElementById("pushPlusTokenInput"),
  serverChanKeyInput: document.getElementById("serverChanKeyInput"),
  pushTestLogs: document.getElementById("pushTestLogs"),
  
  // 底部导航项
  tabRadar: document.getElementById("tabRadar"),
  tabCalendar: document.getElementById("tabCalendar"),
  tabWatch: document.getElementById("tabWatch"),
  tabMember: document.getElementById("tabMember"),
  
  // Toast
  toast: document.getElementById("toast")
};

function showToast(msg, duration = 2400) {
  elements.toast.innerText = msg;
  elements.toast.classList.add("show");
  setTimeout(() => {
    elements.toast.classList.remove("show");
  }, duration);
}

/**
 * 渲染酒店卡片流
 */
function renderHotelCards() {
  elements.hotelList.innerHTML = "";
  const watchList = loadWatchList();
  
  if (state.filteredHotels.length === 0) {
    elements.hotelList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">未找到匹配的基准酒店</div>
        <div class="empty-desc">换个城市、品牌标签或关键词试试</div>
      </div>
    `;
    elements.resultCount.innerText = "0 家酒店";
    return;
  }
  
  elements.resultCount.innerText = `共 ${state.filteredHotels.length} 家基准酒店`;
  
  state.filteredHotels.forEach((hotel) => {
    const card = document.createElement("div");
    const isHeuristic = hotel.isV2Dynamic && (hotel.isHeuristic || hotel.matchType === "dynamic_heuristic");
    let cardClasses = ["hotel-card"];
    if (hotel.isV2Dynamic) {
      cardClasses.push("v2-dynamic-card");
      if (isHeuristic) {
        cardClasses.push("is-heuristic-match");
      } else {
        cardClasses.push("is-benchmark-match");
      }
    }
    card.className = cardClasses.join(" ");
    
    // 计算全渠道最低价
    const best = findBestChannel(hotel.channels, state.profile);
    const isWatched = watchList.some(w => w.hotelId === hotel.id);

    // 动态置顶卡片徽章
    let topBadgeHtml = "";
    if (hotel.isV2Dynamic) {
      if (isHeuristic) {
        const confPercent = Math.round((hotel.matchConfidence || 0) * 100);
        topBadgeHtml = `<div class="v2-card-badge heuristic">⚠️ 启发式估算·待确认${confPercent > 0 ? ` (${confPercent}%)` : ''}</div>`;
      } else {
        const confPercent = Math.round((hotel.matchConfidence || 1) * 100);
        topBadgeHtml = `<div class="v2-card-badge verified">✓ 基准房型精确对齐 (${confPercent}%)</div>`;
      }
    }
    
    // 渠道价格对比条辅助渲染
    const renderPill = (key, name, ch) => {
      if (!ch || ch.status === "none") {
        return `
          <div class="channel-pill ${key} is-none">
            <div class="channel-logo">${name}</div>
            <div class="channel-price">未入驻</div>
            <div class="channel-tag">--</div>
          </div>
        `;
      }
      if (ch.status === "maintenance") {
        return `
          <div class="channel-pill ${key} is-maintenance">
            <div class="channel-logo">${name}</div>
            <div class="channel-status-badge">🔧 维护中</div>
            <div class="channel-tag">防爬降级</div>
          </div>
        `;
      }
      const calc = calcChannelPrice(key, ch, state.profile);
      const isBest = (best.bestKey === key);
      return `
        <div class="channel-pill ${key} ${isBest ? 'is-best' : ''}">
          <div class="channel-logo">${name}</div>
          <div class="channel-price">¥${calc ? calc.price : '--'}</div>
          <div class="channel-tag">${ch.breakfast || '无早'}</div>
          ${isBest ? `<span class="best-badge">${key === 'huazhu' ? '官网底价' : '全网底价'}</span>` : ''}
        </div>
      `;
    };
    
    card.innerHTML = `
      ${topBadgeHtml}
      <div class="card-cover">
        <img src="${hotel.image || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80'}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <div class="card-city-badge">${hotel.city} · ${hotel.star || '精选'}${typeof hotel.star === 'number' ? '星' : ''}</div>
        ${hotel.badge ? `<div class="card-feature-badge">${hotel.badge}</div>` : ""}
        <button class="card-watch-btn ${isWatched ? "active" : ""}" data-id="${hotel.id}" title="降价盯盘">
          ${isWatched ? "🔔 已盯盘" : "🔔 盯盘"}
        </button>
      </div>
      
      <div class="card-body">
        <div class="card-header-row">
          <h3 class="card-title">${hotel.name}</h3>
        </div>
        <div class="card-address">📍 ${hotel.address}</div>

        ${isHeuristic ? `
          <div class="heuristic-notice-bar">
            <span class="notice-icon">⚠️</span>
            <span class="notice-text">未完全命中官方基准库，报价基于公开佣金扣点推算，请核实房型与结算价</span>
          </div>
        ` : ''}
        
        <div class="card-benchmark-room ${isHeuristic ? 'heuristic' : ''}">
          <div class="benchmark-label ${isHeuristic ? 'heuristic' : ''}">
            ${isHeuristic ? '⚠️ 算法推算房型 (待核对)' : '🎯 基准房型对齐'}
          </div>
          <div class="benchmark-room-name">${hotel.benchmarkRoom}</div>
        </div>
        
        <div class="channel-compare-grid">
          ${renderPill('ctrip', '携程', hotel.channels.ctrip)}
          ${renderPill('meituan', '美团', hotel.channels.meituan)}
          ${renderPill('huazhu', '华住直营', hotel.channels.huazhu)}
        </div>
        
        <div class="card-footer-row">
          <div class="savings-hint">
            ${best.maxSavings > 0 ? `最高省 <strong>¥${best.maxSavings}</strong>` : (best.minPrice ? `全网控价统一` : `暂无可用报价`)}
            <span class="view-tag ${isHeuristic ? 'heuristic' : ''}">${isHeuristic ? '估算参考' : (state.profile.activeView === 'wallet' ? '已叠会员' : '公开标价')}</span>
          </div>
          <button class="btn-check-detail" data-id="${hotel.id}">
            30天走势 & 预订建议 ➔
          </button>
        </div>
        <div class="card-disclaimer-note">
          ${isHeuristic ? '* 启发式推算模式：报价及房型由算法模拟推算，实际以各平台下单页为准' : '* 价格由各平台公开规则估算，实际以下单结算页为准'}
        </div>
      </div>
    `;
    
    // 绑定事件
    card.querySelector(".btn-check-detail").addEventListener("click", () => {
      openHotelDetail(hotel);
    });
    
    card.querySelector(".card-watch-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const currentPrice = best.minPrice || 400;
      const res = toggleWatchHotel(hotel.id, hotel.name, currentPrice, currentPrice);
      pulseElement(e.currentTarget);
      if (res.isWatched) {
        showToast(`已开启【${hotel.name}】降价盯盘！低于 ¥${currentPrice} 时将推送微信。`);
      } else {
        showToast(`已取消【${hotel.name}】盯盘`);
      }
      renderHotelCards();
    });
    
    elements.hotelList.appendChild(card);
  });
  
  animateHotelCards();
}

/**
 * 展开酒店详情与 30 天日历底抽屉
 */
function openHotelDetail(hotel) {
  state.activeHotel = hotel;
  elements.sheetHotelName.innerText = hotel.name;
  // 渠道详情渲染器 (支持断源维护态与微信环境防拦截)
  const renderSheetChannels = (channelsObj, bestChannelObj) => {
    elements.sheetChannels.innerHTML = "";
    ["huazhu", "meituan", "ctrip", "fliggy"].forEach((key) => {
      const ch = channelsObj[key];
      if (!ch || ch.status === "none") return;
      
      const row = document.createElement("div");
      
      if (ch.status === "maintenance") {
        row.className = `sheet-channel-item ${key} is-maintenance`;
        row.innerHTML = `
          <div class="ch-left">
            <div class="ch-title-row">
              <span class="ch-name">${ch.platform || key}</span>
              <span class="badge-maintenance">🔧 渠道维护中</span>
            </div>
            <div class="ch-policy">防爬风控熔断降级隔离 · 暂不参与最低价排序</div>
          </div>
          <div class="ch-right">
            <button class="ch-jump-btn disabled" disabled>暂不可订</button>
          </div>
        `;
      } else if (ch.isPending) {
        row.className = `sheet-channel-item ${key}`;
        row.innerHTML = `
          <div class="ch-left">
            <div class="ch-name">${ch.platform}</div>
            <div class="ch-policy">阶段 0 探针评估中（待准入认证）</div>
          </div>
          <div class="ch-right">
            <span class="badge-pending">即将接入</span>
          </div>
        `;
      } else {
        const isBest = bestChannelObj && bestChannelObj.bestKey === key;
        const calc = calcChannelPrice(key, ch, state.profile);
        const priceVal = calc ? calc.price : (ch.wallet_price || ch.base_price || ch.basePrice);
        const baseVal = calc ? calc.basePrice : (ch.base_price || ch.basePrice);
        row.className = `sheet-channel-item ${key} ${isBest ? "is-best" : ""}`;
        row.innerHTML = `
          <div class="ch-left">
            <div class="ch-title-row">
              <span class="ch-name">${ch.platform}</span>
              ${isBest ? '<span class="ch-best-tag">全网最低</span>' : ''}
              ${ch.isOfficial || ch.is_official ? '<span class="ch-official-tag">官方直销锚点</span>' : ''}
            </div>
            <div class="ch-policy">政策：${ch.breakfast} ｜ ${ch.cancelPolicy || ch.cancel_policy || '随时可退'}</div>
            ${calc && calc.isDiscounted ? `<div class="ch-discount-text">✨ ${calc.discountText} (已省¥${calc.saved})</div>` : ''}
          </div>
          <div class="ch-right">
            <div class="ch-price-val">¥${priceVal}</div>
            ${calc && calc.isDiscounted ? `<div class="ch-base-val">原价¥${baseVal}</div>` : ''}
            <a href="${ch.url || '#'}" target="_blank" class="ch-jump-btn" data-key="${key}">前往平台搜价</a>
          </div>
        `;
      }
      elements.sheetChannels.appendChild(row);
    });

    // 绑定平台跳转微信环境检测
    elements.sheetChannels.querySelectorAll(".ch-jump-btn:not(.disabled)").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
        const channelKey = btn.getAttribute("data-key");
        if (isWeChat) {
          if (channelKey === "meituan") {
            showToast("💡 微信提示：如遇拦截，可右上角选择'在浏览器中打开'或通过美团小程序搜价", 3500);
          } else {
            showToast("🚀 正在前往官方平台移动端搜价页...", 1800);
          }
        }
      });
    });
  };

  const initialBest = findBestChannel(hotel.channels, state.profile);
  renderSheetChannels(hotel.channels, initialBest);

  // 异步向 FastAPI 后端拉取实时聚合比价与熔断状态
  fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hotel_id: hotel.id,
      checkin: '2026-09-16',
      checkout: '2026-09-17',
      member_profile: {
        active_view: state.profile.activeView,
        ctrip_tier: state.profile.ctrip,
        meituan_tier: state.profile.meituan,
        huazhu_tier: state.profile.huazhu
      }
    })
  }).then(r => r.json()).then(liveQuote => {
    if (liveQuote && liveQuote.channels) {
      console.log('✅ 后端实时聚合比价响应成功:', liveQuote);
      renderSheetChannels(liveQuote.channels, { bestKey: liveQuote.lowest_channel });
      if (liveQuote.tactical_advice && elements.sheetAdvice) {
        elements.sheetAdvice.innerText = liveQuote.tactical_advice;
      }
    }
  }).catch(e => {
    console.log('Backend quote fallback to local state:', e);
  });
  
  // 渲染 30 天价格走势与热力日历
  elements.sheetCalendarContainer.innerHTML = "";
  const calGrid = renderCalendarGrid(hotel.trend30d, (day) => {
    showToast(`选择日期: ${day.date} (${day.dayOfWeek}) - 预估最低价: ¥${day.price}`);
  });
  elements.sheetCalendarContainer.appendChild(calGrid);
  
  // 绑定盯盘按钮状态
  const watchList = loadWatchList();
  const isWatched = watchList.some(w => w.hotelId === hotel.id);
  elements.sheetWatchBtn.innerText = isWatched ? "🔔 取消盯盘" : "🔔 开启降价微信提醒";
  elements.sheetWatchBtn.onclick = () => {
    const res = toggleWatchHotel(hotel.id, hotel.name, best.minPrice, best.minPrice);
    elements.sheetWatchBtn.innerText = res.isWatched ? "🔔 取消盯盘" : "🔔 开启降价微信提醒";
    showToast(res.isWatched ? "已开启降价盯盘！" : "已取消盯盘");
    renderHotelCards();
  };
  
  openBottomSheet(elements.detailSheet, elements.sheetOverlay);
}

/**
 * 筛选逻辑
 */
function applyFilters() {
  state.filteredHotels = state.hotels.filter((h) => {
    // 城市
    if (state.selectedCity !== "全部" && h.city !== state.selectedCity) return false;
    // 分类
    if (state.selectedCategory !== "全部") {
      if (state.selectedCategory === "商旅连锁" && h.category !== "商旅连锁") return false;
      if (state.selectedCategory === "奢华地标" && h.category !== "奢华地标") return false;
      if (state.selectedCategory === "景区度假" && !h.category.includes("度假")) return false;
      if (state.selectedCategory === "华住专享" && h.group !== "华住会") return false;
    }
    // 搜索词
    if (state.searchKeyword) {
      const kw = state.searchKeyword.toLowerCase();
      const match = h.name.toLowerCase().includes(kw) || 
                    h.city.toLowerCase().includes(kw) || 
                    h.brand.toLowerCase().includes(kw) ||
                    h.address.toLowerCase().includes(kw);
      if (!match) return false;
    }
    return true;
  });
  
  renderHotelCards();
}

/**
 * 渲染会员状态栏
 */
function updateMemberSummary() {
  const p = state.profile;
  const isWallet = p.activeView === "wallet";
  elements.memberViewToggle.innerText = isWallet ? "切换为公开标价" : "切换为会员实付价";
  elements.memberStatusSummary.innerHTML = isWallet
    ? `<span>携程: <strong>${p.ctrip === 'diamond' ? '钻石' : (p.ctrip === 'gold' ? '黄金' : '普通')}</strong></span> · ` +
      `<span>美团: <strong>${p.meituan === 'shen' ? '神会员' : '普通'}</strong></span> · ` +
      `<span>华住: <strong>${p.huazhu === 'platinum' ? '铂金' : (p.huazhu === 'gold' ? '金卡' : '普通')}</strong></span>`
    : `<span class="badge-base">当前以各平台公开标准挂牌价排序 (未叠会员)</span>`;
}

/**
 * 初始化绑定
 */
function initEvents() {
  // 城市点击
  elements.cityPills.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    elements.cityPills.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    state.selectedCity = pill.dataset.city;
    applyFilters();
  });
  
  // 分类点击
  elements.categoryPills.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    elements.categoryPills.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    state.selectedCategory = pill.dataset.cat;
    applyFilters();
  });
  
  // 搜索框
  elements.searchInput.addEventListener("input", (e) => {
    state.searchKeyword = e.target.value.trim();
    applyFilters();
  });
  
  // 会员模式切换
  elements.memberViewToggle.addEventListener("click", () => {
    state.profile.activeView = state.profile.activeView === "wallet" ? "base" : "wallet";
    saveMemberProfile(state.profile);
    updateMemberSummary();
    renderHotelCards();
    showToast(state.profile.activeView === "wallet" ? "已切换为【会员实付折后价】" : "已切换为【公开标价】");
  });
  
  // 抽屉关闭
  elements.sheetCloseBtn.addEventListener("click", () => {
    closeBottomSheet(elements.detailSheet, elements.sheetOverlay);
  });
  elements.sheetOverlay.addEventListener("click", () => {
    closeBottomSheet(elements.detailSheet, elements.sheetOverlay);
  });
  
  // 会员设置弹窗
  const openMemberModal = () => {
    elements.selectCtripTier.value = state.profile.ctrip;
    elements.selectMeituanTier.value = state.profile.meituan;
    elements.selectHuazhuTier.value = state.profile.huazhu;
    openBottomSheet(elements.memberModal, elements.memberModalOverlay);
  };
  
  document.getElementById("btnOpenMemberSettings").addEventListener("click", openMemberModal);
  elements.tabMember.addEventListener("click", openMemberModal);
  
  elements.closeMemberModalBtn.addEventListener("click", () => {
    closeBottomSheet(elements.memberModal, elements.memberModalOverlay);
  });
  elements.memberModalOverlay.addEventListener("click", () => {
    closeBottomSheet(elements.memberModal, elements.memberModalOverlay);
  });
  
  elements.saveMemberBtn.addEventListener("click", () => {
    state.profile.ctrip = elements.selectCtripTier.value;
    state.profile.meituan = elements.selectMeituanTier.value;
    state.profile.huazhu = elements.selectHuazhuTier.value;
    saveMemberProfile(state.profile);
    updateMemberSummary();
    renderHotelCards();
    closeBottomSheet(elements.memberModal, elements.memberModalOverlay);
    showToast("会员资产设置已保存！全网价格已实时重新核算。");
  });
  
  // 降价盯盘设置弹窗
  const openWatchModal = () => {
    const cfg = loadNotifierConfig();
    elements.pushPlusTokenInput.value = cfg.pushPlusToken || "";
    elements.serverChanKeyInput.value = cfg.serverChanKey || "";
    openBottomSheet(elements.watchModal, elements.watchModalOverlay);
  };
  
  elements.tabWatch.addEventListener("click", openWatchModal);
  elements.closeWatchModalBtn.addEventListener("click", () => {
    closeBottomSheet(elements.watchModal, elements.watchModalOverlay);
  });
  elements.watchModalOverlay.addEventListener("click", () => {
    closeBottomSheet(elements.watchModal, elements.watchModalOverlay);
  });
  
  elements.saveWatchCfgBtn.addEventListener("click", () => {
    const cfg = loadNotifierConfig();
    cfg.pushPlusToken = elements.pushPlusTokenInput.value.trim();
    cfg.serverChanKey = elements.serverChanKeyInput.value.trim();
    saveNotifierConfig(cfg);
    closeBottomSheet(elements.watchModal, elements.watchModalOverlay);
    showToast("微信双通道密钥已保存！");
  });
  
  // 双通道连通性实测
  elements.testPushBtn.addEventListener("click", async () => {
    elements.testPushBtn.disabled = true;
    elements.testPushBtn.innerText = "正在向双通道发起探针...";
    elements.pushTestLogs.style.display = "block";
    elements.pushTestLogs.innerHTML = "正在向后端调度 PushPlus 与 Server酱...<br/>";
    
    const cfg = loadNotifierConfig();
    try {
      const resp = await fetch("/api/notify/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_name: "全季酒店 (上海人民广场店)",
          target_price: 400,
          current_lowest_price: 382,
          channel_name: "华住会官方直销",
          pushplus_token: cfg.pushPlusToken || null,
          serverchan_key: cfg.serverChanKey || null
        })
      });
      const data = await resp.json();
      elements.pushTestLogs.innerHTML = data.logs.join("<br/>");
      showToast(data.success ? "双通道推送测试已触发！" : "推送未成功，请检查日志");
    } catch (err) {
      const res = await sendDualChannelNotification(
        "全季酒店(上海人民广场店) 降价提醒",
        "<strong>【降价通知】</strong>您关注的全季酒店(上海人民广场店) 华住直销实付价降至 <strong>¥382</strong> (低于您的预期价 ¥400)！请及时锁定。"
      );
      elements.pushTestLogs.innerHTML = res.logs.join("<br/>");
      showToast(res.success ? "本地双通道测试已触发！" : "推送未成功");
    } finally {
      elements.testPushBtn.disabled = false;
      elements.testPushBtn.innerText = "🚀 立即发送双通道测试推送";
    }
  });

  
  // 底部导航切换
  elements.tabRadar.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  elements.tabCalendar.addEventListener("click", () => {
    // 默认展示第一家酒店的日历
    openHotelDetail(state.filteredHotels[0] || state.hotels[0]);
  });

  // 初始化 V2 智能链接解析器
  initV2Parser(state, elements, (quote) => {
    const isHeuristic = quote.is_heuristic || quote.match_type === "dynamic_heuristic";
    const newHotel = {
      id: quote.hotel_id,
      name: quote.hotel_name,
      brand: quote.brand,
      city: quote.city,
      category: "商旅连锁",
      star: 4,
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80",
      address: isHeuristic ? `${quote.city} · 启发式估算 (待确认)` : `${quote.city} · V2 跨平台精准识别`,
      tags: isHeuristic 
        ? ["启发式推算", "全网估算", quote.room_type || "标准大床房 (待核实)"]
        : ["V2 动态解析", "全网比价", quote.room_type || "标准大床房"],
      benchmarkRoom: quote.room_type || (isHeuristic ? "标准大床房 (算法推算)" : "标准大床房 (基准对齐)"),
      channels: quote.channels,
      trend30d: quote.trend30d,
      advice: quote.tactical_advice,
      isV2Dynamic: true,
      matchType: quote.match_type,
      matchConfidence: quote.match_confidence,
      isHeuristic: isHeuristic
    };
    state.hotels.unshift(newHotel);
    state.filteredHotels.unshift(newHotel);
    renderHotelCards();
    window.scrollTo({ top: 0, behavior: "smooth" });
    const topCard = elements.hotelList.querySelector(".hotel-card");
    if (topCard && window.gsap) {
      gsap.fromTo(topCard, { scale: 0.95, y: -12, opacity: 0.6 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)" });
    }
  }, showToast);
}

// 启动入口
window.addEventListener("DOMContentLoaded", () => {
  updateMemberSummary();
  renderHotelCards();
  initEvents();
  initEntranceAnimations();
});
