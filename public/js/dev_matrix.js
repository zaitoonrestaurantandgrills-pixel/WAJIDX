// WAJIDX Developer Code Matrix & Circuit Node Environment
// From Stitch Design: "WAJIDX | Home (Animated Scroll Stitching)"

(function() {
  'use strict';

  let animationFrameId = null;
  let typingTimeout = null;

  window.initDeveloperEnvironment = function() {
    // Cancel existing instances if any
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }

    const canvas = document.getElementById('code-matrix-canvas');
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    function handleResize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initMatrixStreams();
      initLogicNodes();
    }
    window.addEventListener('resize', handleResize, { passive: true });

    // Developer Code Stream Tokens
    const codeTokens = [
      "01", "10", "const", "async", "=>", "{}", "[]", "&&", "||",
      "0xFF", "void", "true", "null", "import", "type", "return",
      "interface", "<App/>", "git", "status: 200", "docker", "npm run",
      "schema.sql", "devajDB", "latency: <12ms", "resilience: 99.999"
    ];

    // Matrix Column Streams
    const matrixColumns = [];
    const colSpacing = 42;
    function initMatrixStreams() {
      matrixColumns.length = 0;
      const count = Math.floor(width / colSpacing);
      for (let i = 0; i < count; i++) {
        matrixColumns.push({
          x: i * colSpacing + 12,
          y: Math.random() * -height,
          speed: 1.0 + Math.random() * 2.2,
          chars: Array.from({ length: 12 }, () => codeTokens[Math.floor(Math.random() * codeTokens.length)]),
          opacity: 0.08 + Math.random() * 0.18,
          isHighlight: Math.random() > 0.82
        });
      }
    }
    initMatrixStreams();

    // Circuit Logic Nodes
    const logicNodes = [];
    function initLogicNodes() {
      logicNodes.length = 0;
      const nodeCount = Math.floor((width * height) / 45000);
      for (let i = 0; i < nodeCount; i++) {
        logicNodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: 1.5 + Math.random() * 1.5,
          pulse: Math.random() * Math.PI
        });
      }
    }
    initLogicNodes();

    // Interactive Code Typing Demonstration
    const typedPhrases = [
      "wajidx.initSystem()",
      "deployArchitecture({ mode: 'cloud' })",
      "connectDatabase(devajDB)",
      "optimizeWorkflows({ scale: 10000 })"
    ];
    let phraseIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    const dynamicCodeEl = document.getElementById('dynamic-code-text');

    function typeCodeLoop() {
      if (!dynamicCodeEl) return;
      const current = typedPhrases[phraseIdx];
      if (isDeleting) {
        dynamicCodeEl.textContent = current.substring(0, charIdx - 1);
        charIdx--;
      } else {
        dynamicCodeEl.textContent = current.substring(0, charIdx + 1);
        charIdx++;
      }

      let delay = isDeleting ? 40 : 70;
      if (!isDeleting && charIdx === current.length) {
        delay = 2200;
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        phraseIdx = (phraseIdx + 1) % typedPhrases.length;
        delay = 400;
      }
      typingTimeout = setTimeout(typeCodeLoop, delay);
    }
    typeCodeLoop();

    // Mouse Tracking for Interactive 3D Perspective Tilt
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let smoothMouseX = mouseX;
    let smoothMouseY = mouseY;

    function handleMouseMove(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Scroll tracking and parallax depths
    let currentScrollY = window.scrollY;
    let targetScrollY = window.scrollY;
    const telemetryDepth = document.getElementById('telemetry-depth');
    const telemetryProg = document.getElementById('telemetry-prog');
    const streamFar = document.getElementById('code-stream-far');
    const streamMid = document.getElementById('code-stream-mid');
    const streamNear = document.getElementById('code-stream-near');
    const scrollPrompt = document.getElementById('scroll-prompt');

    function handleScroll() {
      targetScrollY = window.scrollY;
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    function renderDeveloperEnvironment() {
      // Smooth scroll interpolation
      currentScrollY += (targetScrollY - currentScrollY) * 0.1;
      smoothMouseX += (mouseX - smoothMouseX) * 0.05;
      smoothMouseY += (mouseY - smoothMouseY) * 0.05;

      const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(currentScrollY / maxScroll, 0), 1);

      // Calculate Mouse 3D Tilt offsets
      const tiltX = (smoothMouseY / height - 0.5) * 12; // deg
      const tiltY = (smoothMouseX / width - 0.5) * -14; // deg

      // Apply dynamic parallax depth shifts to developer code layers
      if (streamFar) {
        const farY = currentScrollY * -0.15;
        streamFar.style.transform = `translate3d(${tiltY * 0.8}px, ${farY}px, -120px) rotateX(${tiltX * 0.4}deg) rotateY(${tiltY * 0.4}deg)`;
      }
      if (streamMid) {
        const midY = currentScrollY * -0.32;
        streamMid.style.transform = `translate3d(${tiltY * 1.5}px, ${midY}px, -40px) rotateX(${tiltX * 0.6}deg) rotateY(${tiltY * 0.6}deg)`;
      }
      if (streamNear) {
        const nearY = currentScrollY * -0.52;
        streamNear.style.transform = `translate3d(${tiltY * 2.4}px, ${nearY}px, 20px) rotateX(${tiltX * 0.8}deg) rotateY(${tiltY * 0.8}deg)`;
      }

      // Telemetry update
      if (telemetryDepth) telemetryDepth.textContent = (currentScrollY * 0.12).toFixed(2);
      if (telemetryProg) telemetryProg.textContent = `${(progress * 100).toFixed(1)}%`;

      // Scroll prompt fade out on scroll
      if (scrollPrompt) {
        const promptOpacity = Math.max(1 - currentScrollY / 180, 0);
        scrollPrompt.style.opacity = promptOpacity.toString();
        scrollPrompt.style.transform = `translateY(${currentScrollY * 0.4}px)`;
      }

      // RENDER CANVAS CODE STREAMS & CIRCUITS
      ctx.clearRect(0, 0, width, height);

      // Draw Connected Logic Grid Circuit Lines
      ctx.lineWidth = 0.75;
      for (let i = 0; i < logicNodes.length; i++) {
        const node = logicNodes[i];
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += 0.025;

        if (node.x < 0) node.x = width;
        if (node.x > width) node.x = 0;
        if (node.y < 0) node.y = height;
        if (node.y > height) node.y = 0;

        for (let j = i + 1; j < logicNodes.length; j++) {
          const other = logicNodes[j];
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const lineAlpha = (1 - dist / 130) * 0.14;
            ctx.strokeStyle = `rgba(38, 116, 231, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }

        // Draw glowing node
        const glow = Math.sin(node.pulse) * 0.3 + 0.5;
        ctx.fillStyle = `rgba(173, 198, 255, ${glow * 0.45})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Vertical Developer Code Streams (Matrix Rain Style)
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      const scrollCanvasOffset = currentScrollY * 0.2;

      for (let i = 0; i < matrixColumns.length; i++) {
        const col = matrixColumns[i];
        col.y += col.speed + (currentScrollY * 0.015);

        if (col.y > height + 240) {
          col.y = -180;
          col.speed = 1.0 + Math.random() * 2.2;
          col.isHighlight = Math.random() > 0.85;
        }

        for (let c = 0; c < col.chars.length; c++) {
          const charY = col.y + c * 18 - scrollCanvasOffset % 600;
          if (charY < -20 || charY > height + 20) continue;

          const isHead = c === col.chars.length - 1;
          if (isHead) {
            ctx.fillStyle = col.isHighlight ? '#adc6ff' : 'rgba(38, 116, 231, 0.9)';
            ctx.shadowColor = '#2674e7';
            ctx.shadowBlur = col.isHighlight ? 8 : 4;
          } else {
            const fade = (c / col.chars.length) * col.opacity;
            ctx.fillStyle = col.isHighlight 
              ? `rgba(52, 211, 153, ${fade * 1.2})` 
              : `rgba(38, 116, 231, ${fade})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(col.chars[c], col.x, charY);
        }
      }
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(renderDeveloperEnvironment);
    }
    animationFrameId = requestAnimationFrame(renderDeveloperEnvironment);

    // Return cleanup callback
    return function cleanup() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  };
})();
