/**
 * Article soundtrack player
 * - Idle: straight progress line
 * - Playing: same line morphs into a middle wave (tapers flat at ends)
 * - Progress painted on the same path
 */
(function () {
  'use strict';

  var W = 1000;
  var H = 48;
  var MID = H / 2;
  var POINTS = 96;

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    sec = Math.floor(sec);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function iconPlay() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>';
  }

  function iconPause() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm7 0h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>';
  }

  function iconNote() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveSrc(src) {
    if (!src) return src;
    // already absolute http(s) or root-absolute
    if (/^(https?:)?\/\//i.test(src) || src.charAt(0) === '/') return src;
    return src;
  }

  /**
   * amount: 0 = pure straight line, 1 = full middle wave
   * returns Y in viewBox units for a given t (0..1)
   */
  function waveYAt(t, amount, phase) {
    t = Math.max(0, Math.min(1, t));
    var envelope = 0;
    if (t > 0.08 && t < 0.92) {
      var u = (t - 0.08) / 0.84;
      envelope = Math.pow(Math.sin(Math.PI * u), 1.15);
    }

    var y = MID;
    if (amount > 0.001 && envelope > 0) {
      var wave =
        Math.sin(t * Math.PI * 4.0 + phase) * 0.62 +
        Math.sin(t * Math.PI * 7.2 - phase * 1.15) * 0.28 +
        Math.sin(t * Math.PI * 2.1 + 0.6) * 0.18;
      y = MID - wave * envelope * amount * 11;
    }
    return y;
  }

  function buildStrokePath(amount, phase) {
    var d = '';
    for (var i = 0; i <= POINTS; i++) {
      var t = i / POINTS;
      var x = t * W;
      var y = waveYAt(t, amount, phase);
      d += (i === 0 ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    return d;
  }

  function barMarkup() {
    return (
      '<svg class="ap-wave-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<path class="ap-wave-base" fill="none" stroke-linecap="round" stroke-linejoin="round" d="M 0 24 L 1000 24"></path>' +
        '<path class="ap-wave-played" fill="none" stroke-linecap="round" stroke-linejoin="round" d="M 0 24 L 1000 24"></path>' +
      '</svg>' +
      '<div class="ap-knob" aria-hidden="true"></div>'
    );
  }

  /* -------- Web Audio fallback (if file fails / missing) -------- */
  function createFallbackEngine(durationSec) {
    var ctx = null;
    var nodes = null;
    var startedAt = 0;
    var offset = 0;
    var playing = false;
    var duration = durationSec || 18;
    var onTime = null;
    var timer = 0;

    function ensureCtx() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      return ctx;
    }

    function makeGraph() {
      var c = ensureCtx();
      if (!c) return null;
      var master = c.createGain();
      master.gain.value = 0.12;
      master.connect(c.destination);

      var freqs = [329.63, 415.3, 493.88];
      var oscs = [];
      for (var i = 0; i < freqs.length; i++) {
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = freqs[i];
        g.gain.value = 1 / (i + 1.4);
        o.connect(g);
        g.connect(master);
        o.start();
        oscs.push(o);
      }

      // subtle tremolo
      var lfo = c.createOscillator();
      var lfoGain = c.createGain();
      lfo.frequency.value = 2.4;
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      lfo.start();

      return { master: master, oscs: oscs, lfo: lfo };
    }

    function emitTime() {
      if (!onTime) return;
      var t = playing && ctx ? Math.min(duration, offset + (ctx.currentTime - startedAt)) : offset;
      onTime(t, duration);
      if (playing && t >= duration - 0.02) {
        api.pause();
        offset = 0;
        if (onTime) onTime(0, duration);
      }
    }

    var api = {
      get currentTime() {
        if (playing && ctx) return Math.min(duration, offset + (ctx.currentTime - startedAt));
        return offset;
      },
      set currentTime(v) {
        offset = Math.max(0, Math.min(duration, v || 0));
        if (playing) {
          api.pause();
          api.play();
        } else {
          emitTime();
        }
      },
      get duration() { return duration; },
      get paused() { return !playing; },
      onTimeUpdate: function (fn) { onTime = fn; },
      play: function () {
        var c = ensureCtx();
        if (!c) return Promise.reject(new Error('No AudioContext'));
        return c.resume().then(function () {
          if (playing) return;
          if (offset >= duration) offset = 0;
          nodes = makeGraph();
          startedAt = c.currentTime;
          playing = true;
          timer = window.setInterval(emitTime, 80);
          emitTime();
        });
      },
      pause: function () {
        if (!playing) return;
        offset = Math.min(duration, offset + (ctx.currentTime - startedAt));
        playing = false;
        if (timer) { clearInterval(timer); timer = 0; }
        if (nodes) {
          try {
            nodes.oscs.forEach(function (o) { try { o.stop(); } catch (e) {} });
            try { nodes.lfo.stop(); } catch (e) {}
            try { nodes.master.disconnect(); } catch (e) {}
          } catch (e) {}
          nodes = null;
        }
        emitTime();
      }
    };
    return api;
  }

  function ensureMarkup(root) {
    var src = resolveSrc(root.getAttribute('data-src'));
    if (!src) return null;

    var title = root.getAttribute('data-title') || 'Untitled';
    var artist = root.getAttribute('data-artist') || '';
    var cover = root.getAttribute('data-cover') || '';

    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Article soundtrack');

    var audio = root.querySelector('audio');
    if (!audio) {
      audio = document.createElement('audio');
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      audio.setAttribute('preload', 'auto');
      audio.className = 'ap-native';
      root.insertBefore(audio, root.firstChild);
    }
    audio.removeAttribute('controls');
    audio.classList.add('ap-native');
    audio.setAttribute('playsinline', '');
    audio.preload = 'auto';

    // Prefer explicit src; also try relative sibling for /jurnal pages
    var candidates = [src];
    if (src.charAt(0) === '/') {
      // e.g. /audio/x.wav -> ../audio/x.wav when page is /jurnal/...
      candidates.push('..' + src);
    }
    // set primary
    if (!audio.getAttribute('src') && !audio.querySelector('source')) {
      audio.src = candidates[0];
    } else if (audio.getAttribute('src') !== candidates[0] && !audio.querySelector('source')) {
      // keep existing if already set in HTML
    }

    // store candidates for retry
    root._apCandidates = candidates;

    var shell = root.querySelector('.ap-shell');
    if (!shell) {
      var coverHtml = cover
        ? '<img class="ap-cover-img" src="' + cover.replace(/"/g, '&quot;') + '" alt="" width="40" height="40" draggable="false">'
        : '<span class="ap-cover-fallback">' + iconNote() + '</span>';

      shell = document.createElement('div');
      shell.className = 'ap-shell';
      shell.innerHTML =
        '<div class="ap-cover" aria-hidden="true">' + coverHtml + '</div>' +
        '<div class="ap-meta">' +
          '<div class="ap-title">' + escapeHtml(title) + '</div>' +
          (artist ? '<div class="ap-artist">' + escapeHtml(artist) + '</div>' : '') +
        '</div>' +
        '<button type="button" class="ap-play" aria-label="Play">' + iconPlay() + '</button>' +
        '<div class="ap-timeline">' +
          '<span class="ap-time ap-cur">0:00</span>' +
          '<div class="ap-bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">' +
            barMarkup() +
          '</div>' +
          '<span class="ap-time ap-dur">0:00</span>' +
        '</div>';
      root.appendChild(shell);
    } else {
      var bar = shell.querySelector('.ap-bar');
      if (bar && (!bar.querySelector('.ap-wave-svg') || !bar.querySelector('.ap-wave-base') || bar.querySelector('.ap-wave-bar'))) {
        bar.innerHTML = barMarkup();
      }
    }

    return audio;
  }

  function wire(root, audio) {
    var playBtn = root.querySelector('.ap-play');
    var bar = root.querySelector('.ap-bar');
    var curEl = root.querySelector('.ap-cur');
    var durEl = root.querySelector('.ap-dur');
    var basePath = root.querySelector('.ap-wave-base');
    var playedPath = root.querySelector('.ap-wave-played');
    var knob = root.querySelector('.ap-knob');
    if (!playBtn || !bar || !curEl || !durEl || !basePath || !playedPath) return;

    var seeking = false;
    var playing = false;
    var phase = 0;
    var amount = 0;
    var progress = 0;
    var raf = 0;
    var reducedMotion = false;
    var engine = 'html'; // or 'fallback'
    var fallback = null;
    var candidateIndex = 0;
    var candidates = root._apCandidates || [audio.currentSrc || audio.src];
    var mediaReady = false;

    try {
      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}

    function draw() {
      var d = buildStrokePath(amount, phase);
      basePath.setAttribute('d', d);
      playedPath.setAttribute('d', d);
      playedPath.style.clipPath = 'inset(0 ' + ((1 - progress) * 100) + '% 0 0)';
      if (knob) {
        // Follow the wave path (x + y), not just a flat horizontal track
        var yView = waveYAt(progress, amount, phase); // 0..H in viewBox
        var yPct = (yView / H) * 100;
        knob.style.left = (progress * 100) + '%';
        knob.style.top = yPct + '%';
      }
    }

    function setUIPlaying(on) {
      playing = on;
      playBtn.innerHTML = on ? iconPause() : iconPlay();
      playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      root.classList.toggle('is-playing', on);
      startLoop();
    }

    function startLoop() {
      if (raf) return;
      var last = performance.now();
      function tick(now) {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        var target = playing ? 1 : 0;
        var speed = playing ? 4.2 : 5.5;
        if (Math.abs(target - amount) < 0.001) amount = target;
        else amount += (target - amount) * Math.min(1, dt * speed);

        if (playing && !reducedMotion) phase += dt * 3.4;
        else if (!playing) phase *= 0.9;

        // poll fallback time if needed
        if (engine === 'fallback' && fallback && playing && !seeking) {
          var t = fallback.currentTime;
          var d = fallback.duration || 0;
          progress = d ? Math.max(0, Math.min(1, t / d)) : 0;
          curEl.textContent = fmt(t);
          if (d) durEl.textContent = fmt(d);
          bar.setAttribute('aria-valuenow', String(Math.floor(t)));
          bar.setAttribute('aria-valuemax', String(Math.floor(d || 0)));
        }

        draw();

        if (playing || amount > 0.002) raf = requestAnimationFrame(tick);
        else {
          amount = 0;
          phase = 0;
          draw();
          raf = 0;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    function updateFromHtml() {
      if (seeking || engine !== 'html') return;
      var d = audio.duration || 0;
      var t = audio.currentTime || 0;
      if (!isFinite(d)) d = 0;
      progress = d ? Math.max(0, Math.min(1, t / d)) : 0;
      curEl.textContent = fmt(t);
      bar.setAttribute('aria-valuenow', String(Math.floor(t)));
      bar.setAttribute('aria-valuemax', String(Math.floor(d || 0)));
      if (d) durEl.textContent = fmt(d);
      // Always draw so knob Y stays locked to the wave while playing
      draw();
    }

    function useFallback(reason) {
      if (engine === 'fallback') return Promise.resolve();
      console.warn('[article-player] fallback audio:', reason || '');
      engine = 'fallback';
      fallback = createFallbackEngine(18);
      fallback.onTimeUpdate(function (t, d) {
        if (seeking) return;
        progress = d ? Math.max(0, Math.min(1, t / d)) : 0;
        curEl.textContent = fmt(t);
        durEl.textContent = fmt(d);
        bar.setAttribute('aria-valuenow', String(Math.floor(t)));
        bar.setAttribute('aria-valuemax', String(Math.floor(d || 0)));
      });
      durEl.textContent = fmt(18);
      mediaReady = true;
      return Promise.resolve();
    }

    function tryNextCandidate() {
      candidateIndex += 1;
      if (candidateIndex < candidates.length) {
        audio.src = candidates[candidateIndex];
        audio.load();
        return true;
      }
      return false;
    }

    function playMedia() {
      // pause other players
      document.querySelectorAll('.article-player').forEach(function (el) {
        if (el === root) return;
        var a = el.querySelector('audio');
        if (a && !a.paused) a.pause();
        if (el._apPauseAll) el._apPauseAll();
      });

      if (engine === 'fallback') {
        return fallback.play().then(function () { setUIPlaying(true); });
      }

      // HTMLAudio
      try { audio.volume = 1; audio.muted = false; } catch (e) {}

      var p = audio.play();
      if (!p || !p.then) {
        setUIPlaying(!audio.paused);
        return Promise.resolve();
      }
      return p.then(function () {
        setUIPlaying(true);
      }).catch(function (err) {
        // retry other path, then fallback synth
        if (tryNextCandidate()) {
          return audio.play().then(function () {
            setUIPlaying(true);
          }).catch(function () {
            return useFallback(err && err.message).then(function () {
              return fallback.play().then(function () { setUIPlaying(true); });
            });
          });
        }
        return useFallback(err && err.message).then(function () {
          return fallback.play().then(function () { setUIPlaying(true); });
        });
      });
    }

    function pauseMedia() {
      if (engine === 'fallback' && fallback) {
        fallback.pause();
      } else {
        try { audio.pause(); } catch (e) {}
      }
      setUIPlaying(false);
    }

    root._apPauseAll = function () {
      if (engine === 'fallback' && fallback && !fallback.paused) fallback.pause();
      setUIPlaying(false);
    };

    playBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (playing) {
        pauseMedia();
      } else {
        playMedia().catch(function (err) {
          console.error('[article-player] play failed', err);
          root.classList.add('is-error');
          playBtn.setAttribute('aria-label', 'Play failed');
        });
      }
    });

    audio.addEventListener('play', function () {
      if (engine === 'html') setUIPlaying(true);
    });
    audio.addEventListener('pause', function () {
      if (engine === 'html') setUIPlaying(false);
    });
    audio.addEventListener('ended', function () {
      if (engine !== 'html') return;
      setUIPlaying(false);
      progress = 0;
      curEl.textContent = '0:00';
      try { audio.currentTime = 0; } catch (e) {}
      draw();
    });
    audio.addEventListener('timeupdate', updateFromHtml);
    audio.addEventListener('loadedmetadata', function () {
      mediaReady = true;
      updateFromHtml();
    });
    audio.addEventListener('durationchange', updateFromHtml);
    audio.addEventListener('canplay', function () { mediaReady = true; });
    audio.addEventListener('error', function () {
      if (tryNextCandidate()) return;
      // don't auto-switch until user hits play — just mark
      mediaReady = false;
    });

    function seekFromEvent(e) {
      var rect = bar.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      progress = ratio;
      draw();

      if (engine === 'fallback' && fallback) {
        fallback.currentTime = ratio * (fallback.duration || 0);
        curEl.textContent = fmt(fallback.currentTime);
        return;
      }
      if (isFinite(audio.duration) && audio.duration > 0) {
        try { audio.currentTime = ratio * audio.duration; } catch (err) {}
        curEl.textContent = fmt(audio.currentTime);
      }
    }

    bar.addEventListener('pointerdown', function (e) {
      seeking = true;
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      seekFromEvent(e);
    });
    bar.addEventListener('pointermove', function (e) {
      if (!seeking) return;
      seekFromEvent(e);
    });
    bar.addEventListener('pointerup', function () {
      seeking = false;
      if (engine === 'html') updateFromHtml();
    });
    bar.addEventListener('pointercancel', function () { seeking = false; });

    bar.addEventListener('keydown', function (e) {
      var dur = engine === 'fallback' && fallback ? fallback.duration : audio.duration;
      if (!isFinite(dur) || !dur) return;
      var step = e.shiftKey ? 10 : 5;
      var cur = engine === 'fallback' && fallback ? fallback.currentTime : audio.currentTime;
      function setT(v) {
        if (engine === 'fallback' && fallback) fallback.currentTime = v;
        else try { audio.currentTime = v; } catch (err) {}
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault(); setT(Math.min(dur, cur + step));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault(); setT(Math.max(0, cur - step));
      } else if (e.key === 'Home') {
        e.preventDefault(); setT(0);
      } else if (e.key === 'End') {
        e.preventDefault(); setT(dur);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); playBtn.click();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && playing) pauseMedia();
    });

    // kick load
    try { audio.load(); } catch (e) {}
    if (audio.readyState >= 1) updateFromHtml();
    else draw();
  }

  function injectStyles() {
    if (document.getElementById('article-player-styles')) return;
    var style = document.createElement('style');
    style.id = 'article-player-styles';
    style.textContent = [
      '.article-player{margin-top:1.35rem;max-width:none;width:100%;position:relative;}',
      '.article-player audio,.article-player .ap-native{',
      '  position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;',
      '  overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;',
      '  opacity:0!important;pointer-events:none!important;',
      '}',
      '.article-player .ap-shell{',
      '  display:grid;',
      '  grid-template-columns:40px minmax(0,1fr) 36px;',
      '  grid-template-areas:"cover meta play" "timeline timeline timeline";',
      '  gap:10px 12px;',
      '  align-items:center;',
      '  padding:12px 14px;',
      '  border-radius:14px;',
      '  border:1px solid #e6e3df;',
      '  background:rgba(0,0,0,0.015);',
      '}',
      'html.dark .article-player .ap-shell{border-color:#2a2a2a;background:rgba(255,255,255,0.03);}',
      '.article-player .ap-cover{grid-area:cover;width:40px;height:40px;border-radius:10px;overflow:hidden;',
      '  background:#ecebe8;display:flex;align-items:center;justify-content:center;color:#6b6b6b;flex-shrink:0;}',
      'html.dark .article-player .ap-cover{background:#222;color:#a7a39d;}',
      '.article-player .ap-cover-img{width:100%;height:100%;object-fit:cover;display:block;}',
      '.article-player .ap-cover-fallback{display:flex;align-items:center;justify-content:center;}',
      '.article-player .ap-meta{grid-area:meta;min-width:0;}',
      '.article-player .ap-title{font-size:13.5px;line-height:1.25;font-weight:500;',
      '  color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'html.dark .article-player .ap-title{color:#e9e6e2;}',
      '.article-player .ap-artist{font-size:12px;line-height:1.3;margin-top:2px;color:#6b6b6b;',
      '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'html.dark .article-player .ap-artist{color:#a7a39d;}',
      '.article-player .ap-play{grid-area:play;width:36px;height:36px;border-radius:999px;border:0;',
      '  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;',
      '  background:#1a1a1a;color:#faf9f7;transition:opacity .15s ease, transform .15s ease;',
      '  -webkit-tap-highlight-color:transparent;position:relative;z-index:2;}',
      'html.dark .article-player .ap-play{background:#e9e6e2;color:#141414;}',
      '.article-player .ap-play:hover{opacity:.9;}',
      '.article-player .ap-play:active{transform:scale(.96);}',
      '.article-player.is-error .ap-play{outline:2px solid #c44;outline-offset:2px;}',
      '.article-player .ap-timeline{grid-area:timeline;display:grid;grid-template-columns:auto 1fr auto;',
      '  gap:10px;align-items:center;min-width:0;}',
      '.article-player .ap-time{font-size:11px;font-variant-numeric:tabular-nums;color:#8a8a8a;min-width:2.1em;}',
      'html.dark .article-player .ap-time{color:#8f8b85;}',
      '.article-player .ap-bar{position:relative;height:28px;display:flex;align-items:center;cursor:pointer;',
      '  touch-action:none;outline:none;}',
      '.article-player .ap-wave-svg{display:block;width:100%;height:28px;overflow:visible;}',
      '.article-player .ap-wave-base{stroke:rgba(26,26,26,0.18);stroke-width:2.5;vector-effect:non-scaling-stroke;}',
      'html.dark .article-player .ap-wave-base{stroke:rgba(233,230,226,0.2);}',
      '.article-player .ap-wave-played{stroke:#1a1a1a;stroke-width:2.5;vector-effect:non-scaling-stroke;}',
      'html.dark .article-player .ap-wave-played{stroke:#e9e6e2;}',
      '.article-player .ap-knob{position:absolute;top:50%;left:0%;width:9px;height:9px;',
      '  border-radius:999px;background:#1a1a1a;',
      '  transform:translate(-50%,-50%);',
      '  box-shadow:0 0 0 2px #faf9f7;pointer-events:none;opacity:0;',
      '  will-change:left,top;}',
      'html.dark .article-player .ap-knob{background:#e9e6e2;box-shadow:0 0 0 2px #1a1a1a;}',
      '.article-player .ap-bar:hover .ap-knob,.article-player.is-playing .ap-knob,',
      '.article-player .ap-bar:focus-visible .ap-knob{opacity:1;}',
      '.article-player .ap-bar:focus-visible{box-shadow:0 0 0 2px rgba(26,26,26,.12);border-radius:8px;}',
      'html.dark .article-player .ap-bar:focus-visible{box-shadow:0 0 0 2px rgba(233,230,226,.14);}',
      '@media (max-width:640px){',
      '  .article-player .ap-shell{padding:11px 12px;gap:9px 10px;}',
      '  .article-player .ap-title{font-size:13px;}',
      '  .article-player .ap-artist{font-size:11.5px;}',
      '  .article-player .ap-bar,.article-player .ap-wave-svg{height:26px;}',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function build(root) {
    var audio = ensureMarkup(root);
    if (!audio) return;
    wire(root, audio);
    root.classList.add('is-ready');
  }

  function init() {
    injectStyles();
    var nodes = document.querySelectorAll('.article-player[data-src]');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].dataset.apReady) {
        nodes[i].dataset.apReady = '1';
        build(nodes[i]);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
