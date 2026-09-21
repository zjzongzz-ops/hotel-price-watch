/**
 * 客户端纯前端智能解析与跨平台比价引擎 (Client-side OTA Parser & Matcher)
 * 用于在离线、无 Python 后端或静态部署环境（如 Netlify / GitHub Pages / PWA）下，
 * 纯本地毫秒级解析 OTA 分享文案并实时对齐比价，保证手机端 7x24h 随时随地零延迟可用！
 */

import { HOTELS_DATA } from "./data.js";
import { calcChannelPrice } from "./member.js";

const KNOWN_CITIES = [
  "上海", "北京", "杭州", "成都", "三亚", "广州", "深圳", "西安", 
  "南京", "武汉", "重庆", "厦门", "青岛", "苏州", "长沙", "天津", 
  "郑州", "昆明", "大连", "珠海", "湖州", "莫干山"
];

const KNOWN_BRANDS = [
  "全季", "汉庭", "桔子水晶", "桔子", "亚朵", "W 酒店", "W酒店", 
  "香格里拉", "四季", "博舍", "亚特兰蒂斯", "白天鹅", "裸心堡", 
  "威斯汀", "金陵饭店", "凯悦", "洲际", "安达仕", "喜来登", "万豪"
];

const HUAZHU_BRANDS = [
  "全季", "汉庭", "桔子水晶", "桔子", "海友", "漫心", "宜必思", "禧玥", "花间堂", "城家"
];

const BASE_URLS = {
  ctrip: "https://m.ctrip.com/webapp/hotel/",
  meituan: "https://i.meituan.com/awp/h5/hotel/search/search.html",
  huazhu: "https://m.huazhu.com/",
  fliggy: "https://m.fliggy.com/"
};

