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

export function getSharedOutlineMaterial(colorHex = 0x2a1810): THREE.MeshBasicMaterial {
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
  thickness = 1.022,
  colorHex = 0x2a1810
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

const faceTextureCache = new Map<string, THREE.CanvasTexture>();

export function createChibiFaceTexture(
  skinHex: number,
  irisHex: string,
  hasFreckles = false,
  isFemale = false,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const key = `${skinHex.toString(16)}_${irisHex.toLowerCase()}_${hasFreckles ? 1 : 0}_${isFemale ? 1 : 0}`;
  const cached = faceTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const baseSkin = new THREE.Color(skinHex);
  const warmSkin = baseSkin.clone().offsetHSL(-0.01, 0.08, 0.05).getStyle();
  const shadowSkin = baseSkin.clone().offsetHSL(-0.015, 0.06, -0.09).getStyle();
  const peachBlush = baseSkin.clone().lerp(new THREE.Color(0xfb7185), 0.45).getStyle();

  // Base warm skin fill
  ctx.fillStyle = baseSkin.getStyle();
  ctx.fillRect(0, 0, 1024, 1024);

  // Soft subsurface glow across the front face (x=512, y=512)
  const faceGlow = ctx.createRadialGradient(512, 495, 24, 512, 520, 260);
  faceGlow.addColorStop(0, warmSkin);
  faceGlow.addColorStop(0.65, baseSkin.getStyle());
  faceGlow.addColorStop(1, shadowSkin);
  ctx.fillStyle = faceGlow;
  ctx.fillRect(0, 0, 1024, 1024);

  // Note: On SphereGeometry equirectangular UV, 1 unit of U spans 2*PI while 1 unit of V spans PI.
  // Scaling horizontal offsets/radii by 0.5 around x=512 produces true circular features on the 3D sphere!
  const cx = 512;

  // Rosy gradient cheeks
  [-1, 1].forEach((side) => {
    const cheekX = cx + side * 86;
    const cheekY = 588;
    ctx.save();
    ctx.translate(cheekX, cheekY);
    ctx.scale(0.55, 1);
    const cg = ctx.createRadialGradient(0, 0, 6, 0, 0, 64);
    cg.addColorStop(0, 'rgba(251, 113, 133, 0.52)');
    cg.addColorStop(0.55, 'rgba(251, 113, 133, 0.22)');
    cg.addColorStop(1, 'rgba(251, 113, 133, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (hasFreckles) {
      ctx.fillStyle = 'rgba(180, 83, 55, 0.48)';
      [
        [-10, -8],
        [4, -14],
        [14, -3],
        [-2, 6],
      ].forEach(([fx, fy]) => {
        ctx.beginPath();
        ctx.ellipse(cheekX + fx * 0.5, cheekY + fy, 2.2, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });

  // Soft nose bridge highlight & warm tip blush
  ctx.save();
  ctx.translate(cx, 540);
  ctx.scale(0.5, 1);
  const noseGrad = ctx.createRadialGradient(0, 6, 3, 0, 0, 32);
  noseGrad.addColorStop(0, peachBlush);
  noseGrad.addColorStop(0.55, 'rgba(255, 228, 210, 0.35)');
  noseGrad.addColorStop(1, 'rgba(255, 228, 210, 0)');
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Large Expressive Chibi-Pixar Eyes painted cleanly onto the 1024x1024 head texture
  const irisBase = new THREE.Color(irisHex);
  const irisBright = irisBase.clone().offsetHSL(0.02, 0.1, 0.2).getStyle();
  const irisMid = irisBase.getStyle();
  const irisRim = irisBase.clone().multiplyScalar(0.32).getStyle();

  [-1, 1].forEach((side) => {
    const eyeX = cx + side * 56;
    const eyeY = 482;

    ctx.save();
    ctx.translate(eyeX, eyeY);
    // Equirectangular X-compression so eyes stay round-oval on the 3D head
    ctx.scale(0.5, 1);

    // Subtle warm eye-socket ambient occlusion
    const socketGrad = ctx.createRadialGradient(0, -6, 36, 0, 0, 102);
    socketGrad.addColorStop(0, 'rgba(130, 68, 42, 0.26)');
    socketGrad.addColorStop(1, 'rgba(130, 68, 42, 0)');
    ctx.fillStyle = socketGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 102, 0, Math.PI * 2);
    ctx.fill();

    // Crisp white sclera oval with subtle upper lid shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 74, 82, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-85, -90, 170, 180);

    // Upper sclera soft shadow
    const scleraShade = ctx.createLinearGradient(0, -82, 0, -28);
    scleraShade.addColorStop(0, 'rgba(148, 163, 184, 0.38)');
    scleraShade.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = scleraShade;
    ctx.fillRect(-85, -85, 170, 62);

    // Multi-tone gradient iris slightly inward for warm Pixar gaze
    const gazeX = side * -5;
    const gazeY = 2;
    const ig = ctx.createRadialGradient(gazeX, gazeY + 12, 12, gazeX, gazeY, 56);
    ig.addColorStop(0, irisBright);
    ig.addColorStop(0.55, irisMid);
    ig.addColorStop(0.86, irisRim);
    ig.addColorStop(1, '#180e09');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(gazeX, gazeY, 54, 58, 0, 0, Math.PI * 2);
    ctx.fill();

    // Delicate iris radial fibers
    ctx.save();
    ctx.translate(gazeX, gazeY);
    for (let f = 0; f < 32; f++) {
      ctx.rotate((Math.PI * 2) / 32);
      ctx.strokeStyle = f % 2 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(50, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Deep glossy pupil
    ctx.fillStyle = '#090b10';
    ctx.beginPath();
    ctx.ellipse(gazeX, gazeY, 27, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bottom iris bounce arc
    const bounce = ctx.createRadialGradient(gazeX, gazeY + 34, 4, gazeX, gazeY + 34, 34);
    bounce.addColorStop(0, 'rgba(255,255,255,0.52)');
    bounce.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bounce;
    ctx.beginPath();
    ctx.arc(gazeX, gazeY, 54, 0, Math.PI * 2);
    ctx.fill();

    // Dual crisp white sparkle catchlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(gazeX - 18, gazeY - 22, 13, 11, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.beginPath();
    ctx.arc(gazeX + 18, gazeY + 18, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Dark lower contour rim
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 74, 82, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // Thick expressive curved upper eyelashes
    ctx.strokeStyle = '#1b0f0a';
    ctx.lineWidth = isFemale ? 12 : 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0, -2, 76, 84, 0, Math.PI + 0.18, Math.PI * 2 - 0.18);
    ctx.stroke();

    if (isFemale) {
      // Cute outer lash wings
      ctx.lineWidth = 7;
      for (let w = 0; w < 2; w++) {
        ctx.beginPath();
        ctx.moveTo(side * (66 - w * 12), -36 - w * 14);
        ctx.quadraticCurveTo(side * (86 - w * 10), -46 - w * 16, side * (96 - w * 12), -56 - w * 16);
        ctx.stroke();
      }
    }

    ctx.restore();
  });

  // Soft smile contour shadow around mouth area
  ctx.save();
  ctx.translate(cx, 622);
  ctx.scale(0.5, 1);
  ctx.strokeStyle = 'rgba(140, 62, 48, 0.25)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -14, 48, 0.35, Math.PI - 0.35);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  tex.userData.sharedResource = true;
  faceTextureCache.set(key, tex);
  return tex;
}

export function createGrassTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, 512, 512);

  // Soft sunlit emerald meadow patches
  for (let i = 0; i < 380; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 512;
    const y = (Math.cos(i * 78.233) * 0.5 + 0.5) * 512;
    const r = 16 + (i % 26);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(34, 197, 94, 0.28)'
        : i % 3 === 1
          ? 'rgba(22, 163, 74, 0.26)'
          : 'rgba(74, 222, 128, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stylized grass blade tufts
  for (let i = 0; i < 720; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    const h = 9 + (i % 10);
    const lean = ((i % 5) - 2) * 2.5;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(74, 222, 128, 0.48)' : 'rgba(20, 83, 45, 0.45)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.5, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
  }

  // Tiny painted wildflowers scattered cleanly across the meadow
  const petalCols = ['#fef08a', '#f472b6', '#ffffff', '#fb923c', '#c084fc'];
  for (let i = 0; i < 42; i++) {
    const fx = ((i * 193 + 37) % 480) + 16;
    const fy = ((i * 263 + 53) % 480) + 16;
    ctx.fillStyle = petalCols[i % petalCols.length];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 3.5, fy + Math.sin(a) * 3.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureColorTexture(canvas, 9, 9, maxAnisotropy);
}

export function createBrickStoneTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // High-brightness neutral warm plaster mortar so material.color tints cleanly
  ctx.fillStyle = '#ebe5dc';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const rowH = 512 / rows;
  const colW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : colW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + offset;
      const by = r * rowH;
      const shade = 232 + ((r * 13 + c * 29) % 20);
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 9})`;
      ctx.beginPath();
      ctx.roundRect(bx + 4, by + 4, colW - 8, rowH - 8, 8);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(130, 118, 102, 0.16)';
      ctx.fillRect(bx + 10, by + rowH - 10, colW - 20, 4);
    }
  }

  return configureColorTexture(canvas, 2, 2, maxAnisotropy);
}

export function createRoofTileTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Neutral white-grey shingle base so roof material.color tints richly
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 8;
  const rowH = 512 / rows;
  const colW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : colW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const tx = c * colW + offset;
      const ty = r * rowH;
      const v = 224 + ((r * 19 + c * 11) % 26);
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.beginPath();
      ctx.roundRect(tx + 2, ty + 2, colW - 4, rowH - 2, [4, 4, 18, 18]);
      ctx.fill();

      ctx.strokeStyle = 'rgba(40, 30, 25, 0.28)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  return configureColorTexture(canvas, 3, 2, maxAnisotropy);
}

export function createWaterRippleTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#0ea5e9');
  grad.addColorStop(0.5, '#38bdf8');
  grad.addColorStop(1, '#0284c7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Sparkling caustic wave bands & sunlit highlights
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.45)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 18; i++) {
    const y = (i / 18) * 512;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const wy = y + Math.sin((x / 512) * Math.PI * 4 + i) * 10;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 90; i++) {
    const x = (i * 89) % 512;
    const y = (i * 149) % 512;
    const r = 3 + (i % 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureColorTexture(canvas, 4, 2, maxAnisotropy);
}

export function createMarbleTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f4f6f9';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.34)';
  ctx.lineWidth = 3;
  for (let v = 0; v < 12; v++) {
    ctx.beginPath();
    let y = (v * 47) % 512;
    ctx.moveTo(0, y);
    for (let x = 32; x <= 512; x += 32) {
      y += Math.sin(x * 0.03 + v) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return configureColorTexture(canvas, 3, 3, maxAnisotropy);
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
