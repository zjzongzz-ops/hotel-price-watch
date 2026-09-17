/**
 * 20 家国内基准酒店全维度数据集 (Benchmark Dataset)
 * 涵盖：商旅经济型/中端连锁、高星奢华地标、景区度假、周边网红民宿
 * 包含极限场景：周末暴涨、国庆高峰、满房(Sold out)、会员大差价、官方直营底价
 */

// 基准当前基线日期: 2026-09-16
const BASE_DATE = new Date("2026-09-16T00:00:00+08:00");

function generate30DayTrend(basePrice, weekendMultiplier = 1.35, holidayMultiplier = 1.8, isSoldOutOnHoliday = false) {
  const trend = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(BASE_DATE);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = d.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    
    // 国庆黄金周判定: 2026-10-01 至 2026-10-07
    const isHoliday = dateStr >= "2026-10-01" && dateStr <= "2026-10-07";
    
    let price = basePrice;
    let tag = "日常平价";
    let isSoldOut = false;
    
    if (isHoliday) {
      if (isSoldOutOnHoliday && (dateStr === "2026-10-02" || dateStr === "2026-10-03")) {
        isSoldOut = true;
        price = 0;
        tag = "已售罄";
      } else {
        price = Math.round(basePrice * holidayMultiplier);
        tag = "国庆高峰";
      }
    } else if (isWeekend) {
      price = Math.round(basePrice * (weekendMultiplier + (Math.sin(i) * 0.05)));
      tag = "周末溢价";
    } else {
      // 周二/周三常有商旅淡季微调
      if (dayOfWeek === 2 || dayOfWeek === 3) {
        price = Math.round(basePrice * 0.94);
        tag = "周中特惠";
      } else {
        price = Math.round(basePrice * (1 + (Math.sin(i * 1.5) * 0.03)));
      }
    }
    
    trend.push({
      date: dateStr,
      displayDate: `${d.getMonth() + 1}/${d.getDate()}`,
      dayOfWeek: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][dayOfWeek],
      price: price,
      tag: tag,
      isWeekend: isWeekend,
      isHoliday: isHoliday,
      isSoldOut: isSoldOut
    });
  }
  return trend;
}

