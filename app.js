const root = document.documentElement;
const canvas = document.getElementById("space");
const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let scrollProgress = 0;
let visualProgress = 0;
let pointerX = 0.5;
let pointerY = 0.5;
let activeSectionLabel = "Home";

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  if (gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function initSpace() {
  if (!gl || prefersReducedMotion) return null;

  const vertex = `
    attribute vec3 position;
    attribute float size;
    uniform float time;
    uniform float scroll;
    uniform vec2 pointer;
    uniform vec2 resolution;
    varying float depth;

    void main() {
      vec3 p = position;
      float wave = sin(time * 0.7 + p.x * 1.7 + p.y * 1.3) * 0.12;
      p.x += (pointer.x - 0.5) * (1.0 - p.z) * 0.75 + wave;
      p.y += (0.5 - pointer.y) * (1.0 - p.z) * 0.55 + cos(time * 0.5 + p.x) * 0.08;
      p.z += scroll * 4.5;
      p.z = mod(p.z + 6.0, 6.0) - 3.0;
      float perspective = 1.25 / (3.4 - p.z);
      gl_Position = vec4(p.x * perspective, p.y * perspective, 0.0, 1.0);
      gl_PointSize = size * perspective * resolution.y * 0.006;
      depth = perspective;
    }
  `;

  const fragment = `
    precision mediump float;
    varying float depth;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float dist = length(uv);
      float alpha = smoothstep(0.5, 0.08, dist);
      vec3 cyan = vec3(0.34, 0.94, 1.0);
      vec3 gold = vec3(1.0, 0.82, 0.43);
      vec3 color = mix(cyan, gold, depth * 0.45);
      gl_FragColor = vec4(color, alpha * 0.78);
    }
  `;

  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  gl.useProgram(program);

  const count = 1700;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.399963;
    const radius = Math.sqrt(i / count) * 4.2;
    const arm = Math.sin(i * 0.018) * 0.4;
    positions[i * 3] = Math.cos(angle) * radius + arm;
    positions[i * 3 + 1] = Math.sin(angle) * radius * 0.62;
    positions[i * 3 + 2] = Math.random() * 6 - 3;
    sizes[i] = 3 + Math.random() * 8;
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

  const sizeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
  const sizeLocation = gl.getAttribLocation(program, "size");
  gl.enableVertexAttribArray(sizeLocation);
  gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  return {
    count,
    uniforms: {
      time: gl.getUniformLocation(program, "time"),
      scroll: gl.getUniformLocation(program, "scroll"),
      pointer: gl.getUniformLocation(program, "pointer"),
      resolution: gl.getUniformLocation(program, "resolution"),
    },
  };
}

function updateScrollState() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
  root.style.setProperty("--progress", scrollProgress.toFixed(4));
  const hero = document.querySelector(".hero");
  const heroFadeStart = hero ? hero.offsetHeight * 0.55 : window.innerHeight * 0.7;
  const heroFadeEnd = hero ? hero.offsetHeight * 0.95 : window.innerHeight;
  const spaceOpacity = Math.max(0, Math.min(1, (window.scrollY - heroFadeStart) / (heroFadeEnd - heroFadeStart)));
  root.style.setProperty("--space-opacity", spaceOpacity.toFixed(3));
}

function updateVisualState() {
  visualProgress += (scrollProgress - visualProgress) * 0.075;
  root.style.setProperty("--progress", visualProgress.toFixed(4));

  document.querySelectorAll(".panel").forEach((panel, index) => {
    const rect = panel.getBoundingClientRect();
    const center = rect.top + rect.height / 2 - window.innerHeight / 2;
    const amount = Math.max(-1, Math.min(1, center / window.innerHeight));
    const depth = Number(panel.dataset.depth || 0.4);
    panel.style.transform = `translate3d(0, ${amount * depth * -28}px, ${amount * depth * -32}px) rotateX(${amount * -3.2}deg) rotateY(${amount * 1.2}deg)`;
    panel.style.opacity = String(Math.max(0.42, 1 - Math.abs(amount) * 0.18));
    panel.style.setProperty("--panel-index", index);
  });

  document.querySelectorAll(".depth-card").forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const viewportCenter = window.innerHeight / 2;
    const distance = Math.max(-1, Math.min(1, (center - viewportCenter) / window.innerHeight));
    const cardProgress = 1 - Math.min(1, Math.abs(distance) * 1.4);
    const side = index % 2 === 0 ? -1 : 1;
    card.style.setProperty("--scroll-lift", `${distance * -22}px`);
    card.style.setProperty("--scroll-z", `${cardProgress * 32}px`);
    card.style.setProperty("--scroll-rx", `${distance * -4}deg`);
    card.style.setProperty("--scroll-ry", `${side * cardProgress * 2.6}deg`);
    card.style.setProperty("--card-progress", cardProgress.toFixed(3));
  });

  document.querySelectorAll(".stack-cloud span").forEach((chip, index) => {
    const rect = chip.getBoundingClientRect();
    const inView = Math.max(0, Math.min(1, 1 - Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight));
    chip.style.setProperty("--chip-y", `${(1 - inView) * 24}px`);
    chip.style.setProperty("--chip-z", `${inView * 38}px`);
    chip.style.setProperty("--chip-rotate", `${Math.sin(index + visualProgress * 7) * 2.4}deg`);
  });
}

