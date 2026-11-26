import * as THREE from 'three';

function configureColorTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

const outlineMaterialCache = new Map<number, THREE.MeshBasicMaterial>();

export function getSharedOutlineMaterial(colorHex = 0x24140c): THREE.MeshBasicMaterial {
  let mat = outlineMaterialCache.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.BackSide,
    });
    mat.userData.sharedResource = true;
    outlineMaterialCache.set(colorHex, mat);
  }
  return mat;
}

export function createCartoonOutline(
  sourceMesh: THREE.Mesh,
  thickness = 1.036,
  colorHex = 0x24140c
): THREE.Mesh {
  const outline = new THREE.Mesh(sourceMesh.geometry, getSharedOutlineMaterial(colorHex));
  outline.scale.setScalar(thickness);
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.userData.isOutline = true;
  outline.userData.sharedResource = true;
  outline.raycast = () => {};
  return outline;
}

let sharedFabricTex: THREE.CanvasTexture | null = null;
export function getSharedFabricTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (sharedFabricTex) return sharedFabricTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // High-brightness neutral woven cloth base so material.color tints cleanly
  ctx.fillStyle = '#f6f6f6';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(210, 215, 224, 0.36)' : 'rgba(255, 255, 255, 0.32)';
    ctx.fillRect(0, y, 256, 2);
  }
  for (let x = 0; x < 256; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? 'rgba(205, 210, 220, 0.28)' : 'rgba(255, 255, 255, 0.24)';
    ctx.fillRect(x, 0, 2, 256);
  }

  // Subtle diagonal twill threads
  ctx.strokeStyle = 'rgba(180, 190, 205, 0.2)';
  ctx.lineWidth = 1;
  for (let i = -256; i < 512; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }

  const tex = configureColorTexture(canvas, 3, 3, maxAnisotropy);
  tex.userData.sharedResource = true;
  sharedFabricTex = tex;
  return tex;
}

const irisTextureCache = new Map<string, THREE.CanvasTexture>();

export function createEyeIrisTexture(irisHex: string): THREE.CanvasTexture {
  const key = irisHex.toLowerCase();
  const cached = irisTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const cx = 128;
  const cy = 128;

  // Crisp sclera backdrop at outer rim
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);

  const baseColor = new THREE.Color(irisHex);
  const brightColor = baseColor.clone().offsetHSL(0.02, 0.08, 0.18).getStyle();
  const darkLimbal = baseColor.clone().multiplyScalar(0.32).getStyle();
  const midColor = baseColor.getStyle();

  // Outer iris gradient
  const irisGrad = ctx.createRadialGradient(cx, cy + 12, 24, cx, cy, 114);
  irisGrad.addColorStop(0, brightColor);
  irisGrad.addColorStop(0.55, midColor);
  irisGrad.addColorStop(0.86, darkLimbal);
  irisGrad.addColorStop(1, '#120b07');

  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 114, 0, Math.PI * 2);
  ctx.fill();

  // Subtle iris radial starburst lines
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 36; i++) {
    ctx.rotate((Math.PI * 2) / 36);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.lineTo(100, 0);
    ctx.stroke();
  }
  ctx.restore();

  // Deep glossy pupil
  ctx.fillStyle = '#090b10';
  ctx.beginPath();
  ctx.arc(cx, cy, 56, 0, Math.PI * 2);
  ctx.fill();

  // Warm bottom iris crescent bounce highlight
  const bounceGrad = ctx.createRadialGradient(cx, cy + 56, 4, cx, cy + 56, 48);
  bounceGrad.addColorStop(0, 'rgba(255,255,255,0.42)');
  bounceGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = bounceGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 108, 0, Math.PI * 2);
  ctx.fill();

  // Dual crisp white catchlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - 34, cy - 38, 22, 18, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.arc(cx + 34, cy + 32, 10, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  tex.userData.sharedResource = true;
  irisTextureCache.set(key, tex);
  return tex;
}

