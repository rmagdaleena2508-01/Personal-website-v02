const root = document.documentElement;
const canvas = document.getElementById("space");
const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

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

function resetToHeroOnOpen() {
  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

window.addEventListener("pageshow", () => {
  window.setTimeout(resetToHeroOnOpen, 0);
});

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
