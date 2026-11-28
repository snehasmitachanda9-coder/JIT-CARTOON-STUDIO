import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  CustomModelBlueprint,
  CustomModelPart,
  HeldItemAttachment,
} from '../types/studio';

function enableShadows(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function buildPartGeometry(part: CustomModelPart): THREE.BufferGeometry {
  const [sx, sy, sz] = part.scale.map((v) =>
    Math.max(0.03, Math.min(3, Number(v) || 0.3))
  );
  switch (part.geometry) {
    case 'sphere': {
      const g = new THREE.SphereGeometry(0.5, 12, 10);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'cylinder': {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'cone': {
      const g = new THREE.ConeGeometry(0.5, 1, 12);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'torus': {
      const g = new THREE.TorusGeometry(0.38, 0.12, 8, 16);
      g.scale(sx, sy, sz);
      return g;
    }
    case 'box':
    default:
      return new THREE.BoxGeometry(sx, sy, sz);
  }
}

export function createBuiltinHandheldGroup(
  itemKind: HeldItemAttachment['itemKind']
): THREE.Group {
  const group = new THREE.Group();

  switch (itemKind) {
    case 'book': {
      const coverMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 });
      const pageMat = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.85 });
      // Open cartoon book resting in palm
      const leftCover = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.24), coverMat);
      leftCover.position.set(-0.085, 0, 0.06);
      leftCover.rotation.z = 0.28;
      const rightCover = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.24), coverMat);
      rightCover.position.set(0.085, 0, 0.06);
      rightCover.rotation.z = -0.28;
      const leftPages = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.22), pageMat);
      leftPages.position.set(-0.08, 0.015, 0.06);
      leftPages.rotation.z = 0.28;
      const rightPages = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.22), pageMat);
      rightPages.position.set(0.08, 0.015, 0.06);
      rightPages.rotation.z = -0.28;
      group.add(leftCover, rightCover, leftPages, rightPages);
      break;
    }

    case 'stick': {
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
      const barkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.92 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.72, 10), woodMat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, 0, 0.24);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.14, 7), barkMat);
      knot.position.set(0.02, 0.04, 0.35);
      knot.rotation.z = -0.5;
      group.add(shaft, knot);
      break;
    }

    case 'gun': {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.2 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.45 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.07), darkMat);
      grip.position.set(0, -0.04, 0);
      grip.rotation.x = -0.22;
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.28), bodyMat);
      barrel.position.set(0, 0.03, 0.1);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 10), tipMat);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.035, 0.26);
      group.add(grip, barrel, muzzle);
      break;
    }

    case 'cricketBat': {
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });
      const stickerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 10), handleMat);
      handle.position.set(0, 0.06, 0.05);
      handle.rotation.x = Math.PI / 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.48), bladeMat);
      blade.position.set(0, 0.06, 0.4);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.044, 0.18), stickerMat);
      stripe.position.set(0, 0.06, 0.36);
      group.add(handle, blade, stripe);
      break;
    }

    case 'football': {
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55 });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 14), whiteMat);
      ball.position.set(0, 0.02, 0.14);
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), darkMat);
      patch.position.set(0, 0.08, 0.26);
      const patch2 = patch.clone();
      patch2.position.set(0.11, 0.02, 0.16);
      group.add(ball, patch, patch2);
      break;
    }

    case 'phone': {
      const caseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.5 });
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.75,
        roughness: 0.15,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.18), caseMat);
      body.position.set(0, 0.015, 0.06);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.02, 0.155), screenMat);
      screen.position.set(0, 0.017, 0.06);
      group.add(body, screen);
      break;
    }

    case 'magicWand': {
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.35, metalness: 0.25 });
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.95,
        roughness: 0.2,
      });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.46, 10), shaftMat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, 0, 0.2);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), starMat);
      star.position.set(0, 0, 0.45);
      group.add(shaft, star);
      break;
    }

    case 'sword': {
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.18 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.25 });
      const gripMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.16, 10), gripMat);
      grip.rotation.x = Math.PI / 2;
      grip.position.set(0, 0, 0.03);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.04), goldMat);
      guard.position.set(0, 0, 0.11);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.56), bladeMat);
      blade.position.set(0, 0, 0.4);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), bladeMat);
      tip.rotation.x = Math.PI / 2;
      tip.rotation.y = Math.PI / 4;
      tip.position.set(0, 0, 0.72);
      group.add(grip, guard, blade, tip);
      break;
    }

    case 'scepter': {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 });
      const gemMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.55,
        roughness: 0.12,
      });
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.78, 12), goldMat);
      staff.rotation.x = Math.PI / 2;
      staff.position.set(0, 0, 0.25);
      const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 16), goldMat);
      crownRing.position.set(0, 0, 0.65);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), gemMat);
      gem.position.set(0, 0, 0.65);
      group.add(staff, crownRing, gem);
      break;
    }

    case 'bag': {
      const bagMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.68 });
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.11), bagMat);
      body.position.set(0, -0.15, 0.02);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 14, Math.PI), strapMat);
      handle.position.set(0, -0.04, 0.02);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.08, 0.116), strapMat);
      flap.position.set(0, -0.09, 0.022);
      group.add(body, handle, flap);
      break;
    }

    case 'umbrella': {
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55, side: THREE.DoubleSide });
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.35 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.68, 8), shaftMat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, 0, 0.28);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.2, 12, 1, true), canopyMat);
      canopy.rotation.x = Math.PI / 2;
      canopy.position.set(0, 0, 0.55);
      group.add(shaft, canopy);
      break;
    }

    default:
      break;
  }

  enableShadows(group);
  return group;
}