export function createGrassTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4cb944';
  ctx.fillRect(0, 0, 512, 512);

  // Soft sunlit meadow patches
  for (let i = 0; i < 360; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 512;
    const y = (Math.cos(i * 78.233) * 0.5 + 0.5) * 512;
    const r = 14 + (i % 24);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(134, 239, 172, 0.2)'
        : i % 3 === 1
          ? 'rgba(34, 139, 34, 0.16)'
          : 'rgba(190, 242, 100, 0.14)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stylized grass blade tufts
  for (let i = 0; i < 650; i++) {
    const x = ((i * 73) % 512);
    const y = ((i * 137) % 512);
    const h = 8 + (i % 10);
    const lean = ((i % 5) - 2) * 2.5;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(163, 230, 53, 0.45)' : 'rgba(21, 128, 61, 0.38)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.5, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
  }

  return configureColorTexture(canvas, 9, 9, maxAnisotropy);
}

export function createWoodPlankTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c88d55';
  ctx.fillRect(0, 0, 512, 512);

  const plankHeight = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * plankHeight;
    const shade = (row % 3) * 10 - 10;
    ctx.fillStyle = `rgb(${198 + shade}, ${138 + shade}, ${82 + shade})`;
    ctx.fillRect(0, y, 512, plankHeight - 2);

    // Top bevel highlight
    ctx.fillStyle = 'rgba(255, 235, 205, 0.25)';
    ctx.fillRect(0, y + 1, 512, 3);

    // Plank seam
    ctx.fillStyle = 'rgba(66, 35, 14, 0.52)';
    ctx.fillRect(0, y + plankHeight - 3, 512, 3);

    // Vertical joint
    const jointX = ((row * 173) % 420) + 40;
    ctx.fillRect(jointX, y, 3, plankHeight);

    // Wood grain lines & knot
    ctx.strokeStyle = 'rgba(92, 50, 20, 0.2)';
    ctx.lineWidth = 2;
    for (let g = 0; g < 4; g++) {
      ctx.beginPath();
      ctx.moveTo(0, y + 12 + g * 13);
      ctx.bezierCurveTo(160, y + 8 + g * 13, 340, y + 18 + g * 13, 512, y + 12 + g * 13);
      ctx.stroke();
    }

    const kx = ((row * 211) % 380) + 60;
    const ky = y + plankHeight * 0.5;
    ctx.fillStyle = 'rgba(92, 50, 20, 0.22)';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 14, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureColorTexture(canvas, 5, 5, maxAnisotropy);
}

export function createCobbleTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7c7267';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 6;
  const rows = 6;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = r % 2 === 0 ? 0 : cellW * 0.45;
      const x = (c * cellW + offsetX) % 512;
      const y = r * cellH;
      const tone = 152 + ((r * 17 + c * 31) % 38);
      ctx.fillStyle = `rgb(${tone}, ${tone - 6}, ${tone - 14})`;
      ctx.beginPath();
      ctx.roundRect(x + 5, y + 5, cellW - 11, cellH - 11, 14);
      ctx.fill();

      // Sunlit top-left edge
      ctx.strokeStyle = 'rgba(255, 250, 240, 0.28)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  return configureColorTexture(canvas, 4, 4, maxAnisotropy);
}

export function createRockTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b735b';
  ctx.fillRect(0, 0, 512, 512);

  // Layered cliff stone strata & highlights
  for (let i = 0; i < 140; i++) {
    const x = (i * 97) % 512;
    const y = (i * 53) % 512;
    const w = 48 + (i % 72);
    const h = 22 + (i % 38);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(182, 152, 122, 0.34)'
        : i % 3 === 1
          ? 'rgba(92, 74, 58, 0.34)'
          : 'rgba(130, 158, 92, 0.16)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
  }

  // Crisp cartoon rock crack lines
  ctx.strokeStyle = 'rgba(54, 42, 32, 0.42)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 24; i++) {
    const sx = (i * 83) % 512;
    const sy = (i * 127) % 512;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 32, sy + 14);
    ctx.lineTo(sx + 54, sy + 6);
    ctx.stroke();
  }

  return configureColorTexture(canvas, 2, 2, maxAnisotropy);
}

export function createWaterfallTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Vibrant turquoise waterfall gradient base
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
  grad.addColorStop(0.5, 'rgba(125, 211, 252, 0.92)');
  grad.addColorStop(1, 'rgba(14, 165, 233, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Flowing vertical white foam streaks
  for (let i = 0; i < 95; i++) {
    const x = (i * 41) % 512;
    const y = (i * 73) % 512;
    const w = 4 + (i % 10);
    const h = 45 + (i % 90);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 255, 255, 0.72)' : 'rgba(224, 242, 254, 0.48)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, w / 2);
    ctx.fill();
    // Wrap vertically for seamless scroll
    if (y + h > 512) {
      ctx.beginPath();
      ctx.roundRect(x, y - 512, w, h, w / 2);
      ctx.fill();
    }
  }

  // Sparkling foam bubbles
  for (let i = 0; i < 120; i++) {
    const x = (i * 67) % 512;
    const y = (i * 113) % 512;
    const r = 3 + (i % 7);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureColorTexture(canvas, 1, 1.5, maxAnisotropy);
}