export function parseAndMatchClientSide(rawText, profile = {}) {
  const text = rawText.trim();
  
  // 1. 提取 URL
  const urlMatches = text.match(/https?:\/\/[^\s\u4e00-\u9fa5<>"\')]+/g) || [];
  const sourceUrl = urlMatches.length > 0 ? urlMatches[0].replace(/[.,;!?]+$/, "") : "";

  // 2. 识别来源平台
  const lower = `${text} ${sourceUrl}`.toLowerCase();
  let sourcePlatform = "generic";
  if (lower.includes("ctrip.com") || lower.includes("携程") || lower.includes("t.ctrip.cn")) sourcePlatform = "ctrip";
  else if (lower.includes("meituan.com") || lower.includes("美团") || lower.includes("dianping.com") || lower.includes("dpurl.cn")) sourcePlatform = "meituan";
  else if (lower.includes("huazhu.com") || lower.includes("华住")) sourcePlatform = "huazhu";
  else if (lower.includes("fliggy.com") || lower.includes("飞猪") || lower.includes("alitrip")) sourcePlatform = "fliggy";

  // 3. 提取城市
  let city = "全国";
  for (const c of KNOWN_CITIES) {
    if (text.includes(c)) {
      city = c;
      break;
    }
  }

  // 4. 提取酒店名称
  let cleaned = text.replace(/【(?:飞猪|携程|美团|大众点评|华住|去哪儿|同程|艺龙)[^】]*】/g, "");
  cleaned = cleaned.replace(/\[(?:飞猪|携程|美团|大众点评|华住|去哪儿|同程|艺龙)[^\]]*\]/g, "");

  let hotelName = "";
  const bracketPats = [
    /【([^】]+?(?:酒店|客栈|度假村|宾馆|饭店|公寓)[^】]*?)】/,
    /「([^」]+?(?:酒店|客栈|度假村|宾馆|饭店|公寓)[^」]*?)」/,
    /\[([^\]]+?(?:酒店|客栈|度假村|宾馆|饭店|公寓)[^\]]*?)\]/,
    /【([^】]{4,25})】/
  ];
  for (const p of bracketPats) {
    const m = cleaned.match(p);
    if (m) {
      hotelName = m[1].trim();
      break;
    }
  }

  if (!hotelName) {
    // 关键词兜底匹配
    for (const b of KNOWN_BRANDS) {
      const re = new RegExp(`(${b}[^\\s,，。！!]{2,20}(?:酒店|客栈|度假村|分店|店)?)`);
      const m = cleaned.match(re);
      if (m) {
        hotelName = m[1].trim();
        break;
      }
    }
  }

  if (!hotelName) {
    hotelName = "未知酒店";
  }

  // 5. 提取品牌
  let brand = "精品酒店";
  for (const b of KNOWN_BRANDS) {
    if (`${hotelName} ${text}`.includes(b)) {
      brand = b;
      break;
    }
  }

  // 6. 提取价格锚点 (严格排除“立减/满减/优惠券”中的虚假立减金额)
  let priceHint = null;
  const explicitPat = /(?:实付|仅售|售价|预订价|专享价|现价|到手价|房费)[^\d]{0,6}(?:¥|￥)?\s*(\d{2,5})/i;
  const explicitMatch = text.match(explicitPat);
  if (explicitMatch) {
    priceHint = parseInt(explicitMatch[1], 10);
  } else {
    // 遮罩立减/抵扣短语
    const masked = text.replace(/(?:立减|满减|直减|直降|立省|最高省|优惠券|抵扣|红包|返现)[^\d]{0,4}\d{1,4}\s*(?:元|块)?/g, "___MASKED___");
    const generalPat = /(?:¥|￥)\s*(\d{2,5})|(\d{2,5})\s*(?:元|块)/;
    const genMatch = masked.match(generalPat);
    if (genMatch) {
      priceHint = parseInt(genMatch[1] || genMatch[2], 10);
    }
  }

  // 7. 基准库匹配
  let matchedBenchmark = null;
  let matchConfidence = 0.0;
  const cleanInputName = hotelName.replace(/[()（）·\s]/g, "").toLowerCase();

  const branchMatch = hotelName.match(/[（(]([^）)]+)[）)]/);
  const inputBranch = branchMatch ? branchMatch[1].trim().toLowerCase() : "";

  for (const h of HOTELS_DATA) {
    const cleanBenchName = h.name.replace(/[()（）·\s]/g, "").toLowerCase();
    
    // 检查分店名冲突
    const benchBranchMatch = h.name.match(/[（(]([^）)]+)[）)]/);
    const benchBranch = benchBranchMatch ? benchBranchMatch[1].trim().toLowerCase() : "";
    if (inputBranch && benchBranch) {
      const b1 = inputBranch.replace(/(分?店)/g, "");
      const b2 = benchBranch.replace(/(分?店)/g, "");
      if (!b1.includes(b2) && !b2.includes(b1)) continue;
    }

    // 检查冲突词 (裸心谷 vs 裸心堡)
    if ((cleanInputName.includes("裸心谷") && cleanBenchName.includes("裸心堡")) ||
        (cleanInputName.includes("裸心堡") && cleanBenchName.includes("裸心谷"))) {
      continue;
    }

    if (cleanInputName === cleanBenchName || cleanInputName.includes(cleanBenchName) || cleanBenchName.includes(cleanInputName)) {
      matchedBenchmark = h;
      matchConfidence = 1.0;
      break;
    }
  }

  const isHeuristic = !matchedBenchmark;
  const isWeakMatch = isHeuristic;
  const benchmarkRoomName = matchedBenchmark ? matchedBenchmark.roomType : "豪华大床房 (标准标间)";

  // 8. 组装各渠道报价
  const channels = {};
  const isHuazhuBrand = HUAZHU_BRANDS.includes(brand);

  if (matchedBenchmark) {
    // 基准库精确匹配
    const ctripBase = matchedBenchmark.channels.ctrip ? matchedBenchmark.channels.ctrip.basePrice : (priceHint || 450);
    const ctripW = calcChannelPrice("ctrip", ctripBase, profile);
    channels.ctrip = {
      platform: "携程旅行",
      channel_key: "ctrip",
      base_price: ctripBase,
      wallet_price: ctripW.walletPrice,
      discount_text: ctripW.discountText,
      url: matchedBenchmark.channels.ctrip?.url || BASE_URLS.ctrip,
      breakfast: matchedBenchmark.channels.ctrip?.breakfast || "无早餐",
      cancel_policy: matchedBenchmark.channels.ctrip?.cancelPolicy || "入住当天18:00前可退",
      room_name: benchmarkRoomName,
      status: "available",
      is_official: false,
      source_type: "benchmark_verified"
    };

    const mtBase = matchedBenchmark.channels.meituan ? matchedBenchmark.channels.meituan.basePrice : (priceHint || 442);
    const mtW = calcChannelPrice("meituan", mtBase, profile);
    channels.meituan = {
      platform: "美团酒店",
      channel_key: "meituan",
      base_price: mtBase,
      wallet_price: mtW.walletPrice,
      discount_text: mtW.discountText,
      url: matchedBenchmark.channels.meituan?.url || BASE_URLS.meituan,
      breakfast: matchedBenchmark.channels.meituan?.breakfast || "含单早",
      cancel_policy: matchedBenchmark.channels.meituan?.cancelPolicy || "入住前1天24:00前可免费取消",
      room_name: benchmarkRoomName,
      status: "available",
      is_official: false,
      source_type: "benchmark_verified"
    };

    if (matchedBenchmark.channels.huazhu) {
      const hzBase = matchedBenchmark.channels.huazhu.basePrice;
      const hzW = calcChannelPrice("huazhu", hzBase, profile);
      channels.huazhu = {
        platform: "华住会官方",
        channel_key: "huazhu",
        base_price: hzBase,
        wallet_price: hzW.walletPrice,
        discount_text: hzW.discountText,
        url: matchedBenchmark.channels.huazhu.url || BASE_URLS.huazhu,
        breakfast: matchedBenchmark.channels.huazhu.breakfast || "含双早",
        cancel_policy: matchedBenchmark.channels.huazhu.cancelPolicy || "整晚保留 · 随时可退",
        room_name: benchmarkRoomName,
        status: "available",
        is_official: true,
        source_type: "benchmark_verified"
      };
    }
  } else {
    // 启发式推算 (dynamic_heuristic)
    const anchor = priceHint || 450;
    
    // 携程
    const cW = calcChannelPrice("ctrip", anchor, profile);
    channels.ctrip = {
      platform: "携程旅行",
      channel_key: "ctrip",
      base_price: anchor,
      wallet_price: cW.walletPrice,
      discount_text: cW.discountText,
      url: (sourcePlatform === "ctrip" && sourceUrl) ? sourceUrl : BASE_URLS.ctrip,
      breakfast: "无早餐",
      cancel_policy: "入住当天18:00前可退",
      room_name: "大床房 (算法推算)",
      status: "available",
      is_official: false,
      source_type: "dynamic_heuristic"
    };

    // 美团
    const mtBase = Math.round(anchor * 0.96);
    const mtW = calcChannelPrice("meituan", mtBase, profile);
    channels.meituan = {
      platform: "美团酒店",
      channel_key: "meituan",
      base_price: mtBase,
      wallet_price: mtW.walletPrice,
      discount_text: mtW.discountText,
      url: (sourcePlatform === "meituan" && sourceUrl) ? sourceUrl : BASE_URLS.meituan,
      breakfast: "含单早",
      cancel_policy: "入住前1天可退",
      room_name: "大床房 (算法推算)",
      status: "available",
      is_official: false,
      source_type: "dynamic_heuristic"
    };

    // 华住 (若适用)
    if (isHuazhuBrand) {
      const hzW = calcChannelPrice("huazhu", anchor, profile);
      channels.huazhu = {
        platform: "华住会官方",
        channel_key: "huazhu",
        base_price: anchor,
        wallet_price: hzW.walletPrice,
        discount_text: hzW.discountText,
        url: (sourcePlatform === "huazhu" && sourceUrl) ? sourceUrl : BASE_URLS.huazhu,
        breakfast: "含双早",
        cancel_policy: "整晚保留 · 随时可退",
        room_name: "大床房 (算法推算)",
        status: "available",
        is_official: true,
        source_type: "dynamic_heuristic"
      };
    }
  }

  // 9. 计算最低价与战术建议
  const validQuotes = Object.entries(channels)
    .filter(([_, v]) => v.status === "available" && (v.wallet_price || v.base_price))
    .map(([k, v]) => ({ key: k, price: v.wallet_price || v.base_price, item: v }));

  validQuotes.sort((a, b) => a.price - b.price);

  let lowestKey = "";
  let lowestPrice = 0;
  let maxSavings = 0;

  if (validQuotes.length > 0) {
    lowestKey = validQuotes[0].key;
    lowestPrice = validQuotes[0].price;
    const maxP = Math.max(...validQuotes.map(q => q.price));
    maxSavings = Math.max(0, maxP - lowestPrice);
    channels[lowestKey].is_lowest = true;
  }

  const bestPlatform = lowestKey ? channels[lowestKey].platform : "";
  let tacticalAdvice = "";

  if (isHeuristic) {
    tacticalAdvice = `⚠️ 该酒店未收录于基准房型库，报价由平台公开规则及佣金模型启发式推算（推算置信度 0%）。当前推算底价为【${bestPlatform}】实付 ¥${lowestPrice}，相比在售渠道最高可省 ¥${maxSavings}。请核实房型与最终结算价。`;
  } else {
    if (lowestKey === "huazhu") {
      tacticalAdvice = `当前全网底价为【华住会官方】实付 ¥${lowestPrice}，相比在售渠道最高可省 ¥${maxSavings}。 华住官方直销赠送双份早餐且退改政策更宽容，推荐作为首选。`;
    } else {
      tacticalAdvice = `当前全网底价为【${bestPlatform}】实付 ¥${lowestPrice}，相比在售渠道最高可省 ¥${maxSavings}。请留意各渠道退改条件及早餐饮用权益。`;
    }
  }

  return {
    success: true,
    comparison: {
      hotel_name: hotelName,
      city: city,
      brand: brand,
      room_name: benchmarkRoomName,
      source_platform: sourcePlatform,
      source_url: sourceUrl,
      match_confidence: matchConfidence,
      is_heuristic: isHeuristic,
      is_weak_match: isWeakMatch,
      channels: channels,
      lowest_channel: lowestKey,
      lowest_price: lowestPrice,
      max_savings: maxSavings,
      tactical_advice: tacticalAdvice,
      source_text_hint: priceHint ? `¥${priceHint}` : "自动识别"
    }
  };
}
