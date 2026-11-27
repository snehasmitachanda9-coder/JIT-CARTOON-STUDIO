import * as THREE from 'three';
import { MotionPathConfig, SceneActor } from '../types/studio';

const _tmpPtA = new THREE.Vector3();
const _tmpPtB = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

export function resolveActorMotionPath(actor: SceneActor): MotionPathConfig | null {
  if (actor.motionPath && actor.motionPath.enabled && actor.motionPath.points.length >= 2) {
    return actor.motionPath;
  }
  if (actor.walkPath && actor.walkPath.enabled) {
    return {
      enabled: true,
      mode: 'straight',
      points: [
        [actor.walkPath.start[0], actor.walkPath.start[1]],
        [actor.walkPath.end[0], actor.walkPath.end[1]],
      ],
      cornerStyle: 'sharp',
    };
  }
  return null;
}

export function cleanWaypoints(
  raw: Array<[number, number]>,
  minDist = 0.04
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const pt of raw) {
    if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
    if (out.length === 0) {
      out.push([pt[0], pt[1]]);
    } else {
      const prev = out[out.length - 1];
      if (Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) >= minDist) {
        out.push([pt[0], pt[1]]);
      }
    }
  }
  return out;
}

export function simplifyFreehandPoints(
  raw: Array<[number, number]>,
  maxPoints = 26
): Array<[number, number]> {
  const cleaned = cleanWaypoints(raw, 0.14);
  if (cleaned.length <= 2) return cleaned;

  // One gentle smoothing pass on interior points
  const smoothed: Array<[number, number]> = [cleaned[0]];
  for (let i = 1; i < cleaned.length - 1; i++) {
    const prev = cleaned[i - 1];
    const curr = cleaned[i];
    const next = cleaned[i + 1];
    smoothed.push([
      Number((prev[0] * 0.22 + curr[0] * 0.56 + next[0] * 0.22).toFixed(2)),
      Number((prev[1] * 0.22 + curr[1] * 0.56 + next[1] * 0.22).toFixed(2)),
    ]);
  }
  smoothed.push(cleaned[cleaned.length - 1]);

  if (smoothed.length <= maxPoints) return smoothed;

  const sampled: Array<[number, number]> = [smoothed[0]];
  const step = (smoothed.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    sampled.push(smoothed[idx]);
  }
  sampled.push(smoothed[smoothed.length - 1]);
  return cleanWaypoints(sampled, 0.08);
}

export function buildMotionCurve(
  config: MotionPathConfig | null
): THREE.Curve<THREE.Vector3> | null {
  if (!config || !config.enabled) return null;
  const pts = cleanWaypoints(config.points, 0.03);
  if (pts.length < 2) return null;

  const vecs = pts.map(([x, z]) => new THREE.Vector3(x, 0.055, z));

  if (
    config.mode === 'straight' ||
    (config.mode === 'multiPoint' && config.cornerStyle === 'sharp')
  ) {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < vecs.length - 1; i++) {
      path.add(new THREE.LineCurve3(vecs[i], vecs[i + 1]));
    }
    return path;
  }

  return new THREE.CatmullRomCurve3(vecs, false, 'centripetal', 0.5);
}

export function sampleMotionCurve(
  curve: THREE.Curve<THREE.Vector3>,
  progress: number,
  outPos: THREE.Vector3,
  outTangent: THREE.Vector3
): void {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  curve.getPointAt(u, outPos);

  // Sample small delta for rock-solid tangent even at sharp corners or endpoints
  const eps = 0.008;
  const u0 = Math.max(0, u - eps);
  const u1 = Math.min(1, u + eps);
  curve.getPointAt(u0, _tmpPtA);
  curve.getPointAt(u1, _tmpPtB);
  outTangent.subVectors(_tmpPtB, _tmpPtA);
  outTangent.y = 0;
  if (outTangent.lengthSq() < 1e-6) {
    curve.getTangentAt(u, outTangent);
    outTangent.y = 0;
  }
  if (outTangent.lengthSq() > 1e-6) {
    outTangent.normalize();
  } else {
    outTangent.set(0, 0, 1);
  }
}

export class MotionPathVisualizer {
  public readonly group = new THREE.Group();
  private readonly dynamicGroup = new THREE.Group();
  private readonly handleHitMeshes: THREE.Object3D[] = [];
  private lastSignature = '';

