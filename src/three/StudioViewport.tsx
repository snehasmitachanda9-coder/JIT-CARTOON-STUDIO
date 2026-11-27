import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AnimalKind,
  AnimationState,
  AspectRatioMode,
  CameraPose,
  CameraZoomMode,
  CharacterKind,
  ENVIRONMENT_META,
  EnvironmentId,
  LightingMode,
  PropKind,
  SceneActor,
  VehicleKind,
} from '../types/studio';
import { StudioAudioManager } from '../utils/audioManager';
import {
  AnimalRig,
  createAnimalRig,
  disposeAnimalRig,
  updateAnimalAccentColor,
  updateAnimalAnimation,
  updateAnimalSpeechBubble,
} from './animals';
import {
  CharacterRig,
  createCharacterRig,
  disposeCharacterRig,
  syncCharacterHeldItems,
  updateCharacterAccentColor,
  updateCharacterAnimation,
  updateSpeechBubble,
} from './characters';
import {
  applyLightingMode,
  buildEnvironment,
  disposeEnvironment,
  EnvironmentHandle,
} from './environments';
import {
  buildMotionCurve,
  MotionPathVisualizer,
  resolveActorMotionPath,
  sampleMotionCurve,
  simplifyFreehandPoints,
} from './motionPath';
import { ActorTransitionController } from './transitions';
import {
  createCustomModelRig,
  createPropRig,
  createVehicleRig,
  disposePropOrCustomRig,
  PropOrCustomRig,
  updatePropAccentColor,
  updatePropOrCustomAnimation,
  updatePropSpeechBubble,
} from './props';

const _pointerNdc = new THREE.Vector2();
const _hitPoint = new THREE.Vector3();
const _dragOffset = new THREE.Vector3();
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _zoomDir = new THREE.Vector3();
const _pathPos = new THREE.Vector3();
const _pathTan = new THREE.Vector3();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export type MotionPathEditMode = 'idle' | 'pickEnd' | 'drawFreehand' | 'addWaypoint';

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export interface StudioViewportHandle {
  getCameraPose: () => CameraPose;
  animateToCameraPose: (pose: CameraPose) => void;
  startVideoCapture: (audioStream?: MediaStream | null) => {
    stop: () => Promise<{ blob: Blob; mimeType: string }>;
    cancel: () => void;
  } | null;
}

type UnifiedRigEntry = (
  | { kindTag: 'character'; rig: CharacterRig; actor: SceneActor }
  | { kindTag: 'animal'; rig: AnimalRig; actor: SceneActor }
  | { kindTag: 'propOrCustom'; rig: PropOrCustomRig; actor: SceneActor }
) & {
  transitionCtrl: ActorTransitionController;
  cachedPathSig: string;
  cachedCurve: THREE.Curve<THREE.Vector3> | null;
  cachedCurveLength: number;
};

interface StudioViewportProps {
  environment: EnvironmentId;
  lighting: LightingMode;
  actors: SceneActor[];
  selectedActorId: string | null;
  aspectRatio: AspectRatioMode;
  isPlaying: boolean;
  isScrubbing: boolean;
  isExporting: boolean;
  sceneProgress: number; // 0..1 within active scene
  sceneDuration: number;
  baseCameraPose: CameraPose;
  cameraZoom: CameraZoomMode;
  cameraStartTime?: number;
  cameraEndTime?: number;
  cameraPoseTrigger: { pose: CameraPose; seq: number } | null;
  motionPathEditMode: MotionPathEditMode;
  audioManager: StudioAudioManager;
  onSelectActor: (id: string | null) => void;
  onMoveActor: (id: string, x: number, z: number) => void;
  onUpdateMotionPathPoints: (
    actorId: string,
    points: Array<[number, number]>,
    options?: { commit?: boolean; exitEditMode?: boolean }
  ) => void;
  onAppendMotionWaypoint: (actorId: string, x: number, z: number) => void;
}

