/**
 * GSAP 动效与交互控制器 (Aesthetics & GSAP Skill)
 * 拒绝生硬跳变与廉价闪烁，打造媲美原生 App 的丝滑体验
 */

export function initEntranceAnimations() {
  if (typeof gsap === "undefined") return;
  
  // 顶部导航与会员条入场
  gsap.from(".app-header", {
    y: -30,
    opacity: 0,
    duration: 0.6,
    ease: "power3.out"
  });
  
  gsap.from(".member-quick-bar", {
    y: -15,
    opacity: 0,
    duration: 0.5,
    delay: 0.2,
    ease: "power2.out"
  });
  
  // 搜索栏及城市过滤器
  gsap.from(".search-section", {
    y: 20,
    opacity: 0,
    duration: 0.5,
    delay: 0.3,
    ease: "power2.out"
  });
  
  // 酒店卡片 Stagger 错落上浮
  animateHotelCards();
}

export function animateHotelCards() {
  if (typeof gsap === "undefined") return;
  
  const cards = document.querySelectorAll(".hotel-card");
  if (!cards.length) return;
  
  gsap.fromTo(cards, 
    { y: 35, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.55,
      stagger: 0.06,
      ease: "power2.out"
    }
  );
}

export function openBottomSheet(sheetEl, overlayEl) {
  if (typeof gsap === "undefined") {
    sheetEl.classList.add("active");
    overlayEl.classList.add("active");
    return;
  }
  
  overlayEl.style.display = "block";
  sheetEl.style.display = "flex";
  
  gsap.to(overlayEl, {
    opacity: 1,
    duration: 0.3,
    ease: "power2.out"
  });
  
  gsap.fromTo(sheetEl,
    { y: "100%" },
    {
      y: "0%",
      duration: 0.42,
      ease: "power3.out"
    }
  );
}

export function closeBottomSheet(sheetEl, overlayEl) {
  if (typeof gsap === "undefined") {
    sheetEl.classList.remove("active");
    overlayEl.classList.remove("active");
    return;
  }
  
  gsap.to(sheetEl, {
    y: "100%",
    duration: 0.32,
    ease: "power3.in",
    onComplete: () => {
      sheetEl.style.display = "none";
    }
  });
  
  gsap.to(overlayEl, {
    opacity: 0,
    duration: 0.25,
    ease: "power2.in",
    onComplete: () => {
      overlayEl.style.display = "none";
    }
  });
}

export function pulseElement(el) {
  if (typeof gsap === "undefined") return;
  gsap.fromTo(el,
    { scale: 1 },
    {
      scale: 1.08,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
      ease: "power1.inOut"
    }
  );
}