function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll(".section, .project, .idea, .timeline .tilt-card").forEach((el) => {
    el.classList.add("reveal");
    observer.observe(el);
  });
}

function initTilt() {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      card.style.setProperty("--ry", `${(x - 0.5) * 8}deg`);
      card.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}

function initFilters() {
  const buttons = document.querySelectorAll("[data-filter]");
  const projects = document.querySelectorAll(".project");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      buttons.forEach((item) => item.classList.toggle("active", item === button));
      projects.forEach((project) => {
        const visible = filter === "all" || project.dataset.tags.includes(filter);
        project.hidden = !visible;
        if (visible) {
          project.animate(
            [
              { opacity: 0, transform: "translateY(28px) scale(0.96) rotateX(8deg)" },
              { opacity: 1, transform: "translateY(0) scale(1) rotateX(0deg)" },
            ],
            { duration: 420, easing: "cubic-bezier(.16, 1, .3, 1)" }
          );
        }
      });
    });
  });
}

function initNavSpy() {
  const links = [...document.querySelectorAll("nav a")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
        activeSectionLabel = entry.target.id || "Home";
        const label = document.querySelector("[data-orbit-label]");
        if (label) label.textContent = activeSectionLabel.charAt(0).toUpperCase() + activeSectionLabel.slice(1);
      });
    },
    { rootMargin: "-58% 0px -35% 0px" }
  );
  sections.forEach((section) => observer.observe(section));
}

function initCounters() {
  const counters = document.querySelectorAll("[data-count]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const counter = entry.target;
        const target = Number(counter.dataset.count || 0);
        const start = performance.now();
        const duration = 1100;
        function tick(now) {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          counter.textContent = String(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(counter);
      });
    },
    { threshold: 0.8 }
  );
  counters.forEach((counter) => observer.observe(counter));
}

function initMagneticControls() {
  document.querySelectorAll(".button, .filters button, .contact-links a").forEach((control) => {
    control.addEventListener("pointermove", (event) => {
      const rect = control.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      control.style.transform = `translate(${x * 0.13}px, ${y * 0.18}px) translateY(-2px)`;
    });
    control.addEventListener("pointerleave", () => {
      control.style.transform = "";
    });
  });
}

function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      history.pushState(null, "", link.getAttribute("href"));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function typeInto(element, text, speed) {
  const target = element.querySelector("[data-type-target]");
  if (!target) return;
  target.textContent = "";
  element.classList.remove("is-complete");

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const previous = text[index - 1] || "";
    target.textContent += character;

    let delay = speed + Math.random() * speed * 0.55;
    if (character === " ") delay = speed * 0.38 + Math.random() * 22;
    if (previous === ".") delay += 120;
    if (/[,.]/.test(character)) delay += 90;
    if (index === 1 || index === Math.floor(text.length * 0.55)) delay += 75;

    await sleep(delay);
  }

  await sleep(180);
  element.classList.add("is-complete");
}

async function initHeroTypewriter() {
  const items = [...document.querySelectorAll(".hero .typewriter")];
  if (!items.length) return;

  if (prefersReducedMotion) {
    items.forEach((item) => {
      const target = item.querySelector("[data-type-target]");
      if (target) target.textContent = item.dataset.typeText || "";
      item.classList.add("is-complete");
    });
    return;
  }

  await sleep(420);
  for (const item of items) {
    await typeInto(item, item.dataset.typeText || "", item.classList.contains("subline") ? 30 : 54);
    await sleep(item.classList.contains("subline") ? 0 : 260);
  }
}

window.addEventListener("pointermove", (event) => {
  pointerX = event.clientX / window.innerWidth;
  pointerY = event.clientY / window.innerHeight;
  root.style.setProperty("--x", `${event.clientX}px`);
  root.style.setProperty("--y", `${event.clientY}px`);
});

window.addEventListener("scroll", updateScrollState, { passive: true });
window.addEventListener("resize", () => {
  resizeCanvas();
  updateScrollState();
});

resizeCanvas();
const space = initSpace();
initReveal();
initTilt();
initFilters();
initNavSpy();
initCounters();
initMagneticControls();
initSmoothAnchors();
initHeroTypewriter();
updateScrollState();

function render(time = 0) {
  updateVisualState();
  if (space && gl) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(space.uniforms.time, time * 0.001);
    gl.uniform1f(space.uniforms.scroll, visualProgress);
    gl.uniform2f(space.uniforms.pointer, pointerX, pointerY);
    gl.uniform2f(space.uniforms.resolution, canvas.width, canvas.height);
    gl.drawArrays(gl.POINTS, 0, space.count);
  }
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