export const HOTELS_DATA = [
  {
    id: "h_01",
    name: "全季酒店 (上海人民广场店)",
    brand: "全季",
    group: "华住会",
    city: "上海",
    category: "商旅连锁",
    star: 4,
    rating: 4.8,
    address: "黄浦区西藏中路500号 (近人民广场地铁站)",
    badge: "商旅标杆 · 华住直销底价",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "高级大床房 (26㎡ / 1张1.8米大床 / 外窗 / 极简茶香风)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 486,
        breakfast: "无早餐",
        cancelPolicy: "入住当天18:00前可免费取消",
        status: "available",
        url: "https://m.ctrip.com/webapp/hotel/",
        memberHint: "携程钻石约92折"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 472,
        breakfast: "含单早",
        cancelPolicy: "入住前1天24:00前可免费取消",
        status: "available",
        url: "https://hotel.meituan.com/",
        memberHint: "美团神会员立减¥30"
      },
      huazhu: {
        platform: "华住会官方",
        basePrice: 450,
        breakfast: "含双早",
        cancelPolicy: "整晚保留 · 随时可退",
        status: "available",
        url: "https://m.huazhu.com/",
        isOfficial: true,
        memberHint: "铂金会员85折+双早"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 478,
        breakfast: "无早",
        cancelPolicy: "不可取消",
        status: "pending",
        isPending: true,
        memberHint: "阶段0待准入"
      }
    },
    trend30d: generate30DayTrend(450, 1.25, 1.7),
    advice: "华住官网含双早实付 ¥450（铂金折后仅 ¥382），比携程裸房省 ¥104！避开 10.1~10.3 国庆溢价高峰。"
  },
  {
    id: "h_02",
    name: "亚朵酒店 (北京中关村软件园店)",
    brand: "亚朵",
    group: "亚朵集团",
    city: "北京",
    category: "商旅连锁",
    star: 4,
    rating: 4.9,
    address: "海淀区东北旺西路8号中关村软件园2号楼",
    badge: "大厂差旅首选 · 亚朵人文体验",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "高级大床房 (30㎡ / 普兰特床垫 / 独立书吧 / 静音玻璃)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 588,
        breakfast: "无早餐",
        cancelPolicy: "入住当天18:00前免费取消",
        status: "available",
        url: "https://m.ctrip.com/webapp/hotel/",
        memberHint: "商旅优选"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 550,
        breakfast: "含单早",
        cancelPolicy: "入住前1天可退",
        status: "available",
        url: "https://hotel.meituan.com/",
        memberHint: "商家特惠券后立省"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 576,
        breakfast: "无早",
        cancelPolicy: "不可取消",
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(550, 0.95, 1.4), // 工作日IT商务溢价，周末反而降价！
    advice: "典型IT商旅特征：周五至周日价格反而回落 15%！周末去北京出差或旅游入住极具性价比，首选美团（含单早）。"
  },
  {
    id: "h_03",
    name: "桔子水晶酒店 (杭州西湖湖滨店)",
    brand: "桔子水晶",
    group: "华住会",
    city: "杭州",
    category: "景区度假",
    star: 4,
    rating: 4.8,
    address: "上城区延安路298号 (近西湖步行5分钟)",
    badge: "湖滨核心 · 周末暴涨预警",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "水晶大床房 (32㎡ / 智能客控 / 胶囊咖啡 / 威士忌音箱)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 680,
        breakfast: "无早餐",
        cancelPolicy: "入住当天18:00前免费取消",
        status: "available",
        url: "https://m.ctrip.com/webapp/hotel/"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 658,
        breakfast: "含单早",
        cancelPolicy: "入住前1天可退",
        status: "available",
        url: "https://hotel.meituan.com/"
      },
      huazhu: {
        platform: "华住会官方",
        basePrice: 620,
        breakfast: "含双早",
        cancelPolicy: "整晚可退",
        status: "available",
        url: "https://m.huazhu.com/",
        isOfficial: true
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 660,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(620, 1.55, 2.1), // 周末极度暴涨！
    advice: "⚠️ 西湖景区典型周末暴涨型：周六相比周三价格上浮高达 55%！强烈建议周一至周四入住，华住官方含双早底价锁定。"
  },
  {
    id: "h_04",
    name: "汉庭酒店 (成都春熙路太古里店)",
    brand: "汉庭",
    group: "华住会",
    city: "成都",
    category: "商旅连锁",
    star: 3,
    rating: 4.7,
    address: "锦江区东大街下东大街段36号",
    badge: "国民性价比 · 学生与青年力荐",
    image: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "汉庭3.5 大床房 (20㎡ / 人体工学床垫 / 隔音封条 / 洁净封签)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 288,
        breakfast: "无早餐",
        cancelPolicy: "不可取消",
        status: "available",
        url: "https://m.ctrip.com/webapp/hotel/"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 268,
        breakfast: "无早餐",
        cancelPolicy: "不可取消",
        status: "available",
        url: "https://hotel.meituan.com/"
      },
      huazhu: {
        platform: "华住会官方",
        basePrice: 245,
        breakfast: "含单早",
        cancelPolicy: "免费取消",
        status: "available",
        url: "https://m.huazhu.com/",
        isOfficial: true
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 275,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(245, 1.3, 1.8),
    advice: "华住直销 ¥245 还带早餐且能免费取消，OTA 平台多为不可取消。百元级酒店官方渠道价格最硬！"
  },
  {
    id: "h_05",
    name: "上海外滩 W 酒店",
    brand: "W Hotels",
    group: "万豪集团",
    city: "上海",
    category: "奢华地标",
    star: 5,
    rating: 4.8,
    address: "虹口区旅顺路66号 (北外滩一线江景)",
    badge: "顶奢地标 · 陆家嘴天际线大片",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "壮美客房 (46㎡ / 浦江景观 / 标志性W睡床 / 盲盒特调香)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 2588,
        breakfast: "无早",
        cancelPolicy: "入住前2天18:00前可免费取消",
        status: "available",
        url: "https://m.ctrip.com/webapp/hotel/",
        memberHint: "携程高端商旅权益"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 2460,
        breakfast: "含双早",
        cancelPolicy: "不可取消 (-8%)",
        status: "available",
        url: "https://i.meituan.com",
        memberHint: "美团大额高星神券"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪万豪旗舰店",
        basePrice: 2520,
        breakfast: "无早",
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(2460, 1.45, 2.2),
    advice: "美团当前投放高星专项满减，含双早实付 ¥2460 击穿携程裸房底价（携程加双早需另付 ¥480）！"
  },
  {
    id: "h_06",
    name: "三亚亚特兰蒂斯酒店",
    brand: "亚特兰蒂斯",
    group: "复星旅文",
    city: "三亚",
    category: "景区度假",
    star: 5,
    rating: 4.9,
    address: "海棠区海棠北路三亚海棠湾中心地带",
    badge: "海岛亲子狂欢 · 含水世界水族馆",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "海景大床房 (48㎡ / 正对海棠湾全景 / 赠双人水世界及水族馆门票)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 2980,
        breakfast: "含双早+门票",
        cancelPolicy: "提前3天免费取消",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 2850,
        breakfast: "含双早+门票",
        cancelPolicy: "提前2天免费取消",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 2920,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(2850, 1.35, 2.4, true), // 国庆售罄边界！
    advice: "注意：国庆期间（10.2~10.3）基础房型已触发【满房熔断】！建议提前至少 15 天预订，美团当前券后底价 ¥2850 略胜携程。"
  },
  {
    id: "h_07",
    name: "北京国贸大酒店 (香格里拉集团)",
    brand: "香格里拉",
    group: "香格里拉",
    city: "北京",
    category: "奢华地标",
    star: 5,
    rating: 4.9,
    address: "朝阳区建国门外大街1号国贸三期 (64-80层俯瞰紫禁城)",
    badge: "云端奢享 · 京城最高地标酒店",
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "行政客房 (55㎡ / 落地全景 / 超大理石浴室 / 欧舒丹备品)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 2180,
        breakfast: "无早",
        cancelPolicy: "入住前1天18:00前可退",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 2120,
        breakfast: "无早",
        cancelPolicy: "不可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 2150,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(2120, 1.05, 1.5),
    advice: "商政核心地标，工作日与周末差价仅 5%。携程虽然贵 60 元但支持提前 1 天免费取消，退改宽容度高推荐携程。"
  },
  {
    id: "h_08",
    name: "杭州西子湖四季酒店",
    brand: "四季酒店",
    group: "Four Seasons",
    city: "杭州",
    category: "景区度假",
    star: 5,
    rating: 5.0,
    address: "西湖区灵隐路5号 (西湖隐秘江南园林)",
    badge: "江南园林巅峰 · 国庆已售罄预警",
    image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "园景精选客房 (63㎡ / 独立私人庭院露台 / 娇兰定制备品)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 6500,
        breakfast: "含双早",
        cancelPolicy: "提前7天免费取消",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 6480,
        breakfast: "含双早",
        cancelPolicy: "提前7天免费取消",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 6550,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(6480, 1.4, 2.5, true),
    advice: "⚠️ 极端紧俏地标：10.2~10.3 房态已满房售罄！平季预订建议提早 20 天以上锁定，OTA 价格高度控盘，差价不大。"
  },
  {
    id: "h_09",
    name: "深圳福田香格里拉大酒店",
    brand: "香格里拉",
    group: "香格里拉",
    city: "深圳",
    category: "商旅连锁",
    star: 5,
    rating: 4.8,
    address: "福田区益田路4088号 (会展中心旁)",
    badge: "金融CBD核心 · 会展商务标杆",
    image: "https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "豪华客房 (45㎡ / 繁华CBD景致 / 独立更衣室)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 1120,
        breakfast: "无早",
        cancelPolicy: "入住前1天免费取消",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 1060,
        breakfast: "含单早",
        cancelPolicy: "不可取消",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 1090,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(1060, 0.92, 1.3),
    advice: "深圳展会酒店规律：会展周（周二至周四）价格偏高，周末度假反向降价 8%！"
  },
  {
    id: "h_10",
    name: "成都博舍酒店 (The Temple House)",
    brand: "太古酒店",
    group: "太古集团",
    city: "成都",
    category: "奢华地标",
    star: 5,
    rating: 4.9,
    address: "锦江区笔帖式街81号 (太古里清代四合院入口)",
    badge: "古典四合院与前卫美学碰撞",
    image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "Studio 60 豪华大床房 (60㎡ / 水磨石深泡浴缸 / 免费Minibar)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 2800,
        breakfast: "含双早",
        cancelPolicy: "提前3天免费取消",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 2680,
        breakfast: "无早",
        cancelPolicy: "不可取消",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 2750,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(2680, 1.3, 1.9),
    advice: "携程含双早 ¥2800，美团无早 ¥2680。博舍单人早餐市价 ¥230，双早价值 ¥460，计算后携程性价比更高！"
  },
  {
    id: "h_11",
    name: "西安大雁塔全季酒店",
    brand: "全季",
    group: "华住会",
    city: "西安",
    category: "商旅连锁",
    star: 4,
    rating: 4.8,
    address: "雁塔区西影路46号 (近大唐不夜城景区)",
    badge: "文旅流量热点 · 步行直达不夜城",
    image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "高级大床房 (25㎡ / 茶香香氛 / 零压床品)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 388,
        breakfast: "无早",
        cancelPolicy: "入住前1天可退",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 370,
        breakfast: "无早",
        cancelPolicy: "不可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "华住会官方",
        basePrice: 342,
        breakfast: "含双早",
        cancelPolicy: "整晚可退",
        status: "available",
        url: "https://m.huazhu.com",
        isOfficial: true
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 375,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(342, 1.45, 2.2),
    advice: "华住官方直销 ¥342 含双早完胜第三方 OTA，节假日建议提前10天以上锁房。"
  },
  {
    id: "h_12",
    name: "广州白天鹅宾馆",
    brand: "白天鹅",
    group: "岭南商旅",
    city: "广州",
    category: "奢华地标",
    star: 5,
    rating: 4.9,
    address: "荔湾区沙面南街1号 (沙面岛一线珠江景致)",
    badge: "中国首家五星老字号 · 米其林早茶殿堂",
    image: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "豪华江景大床房 (35㎡ / 故乡水瀑布景 / 珠江夜游航道视界)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 1580,
        breakfast: "无早",
        cancelPolicy: "入住前1天18:00前免费取消",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 1490,
        breakfast: "含双早茶套餐",
        cancelPolicy: "提前2天可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 1540,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(1490, 1.35, 1.9),
    advice: "美团套餐包含老字号双人早茶券（可免排队VIP快速入席），折算后实际比携程划算 ¥260 以上！"
  },
  {
    id: "h_13",
    name: "杭州阿里西溪园区全季酒店",
    brand: "全季",
    group: "华住会",
    city: "杭州",
    category: "商旅连锁",
    star: 4,
    rating: 4.7,
    address: "余杭区文一西路998号海创基地内",
    badge: "未来科技城大厂商旅腹地",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "高级大床房 (28㎡ / 临街静音窗 / 智能客控)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 410,
        breakfast: "无早",
        cancelPolicy: "当天可退",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 395,
        breakfast: "含单早",
        cancelPolicy: "不可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "华住会官方",
        basePrice: 375,
        breakfast: "含双早",
        cancelPolicy: "随时可退",
        status: "available",
        url: "https://m.huazhu.com",
        isOfficial: true
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 398,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(375, 0.9, 1.3),
    advice: "典型大厂作息：周五与周末价格比工作日低 10%，周末来西溪湿地自驾游入住超值。"
  },
  {
    id: "h_14",
    name: "莫干山裸心堡度假村",
    brand: "裸心",
    group: "裸心集团",
    city: "湖州",
    category: "周边度假",
    star: 5,
    rating: 4.8,
    address: "德清县莫干山镇劳岭村三九坞",
    badge: "欧式悬崖古堡 · 周末极度暴涨",
    image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "城堡厢房 (55㎡ / 悬崖竹海景致 / 私享壁炉)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 2880,
        breakfast: "含双早",
        cancelPolicy: "提前5天可退",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 2790,
        breakfast: "含双早",
        cancelPolicy: "提前5天可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 2850,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(2790, 1.85, 2.6), // 周末暴涨 85%!
    advice: "⚠️ 极端周末暴涨案例：周六价格较周二飙升 85%！周日入住至周二，能省下近 ¥2000 房费。"
  },
  {
    id: "h_15",
    name: "珠海长隆横琴湾酒店",
    brand: "长隆酒店",
    group: "长隆集团",
    city: "珠海",
    category: "景区度假",
    star: 5,
    rating: 4.8,
    address: "香洲区横琴新区环岛东路长隆国际海洋度假区",
    badge: "海洋主题亲子标杆 · 独家水上乐园",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "度假海景大床房 (45㎡ / 远眺澳门天际线 / 赠水世界手环)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 1680,
        breakfast: "含双早",
        cancelPolicy: "入住前2天免费取消",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 1560,
        breakfast: "无早",
        cancelPolicy: "不可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 1620,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(1560, 1.45, 2.3),
    advice: "美团单房价格低但无早且不可退，带娃家庭建议选携程含双早房型，避免现场补早（¥198/位）。"
  },
  {
    id: "h_16",
    name: "重庆解放碑威斯汀酒店",
    brand: "威斯汀",
    group: "万豪集团",
    city: "重庆",
    category: "奢华地标",
    star: 5,
    rating: 4.9,
    address: "渝中区新华路222号 (53层无边玻璃悬空观景台)",
    badge: "洪崖洞解放碑双核 · 网红天际线打卡",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "豪华都市景观大床房 (42㎡ / 天梦之床 / 高空两江夜景)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 1380,
        breakfast: "无早",
        cancelPolicy: "入住前1天可退",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 1299,
        breakfast: "含单早",
        cancelPolicy: "提前24小时可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 1330,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(1299, 1.38, 2.0),
    advice: "美团限时特惠 ¥1299 含单早，比携程裸房直降 ¥81，性价比极高。"
  },
  {
    id: "h_17",
    name: "南京金陵饭店",
    brand: "金陵饭店",
    group: "金陵集团",
    city: "南京",
    category: "奢华地标",
    star: 5,
    rating: 4.8,
    address: "鼓楼区汉中路2号新街口广场核心",
    badge: "中华第一高楼传奇 · 新街口地标",
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "亚太商务大床房 (38㎡ / 智能卫浴 / 经典金陵细意浓情服务)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 860,
        breakfast: "无早",
        cancelPolicy: "当天18:00前可退",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 818,
        breakfast: "含单早",
        cancelPolicy: "提前1天可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 840,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(818, 1.25, 1.7),
    advice: "美团新街口专项商券满减后底价 ¥818，含单早极具竞争力。"
  },
  {
    id: "h_18",
    name: "武汉光谷凯悦酒店",
    brand: "凯悦",
    group: "凯悦集团",
    city: "武汉",
    category: "奢华地标",
    star: 5,
    rating: 4.8,
    address: "洪山区珞喻路1077号 (近华中科技大学)",
    badge: "东方禅意美学 · 光谷商旅高地",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "标准客房 (42㎡ / 橡木浴缸 / 落地窗景 / 专属咖啡机)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 780,
        breakfast: "无早",
        cancelPolicy: "入住当天18点前可退",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 735,
        breakfast: "含单早",
        cancelPolicy: "不可退",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 760,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(735, 1.15, 1.5),
    advice: "日常商旅差价稳定在 45 元左右，行程确定的旅客直接选美团特惠不可取消房。"
  },
  {
    id: "h_19",
    name: "青岛海尔洲际酒店",
    brand: "洲际",
    group: "洲际集团",
    city: "青岛",
    category: "景区度假",
    star: 5,
    rating: 4.8,
    address: "市南区澳门路98号奥帆中心内",
    badge: "奥帆中心一线游艇海景",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "经典海景房 (45㎡ / 俯瞰浮山湾灯光秀 / 奢华大理石浴室)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 1280,
        breakfast: "无早",
        cancelPolicy: "提前2天免费取消",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 1210,
        breakfast: "含双早",
        cancelPolicy: "提前2天免费取消",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 1250,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(1210, 1.45, 2.1),
    advice: "9月中下旬秋高气爽但避开了暑期峰值，美团 ¥1210 还送双早，比暑假省 40% 以上！"
  },
  {
    id: "h_20",
    name: "厦门安达仕酒店 (Andaz Xiamen)",
    brand: "安达仕",
    group: "凯悦集团",
    city: "厦门",
    category: "奢华地标",
    star: 5,
    rating: 4.9,
    address: "思明区湖滨东路101号 (华润万象城内)",
    badge: "南洋热带美学庄园 · 凯悦潮流先锋",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80",
    benchmarkRoom: "安达仕客房 (50㎡ / 南洋花砖 / 免费特色软饮与本地精酿啤酒)",
    channels: {
      ctrip: {
        platform: "携程旅行",
        basePrice: 1620,
        breakfast: "含双早",
        cancelPolicy: "入住前1天免费取消",
        status: "available",
        url: "https://m.ctrip.com"
      },
      meituan: {
        platform: "美团酒店",
        basePrice: 1540,
        breakfast: "含双早",
        cancelPolicy: "不可取消",
        status: "available",
        url: "https://i.meituan.com"
      },
      huazhu: {
        platform: "非华住系",
        basePrice: null,
        status: "none"
      },
      fliggy: {
        platform: "飞猪旅行",
        basePrice: 1590,
        status: "pending",
        isPending: true
      }
    },
    trend30d: generate30DayTrend(1540, 1.4, 2.0),
    advice: "美团特惠立省 ¥80，若需行程灵活可备选携程退改规则更宽容的房型。"
  }
];
