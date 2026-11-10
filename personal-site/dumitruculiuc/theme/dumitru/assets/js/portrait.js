/**
 * The grabbable portrait.
 *
 * Markup (theme: template-parts/portrait.php, or the [dumitru_portrait] shortcode):
 *
 *   <div class="dc-portrait" data-dc-portrait data-texture="…/cutout-640.webp">
 *     <span class="dc-portrait__disc"></span>
 *     <div class="dc-portrait__stage"><img class="dc-portrait__img" src="…" alt="Dumitru Culiuc"></div>
 *     <button class="dc-portrait__poke" type="button">Poke Dumitru</button>
 *   </div>
 *
 * Without JavaScript or WebGL that is simply the photograph in its circle.
 * With them, a canvas takes the photograph's place and the face becomes a
 * soft sheet that can be grabbed and stretched in any direction and springs
 * back when let go.
 *
 * The picture is a grid. Every node has a displacement `u` from where it
 * belongs and a velocity `v`, and obeys
 *
 *     v' = c²∇²u − ω²u − γv + ν∇²v   (+ the hand, when it holds the skin)
 *
 * ∇²u lets a pull drag the skin around it, ω² ties the skin to the skull,
 * γ makes the wobble die out and ν∇²v kills fine ripples first. On top of
 * that the head as a whole leans toward a pull on a slower spring.
 *
 * Stage coordinates: the photograph's square is [0,1]²; the circle it sits
 * in has its centre at (0.5, 0.6) and radius 0.4 (portrait.css draws the
 * same geometry). The body is shown only inside the circle; everything above
 * TOP (the head and all the hair) is shown wherever it has been pulled to.
 */
