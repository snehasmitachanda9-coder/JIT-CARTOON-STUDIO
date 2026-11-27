import * as THREE from 'three';
import {
  EntranceEffect,
  ExitEffect,
  SceneActor,
  TransitionDirection,
} from '../types/studio';

interface MaterialSnapshot {
  mesh: THREE.Mesh;
  mat: THREE.Material & {
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
    clippingPlanes: THREE.Plane[] | null;
    clipShadows: boolean;
  };
  origOpacity: number;
  origTransparent: boolean;
  origDepthWrite: boolean;
}

const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camFlatRight = new THREE.Vector3();
const _camFlatFwd = new THREE.Vector3();
const _centerWorld = new THREE.Vector3();
const _box = new THREE.Box3();
const _vec = new THREE.Vector3();

function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeOutBack(t: number): number {
  const c1 = 1.45;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const u = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  } else if (t < 2.5 / d1) {
    const u = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  } else {
    const u = t - 2.625 / d1;
    return n1 * u * u + 0.984375;
  }
}

export interface TransitionApplyInput {
  rigRoot: THREE.Group;
  speechSprite: THREE.Sprite;
  selectionRing: THREE.Mesh;
  actor: SceneActor;
  sceneTime: number;
  sceneDuration: number;
  isPlaying: boolean;
  isScrubbing: boolean;
  isExporting: boolean;
  camera: THREE.Camera;
  baseX: number;
  baseZ: number;
  baseRotationY: number;
  baseScale: number;
}

