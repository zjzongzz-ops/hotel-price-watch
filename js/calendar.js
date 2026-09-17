/**
 * 30 天价格热力日历与走势洞察分析器 (30-Day Heatmap Calendar)
 */

export function analyzePriceTrend(trend30d) {
  if (!trend30d || trend30d.length === 0) return null;
  
  const validDays = trend30d.filter(d => !d.isSoldOut && d.price > 0);
  if (validDays.length === 0) return null;
  
  const prices = validDays.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  
  const weekendDays = validDays.filter(d => d.isWeekend);
  const weekdayDays = validDays.filter(d => !d.isWeekend && !d.isHoliday);
  
  const avgWeekend = weekendDays.length ? Math.round(weekendDays.reduce((a, b) => a + b.price, 0) / weekendDays.length) : avgPrice;
  const avgWeekday = weekdayDays.length ? Math.round(weekdayDays.reduce((a, b) => a + b.price, 0) / weekdayDays.length) : avgPrice;
  
  const weekendSurgePct = avgWeekday > 0 ? Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100) : 0;
  
  const lowestDays = validDays.filter(d => d.price === minPrice);
  
  return {
    minPrice,
    maxPrice,
    avgPrice,
    avgWeekend,
    avgWeekday,
    weekendSurgePct,
    lowestDateStr: lowestDays[0]?.displayDate || "",
    lowestDayOfWeek: lowestDays[0]?.dayOfWeek || ""
  };
}

export function renderCalendarGrid(trend30d, onSelectDate) {
  const container = document.createElement("div");
  container.className = "calendar-grid-container";
  
  const stats = analyzePriceTrend(trend30d);
  if (!stats) return container;
  
  // 顶部统计栏
  const header = document.createElement("div");
  header.className = "calendar-stats-banner";
  header.innerHTML = `
    <div class="stat-pill low">
      <span class="dot"></span>
      <span>月度谷底 <strong>¥${stats.minPrice}</strong> (${stats.lowestDateStr})</span>
    </div>
    <div class="stat-pill surge">
      <span class="dot red"></span>
      <span>周末平均溢价 <strong>+${stats.weekendSurgePct}%</strong></span>
    </div>
  `;
  container.appendChild(header);
  
  // 星期表头
  const weekRow = document.createElement("div");
  weekRow.className = "calendar-week-row";
  ["日", "一", "二", "三", "四", "五", "六"].forEach((w, idx) => {
    const th = document.createElement("div");
    th.className = `calendar-week-cell ${idx === 0 || idx === 6 ? "weekend" : ""}`;
    th.innerText = w;
    weekRow.appendChild(th);
  });
  container.appendChild(weekRow);
  
  // 网格主体
  const grid = document.createElement("div");
  grid.className = "calendar-day-grid";
  
  // 对齐第一天的星期偏移
  const firstDayOfWeek = new Date(trend30d[0].date).getDay();
  for (let p = 0; p < firstDayOfWeek; p++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-cell empty";
    grid.appendChild(emptyCell);
  }
  
  trend30d.forEach((day) => {
    const cell = document.createElement("div");
    const isLowest = day.price === stats.minPrice && !day.isSoldOut;
    const isHigh = day.price > stats.avgPrice * 1.2 && !day.isSoldOut;
    
    let stateClass = "";
    if (day.isSoldOut) stateClass = "sold-out";
    else if (isLowest) stateClass = "lowest-cell";
    else if (day.isHoliday) stateClass = "holiday-cell";
    else if (isHigh) stateClass = "high-cell";
    
    cell.className = `calendar-cell ${stateClass}`;
    cell.innerHTML = `
      <div class="cell-date">${day.displayDate.split("/")[1]}</div>
      <div class="cell-price">${day.isSoldOut ? "售罄" : `¥${day.price}`}</div>
      <div class="cell-tag">${day.isSoldOut ? "满房" : (isLowest ? "全月最低" : (day.isHoliday ? "国庆" : (day.isWeekend ? "周末" : "")))}</div>
    `;
    
    cell.addEventListener("click", () => {
      if (typeof onSelectDate === "function") {
        onSelectDate(day);
      }
    });
    
    grid.appendChild(cell);
  });
  
  container.appendChild(grid);
  
  // 智能决策建议
  const adviceBox = document.createElement("div");
  adviceBox.className = "calendar-tactical-advice";
  adviceBox.innerHTML = `
    <div class="advice-badge">⚡ 比价雷达决策建议</div>
    <div class="advice-content">
      全月最低价出现在 <strong>${stats.lowestDateStr} (${stats.lowestDayOfWeek})</strong>，低至 <strong>¥${stats.minPrice}</strong>。
      ${stats.weekendSurgePct > 20 ? `避开周五/周六入住，平均可立省 <strong>${stats.weekendSurgePct}%</strong>。` : `该酒店周末与工作日价差不显著，随心入住即可。`}
      10月1日~7日国庆期间价格翻倍，建议错峰在 9月28日前后出行。
    </div>
  `;
  container.appendChild(adviceBox);
  
  return container;
}