(function () {
  "use strict";

  var N = 34; // grid nodes per side
  var CIRCLE = { x: 0.5, y: 0.6, r: 0.4 };
  var HEAD = { x: 0.5, y: 0.37, rx: 0.2, ry: 0.27 }; // in picture space
  var MARGIN = 0.4; // canvas reaches this far past the picture on each side
  var MAX_PULL = 0.42; // how far (picture widths) skin can be dragged
  var HOVER = { pull: 0.11, hold: 0.75, radius: 0.1, slip: 0.13 }; // the resting mouse's half-hold
  var TOP = 0.56; // above this (picture space) everything of him shows: head and all the hair
  var PHYS = { c2: 25, w2: 70, gamma: 7, nu: 0.0016, grip: 900, dt: 1 / 240 };
  var REST = 0.000004; // below this energy he is settled and drawing stops

  // Expressions (assets/images/portrait/expressions, built by
  // tools/make-expressions.mjs). Points on his face, in picture space.
  var FACE = { eyes: { x: 0.475, y: 0.362 }, nose: { x: 0.474, y: 0.428 }, mouth: { x: 0.53, y: 0.505 } };
  var FADE = 0.12; // seconds to fade into a reaction (and back out of it)
  var GAZE_HOLD = 2000; // ms his eyes stay on a pointer that has stopped moving
  var GAZE_FADE = 0.06; // a glance: quick, like a real eye movement
  var DIZZY = { pull: 0.7, taps: 3, within: 2500, ms: 1800 }; // a hard drag (of MAX_PULL) or 3 quick pokes
  // Which photo plays which part; the first one that exists is used. A part
  // with no photo is simply left out.
  var FACE_ROLES = {
    hover: ["annoyed"],
    grab: ["ouch"],
    click: ["shock"],
    dizzy: ["dizzy"],
    wake: ["shock"],
    flyBother: ["ouch", "annoyed"],
    flyBlow: ["blow", "whistle-1"],
    wink: ["wink"]
  };
  // Shown as soon as the expressions arrive; the rest load when first needed.
  var COMMON = ["annoyed", "ouch", "shock", "dizzy"];
  // Eye directions, as seen by the visitor: x to the right, y down.
  var LOOKS = {};
  ["e", "se", "s", "sw", "w", "nw", "n", "ne"].forEach(function (d, k) {
    var a = k * Math.PI / 4;
    LOOKS["look-" + d] = { x: Math.cos(a), y: Math.sin(a) };
  });

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  // ?dcportrait=dev: development controls (see devControls); never in normal use.
  var DEV = /[?&]dcportrait=dev\b/.test(location.search);
  var instances = [];

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  // How much of the head a picture point is: 1 inside, fading to 0 outside.
  function headWeight(px, py, grow) {
    var dx = (px - HEAD.x) / (HEAD.rx * grow), dy = (py - HEAD.y) / (HEAD.ry * grow);
    var d = Math.sqrt(dx * dx + dy * dy);
    return clamp((1.25 - d) / 0.5, 0, 1);
  }

  var VERT = [
    "attribute vec2 aRest;",
    "attribute vec2 aPos;",
    "attribute float aShade;",
    "uniform float uMargin;",
    "varying vec2 vUv;",
    "varying vec2 vPos;",
    "varying float vShade;",
    "void main() {",
    "  vUv = aRest; vPos = aPos; vShade = aShade;",
    "  vec2 c = (aPos + uMargin) / (1.0 + 2.0 * uMargin);",
    "  gl_Position = vec4(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);",
    "}"
  ].join("\n");

  // uTex is the resting face. Over it go up to three eye cells (bands cut
  // from photos looking somewhere else, feathered at their edges) and then up
  // to three whole faces, each mixed in by its weight: what shows is always
  // a weighted sum, so a change can start from whatever is on screen.
  // Textures are premultiplied.
  var FRAG = [
    "precision mediump float;",
    "uniform sampler2D uTex;",
    "uniform sampler2D uEyes;",
    "uniform sampler2D uFace0;",
    "uniform sampler2D uFace1;",
    "uniform sampler2D uFace2;",
    "uniform vec3 uFaceW;",
    "uniform vec4 uEyeRect;",
    "uniform vec4 uEyeCell0;",
    "uniform vec4 uEyeCell1;",
    "uniform vec4 uEyeCell2;",
    "uniform vec3 uEyeW;",
    "uniform vec3 uCircle;",
    "uniform float uTop;",
    "uniform float uPx;",
    "varying vec2 vUv;",
    "varying vec2 vPos;",
    "varying float vShade;",
    "void main() {",
    "  vec4 t = texture2D(uTex, vUv);",
    "  vec2 q = (vUv - uEyeRect.xy) / uEyeRect.zw;",
    "  float ew = uEyeW.x + uEyeW.y + uEyeW.z;",
    "  if (ew > 0.0 && q.x > 0.0 && q.y > 0.0 && q.x < 1.0 && q.y < 1.0) {",
    "    vec2 f = smoothstep(0.0, 0.2, q) * smoothstep(0.0, 0.2, 1.0 - q);",
    "    vec4 e = t * (1.0 - ew);",
    "    if (uEyeW.x > 0.0) e += uEyeW.x * texture2D(uEyes, uEyeCell0.xy + q * uEyeCell0.zw);",
    "    if (uEyeW.y > 0.0) e += uEyeW.y * texture2D(uEyes, uEyeCell1.xy + q * uEyeCell1.zw);",
    "    if (uEyeW.z > 0.0) e += uEyeW.z * texture2D(uEyes, uEyeCell2.xy + q * uEyeCell2.zw);",
    "    t = mix(t, e, f.x * f.y);",
    "  }",
    "  float fw = uFaceW.x + uFaceW.y + uFaceW.z;",
    "  if (fw > 0.0) {",
    "    vec4 g = t * (1.0 - fw);",
    "    if (uFaceW.x > 0.0) g += uFaceW.x * texture2D(uFace0, vUv);",
    "    if (uFaceW.y > 0.0) g += uFaceW.y * texture2D(uFace1, vUv);",
    "    if (uFaceW.z > 0.0) g += uFaceW.z * texture2D(uFace2, vUv);",
    "    t = g;",
    "  }",
    "  float inCircle = clamp((uCircle.z - distance(vPos, uCircle.xy)) / uPx + 0.5, 0.0, 1.0);",
    "  float upper = 1.0 - smoothstep(uTop, uTop + 0.04, vUv.y);",
    "  float m = max(inCircle, upper);",
    "  gl_FragColor = vec4(t.rgb * vShade * m, t.a * m);",
    "}"
  ].join("\n");

  // Random numbers; the development controls seed them so a replay is the
  // same every time.
  var random = Math.random;
  function seed(s) {
    random = function () {
      s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rand(a, b) { return a + random() * (b - a); }

  /**
   * Weights for up to `n` pictures shown over the plain one. `to(name, s)`
   * fades `name` in over s seconds while everything else showing (the plain
   * picture included) fades out in proportion, so a change that interrupts
   * another carries on from exactly what is on screen: nothing jumps, and
   * nothing flashes back to the plain picture on the way. `bind(slot, name)`
   * is called when a picture takes a slot.
   */
  function createBlend(n, bind) {
    var names = [], w = [], from = [], i;
    for (i = 0; i < n; i++) { names.push(null); w.push(0); from.push(0); }
    var target = null, slot = -1, t = 1, t0 = 1, rate = 0, start = 0;

    function weightOf(s) {
      if (s >= 0) return w[s];
      var sum = 0;
      for (var k = 0; k < n; k++) sum += w[k];
      return 1 - sum;
    }

    return {
      to: function (name, seconds) {
        if (name === target) return false;
        target = name;
        slot = name ? names.indexOf(name) : -1;
        if (name && slot < 0) {
          // A free slot, or else the least visible one (a fourth picture
          // within one fade; that one small share drops out at once).
          slot = 0;
          for (var k = 1; k < n; k++) if (w[k] < w[slot]) slot = k;
          w[slot] = 0;
          names[slot] = name;
          bind(slot, name);
        }
        for (var j = 0; j < n; j++) from[j] = w[j];
        t0 = t = weightOf(slot);
        if (seconds > 0) {
          rate = 1 / seconds;
          start = performance.now();
        } else {
          t = 1;
          for (j = 0; j < n; j++) w[j] = j === slot ? 1 : 0;
        }
        return true;
      },
      // Where the fade is at time `now` (ms, performance.now's clock), counted
      // from when it began, so a stalled frame never swallows a fade that
      // started after it. True while still changing.
      step: function (now) {
        if (t >= 1) return false;
        t = Math.min(1, t0 + Math.max(0, now - start) / 1000 * rate);
        var keep = t0 < 1 ? (1 - t) / (1 - t0) : 0;
        for (var k = 0; k < n; k++) w[k] = k === slot ? t : from[k] * keep;
        return t < 1;
      },
      weights: function () { return w; },
      names: function () { return names; },
      target: function () { return target; },
      moving: function () { return t < 1; }
    };
  }

  var FLY_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true">' +
    '<ellipse class="wing" cx="10.5" cy="13" rx="4.6" ry="8.5" transform="rotate(-24 10.5 13)"/>' +
    '<ellipse class="wing" cx="21.5" cy="13" rx="4.6" ry="8.5" transform="rotate(24 21.5 13)"/>' +
    '<ellipse class="body" cx="16" cy="19" rx="4.2" ry="6.8"/>' +
    '<circle class="body" cx="16" cy="10.6" r="3.4"/>' +
    '<circle class="eye" cx="14.4" cy="9.6" r="1.3"/><circle class="eye" cx="17.6" cy="9.6" r="1.3"/>' +
    "</svg>";

  /**
   * What his face is doing: it follows the pointer with his eyes, pulls a
   * face when hovered, held, poked or shaken about, blinks, and when nobody
   * has moved for a while dozes off, yawns, whistles or gets bothered by a fly.
   *
   * It only chooses; the engine draws (c.setFace, c.setEyes). Every photo is
   * optional: a part whose photo is missing is skipped, so more photos can be
   * added later without touching this.
   */
  function createMood(c) {
    // react: a reaction to being handled ({ face, until }), shown over hover.
    var st = { hover: false, held: false, react: null, blink: false, act: null, gaze: null, auto: true };
    var idleTimer = 0, blinkTimer = 0, reactTimer = 0, gazeRaf = 0, gazeTimer = 0, lastAct = "";
    var taps = [];
    var effects = []; // flies and notes on screen: { stop() }
    var now = function () { return performance.now(); };

    // Shut eyes: the sharp, nearly shut drowsy lids, else the closed photo.
    function shut() { return c.hasEyes("drowsy") ? "drowsy" : c.hasEyes("closed") ? "closed" : null; }

    function role(r) {
      var list = FACE_ROLES[r] || [];
      for (var i = 0; i < list.length; i++) if (c.hasFace(list[i])) return list[i];
      return null;
    }

    // The look-* photo nearest the direction from his eyes to a screen point.
    function look(pt) {
      if (!pt) return null;
      var box = c.stage.getBoundingClientRect(), h = c.head();
      var dx = pt.x - (box.left + (FACE.eyes.x + h.x) * box.width);
      var dy = pt.y - (box.top + (FACE.eyes.y + h.y) * box.height);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < box.width * 0.06) return null; // right in front of him: straight ahead
      var best = null, bestDot = 0.7; // within about 45°, or straight ahead
      c.eyeNames().forEach(function (n) {
        var l = LOOKS[n];
        if (!l) return;
        var dot = (l.x * dx + l.y * dy) / d;
        if (dot > bestDot) { bestDot = dot; best = n; }
      });
      return best;
    }

    function toScreen(p) {
      var box = c.stage.getBoundingClientRect();
      return { x: box.left + p.x * box.width, y: box.top + p.y * box.height };
    }

    // Shows what wins right now: held > a reaction > hovered > an idle act.
    // The eyes are worked out underneath every face too, so they are right
    // the moment the face fades away.
    function update() {
      var face = null, fade = FADE;
      if (st.held) face = role("grab");
      else if (st.react && st.react.until > now()) face = st.react.face;
      else if (st.hover) face = role("hover");
      else if (st.act && st.act.face) { face = st.act.face; fade = st.act.faceFade || FADE; }
      else if (st.act) fade = st.act.faceFade || FADE;
      c.setFace(face, fade);
      var eyes, eyeFade = GAZE_FADE;
      var actEyes = st.act && st.act.eyes !== undefined;
      if (st.blink && shut() && !actEyes) { eyes = shut(); eyeFade = 0.04; }
      else if (actEyes) { eyes = st.act.eyes; eyeFade = st.act.fade || GAZE_FADE; }
      else eyes = look(st.act && st.act.lookAt ? toScreen(st.act.lookAt) : st.gaze);
      c.setEyes(eyes && c.hasEyes(eyes) ? eyes : null, eyeFade);
    }

    // --- someone is there ---------------------------------------------------
    function activity() {
      if (!c.alive()) return;
      if (st.act && !st.devHold) stopAct();
      if (st.auto) scheduleIdle(rand(6000, 9000));
    }
    function onPointer(e) {
      if (e.type === "pointermove" && e.pointerType !== "mouse") return;
      if (!c.alive()) return;
      st.gaze = { x: e.clientX, y: e.clientY };
      activity();
      if (!gazeRaf) gazeRaf = requestAnimationFrame(function () { gazeRaf = 0; update(); });
      // Once the pointer stops, he looks back at the visitor.
      clearTimeout(gazeTimer);
      gazeTimer = setTimeout(function () { st.gaze = null; update(); }, GAZE_HOLD);
    }
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("keydown", activity);
    window.addEventListener("wheel", activity, { passive: true });
    window.addEventListener("scroll", activity, { passive: true });

    // A reaction to being handled, for ms; it shows over the hover face.
    function react(face, ms) {
      if (!face) return;
      st.react = { face: face, until: now() + ms };
      clearTimeout(reactTimer);
      reactTimer = setTimeout(function () { st.react = null; update(); }, ms + 20);
      activity();
      update();
    }

    // A poke, a click or a short grab. Three in quick succession make him dizzy.
    function tapped() {
      var t = now();
      taps = taps.filter(function (x) { return t - x < DIZZY.within; });
      taps.push(t);
      if (taps.length >= DIZZY.taps && role("dizzy")) { taps = []; dizzy(); return; }
      react(role("click"), 900); // "Ow!"
    }
    function dizzy() {
      react(role("dizzy"), DIZZY.ms);
      if (!c.gentle()) c.nudge(0.25, -0.1);
    }

    // --- blinking -------------------------------------------------------------
    function scheduleBlink() {
      clearTimeout(blinkTimer);
      if (!st.auto) return;
      blinkTimer = setTimeout(function () { blink(rand(0, 1) < 0.2); }, rand(2500, 6000));
    }
    function blink(twice) {
      if (!c.alive()) return;
      st.blink = true; update();
      blinkTimer = setTimeout(function () {
        st.blink = false; update();
        if (twice) blinkTimer = setTimeout(function () { blink(false); }, 160);
        else scheduleBlink();
      }, 120);
    }

    // --- idle acts --------------------------------------------------------------
    function scheduleIdle(ms) {
      clearTimeout(idleTimer);
      if (st.auto) idleTimer = setTimeout(startIdle, ms);
    }

    function startIdle() {
      if (!c.alive()) return;
      if (!c.visible() || st.held || st.hover || st.act) { scheduleIdle(3000); return; }
      var pool = [];
      Object.keys(ACTS).forEach(function (name) {
        var a = ACTS[name];
        if (!a.can()) return; // (asks for its photos, so it can play next time)
        for (var i = 0; i < a.weight; i++) pool.push(name);
      });
      var fresh = pool.filter(function (n) { return n !== lastAct; });
      if (fresh.length) pool = fresh;
      if (!pool.length) { scheduleIdle(4000); return; }
      run(pool[Math.floor(random() * pool.length)]);
    }

    function run(name) {
      if (st.act) stopAct();
      var act = { name: name, face: null, eyes: undefined, lookAt: null, timers: [], interrupt: null };
      st.gaze = null; // he stops watching where the pointer was
      st.act = act;
      lastAct = name;
      ACTS[name].run(act);
      update();
      return act;
    }

    function later(act, ms, fn) {
      act.timers.push(setTimeout(function () { if (st.act === act) fn(); }, ms));
    }

    function finish(act) {
      if (st.act !== act) return;
      act.timers.forEach(clearTimeout);
      st.act = null;
      c.setPose(0, 0, 0.5);
      update();
    }

    function endAct(act) {
      if (st.act !== act) return;
      finish(act);
      scheduleIdle(rand(4000, 9000));
    }

    // Someone is back: the act stops at once, its timers, fly and notes with it.
    function stopAct() {
      var act = st.act;
      act.faceFade = FADE;
      if (act.interrupt) act.interrupt();
      finish(act);
    }

    // Plays steps one after another: { face, eyes, fade (s, for the eyes),
    // faceFade (s), pose: [x, y, seconds to get there], nudge: [vx, vy], fn, ms }.
    function play(act, steps, i) {
      i = i || 0;
      if (i >= steps.length) { endAct(act); return; }
      var s = steps[i];
      if ("face" in s) act.face = s.face;
      if ("eyes" in s) act.eyes = s.eyes;
      act.fade = s.fade || 0;
      act.faceFade = s.faceFade || FADE;
      if (s.pose) c.setPose(c.gentle() ? 0 : s.pose[0], c.gentle() ? 0 : s.pose[1], s.pose[2] || 0.6);
      if (s.nudge && !c.gentle()) c.nudge(s.nudge[0], s.nudge[1]);
      if (s.fn) s.fn();
      update();
      later(act, s.ms, function () { play(act, steps, i + 1); });
    }

    function note() {
      if (c.gentle()) return;
      var h = c.head(), n = document.createElement("span");
      n.className = "dc-portrait__note";
      n.setAttribute("aria-hidden", "true");
      n.textContent = random() < 0.5 ? "♪" : "♫";
      n.style.left = (FACE.mouth.x + h.x) * 100 + "%";
      n.style.top = (FACE.mouth.y + h.y) * 100 + "%";
      n.style.setProperty("--dc-note-x", rand(1.2, 3.2).toFixed(2) + "rem");
      n.style.setProperty("--dc-note-turn", rand(-25, 25).toFixed(0) + "deg");
      c.stage.appendChild(n);
      var fx = { note: true, stop: function () { clearTimeout(timer); n.remove(); var k = effects.indexOf(fx); if (k >= 0) effects.splice(k, 1); } };
      var timer = setTimeout(fx.stop, 1800);
      effects.push(fx);
    }
    function clearNotes() {
      effects.slice().forEach(function (fx) { if (fx.note) fx.stop(); });
    }

    var ACTS = {
      sleepy: {
        weight: 2,
        can: function () { return c.hasEyes("half") && !!shut(); },
        run: function (act) {
          // Drowsy, fights it, drifts off with his head slowly sinking, nods
          // and wakes with a start. Everything but the waking fades slowly.
          var heavy = shut();
          play(act, [
            { eyes: "half", fade: 0.8, ms: 1500 },
            { eyes: null, fade: 0.35, ms: 600 },
            { eyes: "half", fade: 0.7, pose: [0.004, 0.008, 1.4], ms: 1300 },
            { eyes: heavy, fade: 1, pose: [0.01, 0.02, 2], ms: 2300 },
            { eyes: heavy, pose: [0.014, 0.03, 1.4], ms: 1500 },
            { face: role("wake"), faceFade: 0.08, eyes: undefined, pose: [0, 0, 0.3], nudge: [0, -0.18], ms: 700 },
            { face: null, faceFade: 0.25, ms: 400 }
          ]);
        }
      },
      yawn: {
        weight: 2,
        can: function () { return c.want(["yawn-1", "yawn-2", "yawn-3"]); },
        run: function (act) {
          // Opening, the big moment with the head tipping back, closing, done.
          play(act, [
            { face: "yawn-1", faceFade: 0.3, pose: [0, -0.006, 0.7], ms: 650 },
            { face: "yawn-2", faceFade: 0.22, pose: [0, -0.02, 0.9], ms: 1500 },
            { face: "yawn-3", faceFade: 0.22, pose: [0, -0.006, 0.7], ms: 900 },
            { face: null, faceFade: 0.4, pose: [0, 0, 0.6], ms: 500 }
          ]);
        }
      },
      whistle: {
        weight: 2,
        can: function () { return c.want(["whistle-1", "whistle-2"]); },
        run: function (act) {
          // Whistling a tune, glancing one way and the other.
          var steps = [];
          for (var k = 0; k < 4; k++) steps.push({ face: k % 2 ? "whistle-2" : "whistle-1", faceFade: k ? 0.2 : 0.25, fn: note, ms: 950 });
          steps.push({ face: null, faceFade: 0.3, ms: 400 });
          act.interrupt = clearNotes;
          play(act, steps);
        }
      },
      wink: {
        weight: 1,
        can: function () { return c.want(["wink"]); },
        run: function (act) { play(act, [{ face: role("wink"), faceFade: 0.1, ms: 700 }, { face: null, faceFade: 0.15, ms: 300 }]); }
      },
      fly: {
        weight: 3,
        can: function () { return !c.gentle() && c.want(["blow"]); },
        run: flyAct
      }
    };

    // A fly buzzes around him while his eyes follow it, lands on his nose,
    // he squints at it, shakes his head and blows, and it leaves.
    function flyAct(act) {
      var el = document.createElement("span");
      el.className = "dc-portrait__fly is-flying";
      el.innerHTML = FLY_SVG;
      c.stage.appendChild(el);
      var centre = { x: 0.48, y: 0.42 };
      var a0 = rand(0, Math.PI * 2);
      var f = { x: centre.x + Math.cos(a0) * 0.8, y: centre.y + Math.sin(a0) * 0.8, vx: 0, vy: 0, turn: 0, mode: "wander" };
      var target = waypoint(), until = now() + rand(3500, 5500), lastT = 0, raf = 0;
      var fx = { stop: function () { cancelAnimationFrame(raf); el.remove(); var k = effects.indexOf(fx); if (k >= 0) effects.splice(k, 1); } };
      effects.push(fx);

      function waypoint() {
        var a = rand(0, Math.PI * 2), r = rand(0.2, 0.42);
        return { x: centre.x + Math.cos(a) * r, y: Math.max(-0.05, Math.min(0.85, centre.y + Math.sin(a) * r)) };
      }
      function leave() {
        if (f.mode === "leave") return;
        f.mode = "leave";
        var a = Math.atan2(f.y - centre.y, f.x - centre.x) + rand(-0.6, 0.6);
        target = { x: centre.x + Math.cos(a) * 1.4, y: centre.y + Math.sin(a) * 1.4 };
        el.classList.remove("is-landed");
        el.classList.add("is-flying");
      }
      // Someone came back: it is gone at once.
      act.interrupt = fx.stop;

      function land() {
        f.mode = "landed";
        el.classList.remove("is-flying");
        el.classList.add("is-landed");
        act.eyes = c.hasEyes("fly-cross") ? "fly-cross" : act.eyes; // cross-eyed at it
        act.fade = 0.15;
        update();
        later(act, 1300, function () {
          act.face = role("flyBother");
          act.faceFade = 0.1;
          [0, 150, 300, 450].forEach(function (t, k) {
            later(act, t, function () { if (!c.gentle()) c.nudge(k % 2 ? -0.35 : 0.35, 0); });
          });
          later(act, 200, function () { f.mode = "hover"; target = { x: FACE.nose.x - 0.14, y: FACE.nose.y - 0.12 }; el.classList.remove("is-landed"); el.classList.add("is-flying"); });
          update();
        });
        later(act, 2100, function () { act.face = role("flyBlow") || role("flyBother"); act.faceFade = 0.15; update(); });
        later(act, 2350, leave);
        later(act, 3000, function () { act.face = null; act.eyes = undefined; act.faceFade = 0.25; update(); });
      }

      function tick(t) {
        raf = 0;
        var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
        lastT = t;
        if (f.mode === "landed") {
          var h = c.head();
          f.x = FACE.nose.x + h.x; f.y = FACE.nose.y + h.y;
        } else {
          if (f.mode === "wander" && now() > until) { f.mode = "land"; target = FACE.nose; }
          var dx = target.x - f.x, dy = target.y - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          var sp = f.mode === "land" ? Math.min(0.55, d * 3 + 0.03) : f.mode === "leave" ? 1.4 : f.mode === "hover" ? 0.5 : 0.6;
          var k = Math.min(1, dt * (f.mode === "land" ? 8 : 5));
          var jitter = f.mode === "land" ? 0.6 : 7;
          f.vx += (dx / d * sp - f.vx) * k + (random() - 0.5) * jitter * dt;
          f.vy += (dy / d * sp - f.vy) * k + (random() - 0.5) * jitter * dt;
          f.x += f.vx * dt; f.y += f.vy * dt;
          if (Math.abs(f.vx) + Math.abs(f.vy) > 0.02) f.turn = Math.atan2(f.vy, f.vx) * 180 / Math.PI + 90;
          if (f.mode === "wander" && d < 0.05) target = waypoint();
          if (f.mode === "land" && d < 0.006) land();
          if (f.mode === "leave" && Math.abs(f.x - centre.x) + Math.abs(f.y - centre.y) > 1.2) {
            fx.stop();
            endAct(act);
            return;
          }
        }
        el.style.left = f.x * 100 + "%";
        el.style.top = f.y * 100 + "%";
        el.style.transform = "translate(-50%, -50%) rotate(" + f.turn.toFixed(0) + "deg)";
        if (st.act === act && f.mode !== "landed") { act.lookAt = { x: f.x, y: f.y }; update(); }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }

    function stopAll() {
      if (st.act) stopAct();
      effects.slice().forEach(function (fx) { fx.stop(); });
    }

    scheduleBlink();
    scheduleIdle(9000);

    var api = {
      update: update,
      hovered: function (on) {
        if (on === st.hover) return;
        st.hover = on;
        if (on) { c.want(FACE_ROLES.hover); activity(); }
        update();
      },
      // on: held or let go; pull: how hard it was pulled (0-1 of the most).
      grabbed: function (on, pull) {
        if (on) { st.held = true; activity(); update(); return; }
        if (!st.held) return; // the hint's phantom hand
        st.held = false;
        if (pull >= DIZZY.pull && role("dizzy")) dizzy();
        else tapped();
      },
      poked: tapped,
      // Off screen or in a background tab: whatever he was doing stops.
      paused: function () {
        stopAll();
        st.gaze = null;
        clearTimeout(gazeTimer);
        update();
      },
      destroy: function () {
        clearTimeout(idleTimer); clearTimeout(blinkTimer); clearTimeout(reactTimer); clearTimeout(gazeTimer);
        if (gazeRaf) cancelAnimationFrame(gazeRaf);
        if (st.act) st.act.timers.forEach(clearTimeout);
        st.act = null;
        effects.slice().forEach(function (fx) { fx.stop(); });
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("pointerdown", onPointer);
        window.removeEventListener("keydown", activity);
        window.removeEventListener("wheel", activity);
        window.removeEventListener("scroll", activity);
      },
      // Development controls: everything on demand, nothing at random.
      dev: {
        auto: function (on) {
          st.auto = on;
          clearTimeout(idleTimer); clearTimeout(blinkTimer);
          if (on) { scheduleBlink(); scheduleIdle(3000); }
        },
        acts: function () { return Object.keys(ACTS); },
        run: function (name) { return ACTS[name] && ACTS[name].can() ? run(name) : null; },
        react: function (name) { if (name === "dizzy") dizzy(); else react(role(name) || name, 1200); },
        blink: function () { blink(false); },
        hover: function (on) { api.hovered(!!on); },
        // Input no longer interrupts what is playing (for clicking the panel).
        hold: function (on) { st.devHold = !!on; },
        // As if the pointer were well off in direction dir (n, ne, e, ...).
        gaze: function (dir) {
          var l = LOOKS["look-" + dir], box = c.stage.getBoundingClientRect();
          if (!l) return;
          onPointer({ type: "pointerdown", pointerType: "mouse", clientX: box.left + (FACE.eyes.x + l.x) * box.width, clientY: box.top + (FACE.eyes.y + l.y) * box.height });
        },
        // Holds a face and/or eyes for ms, then lets them go.
        show: function (face, eyesName, ms) {
          if (st.act) stopAct();
          var act = { name: "dev", face: null, eyes: undefined, lookAt: null, timers: [], interrupt: null };
          st.act = act;
          play(act, [
            { face: face || null, faceFade: 0.15, eyes: eyesName || undefined, fade: 0.1, ms: ms || 1500 },
            { face: null, faceFade: 0.2, eyes: undefined, fade: 0.1, ms: 300 }
          ]);
        },
        stop: function () { stopAll(); update(); },
        state: function () { return { act: st.act && st.act.name, hover: st.hover, held: st.held, react: st.react && st.react.until > now() ? st.react.face : null }; }
      }
    };
    return api;
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = "async";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("portrait texture did not load")); };
      img.src = src;
    });
  }

  /**
   * Starts the engine in `root`. Resolves to { destroy() } or rejects (no
   * WebGL, texture missing) leaving the photograph exactly as it was.
   */
  function create(root) {
    var stage = root.querySelector(".dc-portrait__stage");
    var photo = root.querySelector(".dc-portrait__img");
    var texSrc = root.getAttribute("data-texture") || (photo && (photo.currentSrc || photo.src));
    if (!stage || !texSrc) return Promise.reject(new Error("portrait markup incomplete"));

    var canvas = document.createElement("canvas");
    canvas.className = "dc-portrait__canvas";
    canvas.setAttribute("aria-hidden", "true");
    var gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) return Promise.reject(new Error("no WebGL"));

    return loadImage(texSrc).then(function (image) {
      return start(root, stage, photo, canvas, gl, image);
    });
  }

  function start(root, stage, photo, canvas, gl, image) {
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    var count = N * N;
    var rest = new Float32Array(count * 2);
    var pos = new Float32Array(count * 2);
    var shade = new Float32Array(count);
    var u = new Float32Array(count * 2);
    var v = new Float32Array(count * 2);
    var acc = new Float32Array(count * 2);
    var lean = new Float32Array(count); // how much each node goes with the head
    var grip = new Float32Array(count); // the hand's hold on each node
    var gripFrom = new Float32Array(count * 2);
    var i, x, y;
    for (y = 0; y < N; y++) {
      for (x = 0; x < N; x++) {
        i = y * N + x;
        rest[i * 2] = x / (N - 1);
        rest[i * 2 + 1] = y / (N - 1);
        lean[i] = headWeight(rest[i * 2], rest[i * 2 + 1], 1.35);
      }
    }
    var indices = new Uint16Array((N - 1) * (N - 1) * 6);
    var k = 0;
    for (y = 0; y < N - 1; y++) {
      for (x = 0; x < N - 1; x++) {
        i = y * N + x;
        indices.set([i, i + 1, i + N, i + 1, i + N + 1, i + N], k);
        k += 6;
      }
    }

    function buffer(target, data, usage) {
      var b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, usage);
      return b;
    }
    function attrib(name, buf, size) {
      var loc = gl.getAttribLocation(prog, name);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    var restBuf = buffer(gl.ARRAY_BUFFER, rest, gl.STATIC_DRAW);
    var posBuf = buffer(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    var shadeBuf = buffer(gl.ARRAY_BUFFER, shade, gl.DYNAMIC_DRAW);
    var indexBuf = buffer(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    attrib("aRest", restBuf, 2);
    attrib("aPos", posBuf, 2);
    attrib("aShade", shadeBuf, 1);

    // Texture units: 0 the resting face, 1 the eye sheet, 2-4 the faces being
    // shown. New textures are made on unit 5, which nothing draws from, so a
    // picture that finishes loading never changes what is on screen.
    var LOAD_UNIT = 5;
    var textures = [];
    function texture(unit, img) {
      var t = gl.createTexture();
      textures.push(t);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.activeTexture(gl.TEXTURE0);
      return t;
    }
    texture(0, image);
    var blank = texture(1, null);
    [2, 3, 4].forEach(function (unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, blank); });
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "uEyes"), 1);
    var uFaceW = gl.getUniformLocation(prog, "uFaceW");
    var uEyeW = gl.getUniformLocation(prog, "uEyeW");
    var uEyeRect = gl.getUniformLocation(prog, "uEyeRect");
    var uEyeCells = [0, 1, 2].map(function (k) {
      gl.uniform1i(gl.getUniformLocation(prog, "uFace" + k), 2 + k);
      return gl.getUniformLocation(prog, "uEyeCell" + k);
    });
    gl.uniform3f(uFaceW, 0, 0, 0);
    gl.uniform3f(uEyeW, 0, 0, 0);
    gl.uniform1f(gl.getUniformLocation(prog, "uMargin"), MARGIN);
    gl.uniform3f(gl.getUniformLocation(prog, "uCircle"), CIRCLE.x, CIRCLE.y, CIRCLE.r);
    gl.uniform1f(gl.getUniformLocation(prog, "uTop"), TOP);
    var uPx = gl.getUniformLocation(prog, "uPx");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    stage.appendChild(canvas);

    // --- state ---------------------------------------------------------------
    var hand = null; // { id, x, y, fromX, fromY, kind: "grab" | "hover" }
    var headLean = { x: 0, y: 0, vx: 0, vy: 0 };
    var pose = { x: 0, y: 0 }; // where the head rests when nobody holds it (dozing off)
    var poseTween = null; // { from, to, t0, dur }: the pose easing somewhere new
    var faceTex = {}, eyeCells = {};
    // The faces and eyes on screen, each a weighted mix (see createBlend).
    var faces = createBlend(3, function (slot, name) {
      gl.activeTexture(gl.TEXTURE2 + slot);
      gl.bindTexture(gl.TEXTURE_2D, faceTex[name]);
      gl.activeTexture(gl.TEXTURE0);
    });
    var eyes = createBlend(3, function (slot, name) { gl.uniform4fv(uEyeCells[slot], eyeCells[name]); });
    function sendWeights() {
      var f = faces.weights(), e = eyes.weights();
      gl.uniform3f(uFaceW, f[0], f[1], f[2]);
      gl.uniform3f(uEyeW, e[0], e[1], e[2]);
    }
    var maxPull = 0; // the hardest pull of the grab in progress, 0-1
    var inView = true;
    var running = false, visible = true, destroyed = false, raf = 0, last = 0;
    var size = 0;
    var gentle = function () { return reducedMotion && reducedMotion.matches; };

    function resize() {
      var box = stage.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var full = box.width * (1 + 2 * MARGIN);
      var px = Math.max(1, Math.round(full * dpr));
      if (px !== size) {
        size = px;
        canvas.width = canvas.height = px;
        gl.viewport(0, 0, px, px);
      }
      // One pixel in picture units, for anti-aliasing the circle's edge.
      gl.uniform1f(uPx, (1 + 2 * MARGIN) / Math.max(1, px));
      draw();
    }

    // Pointer position in picture units.
    function toPicture(e) {
      var box = stage.getBoundingClientRect();
      return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
    }

    // Where he is in the picture, from the photo's own outline (64x64), so
    // all the hair showing above the circle can be grabbed too.
    var outline = null;
    try {
      var oc = document.createElement("canvas");
      oc.width = oc.height = 64;
      var o2 = oc.getContext("2d");
      o2.drawImage(image, 0, 0, 64, 64);
      outline = o2.getImageData(0, 0, 64, 64).data;
    } catch (err) { /* another origin: fall back to the head's shape */ }

    // Is there face (or anything of him) under this picture point at rest?
    function onHim(p) {
      var dx = p.x - CIRCLE.x, dy = p.y - CIRCLE.y;
      if (dx * dx + dy * dy <= CIRCLE.r * CIRCLE.r) return true;
      if (p.x < 0 || p.y < 0 || p.x >= 1 || p.y > TOP + 0.04) return false;
      if (!outline) return headWeight(p.x, p.y, 1) > 0.5;
      return outline[((Math.floor(p.y * 64) * 64) + Math.floor(p.x * 64)) * 4 + 3] > 128;
    }

    // Takes hold of the skin under p: nodes near it, where they are now.
    function takeHold(p, strength, radius) {
      for (var i = 0; i < count; i++) {
        var nx = rest[i * 2] + u[i * 2] + headOffsetX(i), ny = rest[i * 2 + 1] + u[i * 2 + 1] + headOffsetY(i);
        var d2 = (nx - p.x) * (nx - p.x) + (ny - p.y) * (ny - p.y);
        grip[i] = strength * Math.exp(-d2 / (radius * radius));
        gripFrom[i * 2] = u[i * 2];
        gripFrom[i * 2 + 1] = u[i * 2 + 1];
      }
    }
    function letGo() { grip.fill(0); }

    function headOffsetX(i) { return lean[i] * headLean.x; }
    function headOffsetY(i) { return lean[i] * headLean.y; }

    // A pull is soft-limited, so the face stretches but never tears off.
    function pull() {
      var dx = hand.x - hand.fromX, dy = hand.y - hand.fromY;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-6) return { x: 0, y: 0 };
      var limit = hand.kind === "hover" ? HOVER.pull : MAX_PULL;
      var s = (limit * Math.tanh(d / limit)) / d;
      if (hand.kind === "grab") maxPull = Math.max(maxPull, s * d / MAX_PULL);
      return { x: dx * s, y: dy * s };
    }

    function step(dt) {
      var P = PHYS, w2 = P.w2, gamma = gentle() ? 22 : P.gamma; // reduced motion: no wobble
      var p = hand ? pull() : null;
      var j, i, x, y, l, r, t, b;
      for (y = 0; y < N; y++) {
        for (x = 0; x < N; x++) {
          i = y * N + x;
          l = x > 0 ? i - 1 : i; r = x < N - 1 ? i + 1 : i;
          t = y > 0 ? i - N : i; b = y < N - 1 ? i + N : i;
          for (j = 0; j < 2; j++) {
            var lapU = u[l * 2 + j] + u[r * 2 + j] + u[t * 2 + j] + u[b * 2 + j] - 4 * u[i * 2 + j];
            var lapV = v[l * 2 + j] + v[r * 2 + j] + v[t * 2 + j] + v[b * 2 + j] - 4 * v[i * 2 + j];
            var a = P.c2 * lapU * (N - 1) * (N - 1) / 100 - w2 * u[i * 2 + j] - gamma * v[i * 2 + j] + P.nu * lapV * (N - 1) * (N - 1);
            if (p && grip[i] > 0.001) {
              var target = gripFrom[i * 2 + j] + grip[i] * (j === 0 ? p.x : p.y);
              a += P.grip * grip[i] * (target - u[i * 2 + j]) - 30 * grip[i] * v[i * 2 + j];
            }
            acc[i * 2 + j] = a;
          }
        }
      }
      for (i = 0; i < count * 2; i++) {
        v[i] += acc[i] * dt;
        u[i] += v[i] * dt;
      }
      // The head leans toward a grab on a floppier spring.
      var tx = p && hand.kind === "grab" ? p.x * 0.45 : pose.x, ty = p && hand.kind === "grab" ? p.y * 0.3 : pose.y;
      var hk = 60, hd = gentle() ? 16 : 7;
      headLean.vx += (hk * (tx - headLean.x) - hd * headLean.vx) * dt;
      headLean.vy += (hk * (ty - headLean.y) - hd * headLean.vy) * dt;
      headLean.x += headLean.vx * dt;
      headLean.y += headLean.vy * dt;
    }

    function energy() {
      var hx = headLean.x - pose.x, hy = headLean.y - pose.y;
      var e = hx * hx + hy * hy + headLean.vx * headLean.vx * 0.01 + headLean.vy * headLean.vy * 0.01;
      for (var i = 0; i < count * 2; i++) e += u[i] * u[i] + v[i] * v[i] * 0.01;
      return e / count;
    }

    function draw() {
      if (destroyed) return;
      var i, x, y;
      for (i = 0; i < count; i++) {
        pos[i * 2] = rest[i * 2] + u[i * 2] + headOffsetX(i);
        pos[i * 2 + 1] = rest[i * 2 + 1] + u[i * 2 + 1] + headOffsetY(i);
      }
      // Faked lighting: stretched skin catches light, bunched skin darkens.
      for (y = 0; y < N; y++) {
        for (x = 0; x < N; x++) {
          i = y * N + x;
          var r = x < N - 1 ? i + 1 : i, b = y < N - 1 ? i + N : i;
          var div = (u[r * 2] - u[i * 2] + u[b * 2 + 1] - u[i * 2 + 1]) * (N - 1);
          shade[i] = clamp(1 + div * 0.35, 0.82, 1.14);
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, shade);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }

    function frame(now) {
      raf = 0;
      if (destroyed || !visible) { running = false; return; }
      // Physics takes at most 0.05 s a frame (stable on slow frames); fades
      // keep to the clock, so they last as long on a slow phone.
      var elapsed = Math.min(0.05, last ? (now - last) / 1000 : PHYS.dt);
      last = now;
      for (var t = 0; t < elapsed; t += PHYS.dt) step(PHYS.dt);
      if (faces.moving() || eyes.moving()) {
        var at = performance.now();
        faces.step(at);
        eyes.step(at);
        sendWeights();
      }
      if (poseTween) {
        var k = Math.min(1, (now - poseTween.t0) / poseTween.dur), e = k * k * (3 - 2 * k);
        pose.x = poseTween.from.x + (poseTween.to.x - poseTween.from.x) * e;
        pose.y = poseTween.from.y + (poseTween.to.y - poseTween.from.y) * e;
        if (k >= 1) poseTween = null;
      }
      draw();
      if (!hand && !faces.moving() && !eyes.moving() && !poseTween && energy() < REST) {
        // Settled: put him exactly back and stop drawing until touched again.
        u.fill(0); v.fill(0);
        headLean.x = pose.x; headLean.y = pose.y; headLean.vx = headLean.vy = 0;
        draw();
        running = false;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function wake() {
      if (running || destroyed || !visible) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function setHandled(on) {
      root.classList.toggle("is-grabbed", on);
      if (on) root.classList.add("was-grabbed");
    }

    // --- input -----------------------------------------------------------------
    var pending = null; // a finger that has landed but not yet decided

    function grab(e, p) {
      hand = { id: e.pointerId, x: p.x, y: p.y, fromX: p.x, fromY: p.y, kind: "grab" };
      maxPull = 0;
      takeHold(p, 1, 0.16);
      setHandled(true);
      stage.classList.add("is-grabbing");
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
      if (navigator.vibrate && e.pointerType === "touch") navigator.vibrate(8);
      mood.grabbed(true);
      wake();
    }

    function release() {
      if (!hand) return;
      var wasGrab = hand.kind === "grab";
      hand = null;
      letGo();
      stage.classList.remove("is-grabbing");
      if (wasGrab) {
        tugTimers.push(setTimeout(function () { if (!hand) setHandled(false); }, 700));
        mood.grabbed(false, maxPull);
      }
      wake();
    }

    function poke(p) {
      // A little push away from where he was touched.
      for (var i = 0; i < count; i++) {
        var dx = rest[i * 2] - p.x, dy = rest[i * 2 + 1] - p.y;
        var w = Math.exp(-(dx * dx + dy * dy) / 0.006);
        v[i * 2 + 1] += 0.35 * w;
        v[i * 2] += dx * 6 * w;
      }
      root.classList.add("was-grabbed");
      mood.poked();
      wake();
    }

    function onDown(e) {
      if (e.button > 0) return;
      var p = toPicture(e);
      if (!onHim(p)) return;
      if (e.pointerType === "mouse") {
        e.preventDefault();
        grab(e, p);
        return;
      }
      // Touch or pen: share the screen with scrolling. A sideways move or a
      // long press grabs; a vertical swipe is left to the browser.
      pending = { id: e.pointerId, x: e.clientX, y: e.clientY, p: p, ev: e };
      pending.timer = setTimeout(function () {
        if (pending && pending.id === e.pointerId) { var d = pending; pending = null; grab(d.ev, d.p); }
      }, 320);
    }

    function onMove(e) {
      if (pending && pending.id === e.pointerId) {
        var dx = e.clientX - pending.x, dy = e.clientY - pending.y;
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          clearTimeout(pending.timer);
          var d = pending; pending = null;
          grab(e, d.p);
        } else if (Math.abs(dy) > 10) {
          clearTimeout(pending.timer);
          pending = null;
        }
      }
      var p = toPicture(e);
      if (e.pointerType === "mouse") {
        stage.classList.toggle("is-over", onHim(p));
        mood.hovered(onHim(p));
      }
      if (hand && hand.id === e.pointerId) {
        hand.x = p.x; hand.y = p.y;
        if (hand.kind === "hover") {
          if (!onHim(p)) { release(); return; }
          // Moved too far: the skin slips out of the half-hold and is caught again here.
          var sx = p.x - hand.fromX, sy = p.y - hand.fromY;
          if (sx * sx + sy * sy > HOVER.slip * HOVER.slip) {
            hand.fromX = p.x; hand.fromY = p.y;
            takeHold(p, HOVER.hold, HOVER.radius);
          }
        }
        wake();
        return;
      }
      // A resting mouse already half-holds the skin: it comes along a little
      // and slips free.
      if (e.pointerType === "mouse" && !e.buttons && !gentle() && !hand) {
        if (!onHim(p)) return;
        hand ={ id: e.pointerId, x: p.x, y: p.y, fromX: p.x, fromY: p.y, kind: "hover" };
        takeHold(p, HOVER.hold, HOVER.radius);
        wake();
      }
    }

    function onUp(e) {
      if (pending && pending.id === e.pointerId) {
        clearTimeout(pending.timer);
        var tapped = pending; pending = null;
        poke(tapped.p);
        return;
      }
      if (hand && hand.id === e.pointerId) release();
    }

    function onCancel(e) {
      if (pending && pending.id === e.pointerId) { clearTimeout(pending.timer); pending = null; }
      if (hand && hand.id === e.pointerId) release();
    }

    function onLeave(e) {
      if (hand && hand.kind === "hover" && hand.id === e.pointerId) release();
      if (e.pointerType === "mouse") mood.hovered(false);
    }

    // While a finger holds him, the page must not scroll.
    function onTouchMove(e) {
      if (hand && hand.kind === "grab") e.preventDefault();
    }

    var pokeButton = root.querySelector(".dc-portrait__poke");
    function onPokeButton(e) {
      // Pointer clicks are handled above; this is the keyboard/screen-reader path.
      if (e.detail === 0) poke({ x: 0.5, y: 0.42 });
    }

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onCancel);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("dragstart", preventDefault);
    if (pokeButton) pokeButton.addEventListener("click", onPokeButton);
    function preventDefault(e) { e.preventDefault(); }

    // Idle hint: after a quiet spell, a phantom hand tugs his cheek once, so
    // phones (no hover) show he can be grabbed. Not with reduced motion.
    var ghost = document.createElement("span");
    ghost.className = "dc-portrait__ghost";
    ghost.setAttribute("aria-hidden", "true");
    stage.appendChild(ghost);
    var idleTimer = 0, tugTimers = [];
    function scheduleTug() {
      clearTimeout(idleTimer);
      if (gentle() || DEV || root.classList.contains("was-grabbed")) return;
      idleTimer = setTimeout(tug, 4500);
    }
    function tug() {
      if (destroyed || hand || !visible || root.classList.contains("was-grabbed")) return;
      var cheek = { x: 0.64, y: 0.47 };
      ghost.style.left = cheek.x * 100 + "%";
      ghost.style.top = cheek.y * 100 + "%";
      ghost.classList.add("is-on");
      tugTimers.push(setTimeout(function () {
        if (hand) return;
        hand = { id: -1, x: cheek.x, y: cheek.y, fromX: cheek.x, fromY: cheek.y, kind: "grab" };
        takeHold(cheek, 1, 0.08);
        ghost.classList.add("is-gripping");
        wake();
        var t0 = performance.now();
        (function pullOut() {
          if (!hand || hand.id !== -1) return;
          var t = Math.min(1, (performance.now() - t0) / 650);
          hand.x = cheek.x + 0.16 * t;
          hand.y = cheek.y + 0.02 * Math.sin(t * Math.PI * 3);
          ghost.style.left = hand.x * 100 + "%";
          ghost.style.top = hand.y * 100 + "%";
          if (t < 1) requestAnimationFrame(pullOut);
          else tugTimers.push(setTimeout(function () {
            if (hand && hand.id === -1) release();
            ghost.classList.remove("is-gripping", "is-on");
          }, 180));
        })();
      }, 450));
    }
    root.addEventListener("pointerdown", function () { clearTimeout(idleTimer); }, { once: true });

    // --- expressions -------------------------------------------------------------
    var manifest = null, manifestUrl = "", loading = {}, queue = [], busy = false;

    // Shows the face `name` (null: his own), cross-fading over `seconds` from
    // whatever is on screen now.
    function setFace(name, seconds) {
      if (name && !faceTex[name]) name = null;
      if (faces.to(name, seconds)) { sendWeights(); wake(); }
    }

    // The same for the eyes.
    function setEyes(name, seconds) {
      if (name && !eyeCells[name]) name = null;
      if (eyes.to(name, seconds)) { sendWeights(); wake(); }
    }

    // True if all these faces are loaded; otherwise they are queued (one
    // picture at a time, the ones asked for first) and it is false for now.
    function want(names) {
      var ready = true;
      names.forEach(function (n) {
        if (faceTex[n]) return;
        ready = false;
        if (!manifest || !manifest.faces[n] || loading[n]) return;
        loading[n] = true;
        queue.push(n);
      });
      pump();
      return ready;
    }
    function pump() {
      if (busy || destroyed || !queue.length) return;
      var name = queue.shift();
      busy = true;
      loadImage(new URL(manifest.faces[name], manifestUrl).href).then(function (img) {
        if (!destroyed) faceTex[name] = texture(LOAD_UNIT, img);
      }, function () { /* that face is simply left out */ }).then(function () {
        busy = false;
        if (destroyed) return;
        mood.update();
        pump();
      });
    }

    // Loads expressions.json, the eyes and the common faces, after the
    // portrait is up. Idle faces load when an idle act first wants them.
    function loadExpressions(url) {
      fetch(url, { credentials: "same-origin" }).then(function (r) {
        if (!r.ok) throw new Error("no expressions");
        return r.json();
      }).then(function (m) {
        if (destroyed) return;
        manifest = m;
        manifest.faces = m.faces || {};
        manifestUrl = new URL(url, location.href).href;
        if (m.eyes && m.eyes.sheet) {
          loadImage(new URL(m.eyes.sheet, manifestUrl).href).then(function (img) {
            if (destroyed) return;
            var t = texture(LOAD_UNIT, img);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform4fv(uEyeRect, m.eyes.rect);
            eyeCells = m.eyes.cells || {};
            mood.update();
          }, function () {});
        }
        want(DEV ? Object.keys(manifest.faces).filter(function (n) { return n !== "rest"; }) : COMMON);
      }).catch(function () { /* the plain portrait still works */ });
    }

    // Gone from the page (Elementor redrew the widget, say): stop for good.
    function alive() {
      if (destroyed) return false;
      if (!root.isConnected) { destroy(); return false; }
      return true;
    }

    var mood = createMood({
      root: root,
      stage: stage,
      setFace: setFace,
      setEyes: setEyes,
      want: want,
      alive: alive,
      hasFace: function (n) { return !!faceTex[n]; },
      hasEyes: function (n) { return !!eyeCells[n]; },
      eyeNames: function () { return Object.keys(eyeCells); },
      held: function () { return !!(hand && hand.kind === "grab"); },
      visible: function () { return visible; },
      gentle: gentle,
      head: function () { return { x: headLean.x, y: headLean.y }; },
      setPose: function (x, y, seconds) {
        poseTween = { from: { x: pose.x, y: pose.y }, to: { x: x, y: y }, t0: performance.now(), dur: Math.max(1, (seconds || 0) * 1000) };
        wake();
      },
      nudge: function (vx, vy) { headLean.vx += vx; headLean.vy += vy; wake(); }
    });
    var expressionsUrl = root.getAttribute("data-expressions");
    if (expressionsUrl) setTimeout(function () { if (!destroyed) loadExpressions(expressionsUrl); }, 300);

    // --- lifecycle --------------------------------------------------------------
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(stage); else window.addEventListener("resize", resize);
    // Drawn and lively only while on screen in a tab that is showing.
    function setVisible() {
      var was = visible;
      visible = inView && !document.hidden;
      if (visible) {
        wake();
        if (!was) scheduleTug();
      } else {
        clearTimeout(idleTimer);
        if (hand) release();
        if (was) mood.paused();
      }
    }
    var io = new IntersectionObserver(function (entries) {
      if (!alive()) return;
      inView = entries.some(function (en) { return en.isIntersecting; });
      setVisible();
    });
    io.observe(root);
    function onVisibility() {
      if (alive()) setVisible();
    }
    document.addEventListener("visibilitychange", onVisibility);

    var api = { destroy: destroy, lost: null, root: root };
    instances.push(api);
    var devPanel = null, devTimers = [];
    if (DEV) api.dev = devControls();

    /**
     * Development controls (?dcportrait=dev): no idle acts or blinks at
     * random, random numbers seeded, every face loaded at once, and a panel
     * (plus DCPortrait.instances[i].dev) to trigger each face, eye, act and
     * reaction, or replay all of them in a fixed order.
     */
    function devControls() {
      seed(1);
      mood.dev.auto(false);
      var ctl = {
        mood: mood.dev,
        faces: function () { return manifest ? Object.keys(manifest.faces) : []; },
        eyes: function () { return Object.keys(eyeCells); },
        // A grab at the forehead pulled by (dx, dy) picture widths over ms.
        drag: function (dx, dy, ms) {
          var p0 = { x: 0.5, y: 0.3 };
          hand = { id: -2, x: p0.x, y: p0.y, fromX: p0.x, fromY: p0.y, kind: "grab" };
          maxPull = 0;
          takeHold(p0, 1, 0.16);
          setHandled(true);
          mood.grabbed(true);
          wake();
          var t0 = performance.now();
          (function move() {
            if (!hand || hand.id !== -2) return;
            var t = Math.min(1, (performance.now() - t0) / (ms || 800));
            hand.x = p0.x + dx * t; hand.y = p0.y + dy * t;
            if (t < 1) requestAnimationFrame(move);
            else devTimers.push(setTimeout(function () { if (hand && hand.id === -2) release(); }, 200));
          })();
        },
        poke: function () { poke({ x: 0.5, y: 0.42 }); },
        // What is on screen: faces and eyes with their weights.
        state: function () {
          var list = function (b) {
            var w = b.weights();
            return b.names().map(function (n, k) { return n && w[k] > 0.001 ? n + " " + w[k].toFixed(2) : null; }).filter(Boolean);
          };
          return { faces: list(faces), eyes: list(eyes), mood: mood.dev.state(), drawing: running, visible: visible };
        },
        // Every expression, sequence and interruption, in a fixed order.
        // Returns its length in ms; data-dev-step on the portrait names the step.
        replay: function () {
          devTimers.forEach(clearTimeout);
          devTimers = [];
          seed(1);
          var t = 0, steps = [];
          var at = function (ms, label, fn) { t += ms; steps.push([t, label, fn]); };
          ["e", "ne", "n", "nw", "w", "sw", "s", "se"].forEach(function (d, k) {
            at(k ? 700 : 300, "gaze " + d, function () { mood.dev.gaze(d); });
          });
          at(2400, "gaze back to centre (2 s)", function () {});
          at(600, "hover: annoyed", function () { mood.dev.hover(true); });
          at(1800, "hover ends", function () { mood.dev.hover(false); });
          at(700, "grab: ouch", function () { ctl.drag(0.06, 0.03, 700); });
          at(1700, "released: shock", function () {});
          at(1400, "hard drag: dizzy", function () { ctl.drag(0.4, 0.2, 600); });
          at(2900, "three pokes: shock, shock, dizzy", function () { ctl.poke(); });
          at(350, "", function () { ctl.poke(); });
          at(350, "", function () { ctl.poke(); });
          at(2400, "blink, double blink", function () { mood.dev.blink(); });
          at(500, "", function () { mood.dev.blink(); devTimers.push(setTimeout(mood.dev.blink, 280)); });
          at(800, "wink", function () { mood.dev.run("wink"); });
          at(1300, "yawn", function () { mood.dev.run("yawn"); });
          at(4000, "whistle", function () { mood.dev.run("whistle"); });
          at(4600, "yawn, interrupted by the pointer", function () { mood.dev.run("yawn"); });
          at(1200, "", function () { mood.dev.gaze("e"); });
          at(2600, "sleepy", function () { mood.dev.run("sleepy"); });
          at(8600, "sleepy, interrupted by a grab", function () { mood.dev.run("sleepy"); });
          at(1600, "", function () { ctl.drag(-0.05, 0.02, 500); });
          at(2200, "dizzy, then hovered (dizzy stays on top)", function () { ctl.drag(0.4, -0.15, 500); });
          at(300, "", function () { mood.dev.hover(true); });
          at(2600, "", function () { mood.dev.hover(false); });
          at(800, "fly", function () { mood.dev.run("fly"); });
          at(11000, "end", function () {});
          steps.forEach(function (s) {
            devTimers.push(setTimeout(function () {
              if (destroyed) return;
              if (s[1]) root.setAttribute("data-dev-step", s[1]);
              s[2]();
            }, s[0]));
          });
          return t;
        }
      };
      if (instances.indexOf(api) === 0) devPanel = buildDevPanel(ctl);
      return ctl;
    }

    function buildDevPanel(ctl) {
      var el = document.createElement("div");
      el.className = "dc-portrait-dev";
      el.setAttribute("style", "position:fixed;left:8px;bottom:8px;z-index:99999;max-width:min(560px,calc(100vw - 16px));max-height:45vh;overflow:auto;background:rgba(20,20,20,.92);color:#eee;font:12px/1.3 system-ui,sans-serif;padding:8px;border-radius:8px");
      document.body.appendChild(el);
      var status = document.createElement("div");
      var row = function (title, items, fn) {
        var r = document.createElement("div");
        r.style.margin = "2px 0";
        r.appendChild(document.createTextNode(title + ": "));
        items.forEach(function (it) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = it;
          b.setAttribute("style", "margin:1px;padding:2px 6px;font:inherit;cursor:pointer");
          b.addEventListener("click", function () { fn(it); });
          r.appendChild(b);
        });
        el.appendChild(r);
      };
      var filled = false;
      var fill = function () {
        el.textContent = "";
        row("faces", ctl.faces().filter(function (n) { return n !== "rest"; }), function (n) { mood.dev.show(n, null, 1500); });
        row("eyes", ctl.eyes(), function (n) { mood.dev.show(null, n, 1500); });
        row("gaze", ["n", "ne", "e", "se", "s", "sw", "w", "nw"], mood.dev.gaze);
        row("acts", mood.dev.acts(), mood.dev.run);
        row("react", ["hover on", "hover off", "grab", "hard drag", "poke", "dizzy", "blink"], function (n) {
          if (n === "hover on") mood.dev.hover(true);
          else if (n === "hover off") mood.dev.hover(false);
          else if (n === "grab") ctl.drag(0.06, 0.03, 700);
          else if (n === "hard drag") ctl.drag(0.4, 0.2, 600);
          else if (n === "poke") ctl.poke();
          else if (n === "dizzy") mood.dev.react("dizzy");
          else mood.dev.blink();
        });
        row("run", ["replay all", "stop", "random on", "random off", "input holds", "input interrupts"], function (n) {
          if (n === "replay all") ctl.replay();
          else if (n === "stop") { devTimers.forEach(clearTimeout); mood.dev.stop(); }
          else if (n === "random on") mood.dev.auto(true);
          else if (n === "random off") mood.dev.auto(false);
          else mood.dev.hold(n === "input holds");
        });
        el.appendChild(status);
      };
      fill();
      devTimers.push(setInterval(function () {
        if (destroyed) return;
        if (!filled && manifest && Object.keys(eyeCells).length) { filled = true; fill(); }
        status.textContent = (root.getAttribute("data-dev-step") || "") + " | " + JSON.stringify(ctl.state());
      }, 250));
      return el;
    }

    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      destroy();
      if (api.lost) api.lost();
    });

    resize();
    root.classList.add("is-live");
    scheduleTug();

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      tugTimers.forEach(clearTimeout);
      if (pending) clearTimeout(pending.timer);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onCancel);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("dragstart", preventDefault);
      if (pokeButton) pokeButton.removeEventListener("click", onPokeButton);
      document.removeEventListener("visibilitychange", onVisibility);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
      io.disconnect();
      mood.destroy();
      devTimers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
      if (devPanel) devPanel.remove();
      var k = instances.indexOf(api);
      if (k >= 0) instances.splice(k, 1);
      [restBuf, posBuf, shadeBuf, indexBuf].forEach(function (b) { gl.deleteBuffer(b); });
      textures.forEach(function (t) { gl.deleteTexture(t); });
      gl.deleteProgram(prog);
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose && !gl.isContextLost()) lose.loseContext();
      canvas.remove();
      ghost.remove();
      root.classList.remove("is-live", "is-grabbed");
      stage.classList.remove("is-grabbing");
      if (photo) photo.removeAttribute("hidden");
    }

    return api;
  }

  /**
   * Mounts every [data-dc-portrait] on the page: lazily, when it comes near
   * the viewport (or on first tap for visitors who asked to save data), and
   * brings it back up to 3 times if a phone takes the WebGL context away.
   */
  function mount(root) {
    if (root.__dcPortrait) return;
    var state = { engine: null, tries: 0 };
    root.__dcPortrait = state;

    function boot() {
      if (state.engine || state.starting) return;
      state.starting = true;
      create(root).then(function (engine) {
        state.engine = engine;
        engine.lost = function () {
          state.engine = null;
          if (++state.tries <= 3) setTimeout(boot, 400 * Math.pow(3, state.tries - 1));
        };
      }, function () {
        // The photograph is already there: nothing else to do.
      }).then(function () { state.starting = false; });
    }

    var saveData = navigator.connection && navigator.connection.saveData;
    if (saveData || !window.IntersectionObserver) {
      root.addEventListener("pointerdown", boot, { once: true });
      if (!saveData) boot();
      return;
    }
    var near = new IntersectionObserver(function (entries) {
      if (!entries.some(function (en) { return en.isIntersecting; })) return;
      near.disconnect();
      boot();
    }, { rootMargin: "300px" });
    near.observe(root);
  }

  function mountAll() {
    var nodes = document.querySelectorAll("[data-dc-portrait]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  window.DCPortrait = { mount: mount, create: create, instances: instances };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