export class ActorTransitionController {
  private snapshots: MaterialSnapshot[] = [];
  private scannedChildCount = -1;
  private modelHeight = 1.75;
  private modelHalfRadius = 0.72;

  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly wipePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);
  private readonly splitPlaneLeft = new THREE.Plane(new THREE.Vector3(1, 0, 0), 10);
  private readonly splitPlaneRight = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10);
  private readonly irisPlanes: THREE.Plane[] = Array.from(
    { length: 8 },
    () => new THREE.Plane(new THREE.Vector3(1, 0, 0), 10)
  );
  private readonly singleClipList: THREE.Plane[] = [this.wipePlane];
  private readonly groundClipList: THREE.Plane[] = [this.groundPlane];
  private readonly splitClipList: THREE.Plane[] = [
    this.splitPlaneLeft,
    this.splitPlaneRight,
  ];

  private ensureScanned(
    rigRoot: THREE.Group,
    selectionRing: THREE.Mesh,
    speechSprite: THREE.Sprite
  ): void {
    let meshCount = 0;
    rigRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshCount++;
    });
    if (meshCount === this.scannedChildCount && this.snapshots.length > 0) {
      return;
    }

    this.restoreMaterials();
    this.snapshots = [];
    this.scannedChildCount = meshCount;

    const prevPos = rigRoot.position.clone();
    const prevRotY = rigRoot.rotation.y;
    const prevScale = rigRoot.scale.clone();

    rigRoot.position.set(0, 0, 0);
    rigRoot.rotation.set(0, 0, 0);
    rigRoot.scale.set(1, 1, 1);
    rigRoot.updateMatrixWorld(true);

    _box.makeEmpty();
    rigRoot.traverse((obj) => {
      if (obj === selectionRing || obj === speechSprite) return;
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.userData?.isOutline) return;
        const isGroundHelper =
          mesh.geometry.type === 'RingGeometry' ||
          (mesh.geometry.type === 'PlaneGeometry' && Math.abs(mesh.position.y) < 0.05);

        if (!isGroundHelper) {
          _box.expandByObject(mesh);
        }

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          const mat = m as MaterialSnapshot['mat'];
          this.snapshots.push({
            mesh,
            mat,
            origOpacity: typeof mat.opacity === 'number' ? mat.opacity : 1,
            origTransparent: Boolean(mat.transparent),
            origDepthWrite: typeof mat.depthWrite === 'boolean' ? mat.depthWrite : true,
          });
        }
      }
    });

    if (!_box.isEmpty()) {
      const size = new THREE.Vector3();
      _box.getSize(size);
      this.modelHeight = Math.max(0.5, size.y);
      this.modelHalfRadius = Math.max(0.45, Math.hypot(size.x, size.y, size.z) * 0.56);
    }

    rigRoot.position.copy(prevPos);
    rigRoot.rotation.y = prevRotY;
    rigRoot.scale.copy(prevScale);
    rigRoot.updateMatrixWorld(true);
  }

  public restoreMaterials(): void {
    for (const snap of this.snapshots) {
      const { mat, origOpacity, origTransparent, origDepthWrite } = snap;
      if (mat.transparent !== origTransparent) {
        mat.transparent = origTransparent;
        mat.needsUpdate = true;
      }
      mat.opacity = origOpacity;
      mat.depthWrite = origDepthWrite;
      if (mat.clippingPlanes !== null) {
        mat.clippingPlanes = null;
        mat.clipShadows = false;
        mat.needsUpdate = true;
      }
    }
  }

  private applyMaterialEffects(
    opacityMul: number,
    clipPlanes: THREE.Plane[] | null
  ): void {
    const clampedOp = THREE.MathUtils.clamp(opacityMul, 0, 1);
    const needsAlpha = clampedOp < 0.995;

    for (const snap of this.snapshots) {
      const { mat, origOpacity, origTransparent, origDepthWrite } = snap;
      const targetTrans = origTransparent || needsAlpha;
      if (mat.transparent !== targetTrans) {
        mat.transparent = targetTrans;
        mat.needsUpdate = true;
      }
      mat.opacity = origOpacity * clampedOp;
      mat.depthWrite = needsAlpha
        ? clampedOp > 0.85
          ? origDepthWrite
          : false
        : origDepthWrite;

      const hadClips = mat.clippingPlanes !== null;
      const hasClips = clipPlanes !== null && clipPlanes.length > 0;
      if (hasClips) {
        mat.clippingPlanes = clipPlanes;
        if (!mat.clipShadows) mat.clipShadows = true;
        if (!hadClips) mat.needsUpdate = true;
      } else if (hadClips) {
        mat.clippingPlanes = null;
        mat.clipShadows = false;
        mat.needsUpdate = true;
      }
    }
  }

  private computeCameraBasis(camera: THREE.Camera): void {
    camera.updateMatrixWorld();
    _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    _camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    _camFwd.setFromMatrixColumn(camera.matrixWorld, 2).negate().normalize();

    _camFlatRight.set(_camRight.x, 0, _camRight.z);
    if (_camFlatRight.lengthSq() < 1e-4) _camFlatRight.set(1, 0, 0);
    else _camFlatRight.normalize();

    _camFlatFwd.set(_camFwd.x, 0, _camFwd.z);
    if (_camFlatFwd.lengthSq() < 1e-4) _camFlatFwd.set(0, 0, -1);
    else _camFlatFwd.normalize();
  }

  private computeFlyOffset(
    dir: TransitionDirection,
    amount: number,
    out: THREE.Vector3
  ): void {
    const horizDist = 8.5;
    const vertDist = 6.2;
    if (dir === 'left') {
      out.copy(_camFlatRight).multiplyScalar(-horizDist * amount);
    } else if (dir === 'right') {
      out.copy(_camFlatRight).multiplyScalar(horizDist * amount);
    } else if (dir === 'top') {
      out.set(0, vertDist * amount, 0);
    } else {
      out.set(0, -vertDist * amount, 0);
    }
  }

  public apply(input: TransitionApplyInput): boolean {
    const {
      rigRoot,
      speechSprite,
      selectionRing,
      actor,
      sceneTime,
      sceneDuration,
      isPlaying,
      isScrubbing,
      isExporting,
      camera,
      baseX,
      baseZ,
      baseRotationY,
      baseScale,
    } = input;

    this.ensureScanned(rigRoot, selectionRing, speechSprite);

    const cfg = actor.transitions;
    const inEff: EntranceEffect = cfg?.entrance ?? 'none';
    const outEff: ExitEffect = cfg?.exit ?? 'none';

    const shouldEvaluate =
      isPlaying || isExporting || isScrubbing || sceneTime > 0.005;

    if (!shouldEvaluate || (inEff === 'none' && outEff === 'none')) {
      rigRoot.visible = true;
      rigRoot.position.set(baseX, 0, baseZ);
      rigRoot.rotation.y = baseRotationY;
      rigRoot.scale.setScalar(baseScale);
      this.applyMaterialEffects(1, null);
      if (speechSprite.material) {
        (speechSprite.material as THREE.SpriteMaterial).opacity = 1;
      }
      return true;
    }

    const safeDur = Math.max(0.5, sceneDuration || 6);
    const actStart = actor.startTime ?? 0;
    const actEnd = actor.endTime ?? safeDur;
    const actSpan = Math.max(0.4, actEnd - actStart);

    // Hide cleanly before start when entrance effect is active
    if (sceneTime < actStart - 0.001) {
      if (inEff !== 'none') {
        rigRoot.visible = false;
        return false;
      }
    }

    // Hide cleanly after end when exit effect is active
    if (sceneTime > actEnd + 0.001) {
      if (outEff !== 'none') {
        rigRoot.visible = false;
        return false;
      }
    }

    let inDur = inEff !== 'none' ? THREE.MathUtils.clamp(cfg?.entranceDuration ?? 0.8, 0.3, 2.0) : 0;
    let outDur = outEff !== 'none' ? THREE.MathUtils.clamp(cfg?.exitDuration ?? 0.8, 0.3, 2.0) : 0;
    if (inDur + outDur > actSpan) {
      const ratio = actSpan / (inDur + outDur);
      inDur *= ratio;
      outDur *= ratio;
    }

    let offsetX = 0;
    let offsetY = 0;
    let offsetZ = 0;
    let rotOffsetY = 0;
    let sx = 1;
    let sy = 1;
    let sz = 1;
    let opacityMul = 1;
    let clipPlanes: THREE.Plane[] | null = null;

    this.computeCameraBasis(camera);
    const scaledH = this.modelHeight * baseScale;
    const scaledR = this.modelHalfRadius * baseScale;

    const inActive = inEff !== 'none' && sceneTime >= actStart && sceneTime < actStart + inDur;
    const outActive = outEff !== 'none' && sceneTime >= actEnd - outDur && sceneTime <= actEnd + 0.001;

    if (inActive && inDur > 0.001) {
      const p = THREE.MathUtils.clamp((sceneTime - actStart) / inDur, 0, 1);
      const inDir: TransitionDirection = cfg?.entranceDirection ?? 'left';

      switch (inEff) {
        case 'appear': {
          if (p < 0.02) {
            rigRoot.visible = false;
            return false;
          }
          break;
        }
        case 'fade': {
          opacityMul = easeOutCubic(p);
          break;
        }
        case 'flyIn': {
          const e = 1 - easeOutCubic(p);
          this.computeFlyOffset(inDir, e, _vec);
          offsetX += _vec.x;
          offsetY += _vec.y;
          offsetZ += _vec.z;
          opacityMul = Math.min(1, p * 4);
          break;
        }
        case 'floatIn': {
          const e = easeOutCubic(p);
          offsetY = (e - 1) * 1.15;
          opacityMul = e;
          break;
        }
        case 'split': {
          const e = easeOutCubic(p);
          const halfW = Math.max(0.006, (scaledR + 0.18) * e);
          _centerWorld.set(baseX, scaledH * 0.5, baseZ);
          const dotC = _camFlatRight.dot(_centerWorld);
          this.splitPlaneLeft.normal.copy(_camFlatRight);
          this.splitPlaneLeft.constant = -dotC + halfW;
          this.splitPlaneRight.normal.copy(_camFlatRight).negate();
          this.splitPlaneRight.constant = dotC + halfW;
          clipPlanes = this.splitClipList;
          sx = THREE.MathUtils.lerp(0.22, 1, e);
          break;
        }
        case 'wipe': {
          const e = easeOutCubic(p);
          _centerWorld.set(baseX, scaledH * 0.5, baseZ);
          if (inDir === 'left' || inDir === 'right') {
            const sign = inDir === 'right' ? 1 : -1;
            const sweep = THREE.MathUtils.lerp(-scaledR - 0.15, scaledR + 0.2, e);
            this.wipePlane.normal.copy(_camFlatRight).multiplyScalar(sign);
            this.wipePlane.constant =
              -this.wipePlane.normal.dot(_centerWorld) + sweep;
          } else {
            const wipeY = THREE.MathUtils.lerp(-0.08, scaledH + 0.24, e);
            this.wipePlane.normal.set(0, -1, 0);
            this.wipePlane.constant = wipeY;
          }
          clipPlanes = this.singleClipList;
          break;
        }
        case 'zoom': {
          const s = Math.max(0.01, easeOutBack(p));
          sx = s;
          sy = s;
          sz = s;
          opacityMul = Math.min(1, p * 3.5);
          break;
        }
        case 'swivel': {
          const e = easeOutCubic(p);
          rotOffsetY = (1 - e) * Math.PI * 2;
          const s = Math.max(0.04, e);
          sx = s;
          sy = THREE.MathUtils.lerp(0.25, 1, e);
          sz = s;
          opacityMul = Math.min(1, p * 3);
          break;
        }
        case 'bounce': {
          const b = bounceOut(p);
          const drop = Math.max(0, 1 - b);
          offsetY = drop * 3.2;
          if (drop < 0.035 && p > 0.3 && p < 0.94) {
            const squash = Math.sin(p * Math.PI * 6) * (1 - p) * 0.16;
            sy = Math.max(0.78, 1 - Math.abs(squash));
            sx = 1 + Math.abs(squash) * 0.55;
            sz = 1 + Math.abs(squash) * 0.55;
          }
          opacityMul = Math.min(1, p * 5);
          break;
        }
        case 'expand': {
          const e = easeOutCubic(p);
          sx = THREE.MathUtils.lerp(0.02, 1, e);
          sy = THREE.MathUtils.lerp(0.08, 1, e);
          sz = THREE.MathUtils.lerp(0.02, 1, e);
          opacityMul = Math.min(1, p * 4);
          break;
        }
        case 'riseUp': {
          const e = easeOutCubic(p);
          offsetY = THREE.MathUtils.lerp(-scaledH - 0.18, 0, e);
          this.groundPlane.normal.set(0, 1, 0);
          this.groundPlane.constant = 0;
          clipPlanes = this.groundClipList;
          break;
        }
        case 'stretch': {
          const e = easeOutCubic(p);
          const snap = Math.sin(p * Math.PI) * 0.25 * (1 - p);
          sy = THREE.MathUtils.lerp(2.15, 1.0, e) + snap;
          sx = THREE.MathUtils.lerp(0.32, 1.0, e);
          sz = THREE.MathUtils.lerp(0.32, 1.0, e);
          opacityMul = Math.min(1, p * 4);
          break;
        }
        case 'compress': {
          const e = easeOutCubic(p);
          sx = THREE.MathUtils.lerp(1.95, 1.0, e);
          sy = THREE.MathUtils.lerp(1.55, 1.0, e);
          sz = THREE.MathUtils.lerp(1.65, 1.0, e);
          opacityMul = THREE.MathUtils.lerp(0.15, 1.0, e);
          break;
        }
        case 'zoomIn': {
          const e = easeOutExpo(p);
          const travel = (1 - e) * -5.8;
          offsetX += _camFlatFwd.x * travel;
          offsetZ += _camFlatFwd.z * travel;
          const s = THREE.MathUtils.lerp(0.08, 1.0, e);
          sx = s;
          sy = s;
          sz = s;
          opacityMul = Math.min(1, p * 3.5);
          break;
        }
        default:
          break;
      }
    } else if (outActive && outDur > 0.001) {
      const q = THREE.MathUtils.clamp((sceneTime - (actEnd - outDur)) / outDur, 0, 1);
      const outDir: TransitionDirection = cfg?.exitDirection ?? 'right';

      switch (outEff) {
        case 'disappear': {
          if (q >= 0.96) {
            rigRoot.visible = false;
            return false;
          }
          break;
        }
        case 'fade': {
          opacityMul = 1 - easeInOutCubic(q);
          break;
        }
        case 'flyOut': {
          const e = easeInCubic(q);
          this.computeFlyOffset(outDir, e, _vec);
          offsetX += _vec.x;
          offsetY += _vec.y;
          offsetZ += _vec.z;
          opacityMul = 1 - Math.max(0, (q - 0.65) / 0.35);
          break;
        }
        case 'floatOut': {
          const e = easeOutCubic(q);
          offsetY = e * 1.3;
          opacityMul = 1 - easeInOutCubic(q);
          break;
        }
        case 'split': {
          const e = easeInCubic(q);
          const halfW = Math.max(0.001, (scaledR + 0.18) * (1 - e));
          _centerWorld.set(baseX, scaledH * 0.5, baseZ);
          const dotC = _camFlatRight.dot(_centerWorld);
          this.splitPlaneLeft.normal.copy(_camFlatRight);
          this.splitPlaneLeft.constant = -dotC + halfW;
          this.splitPlaneRight.normal.copy(_camFlatRight).negate();
          this.splitPlaneRight.constant = dotC + halfW;
          clipPlanes = this.splitClipList;
          sx = THREE.MathUtils.lerp(1, 0.08, e);
          if (q > 0.94) opacityMul = 1 - (q - 0.94) / 0.06;
          break;
        }
        case 'wipe': {
          const e = easeInOutCubic(q);
          _centerWorld.set(baseX, scaledH * 0.5, baseZ);
          if (outDir === 'left' || outDir === 'right') {
            const sign = outDir === 'right' ? -1 : 1;
            const sweep = THREE.MathUtils.lerp(-scaledR - 0.18, scaledR + 0.2, e);
            this.wipePlane.normal.copy(_camFlatRight).multiplyScalar(sign);
            this.wipePlane.constant =
              -this.wipePlane.normal.dot(_centerWorld) - sweep;
          } else {
            const wipeY = THREE.MathUtils.lerp(-0.08, scaledH + 0.24, e);
            this.wipePlane.normal.set(0, 1, 0);
            this.wipePlane.constant = -wipeY;
          }
          clipPlanes = this.singleClipList;
          break;
        }
        case 'shape': {
          const e = easeInCubic(q);
          const irisRadius = Math.max(0.002, scaledR * 1.35 * (1 - e));
          _centerWorld.set(baseX, scaledH * 0.5, baseZ);
          for (let k = 0; k < 8; k++) {
            const ang = (k * Math.PI) / 4;
            const ca = Math.cos(ang);
            const sa = Math.sin(ang);
            const pl = this.irisPlanes[k];
            pl.normal
              .set(0, 0, 0)
              .addScaledVector(_camRight, -ca)
              .addScaledVector(_camUp, -sa)
              .normalize();
            pl.constant = -pl.normal.dot(_centerWorld) + irisRadius;
          }
          clipPlanes = this.irisPlanes;
          const tailScale = q > 0.78 ? THREE.MathUtils.lerp(1, 0.04, (q - 0.78) / 0.22) : 1;
          sx = tailScale;
          sy = tailScale;
          sz = tailScale;
          opacityMul = q > 0.85 ? 1 - (q - 0.85) / 0.15 : 1;
          break;
        }
        default:
          break;
      }
    }

    if (opacityMul <= 0.01) {
      rigRoot.visible = false;
      this.applyMaterialEffects(0, null);
      return false;
    }

    rigRoot.visible = true;
    rigRoot.position.set(baseX + offsetX, offsetY, baseZ + offsetZ);
    rigRoot.rotation.y = baseRotationY + rotOffsetY;
    rigRoot.scale.set(baseScale * sx, baseScale * sy, baseScale * sz);

    this.applyMaterialEffects(opacityMul, clipPlanes);
    if (speechSprite.material) {
      (speechSprite.material as THREE.SpriteMaterial).opacity = opacityMul;
    }
    return true;
  }
}