export const StudioViewport = forwardRef<StudioViewportHandle, StudioViewportProps>(
  function StudioViewport(
    {
      environment,
      lighting,
      actors,
      selectedActorId,
      aspectRatio,
      isPlaying,
      isScrubbing,
      isExporting,
      sceneProgress,
      sceneDuration,
      baseCameraPose,
      cameraZoom,
      cameraStartTime,
      cameraEndTime,
      cameraPoseTrigger,
      motionPathEditMode,
      audioManager,
      onSelectActor,
      onMoveActor,
      onUpdateMotionPathPoints,
      onAppendMotionWaypoint,
    },
    ref
  ) {
    const outerStageRef = useRef<HTMLDivElement>(null);
    const frameContainerRef = useRef<HTMLDivElement>(null);
    const canvasMountRef = useRef<HTMLDivElement>(null);
    const [contextLost, setContextLost] = useState(false);

    const exportOverrideRef = useRef<{ width: number; height: number } | null>(null);
    const exportActiveLocalRef = useRef(false);
    const syncSizeRef = useRef<(() => void) | null>(null);

    const propsRef = useRef({
      actors,
      selectedActorId,
      aspectRatio,
      isPlaying,
      isScrubbing,
      isExporting,
      sceneProgress,
      sceneDuration,
      baseCameraPose,
      cameraZoom,
      cameraStartTime,
      cameraEndTime,
      motionPathEditMode,
      onSelectActor,
      onMoveActor,
      onUpdateMotionPathPoints,
      onAppendMotionWaypoint,
      audioManager,
    });
    propsRef.current = {
      actors,
      selectedActorId,
      aspectRatio,
      isPlaying,
      isScrubbing,
      isExporting,
      sceneProgress,
      sceneDuration,
      baseCameraPose,
      cameraZoom,
      cameraStartTime,
      cameraEndTime,
      motionPathEditMode,
      onSelectActor,
      onMoveActor,
      onUpdateMotionPathPoints,
      onAppendMotionWaypoint,
      audioManager,
    };

    const threeRef = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      hemiLight: THREE.HemisphereLight;
      keyLight: THREE.DirectionalLight;
      rimLight: THREE.DirectionalLight;
      envHandle: EnvironmentHandle | null;
      currentEnvId: EnvironmentId | null;
      rigs: Map<string, UnifiedRigEntry>;
      motionPathViz: MotionPathVisualizer;
      camTransitionActive: boolean;
      maxAnisotropy: number;
      isSoftwareGl: boolean;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      getCameraPose: () => {
        const inst = threeRef.current;
        if (!inst) return ENVIRONMENT_META[environment].defaultCamera;
        return {
          position: [
            Number(inst.camera.position.x.toFixed(2)),
            Number(inst.camera.position.y.toFixed(2)),
            Number(inst.camera.position.z.toFixed(2)),
          ],
          target: [
            Number(inst.controls.target.x.toFixed(2)),
            Number(inst.controls.target.y.toFixed(2)),
            Number(inst.controls.target.z.toFixed(2)),
          ],
        };
      },
      animateToCameraPose: (pose: CameraPose) => {
        const inst = threeRef.current;
        if (!inst) return;
        _camGoalPos.set(...pose.position);
        _camGoalTarget.set(...pose.target);
        inst.camTransitionActive = true;
      },
      startVideoCapture: (audioStream?: MediaStream | null) => {
        const inst = threeRef.current;
        if (!inst) return null;
        const canvas = inst.renderer.domElement;
        if (typeof canvas.captureStream !== 'function') return null;

        const ratio = propsRef.current.aspectRatio;
        const targetW = ratio === '9:16' ? 1080 : ratio === '1:1' ? 1080 : 1920;
        const targetH = ratio === '9:16' ? 1920 : ratio === '1:1' ? 1080 : 1080;

        exportOverrideRef.current = { width: targetW, height: targetH };
        exportActiveLocalRef.current = true;
        inst.motionPathViz.group.visible = false;
        inst.rigs.forEach((entry) => {
          entry.rig.selectionRing.visible = false;
        });

        inst.renderer.setPixelRatio(1);
        inst.renderer.setSize(targetW, targetH, false);
        inst.camera.aspect = targetW / targetH;
        inst.camera.updateProjectionMatrix();
        inst.renderer.render(inst.scene, inst.camera);

        const restoreViewportResolution = () => {
          exportOverrideRef.current = null;
          exportActiveLocalRef.current = false;
          if (!threeRef.current) return;
          threeRef.current.renderer.setPixelRatio(
            threeRef.current.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
          );
          syncSizeRef.current?.();
        };

        const captureFps = inst.isSoftwareGl ? 30 : 60;
        const videoStream = canvas.captureStream(captureFps);
        const combinedTracks = [...videoStream.getVideoTracks()];
        if (audioStream) {
          audioStream.getAudioTracks().forEach((t) => combinedTracks.push(t));
        }
        const combinedStream = new MediaStream(combinedTracks);

        const preferredMime = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9',
          'video/webm',
        ].find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));

        const recorder = preferredMime
          ? new MediaRecorder(combinedStream, {
              mimeType: preferredMime,
              videoBitsPerSecond: inst.isSoftwareGl ? 8_000_000 : 10_000_000,
            })
          : new MediaRecorder(combinedStream);

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.start(200);

        return {
          stop: () =>
            new Promise<{ blob: Blob; mimeType: string }>((resolve) => {
              recorder.onstop = () => {
                const mimeType = recorder.mimeType || 'video/webm';
                const blob = new Blob(chunks, { type: mimeType });
                videoStream.getTracks().forEach((t) => t.stop());
                restoreViewportResolution();
                resolve({ blob, mimeType });
              };
              if (recorder.state !== 'inactive') {
                recorder.stop();
              } else {
                const mimeType = recorder.mimeType || 'video/webm';
                videoStream.getTracks().forEach((t) => t.stop());
                restoreViewportResolution();
                resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
              }
            }),
          cancel: () => {
            recorder.onstop = null;
            if (recorder.state !== 'inactive') recorder.stop();
            videoStream.getTracks().forEach((t) => t.stop());
            restoreViewportResolution();
          },
        };
      },
    }));

    // 1. Initialize Three.js WebGLRenderer, Scene, Lighting, OrbitControls & Pointer Dragging ONCE
    useEffect(() => {
      const mount = canvasMountRef.current;
      const frameEl = frameContainerRef.current;
      if (!mount || !frameEl) return;

      const isSoftwareGl = detectSoftwareGl();
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.localClippingEnabled = true;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none';

      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const handleContextRestored = () => {
        setContextLost(false);
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b0e14);

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      scene.environmentIntensity = 0.32;
      pmremGenerator.dispose();

      const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 160);
      const initCam = ENVIRONMENT_META.village.defaultCamera;
      camera.position.set(...initCam.position);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(...initCam.target);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.07;
      controls.minDistance = 2.0;
      controls.maxDistance = 24;
      controls.maxPolarAngle = Math.PI / 2 - 0.04;
      controls.minPolarAngle = 0.12;
      controls.update();

      const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x166534, 0.75);
      hemiLight.position.set(0, 20, 0);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff4d6, 2.3);
      keyLight.position.set(8, 14, 10);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.radius = 2.5;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 38;
      keyLight.shadow.camera.left = -12;
      keyLight.shadow.camera.right = 12;
      keyLight.shadow.camera.top = 12;
      keyLight.shadow.camera.bottom = -12;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.0);
      rimLight.position.set(-7, 8, -10);
      scene.add(rimLight);

      // 3D Motion Path Visualizer (only visible in edit mode, never during video export)
      const motionPathViz = new MotionPathVisualizer();
      scene.add(motionPathViz.group);

      const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 4);
      const rigs = new Map<string, UnifiedRigEntry>();

      threeRef.current = {
        renderer,
        scene,
        camera,
        controls,
        hemiLight,
        keyLight,
        rimLight,
        envHandle: null,
        currentEnvId: null,
        rigs,
        motionPathViz,
        camTransitionActive: false,
        maxAnisotropy,
        isSoftwareGl,
      };

      const onControlStart = () => {
        if (threeRef.current) {
          threeRef.current.camTransitionActive = false;
        }
      };
      controls.addEventListener('start', onControlStart);

      const syncSize = () => {
        if (exportOverrideRef.current) return;
        const w = Math.max(160, Math.floor(frameEl.clientWidth));
        const h = Math.max(160, Math.floor(frameEl.clientHeight));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      syncSizeRef.current = syncSize;
      syncSize();
      const resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(frameEl);

      // Raycasting: Select/Drag Actors, Drag Path Waypoints, Draw Freehand Path, or Add Multi-Point Turns
      const raycaster = new THREE.Raycaster();
      let draggingId: string | null = null;
      let draggingWaypoint: { actorId: string; index: number; points: Array<[number, number]> } | null = null;
      let freehandDraft: Array<[number, number]> | null = null;
      let pointerDownPos = { x: 0, y: 0 };
      let hasMovedDuringPointer = false;

      const updateNdc = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      };

      const findActorIdFromObject = (obj: THREE.Object3D | null): string | null => {
        let cur = obj;
        while (cur) {
          if (cur.userData && typeof cur.userData.actorId === 'string') {
            return cur.userData.actorId;
          }
          cur = cur.parent;
        }
        return null;
      };

      const clampGroundPoint = (pt: THREE.Vector3): [number, number] => [
        Number(THREE.MathUtils.clamp(pt.x, -7.8, 7.8).toFixed(2)),
        Number(THREE.MathUtils.clamp(pt.z, -6.5, 6.5).toFixed(2)),
      ];

      const onPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 0 && ev.pointerType === 'mouse') return;
        pointerDownPos = { x: ev.clientX, y: ev.clientY };
        hasMovedDuringPointer = false;

        updateNdc(ev.clientX, ev.clientY);
        raycaster.setFromCamera(_pointerNdc, camera);

        const {
          motionPathEditMode: editMode,
          selectedActorId: selId,
          actors: curActors,
          isPlaying: playingNow,
        } = propsRef.current;

        if (!playingNow && selId && editMode === 'pickEnd') {
          ev.stopImmediatePropagation();
          if (raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
            const [nx, nz] = clampGroundPoint(_hitPoint);
            const selActor = curActors.find((a) => a.id === selId);
            const existingMp = selActor ? resolveActorMotionPath(selActor) : null;
            const startPt: [number, number] =
              existingMp?.points[0] ?? (selActor ? [...selActor.position] : [0, 0]);
            propsRef.current.onUpdateMotionPathPoints(selId, [startPt, [nx, nz]], {
              commit: true,
              exitEditMode: true,
            });
          }
          return;
        }

        if (!playingNow && selId && editMode === 'drawFreehand') {
          ev.stopImmediatePropagation();
          if (raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
            const [nx, nz] = clampGroundPoint(_hitPoint);
            freehandDraft = [[nx, nz]];
            controls.enabled = false;
            motionPathViz.syncLiveFreehand(freehandDraft);
            try {
              renderer.domElement.setPointerCapture(ev.pointerId);
            } catch {
              // ignore
            }
          }
          return;
        }

        // In idle edit mode, check draggable Motion Path waypoint handles first
        if (!playingNow && selId && editMode === 'idle') {
          const handles = motionPathViz.getDraggableHandles();
          if (handles.length > 0) {
            const handleHits = raycaster.intersectObjects(handles, false);
            if (handleHits.length > 0) {
              const wpIdx = handleHits[0].object.userData.waypointIndex;
              const selActor = curActors.find((a) => a.id === selId);
              const existingMp = selActor ? resolveActorMotionPath(selActor) : null;
              if (
                typeof wpIdx === 'number' &&
                existingMp &&
                wpIdx >= 0 &&
                wpIdx < existingMp.points.length
              ) {
                ev.stopImmediatePropagation();
                draggingWaypoint = {
                  actorId: selId,
                  index: wpIdx,
                  points: existingMp.points.map(([x, z]) => [x, z] as [number, number]),
                };
                controls.enabled = false;
                try {
                  renderer.domElement.setPointerCapture(ev.pointerId);
                } catch {
                  // ignore
                }
                return;
              }
            }
          }
        }

        if (editMode === 'addWaypoint') {
          // Let tap add a waypoint in pointerUp while preserving camera drag if user orbits
          return;
        }

        const roots: THREE.Object3D[] = [];
        rigs.forEach(({ rig }) => roots.push(rig.root));

        const hits = raycaster.intersectObjects(roots, true);
        if (hits.length > 0) {
          const hitId = findActorIdFromObject(hits[0].object);
          if (hitId) {
            ev.stopImmediatePropagation();
            draggingId = hitId;
            controls.enabled = false;
            propsRef.current.onSelectActor(hitId);

            if (raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
              const entry = rigs.get(hitId);
              if (entry) {
                _dragOffset.copy(entry.rig.root.position).sub(_hitPoint);
              }
            }
            try {
              renderer.domElement.setPointerCapture(ev.pointerId);
            } catch {
              // ignore
            }
          }
        }
      };

      const onPointerMove = (ev: PointerEvent) => {
        if (
          Math.abs(ev.clientX - pointerDownPos.x) > 4 ||
          Math.abs(ev.clientY - pointerDownPos.y) > 4
        ) {
          hasMovedDuringPointer = true;
        }

        if (freehandDraft) {
          updateNdc(ev.clientX, ev.clientY);
          raycaster.setFromCamera(_pointerNdc, camera);
          if (raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
            const [nx, nz] = clampGroundPoint(_hitPoint);
            const prev = freehandDraft[freehandDraft.length - 1];
            if (!prev || Math.hypot(nx - prev[0], nz - prev[1]) >= 0.22) {
              freehandDraft.push([nx, nz]);
              motionPathViz.syncLiveFreehand(freehandDraft);
            }
          }
          return;
        }

        if (draggingWaypoint) {
          updateNdc(ev.clientX, ev.clientY);
          raycaster.setFromCamera(_pointerNdc, camera);
          if (raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
            const [nx, nz] = clampGroundPoint(_hitPoint);
            draggingWaypoint.points[draggingWaypoint.index] = [nx, nz];
            const copy = draggingWaypoint.points.map(([x, z]) => [x, z] as [number, number]);
            propsRef.current.onUpdateMotionPathPoints(draggingWaypoint.actorId, copy, {
              commit: false,
            });
          }
          return;
        }

        if (!draggingId) return;
        updateNdc(ev.clientX, ev.clientY);
        raycaster.setFromCamera(_pointerNdc, camera);

        if (raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
          const nx = THREE.MathUtils.clamp(_hitPoint.x + _dragOffset.x, -7.8, 7.8);
          const nz = THREE.MathUtils.clamp(_hitPoint.z + _dragOffset.z, -6.5, 6.5);
          const entry = rigs.get(draggingId);
          if (entry) {
            entry.rig.root.position.set(nx, 0, nz);
            propsRef.current.onMoveActor(draggingId, Number(nx.toFixed(2)), Number(nz.toFixed(2)));
          }
        }
      };

      const onPointerUp = (ev: PointerEvent) => {
        if (freehandDraft) {
          const raw = freehandDraft;
          freehandDraft = null;
          controls.enabled = true;
          try {
            renderer.domElement.releasePointerCapture(ev.pointerId);
          } catch {
            // ignore
          }
          const selId = propsRef.current.selectedActorId;
          if (selId && raw.length >= 2) {
            const simplified = simplifyFreehandPoints(raw, 26);
            if (simplified.length >= 2) {
              propsRef.current.onUpdateMotionPathPoints(selId, simplified, {
                commit: true,
                exitEditMode: true,
              });
            }
          }
          return;
        }

        if (draggingWaypoint) {
          const dw = draggingWaypoint;
          draggingWaypoint = null;
          controls.enabled = true;
          try {
            renderer.domElement.releasePointerCapture(ev.pointerId);
          } catch {
            // ignore
          }
          const copy = dw.points.map(([x, z]) => [x, z] as [number, number]);
          propsRef.current.onUpdateMotionPathPoints(dw.actorId, copy, {
            commit: true,
          });
          return;
        }

        if (draggingId) {
          draggingId = null;
          controls.enabled = true;
          try {
            renderer.domElement.releasePointerCapture(ev.pointerId);
          } catch {
            // ignore
          }
          return;
        }

        if (
          !hasMovedDuringPointer &&
          !propsRef.current.isPlaying &&
          propsRef.current.selectedActorId &&
          propsRef.current.motionPathEditMode === 'addWaypoint'
        ) {
          updateNdc(ev.clientX, ev.clientY);
          raycaster.setFromCamera(_pointerNdc, camera);
          if (raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
            const [nx, nz] = clampGroundPoint(_hitPoint);
            propsRef.current.onAppendMotionWaypoint(
              propsRef.current.selectedActorId,
              nx,
              nz
            );
          }
          return;
        }

        if (!hasMovedDuringPointer && propsRef.current.motionPathEditMode === 'idle') {
          updateNdc(ev.clientX, ev.clientY);
          raycaster.setFromCamera(_pointerNdc, camera);
          const roots: THREE.Object3D[] = [];
          rigs.forEach(({ rig }) => roots.push(rig.root));
          const hits = raycaster.intersectObjects(roots, true);
          if (hits.length === 0) {
            propsRef.current.onSelectActor(null);
          }
        }
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointercancel', onPointerUp);

      const clock = new THREE.Clock();
      let frameId = 0;
      let disposed = false;

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        gl.flush();
        const poll = () => {
          if (disposed) {
            gl.deleteSync(sync);
            return;
          }
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      const tick = () => {
        if (disposed) return;
        const delta = Math.min(clock.getDelta(), 0.1);
        const elapsed = clock.elapsedTime;
        const inst = threeRef.current;

        if (inst) {
          const {
            isPlaying: playing,
            isScrubbing: scrubbing,
            isExporting: exportingProp,
            sceneProgress: sProg,
            sceneDuration: sDur,
            baseCameraPose: baseCam,
            cameraZoom: zoomMode,
            cameraStartTime: camStartRaw,
            cameraEndTime: camEndRaw,
          } = propsRef.current;

          const exportingNow = exportingProp || exportActiveLocalRef.current;
          const safeDur = Math.max(0.5, sDur || 6);
          const sceneTime = sProg * safeDur;
          const camStart = camStartRaw ?? 0;
          const camEnd = camEndRaw ?? safeDur;
          const camSpan = Math.max(0.2, camEnd - camStart);
          const camProg = THREE.MathUtils.clamp((sceneTime - camStart) / camSpan, 0, 1);

          const previewTimeline = playing || exportingNow || scrubbing || sceneTime > 0.005;

          if ((playing || (previewTimeline && !inst.camTransitionActive)) && zoomMode !== 'none') {
            _camGoalTarget.set(...baseCam.target);
            _camGoalPos.set(...baseCam.position);
            _zoomDir.copy(_camGoalPos).sub(_camGoalTarget);
            const zoomFactor =
              zoomMode === 'zoomIn'
                ? THREE.MathUtils.lerp(1.0, 0.62, camProg)
                : THREE.MathUtils.lerp(0.7, 1.25, camProg);
            _camGoalPos.copy(_camGoalTarget).addScaledVector(_zoomDir, zoomFactor);
            const k = playing ? 1 - Math.exp(-5.0 * delta) : 1;
            camera.position.lerp(_camGoalPos, k);
            controls.target.lerp(_camGoalTarget, k);
          } else if (inst.camTransitionActive) {
            const k = 1 - Math.exp(-5.5 * delta);
            camera.position.lerp(_camGoalPos, k);
            controls.target.lerp(_camGoalTarget, k);
            if (
              camera.position.distanceTo(_camGoalPos) < 0.03 &&
              controls.target.distanceTo(_camGoalTarget) < 0.03
            ) {
              camera.position.copy(_camGoalPos);
              controls.target.copy(_camGoalTarget);
              inst.camTransitionActive = false;
            }
          }

          controls.update();
          inst.envHandle?.animatedUpdate?.(elapsed);

          const lipAmp = playing ? propsRef.current.audioManager.getLipSyncAmplitude() : -1;

          const travelAnims: AnimationState[] = [
            'Walk',
            'Run',
            'Running & Chasing',
            'Run/Chase',
            'Drive/Ride Forward',
            'Fly in Sky',
            'Fly',
            'Sail on Water',
            'Swimming',
            'Swim',
          ];

          // Always hide 3D path guides during export or active movie playback
          if (playing || exportingNow) {
            inst.motionPathViz.group.visible = false;
          }

          const isScrubMode = !playing && (scrubbing || sceneTime > 0.005);
          const animClockTime = isScrubMode ? sceneTime : elapsed;

          inst.rigs.forEach((entry) => {
            const { actor } = entry;
            const actStart = actor.startTime ?? 0;
            const actEnd = actor.endTime ?? safeDur;
            const actInWindow = !previewTimeline || (sceneTime >= actStart && sceneTime <= actEnd);
            const actProg = THREE.MathUtils.clamp(
              (sceneTime - actStart) / Math.max(0.2, actEnd - actStart),
              0,
              1
            );

            let activeAnim: AnimationState = actInWindow ? actor.animation : 'Idle';

            let baseX = actor.position[0];
            let baseZ = actor.position[1];
            let baseRotY = actor.rotationY;

            // Motion Path interpolation (Straight, Freehand Curve, Multi-Turn)
            const mp = resolveActorMotionPath(actor);
            if (mp) {
              const mpSig = JSON.stringify({
                m: mp.mode,
                c: mp.cornerStyle || 'rounded',
                p: mp.points,
              });
              if (mpSig !== entry.cachedPathSig) {
                entry.cachedPathSig = mpSig;
                entry.cachedCurve = buildMotionCurve(mp);
                entry.cachedCurveLength = entry.cachedCurve ? entry.cachedCurve.getLength() : 0;
              }
            } else {
              entry.cachedPathSig = '';
              entry.cachedCurve = null;
              entry.cachedCurveLength = 0;
            }

            if (mp && entry.cachedCurve && previewTimeline) {
              sampleMotionCurve(entry.cachedCurve, actProg, _pathPos, _pathTan);
              baseX = _pathPos.x;
              baseZ = _pathPos.z;
              if (entry.cachedCurveLength > 0.05) {
                baseRotY = Math.atan2(_pathTan.x, _pathTan.z);
                if (actInWindow && !travelAnims.includes(actor.animation)) {
                  activeAnim =
                    actor.actorType === 'vehicle'
                      ? actor.kind === 'helicopter' || actor.kind === 'airplane'
                        ? 'Fly in Sky'
                        : actor.kind === 'boat'
                          ? 'Sail on Water'
                          : 'Drive/Ride Forward'
                      : actor.actorType === 'animal'
                        ? actor.kind === 'bird'
                          ? 'Fly'
                          : actor.kind === 'fish'
                            ? 'Swim'
                            : 'Walk'
                        : 'Walk';
                }
              }
            }

            // Apply Entrance & Exit Effects (synced to timeline bar, previewed in real time & export)
            const isVisible = entry.transitionCtrl.apply({
              rigRoot: entry.rig.root,
              speechSprite: entry.rig.speechSprite,
              selectionRing: entry.rig.selectionRing,
              actor,
              sceneTime,
              sceneDuration: safeDur,
              isPlaying: playing,
              isScrubbing: scrubbing,
              isExporting: exportingNow,
              camera,
              baseX,
              baseZ,
              baseRotationY: baseRotY,
              baseScale: actor.scale,
            });

            entry.rig.selectionRing.visible =
              isVisible && !playing && !exportingNow && actor.id === propsRef.current.selectedActorId;

            const propStart = actor.propStartTime ?? 0;
            const propEnd = actor.propEndTime ?? safeDur;
            const propInWindow = !previewTimeline || (sceneTime >= propStart && sceneTime <= propEnd);
            if (entry.kindTag === 'character') {
              if (entry.rig.leftItemObj) entry.rig.leftItemObj.visible = propInWindow;
              if (entry.rig.rightItemObj) entry.rig.rightItemObj.visible = propInWindow;
            }

            const hasDialogue = actor.dialogue.trim().length > 0;
            const voiceStart = actor.voiceStartTime ?? 0;
            const voiceEnd = actor.voiceEndTime ?? safeDur;
            const voiceInWindow = !previewTimeline || (sceneTime >= voiceStart && sceneTime <= voiceEnd);
            entry.rig.speechSprite.visible = isVisible && hasDialogue && voiceInWindow;

            if (!isVisible) return;

            const autoLipSync = playing && hasDialogue && voiceInWindow;

            if (entry.kindTag === 'character') {
              updateCharacterAnimation(
                entry.rig,
                activeAnim,
                actor.expression,
                animClockTime,
                delta,
                lipAmp,
                autoLipSync,
                isScrubMode
              );
            } else if (entry.kindTag === 'animal') {
              updateAnimalAnimation(
                entry.rig,
                activeAnim,
                actor.expression,
                animClockTime,
                delta,
                lipAmp,
                autoLipSync
              );
            } else {
              updatePropOrCustomAnimation(
                entry.rig,
                activeAnim,
                animClockTime,
                delta,
                lipAmp,
                autoLipSync
              );
            }
          });

          renderer.render(scene, camera);
        }

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      };

      if (isSoftwareGl) {
        renderer.render(scene, camera);
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        controls.removeEventListener('start', onControlStart);
        controls.dispose();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown, { capture: true });
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

        if (threeRef.current?.envHandle) {
          scene.remove(threeRef.current.envHandle.group);
          disposeEnvironment(threeRef.current.envHandle);
        }
        rigs.forEach((entry) => {
          entry.transitionCtrl.restoreMaterials();
          scene.remove(entry.rig.root);
          if (entry.kindTag === 'character') disposeCharacterRig(entry.rig);
          else if (entry.kindTag === 'animal') disposeAnimalRig(entry.rig);
          else disposePropOrCustomRig(entry.rig);
        });
        rigs.clear();
        scene.remove(motionPathViz.group);
        motionPathViz.dispose();
        envTex.dispose();
        renderer.dispose();
        syncSizeRef.current = null;
        threeRef.current = null;
      };
    }, []);

    // 2. Sync Environment & Lighting Mode
    useEffect(() => {
      const inst = threeRef.current;
      if (!inst) return;

      if (inst.currentEnvId !== environment) {
        if (inst.envHandle) {
          inst.scene.remove(inst.envHandle.group);
          disposeEnvironment(inst.envHandle);
        }
        const nextEnv = buildEnvironment(environment, inst.maxAnisotropy);
        inst.scene.add(nextEnv.group);
        inst.envHandle = nextEnv;
        inst.currentEnvId = environment;
      }

      if (inst.envHandle) {
        applyLightingMode(
          inst.scene,
          inst.hemiLight,
          inst.keyLight,
          inst.rimLight,
          inst.envHandle,
          lighting
        );
      }
    }, [environment, lighting]);

    // 3. Sync Camera Pose Transitions
    useEffect(() => {
      const inst = threeRef.current;
      if (!inst || !cameraPoseTrigger) return;
      _camGoalPos.set(...cameraPoseTrigger.pose.position);
      _camGoalTarget.set(...cameraPoseTrigger.pose.target);
      inst.camTransitionActive = true;
    }, [cameraPoseTrigger]);

    // 4. Sync Actors & Walk Path Helper Line
    useEffect(() => {
      const inst = threeRef.current;
      if (!inst) return;

      const activeIds = new Set(actors.map((a) => a.id));

      inst.rigs.forEach((entry, id) => {
        const match = actors.find((a) => a.id === id);
        if (
          !activeIds.has(id) ||
          (match &&
            (match.actorType !== entry.actor.actorType || match.kind !== entry.actor.kind))
        ) {
          inst.scene.remove(entry.rig.root);
          entry.transitionCtrl.restoreMaterials();
          if (entry.kindTag === 'character') disposeCharacterRig(entry.rig);
          else if (entry.kindTag === 'animal') disposeAnimalRig(entry.rig);
          else disposePropOrCustomRig(entry.rig);
          inst.rigs.delete(id);
        }
      });

      for (const actor of actors) {
        let entry = inst.rigs.get(actor.id);
        if (!entry) {
          const transitionCtrl = new ActorTransitionController();
          if (actor.actorType === 'character') {
            const safeKind = (actor.kind === 'twins' ? 'boy' : actor.kind) as CharacterKind;
            const rig = createCharacterRig(safeKind, actor.accentColor);
            rig.root.userData.actorId = actor.id;
            inst.scene.add(rig.root);
            entry = {
              kindTag: 'character',
              rig,
              actor,
              transitionCtrl,
              cachedPathSig: '',
              cachedCurve: null,
              cachedCurveLength: 0,
            };
          } else if (actor.actorType === 'animal') {
            const rig = createAnimalRig(actor.kind as AnimalKind, actor.accentColor);
            rig.root.userData.actorId = actor.id;
            inst.scene.add(rig.root);
            entry = {
              kindTag: 'animal',
              rig,
              actor,
              transitionCtrl,
              cachedPathSig: '',
              cachedCurve: null,
              cachedCurveLength: 0,
            };
          } else if (actor.actorType === 'vehicle') {
            const rig = createVehicleRig(actor.kind as VehicleKind, actor.accentColor);
            rig.root.userData.actorId = actor.id;
            inst.scene.add(rig.root);
            entry = {
              kindTag: 'propOrCustom',
              rig,
              actor,
              transitionCtrl,
              cachedPathSig: '',
              cachedCurve: null,
              cachedCurveLength: 0,
            };
          } else if (actor.actorType === 'custom' && actor.customBlueprint) {
            const rig = createCustomModelRig(actor.customBlueprint);
            rig.root.userData.actorId = actor.id;
            inst.scene.add(rig.root);
            entry = {
              kindTag: 'propOrCustom',
              rig,
              actor,
              transitionCtrl,
              cachedPathSig: '',
              cachedCurve: null,
              cachedCurveLength: 0,
            };
          } else {
            const rig = createPropRig(actor.kind as PropKind, actor.accentColor);
            rig.root.userData.actorId = actor.id;
            inst.scene.add(rig.root);
            entry = {
              kindTag: 'propOrCustom',
              rig,
              actor,
              transitionCtrl,
              cachedPathSig: '',
              cachedCurve: null,
              cachedCurveLength: 0,
            };
          }
          inst.rigs.set(actor.id, entry);
        }

        entry.actor = actor;

        // When parked at t=0 in edit mode, keep actor positioned at its edit position
        if (!isPlaying && !isScrubbing && sceneProgress <= 0.001) {
          entry.rig.root.position.set(actor.position[0], 0, actor.position[1]);
          entry.rig.root.rotation.y = actor.rotationY;
          entry.rig.root.scale.setScalar(actor.scale);
        }
        entry.rig.selectionRing.visible =
          !isPlaying && !isExporting && actor.id === selectedActorId;

        if (entry.kindTag === 'character') {
          updateCharacterAccentColor(entry.rig, actor.accentColor);
          updateSpeechBubble(entry.rig, actor.dialogue);
          syncCharacterHeldItems(entry.rig, actor.heldItemLeft, actor.heldItemRight);
        } else if (entry.kindTag === 'animal') {
          updateAnimalAccentColor(entry.rig, actor.accentColor);
          updateAnimalSpeechBubble(entry.rig, actor.dialogue);
        } else {
          if (actor.actorType === 'vehicle') {
            updatePropAccentColor(entry.rig, actor.accentColor);
          }
          updatePropSpeechBubble(entry.rig, actor.dialogue);
        }
      }

      // Glowing 3D Motion Path Visualizer (visible in edit mode, hidden during playback & video export)
      const selActor = actors.find((a) => a.id === selectedActorId) || null;
      const selMp = selActor ? resolveActorMotionPath(selActor) : null;
      if (motionPathEditMode !== 'drawFreehand') {
        inst.motionPathViz.sync(selMp, !isPlaying && !isExporting && Boolean(selMp?.enabled));
      }
    }, [actors, selectedActorId, isPlaying, isScrubbing, isExporting, sceneProgress, motionPathEditMode]);

    // 5. Responsive Aspect Ratio Frame (16:9 / 9:16 / 1:1)
    const [boxSize, setBoxSize] = useState<{ width: number; height: number }>({
      width: 640,
      height: 360,
    });

    useEffect(() => {
      const outer = outerStageRef.current;
      if (!outer) return;

      const recompute = () => {
        const availW = Math.max(180, outer.clientWidth - 16);
        const availH = Math.max(244, outer.clientHeight - 16);
        const targetRatio =
          aspectRatio === '16:9' ? 16 / 9 : aspectRatio === '9:16' ? 9 / 16 : 1;

        let w = availW;
        let h = w / targetRatio;
        if (h > availH) {
          h = availH;
          w = h * targetRatio;
        }
        setBoxSize({ width: Math.floor(w), height: Math.floor(h) });
      };

      recompute();
      const ro = new ResizeObserver(recompute);
      ro.observe(outer);
      return () => ro.disconnect();
    }, [aspectRatio]);

    return (
      <div
        ref={outerStageRef}
        className="relative flex-1 min-h-[max(260px,42dvh)] w-full flex items-center justify-center bg-[#080A0F] overflow-hidden select-none"
      >
        <div
          ref={frameContainerRef}
          style={{ width: boxSize.width, height: boxSize.height }}
          className={`relative rounded-xl overflow-hidden border shadow-2xl bg-[#0B0E14] ${
            motionPathEditMode !== 'idle'
              ? 'border-amber-400 cursor-crosshair'
              : 'border-white/10'
          }`}
        >
          <div ref={canvasMountRef} className="w-full h-full" />

          {motionPathEditMode !== 'idle' && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-[#0B0E14]/90 border border-amber-500/50 text-xs font-medium text-amber-300 whitespace-nowrap">
              {motionPathEditMode === 'pickEnd'
                ? 'Tap 3D ground to set End Point (B)'
                : motionPathEditMode === 'drawFreehand'
                  ? 'Drag with mouse or finger on 3D ground to draw path'
                  : 'Tap 3D ground to add corner waypoints'}
            </div>
          )}

          {contextLost && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0E14]/95 text-center p-6">
              <p className="text-sm font-medium text-slate-200">
                3D graphics context paused
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Restoring WebGL rendering surface...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
);
