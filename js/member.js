/**
 * 全局会员资产测算引擎 (Member Profile Engine)
 * 解决痛点：非侵入式，无需每个酒店手动填表，顶部全局设一次即可实时套用券后实付价
 */

const STORAGE_KEY = "hotel_radar_member_profile";

export const DEFAULT_MEMBER_PROFILE = {
  activeView: "wallet", // "base" (公开挂牌价) | "wallet" (我的实付预估价)
  ctrip: "diamond",      // "normal" (1.0) | "gold" (0.95) | "diamond" (0.90)
  meituan: "shen",       // "normal" (0) | "shen" (满减¥30)
  huazhu: "platinum"     // "normal" (1.0) | "gold" (0.88 + 1早) | "platinum" (0.85 + 2早)
};

export function loadMemberProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEMBER_PROFILE };
    return { ...DEFAULT_MEMBER_PROFILE, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_MEMBER_PROFILE };
  }
}

export function saveMemberProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error("Failed to save member profile", e);
  }
}

/**
 * 计算单个渠道在会员叠加后的真实预估价
 */
export function calcChannelPrice(channelKey, channelData, profile) {
  if (!channelData || channelData.status === "none" || channelData.isPending) {
    return null;
  }
  if (channelData.status === "maintenance") {
    return {
      price: null,
      basePrice: null,
      discountText: "🔧 渠道维护中 (降级隔离)",
      isDiscounted: false,
      isMaintenance: true
    };
  }
  
  const base = channelData.basePrice || channelData.base_price;
  if (!base) return null;
  
  if (profile.activeView === "base") {
    return {
      price: base,
      discountText: "公开挂牌价",
      isDiscounted: false
    };
  }
  
  let finalPrice = base;
  let discountText = "";
  
  if (channelKey === "ctrip") {
    if (profile.ctrip === "diamond") {
      finalPrice = Math.round(base * 0.90);
      discountText = "携程钻石 9 折";
    } else if (profile.ctrip === "gold") {
      finalPrice = Math.round(base * 0.95);
      discountText = "携程黄金 95 折";
    } else {
      discountText = "携程普通标价";
    }
  } else if (channelKey === "meituan") {
    if (profile.meituan === "shen") {
      finalPrice = Math.max(1, base - 30);
      discountText = "美团神会员立减¥30";
    } else {
      discountText = "美团普通标价";
    }
  } else if (channelKey === "huazhu") {
    if (profile.huazhu === "platinum") {
      finalPrice = Math.round(base * 0.85);
      discountText = "华住铂金 85 折 (含双早)";
    } else if (profile.huazhu === "gold") {
      finalPrice = Math.round(base * 0.88);
      discountText = "华住金卡 88 折 (含单早)";
    } else {
      discountText = "华住星会员标价";
    }
  }
  
  return {
    price: finalPrice,
    basePrice: base,
    discountText: discountText,
    isDiscounted: finalPrice < base,
    saved: base - finalPrice
  };
}

/**
 * 找出全渠道最低价及渠道名 (维护中渠道绝对不参与排序与比价)
 */
export function findBestChannel(channels, profile) {
  let minPrice = Infinity;
  let bestKey = null;
  let bestData = null;
  let maxPrice = 0;
  
  for (const key of ["huazhu", "meituan", "ctrip"]) {
    const ch = channels[key];
    if (ch && ch.status === "available" && (ch.basePrice || ch.base_price)) {
      const calc = calcChannelPrice(key, ch, profile);
      if (calc && !calc.isMaintenance && calc.price && calc.price < minPrice) {
        minPrice = calc.price;
        bestKey = key;
        bestData = { ...ch, ...calc };
      }
      if (calc && !calc.isMaintenance && calc.price && calc.price > maxPrice) {
        maxPrice = calc.price;
      }
    }
  }
  
  return {
    bestKey,
    bestData,
    minPrice: minPrice === Infinity ? null : minPrice,
    maxPrice: maxPrice,
    maxSavings: (minPrice !== null && maxPrice > minPrice) ? maxPrice - minPrice : 0
  };
}
