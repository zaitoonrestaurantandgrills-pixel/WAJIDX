// WAJIDX Full-Page Interactive 3D Web & Dev Universe
// Powered by Three.js (From Stitch Design System)

(function() {
  'use strict';

  window.initUniverse3D = function(containerId = 'threejs-universe-container') {
    const container = document.getElementById(containerId);
    if (!container || typeof THREE === 'undefined') return null;

    // Clean up any existing instance
    if (container._cleanup) {
      container._cleanup();
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 26);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Color Palette inspired by WAJIDX Core (Electric Blue, Cyan, Subtle Tech Indigo)
    const COLOR_PRIMARY = 0x3b82f6;
    const COLOR_CYAN = 0x38bdf8;
    const COLOR_PURPLE = 0x818cf8;

    // --- 1. 3D Wireframe Browser / Device / Viewport Mockup Windows ---
    function createWireframeWindow(w, h, depth) {
      const group = new THREE.Group();

      const boxGeo = new THREE.BoxGeometry(w, h, depth);
      const edges = new THREE.EdgesGeometry(boxGeo);
      const lineMat = new THREE.LineBasicMaterial({
        color: COLOR_CYAN,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending
      });
      const wireframeBox = new THREE.LineSegments(edges, lineMat);
      group.add(wireframeBox);

      // Top header bar / browser tab bar
      const headerGeo = new THREE.PlaneGeometry(w * 0.94, h * 0.14);
      const headerMat = new THREE.MeshBasicMaterial({
        color: COLOR_PRIMARY,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide
      });
      const header = new THREE.Mesh(headerGeo, headerMat);
      header.position.set(0, h * 0.38, depth * 0.52);
      group.add(header);

      // Three small window control dots (Mac / IDE style)
      for (let i = 0; i < 3; i++) {
        const dotGeo = new THREE.CircleGeometry(w * 0.02, 16);
        const dotMat = new THREE.MeshBasicMaterial({
          color: i === 0 ? 0xf87171 : i === 1 ? 0xfbbf24 : 0x34d399,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(-w * 0.4 + i * (w * 0.06), h * 0.38, depth * 0.54);
        group.add(dot);
      }

      // Inside layout UI grid lines (hero card + 2 columns)
      const lineMatDim = new THREE.LineBasicMaterial({
        color: COLOR_PRIMARY,
        transparent: true,
        opacity: 0.22
      });

      const heroGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w * 0.88, h * 0.35));
      const heroMesh = new THREE.LineSegments(heroGeo, lineMatDim);
      heroMesh.position.set(0, h * 0.08, depth * 0.52);
      group.add(heroMesh);

      const col1Geo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w * 0.41, h * 0.3));
      const col1 = new THREE.LineSegments(col1Geo, lineMatDim);
      col1.position.set(-w * 0.23, -h * 0.28, depth * 0.52);
      group.add(col1);

      const col2Geo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w * 0.41, h * 0.3));
      const col2 = new THREE.LineSegments(col2Geo, lineMatDim);
      col2.position.set(w * 0.23, -h * 0.28, depth * 0.52);
      group.add(col2);

      return group;
    }

    const windows = [];
    const winParams = [
      { w: 6.5, h: 4.2, d: 0.3, pos: [-11, 4.5, -4], rot: [0.15, 0.4, -0.05], speed: 0.0008 },
      { w: 5.2, h: 3.5, d: 0.25, pos: [12, -3.5, -3], rot: [-0.2, -0.45, 0.08], speed: -0.0009 },
      { w: 4.8, h: 7.2, d: 0.3, pos: [-12.5, -5.5, -2], rot: [0.1, 0.35, 0.12], speed: 0.0007 },
      { w: 5.8, h: 3.8, d: 0.25, pos: [11.5, 6, -5], rot: [-0.15, -0.35, -0.1], speed: -0.0006 }
    ];

    winParams.forEach(p => {
      const win = createWireframeWindow(p.w, p.h, p.d);
      win.position.set(p.pos[0], p.pos[1], p.pos[2]);
      win.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      win.userData = { initialY: p.pos[1], initialRotY: p.rot[1], speed: p.speed, phase: Math.random() * Math.PI * 2 };
      mainGroup.add(win);
      windows.push(win);
    });

    // --- 2. 3D Code Brackets `< / >` and `{ }` ---
    function createCodeBracket(type = 'angle_open') {
      const points = [];
      if (type === 'angle_open') {
        points.push(new THREE.Vector3(0.8, 1.2, 0));
        points.push(new THREE.Vector3(-0.8, 0, 0));
        points.push(new THREE.Vector3(0.8, -1.2, 0));
      } else if (type === 'angle_close') {
        points.push(new THREE.Vector3(-0.8, 1.2, 0));
        points.push(new THREE.Vector3(0.8, 0, 0));
        points.push(new THREE.Vector3(-0.8, -1.2, 0));
      } else if (type === 'slash') {
        points.push(new THREE.Vector3(-0.5, -1.3, 0));
        points.push(new THREE.Vector3(0.5, 1.3, 0));
      } else if (type === 'curly_open') {
        points.push(new THREE.Vector3(0.6, 1.3, 0));
        points.push(new THREE.Vector3(0.1, 1.1, 0));
        points.push(new THREE.Vector3(0.1, 0.25, 0));
        points.push(new THREE.Vector3(-0.5, 0, 0));
        points.push(new THREE.Vector3(0.1, -0.25, 0));
        points.push(new THREE.Vector3(0.1, -1.1, 0));
        points.push(new THREE.Vector3(0.6, -1.3, 0));
      } else {
        points.push(new THREE.Vector3(-0.6, 1.3, 0));
        points.push(new THREE.Vector3(-0.1, 1.1, 0));
        points.push(new THREE.Vector3(-0.1, 0.25, 0));
        points.push(new THREE.Vector3(0.5, 0, 0));
        points.push(new THREE.Vector3(-0.1, -0.25, 0));
        points.push(new THREE.Vector3(-0.1, -1.1, 0));
        points.push(new THREE.Vector3(-0.6, -1.3, 0));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: COLOR_CYAN,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      return new THREE.Line(geometry, material);
    }

    const brackets = [];
    const bracketTypes = ['angle_open', 'slash', 'angle_close', 'curly_open', 'curly_close', 'angle_open', 'angle_close'];
    const bracketPositions = [
      [-6, 7.5, 2],
      [-4.2, 7.8, 1.5],
      [-2.4, 7.5, 2],
      [6.5, 8.2, 1],
      [14.5, 1.5, 0],
      [-14.5, 0.5, 1],
      [5.5, -7.5, 2]
    ];

    bracketTypes.forEach((type, idx) => {
      const b = createCodeBracket(type);
      const pos = bracketPositions[idx] || [0, 0, 0];
      b.position.set(pos[0], pos[1], pos[2]);
      b.scale.set(0.9, 0.9, 0.9);
      b.userData = {
        initialY: pos[1],
        phase: idx * 0.8,
        rotSpeedX: 0.004 * (idx % 2 === 0 ? 1 : -1),
        rotSpeedY: 0.005
      };
      mainGroup.add(b);
      brackets.push(b);
    });

    // --- 3. Interactive Node Graph Network ---
    const nodeCount = 50;
    const nodeGroup = new THREE.Group();
    mainGroup.add(nodeGroup);

    const nodeMeshes = [];
    const nodeGeo = new THREE.OctahedronGeometry(0.2, 0);

    for (let i = 0; i < nodeCount; i++) {
      const mesh = new THREE.Mesh(
        nodeGeo,
        new THREE.MeshBasicMaterial({
          color: (i % 3 === 0) ? COLOR_CYAN : (i % 3 === 1) ? COLOR_PRIMARY : COLOR_PURPLE,
          transparent: true,
          opacity: 0.75
        })
      );

      const px = (Math.random() - 0.5) * 36;
      const py = (Math.random() - 0.5) * 24;
      const pz = (Math.random() - 0.5) * 12 - 2;

      mesh.position.set(px, py, pz);
      mesh.userData = {
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.008,
        vz: (Math.random() - 0.5) * 0.006,
        baseX: px,
        baseY: py,
        baseZ: pz
      };
      nodeGroup.add(mesh);
      nodeMeshes.push(mesh);
    }

    const maxConnections = 65;
    const linePositions = new Float32Array(maxConnections * 2 * 3);
    const lineColors = new Float32Array(maxConnections * 2 * 3);
    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    linesGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const linesMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const nodeNetworkLines = new THREE.LineSegments(linesGeo, linesMat);
    nodeGroup.add(nodeNetworkLines);

    // --- 4. Sub-Floor & Ceiling Coordinate Grids ---
    const gridHelper = new THREE.GridHelper(50, 40, COLOR_PRIMARY, 0x1e293b);
    gridHelper.position.y = -10.5;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.28;
    mainGroup.add(gridHelper);

    const topGrid = new THREE.GridHelper(50, 40, COLOR_CYAN, 0x111827);
    topGrid.position.y = 12.5;
    topGrid.material.transparent = true;
    topGrid.material.opacity = 0.18;
    mainGroup.add(topGrid);

    // --- 5. Ambient Floating Code / Bit Particles ---
    const particleCount = 260;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 44;
      pPos[i + 1] = (Math.random() - 0.5) * 30;
      pPos[i + 2] = (Math.random() - 0.5) * 16 - 3;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: COLOR_CYAN,
      size: 0.16,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const codeParticles = new THREE.Points(pGeo, pMat);
    mainGroup.add(codeParticles);

    // --- 6. Smooth Mouse Parallax Interaction ---
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const onMouseMove = (e) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      targetMouseX = normX * 0.35;
      targetMouseY = normY * 0.25;
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // --- 7. Main Animation Loop ---
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      mainGroup.rotation.y = mouseX * 0.35 + Math.sin(elapsedTime * 0.05) * 0.05;
      mainGroup.rotation.x = -mouseY * 0.3;

      windows.forEach((win) => {
        win.position.y = win.userData.initialY + Math.sin(elapsedTime * 0.8 + win.userData.phase) * 0.35;
        win.rotation.y = win.userData.initialRotY + Math.cos(elapsedTime * 0.5 + win.userData.phase) * 0.08;
      });

      brackets.forEach((b) => {
        b.position.y = b.userData.initialY + Math.sin(elapsedTime * 1.2 + b.userData.phase) * 0.25;
        b.rotation.y += b.userData.rotSpeedY;
        b.rotation.x += b.userData.rotSpeedX;
      });

      let lineIdx = 0;
      const posArr = linesGeo.attributes.position.array;
      const colArr = linesGeo.attributes.color.array;

      nodeMeshes.forEach((mesh) => {
        mesh.position.x += mesh.userData.vx;
        mesh.position.y += mesh.userData.vy;
        mesh.position.z += mesh.userData.vz;

        if (Math.abs(mesh.position.x - mesh.userData.baseX) > 2) mesh.userData.vx *= -1;
        if (Math.abs(mesh.position.y - mesh.userData.baseY) > 2) mesh.userData.vy *= -1;
        if (Math.abs(mesh.position.z - mesh.userData.baseZ) > 1.5) mesh.userData.vz *= -1;

        mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.015;
      });

      for (let i = 0; i < nodeCount && lineIdx < maxConnections; i++) {
        const p1 = nodeMeshes[i].position;
        for (let j = i + 1; j < nodeCount && lineIdx < maxConnections; j++) {
          const p2 = nodeMeshes[j].position;
          if (Math.abs(p1.x - p2.x) > 5.5 || Math.abs(p1.y - p2.y) > 5.5) continue;

          const d2 = p1.distanceToSquared(p2);
          if (d2 < 30.25) { // 5.5 * 5.5
            const d = Math.sqrt(d2);
            const base = lineIdx * 6;
            posArr[base] = p1.x; posArr[base + 1] = p1.y; posArr[base + 2] = p1.z;
            posArr[base + 3] = p2.x; posArr[base + 4] = p2.y; posArr[base + 5] = p2.z;

            const alpha = Math.max(0.1, 1 - d / 5.5);
            colArr[base] = 0.23 * alpha; colArr[base + 1] = 0.51 * alpha; colArr[base + 2] = 0.96 * alpha;
            colArr[base + 3] = 0.22 * alpha; colArr[base + 4] = 0.74 * alpha; colArr[base + 5] = 0.97 * alpha;

            lineIdx++;
          }
        }
      }

      for (let k = lineIdx * 6; k < maxConnections * 6; k++) {
        posArr[k] = 0;
        colArr[k] = 0;
      }
      linesGeo.attributes.position.needsUpdate = true;
      linesGeo.attributes.color.needsUpdate = true;

      codeParticles.rotation.y = elapsedTime * 0.015;
      codeParticles.rotation.x = Math.sin(elapsedTime * 0.01) * 0.05;

      renderer.render(scene, camera);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !animationFrameId) {
        clock.start();
        animate();
      } else if (document.hidden && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        clock.stop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (!document.hidden) {
      animate();
    }

    // Cleanup hook
    container._cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      gridHelper.dispose();
      topGrid.dispose();
      nodeGeo.dispose();
      linesGeo.dispose();
      pGeo.dispose();
      pMat.dispose();
      brackets.forEach(b => { b.geometry.dispose(); b.material.dispose(); });
      windows.forEach(w => {
        w.traverse(c => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) c.material.dispose();
        });
      });
    };

    return container._cleanup;
  };
})();
