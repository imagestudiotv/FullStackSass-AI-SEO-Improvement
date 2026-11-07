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
 * same geometry). The body is shown only inside the circle; the head is
 * shown wherever it has been pulled to.
 */
(function () {
  "use strict";

  var N = 34; // grid nodes per side
  var CIRCLE = { x: 0.5, y: 0.6, r: 0.4 };
  var HEAD = { x: 0.5, y: 0.37, rx: 0.2, ry: 0.27 }; // in picture space
  var MARGIN = 0.25; // canvas reaches this far past the picture on each side
  var MAX_PULL = 0.24; // how far (picture widths) skin can be dragged
  var PHYS = { c2: 25, w2: 70, gamma: 7, nu: 0.0016, grip: 900, dt: 1 / 240 };
  var REST = 0.000004; // below this energy he is settled and drawing stops

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

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

  var FRAG = [
    "precision mediump float;",
    "uniform sampler2D uTex;",
    "uniform vec3 uCircle;",
    "uniform vec4 uHead;",
    "uniform float uPx;",
    "varying vec2 vUv;",
    "varying vec2 vPos;",
    "varying float vShade;",
    "void main() {",
    "  vec4 t = texture2D(uTex, vUv);",
    "  float inCircle = clamp((uCircle.z - distance(vPos, uCircle.xy)) / uPx + 0.5, 0.0, 1.0);",
    "  vec2 h = (vUv - uHead.xy) / uHead.zw;",
    "  float inHead = clamp((1.0 - length(h)) * 6.0, 0.0, 1.0);",
    "  float a = t.a * max(inCircle, inHead);",
    "  gl_FragColor = vec4(t.rgb * vShade * a, a);",
    "}"
  ].join("\n");

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

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1f(gl.getUniformLocation(prog, "uMargin"), MARGIN);
    gl.uniform3f(gl.getUniformLocation(prog, "uCircle"), CIRCLE.x, CIRCLE.y, CIRCLE.r);
    gl.uniform4f(gl.getUniformLocation(prog, "uHead"), HEAD.x, HEAD.y, HEAD.rx * 1.08, HEAD.ry * 1.08);
    var uPx = gl.getUniformLocation(prog, "uPx");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    stage.appendChild(canvas);

    // --- state ---------------------------------------------------------------
    var hand = null; // { id, x, y, fromX, fromY, kind: "grab" | "hover" }
    var headLean = { x: 0, y: 0, vx: 0, vy: 0 };
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

    // Is there face (or anything of him) under this picture point at rest?
    function onHim(p) {
      var dx = p.x - CIRCLE.x, dy = p.y - CIRCLE.y;
      return dx * dx + dy * dy <= CIRCLE.r * CIRCLE.r || headWeight(p.x, p.y, 1) > 0.5;
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
      var limit = hand.kind === "hover" ? 0.05 : MAX_PULL;
      var s = (limit * Math.tanh(d / limit)) / d;
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
      var tx = p && hand.kind === "grab" ? p.x * 0.35 : 0, ty = p && hand.kind === "grab" ? p.y * 0.25 : 0;
      var hk = 60, hd = gentle() ? 16 : 7;
      headLean.vx += (hk * (tx - headLean.x) - hd * headLean.vx) * dt;
      headLean.vy += (hk * (ty - headLean.y) - hd * headLean.vy) * dt;
      headLean.x += headLean.vx * dt;
      headLean.y += headLean.vy * dt;
    }

    function energy() {
      var e = headLean.x * headLean.x + headLean.y * headLean.y + headLean.vx * headLean.vx * 0.01 + headLean.vy * headLean.vy * 0.01;
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
      var elapsed = Math.min(0.05, last ? (now - last) / 1000 : PHYS.dt);
      last = now;
      for (var t = 0; t < elapsed; t += PHYS.dt) step(PHYS.dt);
      draw();
      if (!hand && energy() < REST) {
        // Settled: put him exactly back and stop drawing until touched again.
        u.fill(0); v.fill(0);
        headLean.x = headLean.y = headLean.vx = headLean.vy = 0;
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
      takeHold(p, 1, 0.13);
      setHandled(true);
      stage.classList.add("is-grabbing");
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
      if (navigator.vibrate && e.pointerType === "touch") navigator.vibrate(8);
      wake();
    }

    function release() {
      if (!hand) return;
      var wasGrab = hand.kind === "grab";
      hand = null;
      letGo();
      stage.classList.remove("is-grabbing");
      if (wasGrab) setTimeout(function () { if (!hand) setHandled(false); }, 700);
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
      if (e.pointerType === "mouse") stage.classList.toggle("is-over", onHim(p));
      if (hand && hand.id === e.pointerId) {
        hand.x = p.x; hand.y = p.y;
        if (hand.kind === "hover") {
          if (!onHim(p)) { release(); return; }
          // Moved too far: the skin slips out of the half-hold and is caught again here.
          var sx = p.x - hand.fromX, sy = p.y - hand.fromY;
          if (sx * sx + sy * sy > 0.07 * 0.07) {
            hand.fromX = p.x; hand.fromY = p.y;
            takeHold(p, 0.5, 0.07);
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
        takeHold(p, 0.5, 0.07);
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
      if (gentle() || root.classList.contains("was-grabbed")) return;
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

    // --- lifecycle --------------------------------------------------------------
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(stage); else window.addEventListener("resize", resize);
    var io = new IntersectionObserver(function (entries) {
      visible = entries.some(function (en) { return en.isIntersecting; });
      if (visible) { wake(); scheduleTug(); } else { clearTimeout(idleTimer); }
    });
    io.observe(root);
    function onVisibility() {
      visible = !document.hidden;
      if (visible) wake();
      else if (hand) release();
    }
    document.addEventListener("visibilitychange", onVisibility);

    var api = { destroy: destroy, lost: null };
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
      [restBuf, posBuf, shadeBuf, indexBuf].forEach(function (b) { gl.deleteBuffer(b); });
      gl.deleteTexture(tex);
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

  window.DCPortrait = { mount: mount, create: create };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