function createBlueprintHandheldGroup(bp: CustomModelBlueprint): THREE.Group {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  let minY = Infinity;
  let maxY = -Infinity;

  bp.parts.forEach((p) => {
    const geo = buildPartGeometry(p);
    const mat = new THREE.MeshStandardMaterial({
      color: /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : '#3B82F6',
      roughness: typeof p.roughness === 'number' ? p.roughness : 0.6,
      metalness: typeof p.metalness === 'number' ? p.metalness : 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...p.position);
    mesh.rotation.set(...p.rotation);
    minY = Math.min(minY, p.position[1]);
    maxY = Math.max(maxY, p.position[1]);
    inner.add(mesh);
  });

  const height = Math.max(0.5, maxY - minY);
  const autoScale = 0.36 / height;
  inner.scale.setScalar(autoScale);
  inner.position.set(0, -minY * autoScale * 0.5, 0.12);
  inner.rotation.x = Math.PI / 2.4;

  group.add(inner);
  enableShadows(group);
  return group;
}

export function createImageCutoutTexture(
  imageDataUrl: string,
  removeWhiteBg: boolean,
  onReady: (tex: THREE.CanvasTexture, aspect: number) => void,
  maxDim = 512
): void {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(32, Math.round(img.width * scale));
    const h = Math.max(32, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, w, h);

    if (removeWhiteBg) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const brightness = (r + g + b) / 3;
        const maxDiff = Math.max(r, g, b) - Math.min(r, g, b);
        if (brightness > 232 && maxDiff < 24) {
          d[i + 3] = 0;
        } else if (brightness > 215 && maxDiff < 22) {
          d[i + 3] = Math.round(d[i + 3] * 0.35);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    onReady(tex, w / h);
  };
  img.src = imageDataUrl;
}

export function buildHandheldAttachmentObject(
  attachment: HeldItemAttachment
): THREE.Group {
  const wrapper = new THREE.Group();

  if (attachment.itemKind === 'custom3D' && attachment.customBlueprint) {
    wrapper.add(createBlueprintHandheldGroup(attachment.customBlueprint));
  } else if (attachment.itemKind === 'customImage' && attachment.imageDataUrl) {
    const placeholderGeo = new THREE.PlaneGeometry(0.32, 0.32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      roughness: 0.45,
    });
    const plane = new THREE.Mesh(placeholderGeo, mat);
    plane.position.set(0, 0.02, 0.14);
    plane.rotation.x = Math.PI / 2.2;
    wrapper.add(plane);

    createImageCutoutTexture(
      attachment.imageDataUrl,
      Boolean(attachment.removeBg),
      (tex, aspect) => {
        mat.map = tex;
        mat.needsUpdate = true;
        plane.scale.set(aspect >= 1 ? 1 : aspect, aspect >= 1 ? 1 / aspect : 1, 1);
      }
    );
  } else if (attachment.itemKind === 'customGLB' && attachment.glbUrl) {
    const holder = new THREE.Group();
    wrapper.add(holder);
    let cancelled = false;
    wrapper.userData.onDispose = () => {
      cancelled = true;
    };

    const loader = new GLTFLoader();
    loader
      .loadAsync(attachment.glbUrl)
      .then((gltf) => {
        if (cancelled) {
          disposeObjectTree(gltf.scene);
          return;
        }
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z, 0.01);
        const scale = 0.36 / maxDim;
        model.scale.setScalar(scale);
        model.position.set(
          -center.x * scale,
          -center.y * scale + 0.02,
          -center.z * scale + 0.1
        );
        enableShadows(model);
        holder.add(model);
      })
      .catch(() => {
        // Fallback small emblem if invalid GLB
        if (cancelled) return;
        const fallback = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.12, 0),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 })
        );
        fallback.position.set(0, 0.02, 0.12);
        holder.add(fallback);
      });
  } else if (attachment.itemKind !== 'none') {
    wrapper.add(createBuiltinHandheldGroup(attachment.itemKind));
  }

  applyHandheldTransform(wrapper, attachment);
  return wrapper;
}

export function applyHandheldTransform(
  wrapper: THREE.Group,
  attachment: HeldItemAttachment
): void {
  wrapper.scale.setScalar(THREE.MathUtils.clamp(attachment.scale || 1, 0.3, 2.5));
  wrapper.rotation.set(0, (attachment.rotationDeg * Math.PI) / 180, 0);
  wrapper.position.set(0, attachment.offsetY || 0, attachment.offsetZ || 0);
}

export function disposeObjectTree(obj: THREE.Object3D): void {
  if (typeof obj.userData?.onDispose === 'function') {
    obj.userData.onDispose();
  }
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mt) => {
        if (!mt) return;
        const std = mt as THREE.MeshStandardMaterial;
        if (std.map) std.map.dispose();
        mt.dispose();
      });
    }
  });
}
