/* Поведение страницы: тема, содержание (сайдбар и мобильное меню), видео, место чтения, попап.
   Общий файл для всех страниц. */
(function () {
  'use strict';

  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим — не страшно */ } }
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = window.matchMedia('(max-width: 1023px)');

  /* ---------- Тема: переключатель — одна кнопка целиком ---------- */
  var THEME_BG = { dark: '#1b2039', light: '#d9eafa' };
  var BAR_BG = { dark: '#13162c', light: '#17558c' };
  var LABEL = root.lang === 'en'
    ? { dark: 'Switch to light theme', light: 'Switch to dark theme' }
    : { dark: 'Включить светлую тему', light: 'Включить тёмную тему' };

  function paintTheme() {
    var t = root.dataset.theme;
    document.querySelectorAll('[data-toggle-theme]').forEach(function (b) { b.setAttribute('aria-label', LABEL[t]); });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = narrow.matches ? BAR_BG[t] : THEME_BG[t];
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-toggle-theme]')) return;
    var t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = t;
    store.set('oy-theme', t);
    paintTheme();
  });
  narrow.addEventListener('change', paintTheme);
  paintTheme();

  /* ---------- Попап «Обо мне»: под кнопкой, с зазором ---------- */
  var about = document.getElementById('about');
  // карточку открывают и кнопка «Обо мне», и имя автора — встаём под тем, на что нажали
  var invoker = null;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[popovertarget="about"]:not(.about-close)');
    if (b) invoker = b;
  }, true);
  if (about) {
    about.addEventListener('toggle', function (e) {
      if (e.newState !== 'open') return;
      var btn = invoker || document.querySelector('.author');
      var r = btn.getBoundingClientRect();
      var w = about.offsetWidth;
      var left = Math.min(r.left, document.documentElement.clientWidth - w - 16);
      about.style.left = Math.max(16, left) + window.scrollX + 'px';
      about.style.top = r.bottom + 10 + window.scrollY + 'px';
    });
  }

  /* ---------- Содержание и «ты здесь» ---------- */
  var toc = document.getElementById('toc');
  var list = toc && toc.querySelector('.toc-list');
  var items = list ? Array.prototype.slice.call(list.querySelectorAll('li')) : [];
  var heads = items.map(function (li) {
    return document.getElementById(li.querySelector('a').getAttribute('href').slice(1));
  });
  var barTitle = document.querySelector('.menubar span');
  var marker = toc && toc.querySelector('.toc-marker');
  var current = -1;
  var hoverSide = false;
  var recenterTimer = null;

  function centerList(i, smooth) {
    if (!list || i < 0) return;
    var li = items[i];
    var top = li.offsetTop - list.clientHeight / 2 + li.offsetHeight / 2;
    list.scrollTo({ top: top, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
  }

  // «нашлёпка» в сайдбаре стоит на высоте текущего пункта и едет с ним при прокрутке списка
  function placeMarker() {
    if (!marker || current < 0 || narrow.matches) return;
    var a = items[current].getBoundingClientRect();
    var t = toc.getBoundingClientRect();
    var l = list.getBoundingClientRect();
    var mid = a.top + a.height / 2;
    marker.style.transform = 'translateY(' + Math.round(mid - t.top - 22) + 'px)';
    marker.classList.toggle('on', mid > l.top + 10 && mid < l.bottom - 10);
  }

  // в полосе меню вверху страницы — название первого раздела, а не «Начало»
  function barLabel(i) {
    var k = (i === 0 && items[0].classList.contains('top') && items[1]) ? 1 : i;
    return items[k].querySelector('a').innerHTML;
  }

  function setCurrent(i) {
    if (i === current) return;
    if (current >= 0) items[current].classList.remove('is-current');
    current = i;
    if (i < 0) return;
    items[i].classList.add('is-current');
    items[i].querySelector('a').setAttribute('aria-current', 'location');
    items.forEach(function (li, k) { if (k !== i) li.querySelector('a').removeAttribute('aria-current'); });
    if (barTitle && !root.classList.contains('menu-open')) barTitle.innerHTML = barLabel(i);
    // в открытом мобильном меню «ты здесь» не меняется под пальцем; в сайдбаре — держим по центру
    if (!narrow.matches && !hoverSide) centerList(i, true);
    placeMarker();
  }

  // раздел становится текущим, когда его заголовок поднялся выше линии ~30% экрана
  function spy() {
    if (!heads.length) return;
    var bar = narrow.matches ? 52 : 0;
    var line = bar + (window.innerHeight - bar) * 0.3;
    var i = -1;
    for (var k = 0; k < heads.length; k++) {
      if (heads[k] && heads[k].getBoundingClientRect().top <= line) i = k; else break;
    }
    // конец страницы — последний раздел, даже если его заголовок не дошёл до линии
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) i = heads.length - 1;
    // пункт «Начало» (первый) есть только в мобильном меню; на десктопе вверху страницы текущий — TL;DR
    var hasTop = items.length && items[0].classList.contains('top');
    if (hasTop && !narrow.matches && i < 1) i = 1;
    setCurrent(Math.max(i, 0));
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; spy(); savePlace(); });
  }, { passive: true });
  window.addEventListener('resize', function () { spy(); if (!narrow.matches) centerList(current, false); placeMarker(); });

  if (list) {
    list.addEventListener('scroll', function () { requestAnimationFrame(placeMarker); }, { passive: true });
    // ручная прокрутка списка мышью: маркер едет со своим пунктом, потом список возвращается
    toc.addEventListener('mouseenter', function () { hoverSide = true; clearTimeout(recenterTimer); });
    toc.addEventListener('mouseleave', function () {
      hoverSide = false;
      clearTimeout(recenterTimer);
      recenterTimer = setTimeout(function () { if (!narrow.matches) centerList(current, true); }, 900);
    });
  }

  /* ---------- Мобильное меню ---------- */
  var menubar = document.querySelector('.menubar');
  var dim = document.querySelector('.menu-dim');
  var menuLabel = menubar ? menubar.dataset.label : '';

  function openMenu() {
    root.classList.add('menu-open');
    menubar.setAttribute('aria-expanded', 'true');
    barTitle.textContent = menuLabel;
    requestAnimationFrame(function () { centerList(current, false); });
  }
  function closeMenu() {
    root.classList.remove('menu-open');
    menubar.setAttribute('aria-expanded', 'false');
    if (current >= 0) barTitle.innerHTML = barLabel(current);
  }
  if (menubar) {
    menubar.addEventListener('click', function () {
      root.classList.contains('menu-open') ? closeMenu() : openMenu();
    });
    dim.addEventListener('click', closeMenu);
    toc.querySelector('.toc-close').addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) closeMenu();
    });
  }
  if (list) {
    // переход по пункту: мгновенный прыжок, запись в историю браузера (через обычный якорь)
    list.addEventListener('click', function (e) {
      if (!e.target.closest('a')) return;
      if (root.classList.contains('menu-open')) closeMenu();
    });
  }

  /* ---------- Видео: грузим рядом с экраном, играем только в поле зрения ---------- */
  var videos = document.querySelectorAll('video[data-src]');
  if ('IntersectionObserver' in window) {
    var loader = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var v = e.target;
        v.src = v.dataset.src;
        v.preload = 'metadata';
        // немой ролик, уже стоящий в кадре, запускаем, как только он готов
        if (v.classList.contains('loop')) {
          v.addEventListener('canplay', function () { if (v.oyVisible && !reduceMotion) { var p = v.play(); if (p) p.catch(function () {}); } }, { once: true });
        }
        loader.unobserve(v);
      });
    }, { rootMargin: '900px 0px' });
    var player = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        v.oyVisible = e.isIntersecting;
        if (e.isIntersecting) {
          if (v.classList.contains('loop') && !reduceMotion) { var p = v.play(); if (p) p.catch(function () {}); }
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) { loader.observe(v); player.observe(v); });
  } else {
    videos.forEach(function (v) { v.src = v.dataset.src; });
  }

  /* ---------- Место чтения ---------- */
  var KEY = 'oy-place:' + location.pathname;
  var saveTimer = null;
  function savePlace() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { store.set(KEY, String(Math.round(window.scrollY))); }, 300);
  }
  var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  var navType = nav ? nav.type : 'navigate';
  if (navType === 'navigate' && !location.hash) {
    var y = parseInt(store.get(KEY), 10);
    // ждём шрифты: до них строки другой длины и страница другой высоты
    if (y > 0) (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { window.scrollTo(0, y); });
  }

  spy();
  if (!narrow.matches) centerList(current, false);
  placeMarker();
  if (document.fonts) document.fonts.ready.then(function () { if (!narrow.matches) centerList(current, false); placeMarker(); });
})();