  // Shared materials/geometries for handles & indicators
  private readonly startMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.1,
  });
  private readonly endMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.1,
  });
  private readonly midMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.1,
  });
  private readonly tubeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });
  private readonly coreLineMat = new THREE.LineBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.95,
  });
  private readonly arrowMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  private readonly hitMat = new THREE.MeshBasicMaterial({
    visible: false,
  });

  private readonly sphereGeo = new THREE.SphereGeometry(0.11, 20, 16);
  private readonly hitSphereGeo = new THREE.SphereGeometry(0.28, 12, 10);
  private readonly ringGeo = new THREE.RingGeometry(0.16, 0.26, 28);
  private readonly arrowGeo = new THREE.ConeGeometry(0.075, 0.21, 14);

  constructor() {
    this.ringGeo.rotateX(-Math.PI / 2);
    this.arrowGeo.rotateX(Math.PI / 2);
    this.group.add(this.dynamicGroup);
    this.group.visible = false;
  }

  public getDraggableHandles(): THREE.Object3D[] {
    return this.group.visible ? this.handleHitMeshes : [];
  }

  private clearDynamic(): void {
    while (this.dynamicGroup.children.length > 0) {
      const child = this.dynamicGroup.children[0];
      this.dynamicGroup.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Line).isLine) {
          const geom = (obj as THREE.Mesh | THREE.Line).geometry;
          if (
            geom &&
            geom !== this.sphereGeo &&
            geom !== this.hitSphereGeo &&
            geom !== this.ringGeo &&
            geom !== this.arrowGeo
          ) {
            geom.dispose();
          }
        }
      });
    }
    this.handleHitMeshes.length = 0;
  }

  public sync(config: MotionPathConfig | null, visible: boolean): void {
    if (!visible || !config || !config.enabled || config.points.length < 2) {
      this.group.visible = false;
      return;
    }

    const sig = JSON.stringify({
      mode: config.mode,
      cornerStyle: config.cornerStyle || 'rounded',
      points: config.points,
    });

    this.group.visible = true;
    if (sig === this.lastSignature) return;
    this.lastSignature = sig;

    this.rebuildFromConfig(config);
  }

  public syncLiveFreehand(points: Array<[number, number]>): void {
    if (points.length < 2) {
      this.group.visible = false;
      return;
    }
    this.lastSignature = '';
    this.group.visible = true;
    this.rebuildFromConfig({
      enabled: true,
      mode: 'freehand',
      points,
      cornerStyle: 'rounded',
    });
  }

  private rebuildFromConfig(config: MotionPathConfig): void {
    this.clearDynamic();
    const curve = buildMotionCurve(config);
    if (!curve) return;

    const totalLen = Math.max(0.1, curve.getLength());
    const tubularSegments = Math.min(
      140,
      Math.max(24, Math.round(totalLen * 12))
    );

    // 1. Glowing 3D path tube
    const tubeGeo = new THREE.TubeGeometry(curve, tubularSegments, 0.036, 10, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, this.tubeMat);
    tubeMesh.raycast = () => {};
    this.dynamicGroup.add(tubeMesh);

    // 2. Crisp center core line
    const samplePts = curve.getSpacedPoints(Math.min(120, Math.max(16, tubularSegments)));
    for (const p of samplePts) p.y = 0.075;
    const lineGeo = new THREE.BufferGeometry().setFromPoints(samplePts);
    const lineMesh = new THREE.Line(lineGeo, this.coreLineMat);
    lineMesh.raycast = () => {};
    this.dynamicGroup.add(lineMesh);

    // 3. Directional chevron arrows along path
    const arrowCount = Math.min(6, Math.max(1, Math.floor(totalLen / 1.45)));
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let i = 1; i <= arrowCount; i++) {
      const u = i / (arrowCount + 1);
      sampleMotionCurve(curve, u, p, tan);
      const arrow = new THREE.Mesh(this.arrowGeo, this.arrowMat);
      arrow.position.set(p.x, 0.09, p.z);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      arrow.raycast = () => {};
      this.dynamicGroup.add(arrow);
    }

    // 4. Waypoint handles (Start, End, and Intermediate Multi-Point Corners)
    const pts = config.points;
    pts.forEach(([x, z], idx) => {
      const isStart = idx === 0;
      const isEnd = idx === pts.length - 1;
      // In freehand mode, only show draggable handles at start and end so 26 curve points don't clutter
      if (config.mode === 'freehand' && !isStart && !isEnd) return;

      const mat = isStart ? this.startMat : isEnd ? this.endMat : this.midMat;
      const handleGroup = new THREE.Group();
      handleGroup.position.set(x, 0, z);

      const ring = new THREE.Mesh(this.ringGeo, mat);
      ring.position.y = 0.032;
      ring.scale.setScalar(isStart || isEnd ? 1.15 : 0.85);
      ring.raycast = () => {};

      const knob = new THREE.Mesh(this.sphereGeo, mat);
      knob.position.y = isStart || isEnd ? 0.16 : 0.13;
      knob.scale.setScalar(isStart || isEnd ? 1.05 : 0.78);
      knob.raycast = () => {};

      const hitProxy = new THREE.Mesh(this.hitSphereGeo, this.hitMat);
      hitProxy.position.y = 0.16;
      hitProxy.userData.waypointIndex = idx;
      this.handleHitMeshes.push(hitProxy);

      handleGroup.add(ring, knob, hitProxy);
      this.dynamicGroup.add(handleGroup);
    });

    // Subtle vertical beacon pole on End Point B for instant visual legibility
    const last = pts[pts.length - 1];
    const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.36, 10);
    const pole = new THREE.Mesh(poleGeo, this.endMat);
    pole.position.set(last[0], 0.2, last[1]);
    pole.raycast = () => {};
    this.dynamicGroup.add(pole);

    // Ensure _upAxis referenced cleanly if needed
    void _upAxis;
  }

  public dispose(): void {
    this.clearDynamic();
    this.startMat.dispose();
    this.endMat.dispose();
    this.midMat.dispose();
    this.tubeMat.dispose();
    this.coreLineMat.dispose();
    this.arrowMat.dispose();
    this.hitMat.dispose();
    this.sphereGeo.dispose();
    this.hitSphereGeo.dispose();
    this.ringGeo.dispose();
    this.arrowGeo.dispose();
  }
}
