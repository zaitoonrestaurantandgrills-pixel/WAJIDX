// WAJIDX Dynamic WebGL Shader Canvas
// Electric Blue Pulses & Deep Void Background Grid

function initShaderCanvas(canvasId = 'bg-shader-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return null;

  function syncSize() {
    const parent = canvas.parentElement || document.body;
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    new ResizeObserver(syncSize).observe(canvas.parentElement);
  }
  window.addEventListener('resize', syncSize);
  syncSize();

  const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision highp float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    varying vec2 v_texCoord;

    float grid(vec2 uv, float res) {
      vec2 g = fract(uv * res);
      return 1.0 - smoothstep(0.0, 0.05, min(g.x, g.y));
    }

    void main() {
      vec2 uv = v_texCoord;
      vec2 centered_uv = (uv * 2.0 - 1.0) * (u_resolution.x / u_resolution.y);
      
      // Deep void black
      vec3 color = vec3(0.015, 0.015, 0.02);
      
      // Micro blueprint grid
      float g1 = grid(uv, 12.0) * 0.04;
      float g2 = grid(uv, 48.0) * 0.02;
      color += (g1 + g2);
      
      // Electric blue dynamic pulses (WAJIDX action blue)
      float pulse = sin(u_time * 0.6) * 0.5 + 0.5;
      vec2 p1 = vec2(sin(u_time * 0.25), cos(u_time * 0.35)) * 0.45;
      float d1 = length(centered_uv - p1);
      float glow1 = 0.025 / (d1 + 0.05);
      
      // Subtle secondary pulse
      vec2 p2 = vec2(cos(u_time * 0.2), sin(u_time * 0.3)) * 0.6;
      float d2 = length(centered_uv - p2);
      float glow2 = 0.015 / (d2 + 0.08);

      vec3 blueColor = vec3(0.15, 0.45, 0.91);
      vec3 cyanColor = vec3(0.35, 0.65, 1.0);
      
      color += blueColor * glow1 * pulse * 0.4;
      color += cyanColor * glow2 * (1.0 - pulse) * 0.25;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compileShader(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[Shader]', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[Shader Link]', gl.getProgramInfoLog(program));
    return null;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, 'u_time');
  const uRes = gl.getUniformLocation(program, 'u_resolution');
  const uMouse = gl.getUniformLocation(program, 'u_mouse');

  let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      mouse.y = (rect.bottom - e.clientY) * (canvas.height / rect.height);
    }
  });

  let animFrameId = null;
  let isRunning = true;

  function render(time) {
    if (!isRunning) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, time * 0.001);
    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    animFrameId = requestAnimationFrame(render);
  }

  animFrameId = requestAnimationFrame(render);

  return {
    destroy: () => {
      isRunning = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', syncSize);
    }
  };
}

window.initShaderCanvas = initShaderCanvas;
