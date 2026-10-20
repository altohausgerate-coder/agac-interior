/* Epoxy Azerbaijan — dil sistemi (AZ / EN / RU / AR)
   Səhifədəki mətn Azərbaycan dilində yazılır; tərcümələr js/i18n/<səhifə>.js
   faylında I18N.add({"AZ mətn": ["EN", "RU", "AR"]}) şəklində saxlanılır. */
(function () {
  var LANGS = ['az', 'en', 'ru', 'ar'];
  var COL = { en: 0, ru: 1, ar: 2 };
  var ATTRS = ['placeholder', 'alt', 'title', 'aria-label'];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, svg: 1 };
  var dict = {};

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  var lang = null;
  try { lang = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (LANGS.indexOf(lang) < 0) { try { lang = localStorage.getItem('lang'); } catch (e) {} }
  if (LANGS.indexOf(lang) < 0) lang = 'az';
  try { localStorage.setItem('lang', lang); } catch (e) {}

  var root = document.documentElement;
  root.lang = lang;
  var base = document.createElement('style');
  base.textContent = ':where(button[data-lang]){background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer;line-height:inherit}';
  (document.head || root).appendChild(base);
  if (lang === 'ar') {
    root.dir = 'rtl';
    var st = document.createElement('style');
    st.textContent =
      "@font-face{font-family:'ArUI';font-style:normal;font-weight:300;font-display:swap;src:url(https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOW_uCRXMR5Kw.woff2) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}" +
      "@font-face{font-family:'ArUI';font-style:normal;font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6Ys43PWrfQ.woff2) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}" +
      "@font-face{font-family:'ArUI';font-style:normal;font-weight:500 900;font-display:swap;src:url(https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPO_-CRXMR5Kw.woff2) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}" +
      /* ərəb hərfləri bitişik yazılır: hərf arası boşluq və kursiv onları pozur */
      "html[lang=ar] body *{letter-spacing:0!important;font-style:normal!important}" +
      "html[lang=ar] body{font-family:'ArUI',sans-serif}" +
      "html[lang=ar] input,html[lang=ar] textarea,html[lang=ar] select{text-align:right}" +
      "html[lang=ar] input[type=tel],html[lang=ar] a[href^='tel:']{direction:ltr;unicode-bidi:embed}";
    (document.head || root).appendChild(st);
  }

  function tr(s) {
    var k = norm(s);
    var row = dict[k];
    return row ? row[COL[lang]] : null;
  }

  function doText(n) {
    var v = n.nodeValue;
    if (!v || !/\S/.test(v)) return;
    var t = tr(v);
    if (t == null || t === norm(v)) return;
    var lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0];
    n.nodeValue = lead + t + tail;
  }

  function doEl(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a) { var t = tr(a); if (t != null && t !== a) el.setAttribute(ATTRS[i], t); }
    }
  }

  function walk(node) {
    if (node.nodeType === 3) { var p = node.parentNode; if (!p || !SKIP[p.nodeName]) doText(node); return; }
    if (node.nodeType !== 1 || SKIP[node.nodeName]) return;
    doEl(node);
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function translateHead() {
    var t = tr(document.title); if (t != null) document.title = t;
    var ms = document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]');
    for (var i = 0; i < ms.length; i++) { var c = tr(ms[i].content); if (c != null) ms[i].content = c; }
  }

  /* ərəb şriftini səhifənin öz şrift dəyişənlərinin önünə əlavə et — latın hərfləri əvvəlki kimi qalır */
  function arabicFonts() {
    var cs = getComputedStyle(root);
    ['--D', '--S', '--title', '--body', '--serif', '--sans', '--display', '--font'].forEach(function (v) {
      var val = cs.getPropertyValue(v).trim();
      if (val) root.style.setProperty(v, "'ArUI'," + val);
    });
  }

  function markButtons() {
    var bs = document.querySelectorAll('[data-lang]');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('active', bs[i].getAttribute('data-lang') === lang);
  }

  /* mobil menyuya da dil seçimi əlavə et */
  function mobileSwitch() {
    var m = document.querySelector('.mob-nav');
    if (!m || m.querySelector('.i18n-mob')) return;
    var d = document.createElement('div');
    var link = m.querySelector('a');
    d.className = 'i18n-mob';
    d.style.cssText = 'display:flex;gap:1.4rem;justify-content:center;margin-top:2.2rem;font-size:.8rem;letter-spacing:.14em;color:' + (link ? getComputedStyle(link).color : 'inherit');
    LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-lang', l); b.textContent = l.toUpperCase();
      b.style.cssText = 'background:none;border:0;padding:.4rem;font:inherit;color:inherit;cursor:pointer;opacity:' + (l === lang ? '1' : '.45');
      d.appendChild(b);
    });
    m.appendChild(d);
  }

  function setLang(l) {
    if (l === lang || LANGS.indexOf(l) < 0) return;
    try { localStorage.setItem('lang', l); } catch (e) {}
    var u = new URL(location.href);
    if (l === 'az') u.searchParams.delete('lang'); else u.searchParams.set('lang', l);
    location.replace(u.toString());
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-lang]');
    if (!b) return;
    e.preventDefault();
    setLang(b.getAttribute('data-lang'));
  });

  /* daxili keçidlərdə seçilmiş dili saxla */
  function keepLangInLinks() {
    if (lang === 'az') return;
    var as = document.querySelectorAll('a[href$=".html"],a[href*=".html#"]');
    for (var i = 0; i < as.length; i++) {
      var h = as[i].getAttribute('href');
      if (/^(https?:|mailto:|tel:)/.test(h)) continue;
      var parts = h.split('#');
      as[i].setAttribute('href', parts[0] + (parts[0].indexOf('?') < 0 ? '?' : '&') + 'lang=' + lang + (parts[1] != null ? '#' + parts[1] : ''));
    }
  }

  var observer = null;
  function start() {
    if (lang === 'az' || observer) return;
    /* səhifə oxunduqca və sonradan skriptlərin əlavə etdiyi mətnləri də tərcümə et */
    observer = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'characterData') doText(r.target);
        else if (r.type === 'attributes') doEl(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  window.I18N = {
    lang: lang,
    add: function (o) { for (var k in o) dict[norm(k)] = o[k]; },
    t: function (s) { var t = tr(s); return t == null ? s : t; },
    run: function () { if (lang !== 'az' && document.body) { translateHead(); walk(document.body); } }
  };

  start();
  document.addEventListener('DOMContentLoaded', function () {
    if (lang !== 'az') { I18N.run(); keepLangInLinks(); }
    if (lang === 'ar') arabicFonts();
    markButtons();
    mobileSwitch();
  });
})();
