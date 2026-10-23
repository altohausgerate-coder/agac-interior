/* Epoxy 2.0-dan köçürülmüş bölmələr: seçilmiş işlər, qalereya, video, iş prosesi, lightbox.
   gsap + ScrollTrigger səhifədə qlobal yüklənir; 3D masa ayrıca js/table3d.js-dədir. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rtl = document.documentElement.dir === 'rtl';
  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (gsap && ST) gsap.registerPlugin(ST);

  /* hamar scroll (Lenis), ScrollTrigger ilə eyni saatda işləyir */
  var lenis = null;
  if (window.Lenis && gsap && ST && !reduced) {
    lenis = window.lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    /* pəncərə və menyu açıq olanda arxadakı səhifə scroll olmasın */
    var locked = function () {
      return ['lbox', 'catModal', 'mobNav'].some(function (id) { var el = document.getElementById(id); return el && el.classList.contains('open'); });
    };
    new MutationObserver(function () { locked() ? lenis.stop() : lenis.start(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  /* daxili linklər hamar scroll edir. CSS scroll-behavior:smooth ScrollTrigger-in ölçmələrini pozduğu üçün JS ilə */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.metaKey || e.ctrlKey) return;
    var id = a.getAttribute('href');
    var el = id.length > 1 ? document.querySelector(id) : null;
    if (!el && id !== '#') return;
    e.preventDefault();
    var off = id === '#contact' ? 0 : -60;
    if (lenis) lenis.scrollTo(el || 0, { offset: off, duration: 1.4 });
    else scrollTo({ top: el ? el.getBoundingClientRect().top + scrollY + off : 0, behavior: reduced ? 'auto' : 'smooth' });
    if (el) history.replaceState(null, '', id);
  });

  /* seçilmiş işlər: desktopda bölmə dayanır, kartlar scroll ilə yana sürüşür */
  var hs = $('.nx-hs');
  if (hs && gsap && !reduced) {
    gsap.matchMedia().add('(min-width: 761px)', function () {
      var track = $('.nx-hs-track', hs);
      var bar = $('.nx-hs-progress span', hs);
      var dist = function () { return track.scrollWidth - innerWidth; };
      gsap.to(track, {
        x: function () { return rtl ? dist() : -dist(); },
        ease: 'none',
        scrollTrigger: {
          trigger: $('.nx-hs-pin', hs), pin: true, start: 'top top',
          end: function () { return '+=' + dist(); },
          scrub: 1, invalidateOnRefresh: true,
          onUpdate: function (s) { bar.style.transform = 'scaleX(' + s.progress + ')'; }
        }
      });
    });
  }

  /* qalereya: filtr və "hamısını göstər" */
  var grid = $('#masonry');
  var more = $('#nxMore');
  function showAll() {
    grid.classList.add('is-all');
    if (more && more.parentElement) more.parentElement.remove();
    more = null;
  }
  if (grid) {
    if (more) more.addEventListener('click', function () { showAll(); if (ST) ST.refresh(); });
    $$('.nx-filters button').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.dataset.f;
        $$('.nx-filters button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        if (f !== '*') showAll();
        $$('.nx-tile', grid).forEach(function (t) {
          t.classList.toggle('is-out', f !== '*' && t.dataset.cat !== f);
          t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
        });
        if (ST) ST.refresh();
      });
    });
  }

  /* lightbox: [data-zoom] şəkillər qrup daxilində, [data-film] videolar */
  var lbox = $('#lbox'), media = $('#lboxMedia');
  var cap = document.createElement('p');
  cap.id = 'lboxCap';
  lbox.appendChild(cap);
  var list = [], at = 0;
  function render() {
    var el = list[at];
    var img = $('img', el);
    var alt = img ? img.alt : '';
    media.innerHTML = '<img src="' + el.dataset.zoom + '" alt="">';
    media.firstChild.alt = alt;
    cap.textContent = alt + '  ·  ' + String(at + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
  }
  function open() { lbox.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function close() { lbox.classList.remove('open'); document.body.style.overflow = ''; media.innerHTML = ''; cap.textContent = ''; list = []; }
  function step(d) { if (!list.length) return; at = (at + d + list.length) % list.length; render(); }
  document.addEventListener('click', function (e) {
    var z = e.target.closest('[data-zoom]');
    var f = !z && e.target.closest('[data-film]');
    if (z) {
      var group = z.closest('.nx-masonry, .nx-hs-track, .nx-feature') || document;
      list = $$('[data-zoom]', group).filter(function (x) { return x.offsetParent !== null; });
      at = Math.max(0, list.indexOf(z));
      render(); open();
    } else if (f) {
      list = []; cap.textContent = '';
      media.innerHTML = '<video src="' + f.dataset.film + '" autoplay playsinline controls></video>';
      open();
    }
  });
  $('#lboxClose').addEventListener('click', close);
  $('#lboxPrev').addEventListener('click', function () { step(-1); });
  $('#lboxNext').addEventListener('click', function () { step(1); });
  lbox.addEventListener('click', function (e) { if (e.target === lbox) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lbox.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  var x0 = null;
  lbox.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lbox.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    x0 = null;
  });

  /* videolar: yalnız ekranda olanlar oynayır, eyni anda çox video açılıb səhifəni dondurmasın.
     Video kartları kompüterdə üzərinə gələndə, telefonda isə ekranın ortasına çatanda oynayır. */
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var play = function (v) {
    if (reduced) return;
    if (v.dataset.src && !v.getAttribute('src')) v.src = v.dataset.src;
    var p = v.play(); if (p) p.catch(function () {});
  };
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { en.isIntersecting ? play(en.target) : en.target.pause(); });
  }, { threshold: 0.5 });
  $$('.nx-feature-video, video.nx-auto').forEach(function (v) { io.observe(v); });
  $$('.nx-reel').forEach(function (r) {
    var v = $('video', r);
    if (fine) {
      r.addEventListener('pointerenter', function () { play(v); });
      r.addEventListener('pointerleave', function () { v.pause(); });
    } else io.observe(v);
  });

  /* xəritə: səhifə boş olan anda yüklənir */
  var map = $('iframe[data-src]');
  if (map) {
    var mio = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      mio.disconnect();
      (window.requestIdleCallback || setTimeout)(function () { map.src = map.dataset.src; }, { timeout: 1500 });
    }, { rootMargin: '600px 0px' });
    mio.observe(map);
  }

  /* iş prosesi: yandakı şəkil görünən addımı izləyir */
  var pimgs = $$('.nx-process-img');
  if (pimgs.length && ST) {
    $$('.nx-step[data-k]').forEach(function (st) {
      ST.create({
        trigger: st, start: 'top 60%', end: 'bottom 60%',
        onToggle: function (s) { if (s.isActive) pimgs.forEach(function (im) { im.classList.toggle('is-on', im.dataset.k === st.dataset.k); }); }
      });
    });
  }

  /* gec yüklənən şəkillər səhifəni uzadır: hər yüklənmədən sonra scroll nöqtələrini yenidən hesabla,
     yoxsa 3D masa və kolleksiya bölmələri ekrana gəlmədən işə düşür */
  if (ST) {
    var timer = null, lastH = 0;
    /* refresh bütün səhifəni yenidən ölçür: yalnız hündürlük həqiqətən dəyişəndə */
    var refresh = function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var h = document.documentElement.scrollHeight;
        if (h !== lastH) { lastH = h; ST.refresh(); }
      }, 200);
    };
    addEventListener('load', refresh);
    if (document.fonts) document.fonts.ready.then(refresh);
    $$('img').forEach(function (im) { if (!im.complete) im.addEventListener('load', refresh, { once: true }); });
  }
})();
