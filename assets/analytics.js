// Google Analytics 4 埋點：瀏覽人數與停留時間由 GA4 自動記錄，這裡另外補上
// 滾動深度（25/50/75/100%）、加密頁解鎖、外部連結點擊、語言切換。
// 排除自己的瀏覽：在任一頁網址後加 ?notrack 開啟（這個瀏覽器之後都不記錄），加 ?track 取消。
(function () {
  var ID = 'G-Z3EVL5T5L8';
  var OPT_OUT = 'ga-optout';
  try {
    var q = location.search;
    if (/[?&]notrack\b/.test(q)) localStorage.setItem(OPT_OUT, '1');
    if (/[?&]track\b/.test(q)) localStorage.removeItem(OPT_OUT);
    if (localStorage.getItem(OPT_OUT) === '1') window['ga-disable-' + ID] = true;
  } catch (e) {}

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID);
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);

  function lang() { return document.documentElement.lang === 'zh-Hant' ? 'zh' : 'en'; }

  // 滾動深度：每個門檻每次瀏覽只記一次。加密頁解鎖前畫面很短，等解鎖後才開始算。
  var marks = [25, 50, 75, 100], sent = {};
  var locked = !!document.getElementById('enc-payload');
  function onScroll() {
    if (locked) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    var pct = (window.scrollY / max) * 100;
    marks.forEach(function (m) {
      if (!sent[m] && pct >= m - 1) {
        sent[m] = true;
        gtag('event', 'scroll_depth', { percent: m, page_language: lang() });
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // 加密頁：頁面解鎖時呼叫 window.trackUnlock('password' | 'session')，解鎖失敗呼叫 window.trackUnlockFail()
  window.trackUnlock = function (method) {
    locked = false;
    gtag('event', 'page_unlock', { method: method });
  };
  window.trackUnlockFail = function () { gtag('event', 'page_unlock_fail'); };
  if (window.__pendingUnlock) window.trackUnlock(window.__pendingUnlock);

  document.addEventListener('click', function (e) {
    // 語言切換
    var opt = e.target.closest && e.target.closest('#langBtn');
    if (opt) {
      setTimeout(function () { gtag('event', 'language_switch', { language: lang() }); }, 0);
      return;
    }
    // 外部連結與 Email
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var type = null;
    if (/^mailto:/i.test(href)) type = 'email';
    else if (a.hostname && a.hostname !== location.hostname) type = /linkedin\.com$/i.test(a.hostname) ? 'linkedin' : 'external';
    if (!type) return;
    gtag('event', 'link_click', {
      link_type: type,
      link_url: type === 'email' ? 'mailto' : a.href,
      link_text: (a.textContent || '').trim().slice(0, 80)
    });
  });
})();