export function createChalkboardTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e4631';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle chalk dust smudge
  const grad = ctx.createRadialGradient(256, 128, 20, 256, 128, 230);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Friendly cartoon chalk lesson drawing
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.85)';
  ctx.lineWidth = 3;
  ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.fillText('Welcome to Story Class!', 44, 58);

  ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
  ctx.fillText('A + B = C    |    12 × 4 = 48', 44, 108);

  // Chalk sun & house doodle
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.8)';
  ctx.beginPath();
  ctx.arc(410, 82, 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
  ctx.strokeRect(365, 145, 70, 55);
  ctx.beginPath();
  ctx.moveTo(355, 145);
  ctx.lineTo(400, 112);
  ctx.lineTo(445, 145);
  ctx.closePath();
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSpeechBubbleTexture(text: string): {
  texture: THREE.CanvasTexture;
  aspect: number;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 220);

  // Word wrap (supports Bengali & English)
  ctx.font = '700 26px "Noto Sans Bengali", "Plus Jakarta Sans", system-ui, sans-serif';
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  const maxWidth = 420;

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const visibleLines = lines.slice(0, 3);
  if (lines.length > 3) {
    visibleLines[2] = visibleLines[2].slice(0, Math.max(0, visibleLines[2].length - 3)) + '...';
  }

  const lineHeight = 36;
  const textBlockH = visibleLines.length * lineHeight;
  const boxH = Math.max(76, textBlockH + 34);
  const widest = Math.max(120, ...visibleLines.map((l) => ctx.measureText(l).width));
  const boxW = Math.min(480, widest + 56);
  const boxX = (512 - boxW) / 2;
  const boxY = 220 - boxH - 36;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;

  // Bubble body
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 24);
  ctx.fill();
  ctx.restore();

  // Tail triangle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(240, boxY + boxH - 2);
  ctx.lineTo(272, boxY + boxH - 2);
  ctx.lineTo(256, boxY + boxH + 26);
  ctx.closePath();
  ctx.fill();

  // Subtle cartoon outline
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 24);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = boxY + boxH / 2 - ((visibleLines.length - 1) * lineHeight) / 2;
  visibleLines.forEach((line, idx) => {
    ctx.fillText(line, 256, startY + idx * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return { texture, aspect: 512 / 220 };
}

export function createSkyDomeTexture(
  topColor: string,
  horizonColor: string,
  bottomColor: string,
  withRainbowAndClouds = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = withRainbowAndClouds ? 1024 : 32;
  canvas.height = withRainbowAndClouds ? 512 : 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, topColor);
  grad.addColorStop(0.52, horizonColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (withRainbowAndClouds) {
    // Soft glowing rainbow arc centered toward the scenic horizon
    const arcX = canvas.width * 0.72;
    const arcY = canvas.height * 0.56;
    const bands = [
      'rgba(248, 113, 113, 0.34)',
      'rgba(251, 146, 60, 0.34)',
      'rgba(250, 204, 21, 0.34)',
      'rgba(74, 222, 128, 0.32)',
      'rgba(96, 165, 250, 0.32)',
      'rgba(167, 139, 250, 0.30)',
    ];
    ctx.save();
    ctx.filter = 'blur(3px)';
    bands.forEach((col, i) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(arcX, arcY, 175 - i * 9, Math.PI, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();

    // Fluffy Pixar-style sunlit clouds
    const drawCloud = (cx: number, cy: number, scale: number) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      [
        [0, 0, 34],
        [-30, 8, 25],
        [32, 10, 26],
        [-14, -14, 24],
        [18, -12, 22],
      ].forEach(([dx, dy, r]) => {
        ctx.beginPath();
        ctx.arc(cx + dx * scale, cy + dy * scale, r * scale, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    drawCloud(180, 175, 1.15);
    drawCloud(450, 140, 0.9);
    drawCloud(610, 200, 0.85);
    drawCloud(880, 165, 1.25);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
