import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import shootRifleUrl from './assets/models/Shoot Rifle.fbx?url';
import soldierUrl from './assets/models/soldier.glb?url';
import { movePositionWithSlide, PLAYABLE_CLAMP_PADDING } from './scene.js';

const MODEL_HEIGHT = 1.95;
const MODEL_YAW_OFFSET = 0;
const STATIC_COMBAT_POSE_FRACTION = 0.62;
const PLAYER_COLLISION_SIZE = new THREE.Vector3(0.7, 2.0, 0.7);
// ─── Bone name patterns (supports Mixamo, Rigify, custom rigs) ───────────────
const BONE_SEARCH = {
  hips:          n => /hips|pelvis|hip$/.test(n),
  spine:         n => n.includes('spine') && !/spine[123]|spine_0[123]/.test(n),
  spine1:        n => /spine1|spine_01|spine01/.test(n),
  spine2:        n => /spine2|spine_02|spine02/.test(n),
  neck:          n => n.includes('neck'),
  head:          n => n === 'head' || n.endsWith('_head'),
  leftUpperArm:  n => (n.includes('left') || /^l[_\s]/.test(n)) && (n.includes('arm') || n.includes('upperarm') || n.includes('shoulder')),
  rightUpperArm: n => (n.includes('right') || /^r[_\s]/.test(n)) && (n.includes('arm') || n.includes('upperarm') || n.includes('shoulder')),
  leftForeArm:   n => (n.includes('left') || /^l[_\s]/.test(n)) && (n.includes('forearm') || n.includes('elbow') || n.includes('lowerarm')),
  rightForeArm:  n => (n.includes('right') || /^r[_\s]/.test(n)) && (n.includes('forearm') || n.includes('elbow') || n.includes('lowerarm')),
  leftHand:      n => (n.includes('left') || /^l[_\s]/.test(n)) && n.includes('hand') && !n.includes('finger') && !n.includes('thumb'),
  rightHand:     n => (n.includes('right') || /^r[_\s]/.test(n)) && n.includes('hand') && !n.includes('finger') && !n.includes('thumb'),
  leftUpLeg:     n => (n.includes('left') || /^l[_\s]/.test(n)) && (n.includes('upleg') || n.includes('thigh') || n.includes('upperleg')),
  rightUpLeg:    n => (n.includes('right') || /^r[_\s]/.test(n)) && (n.includes('upleg') || n.includes('thigh') || n.includes('upperleg')),
  leftLeg:       n => (n.includes('left') || /^l[_\s]/.test(n)) && (n.includes('shin') || n.includes('knee') || (n.includes('leg') && !n.includes('upleg') && !n.includes('thigh') && !n.includes('upper'))),
  rightLeg:      n => (n.includes('right') || /^r[_\s]/.test(n)) && (n.includes('shin') || n.includes('knee') || (n.includes('leg') && !n.includes('upleg') && !n.includes('thigh') && !n.includes('upper'))),
};

function findBones(root) {
  const bones = {};
  const found = new Set();
  root.traverse(obj => {
    if (!obj.name) return;
    const n = obj.name.toLowerCase().replace(/mixamorig[:_]/gi, '');
    for (const [key, test] of Object.entries(BONE_SEARCH)) {
      if (!found.has(key) && test(n)) {
        bones[key] = obj;
        found.add(key);
      }
    }
  });
  return bones;
}

// ─── Smooth bone rotation helper ──────────────────────────────────────────────
function lerpBone(bone, dx, dy, dz, speed) {
  if (!bone || !bone._tpose) return;
  bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, bone._tpose.x + dx, speed);
  bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, bone._tpose.y + dy, speed);
  bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, bone._tpose.z + dz, speed);
}

function fitModelToPlayer(model) {
  model.rotation.y += MODEL_YAW_OFFSET;
  model.updateMatrixWorld(true);

  const sourceBox = new THREE.Box3().setFromObject(model);
  if (sourceBox.isEmpty()) return;

  const size = sourceBox.getSize(new THREE.Vector3());
  const scale = MODEL_HEIGHT / Math.max(size.y, 0.001);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fittedBox.min.y;
  model.updateMatrixWorld(true);
}

function placeDefaultMuzzle(anchor, muzzlePt) {
  anchor.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(anchor);
  if (box.isEmpty()) {
    muzzlePt.position.set(0.30, 1.25, 0.88);
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  muzzlePt.position.set(
    center.x + size.x * 0.18,
    box.min.y + size.y * 0.62,
    box.max.z - size.z * 0.04
  );
}

function configureModelForScene(model) {
  fitModelToPlayer(model);
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      // Imported character meshes tend to self-shadow too aggressively in this scene.
      child.receiveShadow = false;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(material => {
        if (!material) return;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
        }
        if (material.emissiveMap) {
          material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        }
        if (material.color) {
          material.color.multiplyScalar(material.map ? 1.03 : 1.12);
        }
        if ('roughness' in material && typeof material.roughness === 'number') {
          material.roughness = Math.min(material.roughness, material.map ? 0.88 : 0.8);
        }
        if ('metalness' in material && typeof material.metalness === 'number') {
          material.metalness *= material.map ? 0.38 : 0.55;
        }
        if ('aoMapIntensity' in material && typeof material.aoMapIntensity === 'number') {
          material.aoMapIntensity = Math.min(material.aoMapIntensity, 0.82);
        }
        if (material.color) {
          if ('emissive' in material && material.emissive) {
            material.emissive.copy(material.color).multiplyScalar(material.map ? 0.022 : 0.05);
          }
        } else if ('emissive' in material && material.emissive) {
          material.emissive.addScalar(0.03);
        }
        if ('emissiveIntensity' in material && typeof material.emissiveIntensity === 'number') {
          material.emissiveIntensity = Math.max(material.emissiveIntensity, material.map ? 0.45 : 0.72);
        }
        material.needsUpdate = true;
      });
    }
  });
}

// ─── Procedural fallback mesh ─────────────────────────────────────────────────
function buildFallback() {
  const g   = new THREE.Group();
  const bMat = new THREE.MeshPhongMaterial({ color: 0x3a4a2a });
  const hMat = new THREE.MeshPhongMaterial({ color: 0xc8a87a });
  const eMat = new THREE.MeshPhongMaterial({ color: 0x2a3525 });
  const gMat = new THREE.MeshPhongMaterial({ color: 0x2a2a2a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.28), bMat);
  torso.position.y = 1.15; torso.castShadow = true; g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.28, 0.28), hMat);
  head.position.y = 1.72; head.castShadow = true; g.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 8), eMat);
  helmet.scale.y = 0.8; helmet.position.y = 1.83; g.add(helmet);

  const lArm = new THREE.Group(); lArm.position.set(-0.35, 1.38, 0); g.add(lArm);
  const rArm = new THREE.Group(); rArm.position.set( 0.35, 1.38, 0); g.add(rArm);
  [lArm, rArm].forEach(a => {
    const u = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.30, 0.16), bMat);
    u.position.y = -0.15; a.add(u);
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.14), bMat);
    f.position.y = -0.44; a.add(f);
    a.rotation.x = -0.6;
  });

  const lLeg = new THREE.Group(); lLeg.position.set(-0.14, 0.85, 0); g.add(lLeg);
  const rLeg = new THREE.Group(); rLeg.position.set( 0.14, 0.85, 0); g.add(rLeg);
  [lLeg, rLeg].forEach(l => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.50, 0.20), bMat);
    m.position.y = -0.25; m.castShadow = true; l.add(m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.26), new THREE.MeshPhongMaterial({ color: 0x1a1a1a }));
    b.position.set(0, -0.55, 0.03); l.add(b);
  });

  // Gun
  const gun = new THREE.Group(); gun.position.set(0.30, 1.25, 0.28); g.add(gun);
  gun.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.48), gMat));
  const brl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 8), gMat);
  brl.rotation.x = Math.PI / 2; brl.position.z = 0.40; gun.add(brl);
  const stk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.18), gMat);
  stk.position.set(0, -0.02, -0.32); gun.add(stk);

  return { group: g, lArm, rArm, lLeg, rLeg };
}

// ═══════════════════════════════════════════════════════════════════════════════
export function createPlayer(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const footRing = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.64, 48),
    new THREE.MeshBasicMaterial({
      color: 0x2aff66,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  footRing.rotation.x = -Math.PI / 2;
  footRing.position.y = 0.035;
  group.add(footRing);

  const visual = new THREE.Group();
  group.add(visual);

  // Follow light
  const pointLight = new THREE.PointLight(0xffd8b0, 1.45, 15, 1.9);
  pointLight.position.set(0, 3.5, 0.65);
  group.add(pointLight);

  // State
  let hp = 100;
  const SPEED   = 7.0;
  let walkTime   = 0;
  let idleTime   = 0;
  let shootTimer = 0;  // > 0 while shooting anim plays
  let recoilKick  = 0;


  // Model & bones
  let mixer       = null;
  let clipActions = {};   // named AnimationAction map if GLB has clips
  let currentClip = null;
  let bones       = {};
  let loadedModel = null;
  let rootMotionNode = null;
  let rootMotionBase = null;
  let wasMoveShootClipActive = false;
  let lastIsMoving = false;

  // Muzzle reference (parented to right hand bone when loaded, else static)
  const muzzlePt = new THREE.Object3D();
  muzzlePt.position.set(0.30, 1.25, 0.88);
  visual.add(muzzlePt);

  // ── Fallback procedural mesh ───────────────────────────────────────────────
  const fb = buildFallback();
  visual.add(fb.group);

  function bindModel(model) {
    configureModelForScene(model);
    visual.add(model);
    loadedModel = model;

    bones = findBones(model);
    console.log('[Player] Bones found:', Object.keys(bones));

    for (const bone of Object.values(bones)) {
      bone._tpose = bone.rotation.clone();
      bone._basePosition = bone.position.clone();
    }

    rootMotionNode = bones.hips || model;
    rootMotionBase = rootMotionNode.position.clone();

    if (bones.rightHand) {
      visual.remove(muzzlePt);
      const handMuzzle = new THREE.Object3D();
      handMuzzle.name = 'muzzle';
      handMuzzle.position.set(0.05, 0.03, 0.42);
      bones.rightHand.add(handMuzzle);
      player._handMuzzle = handMuzzle;
    } else {
      player._handMuzzle = null;
      if (!muzzlePt.parent) visual.add(muzzlePt);
      placeDefaultMuzzle(model, muzzlePt);
    }
  }

  function registerClipAction(clip, action, aliases = []) {
    clipActions[clip.name.toLowerCase()] = action;
    aliases.forEach(alias => { clipActions[alias] = action; });
  }

  function setupAnimations(model, animations, preferredAliases = []) {
    if (!animations || animations.length === 0) return;

    mixer = new THREE.AnimationMixer(model);
    clipActions = {};
    currentClip = null;

    animations.forEach((clip, index) => {
      const action = mixer.clipAction(clip);
      const name = clip.name.toLowerCase();
      const aliases = [];

      if (index === 0) aliases.push(...preferredAliases);
      if (/idle|breath|stand/.test(name)) aliases.push('idle', 'breathing', 'standing');
      if (/run|walk|move|jog/.test(name)) aliases.push('run', 'walk', 'move');
      if (/shoot|fire|attack|rifle/.test(name)) aliases.push('shoot', 'fire', 'attack');

      registerClipAction(clip, action, aliases);
    });

    console.log('[Player] Animation clips:', animations.map(a => a.name));
  }

  function loadGlbFallback() {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      soldierUrl,
      (gltf) => {
        visual.remove(fb.group);
        bindModel(gltf.scene);
        setupAnimations(gltf.scene, gltf.animations);
        playClip('idle') || playClip('breathing') || playClip('standing');
        console.log('[Player] GLB fallback loaded successfully.');
      },
      (xhr) => {
        if (xhr.total) console.log(`[Player] GLB loading: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
      },
      (err) => {
        console.warn('[Player] GLB load failed, keeping fallback mesh.', err.message || err);
      }
    );
  }

  // ── Load primary animated FBX, then fall back to GLB ─────────────────────
  const fbxLoader = new FBXLoader();
  fbxLoader.load(
    shootRifleUrl,
    (fbx) => {
      visual.remove(fb.group); // hide fallback
      bindModel(fbx);
      setupAnimations(fbx, fbx.animations, ['shoot', 'fire', 'attack']);
      console.log('[Player] FBX model loaded successfully.');
    },
    (xhr) => {
      if (xhr.total) console.log(`[Player] FBX loading: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
    },
    (err) => {
      console.warn('[Player] FBX load failed, falling back to GLB.', err.message || err);
      loadGlbFallback();
    }
  );

  // ── Animation clip helpers (for embedded clips) ───────────────────────────
  function findClipAction(name) {
    return Object.entries(clipActions).find(([k]) => k.includes(name))?.[1] ?? null;
  }

  function playClip(name, loop = true, fadeDuration = 0.3) {
    const action = findClipAction(name);
    if (!action) return false;
    if (currentClip === action) {
      // Resume a held shooting pose when movement needs the same clip to play.
      action.enabled = true;
      action.paused = false;
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.play();
      return true;
    }
    Object.values(clipActions).forEach(a => { if (a !== action) a.fadeOut(fadeDuration); });
    action.enabled = true;
    action.paused = false;
    action.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1).fadeIn(fadeDuration).play();
    if (!loop) action.clampWhenFinished = true;
    currentClip = action;
    return true;
  }

  function holdClipPose(name, fraction = STATIC_COMBAT_POSE_FRACTION, fadeDuration = 0.12) {
    const action = findClipAction(name);
    if (!action) return false;
    if (currentClip !== action) {
      Object.values(clipActions).forEach(a => { if (a !== action) a.fadeOut(fadeDuration); });
      action.enabled = true;
      action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fadeDuration).play();
      currentClip = action;
    }
    action.enabled = true;
    action.paused = true;
    action.clampWhenFinished = true;
    action.time = action.getClip().duration * fraction;
    return true;
  }

  function stopCurrentClip(fadeDuration = 0.15) {
    if (!currentClip) return;
    const uniqueActions = [...new Set(Object.values(clipActions))];
    uniqueActions.forEach(action => action.fadeOut(fadeDuration));
    currentClip = null;
  }

  function lockRootMotion() {
    if (!rootMotionNode || !rootMotionBase) return;
    rootMotionNode.position.copy(rootMotionBase);
    if (bones.spine?._basePosition) {
      bones.spine.position.copy(bones.spine._basePosition);
    }
    if (bones.spine1?._basePosition) {
      bones.spine1.position.copy(bones.spine1._basePosition);
    }
  }

  function getRigMuzzleWorldPosition() {
    if (!bones.rightHand) return null;

    const rightHandPos = new THREE.Vector3();
    bones.rightHand.getWorldPosition(rightHandPos);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(group.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const muzzlePos = rightHandPos.clone();

    if (bones.leftHand) {
      const leftHandPos = new THREE.Vector3();
      bones.leftHand.getWorldPosition(leftHandPos);

      // Use one consistent combat pose offset so the muzzle stays aligned.
      muzzlePos.lerp(leftHandPos, 0.18);
      muzzlePos.addScaledVector(right, 0.08);
      muzzlePos.addScaledVector(up, 0.14);
      muzzlePos.addScaledVector(forward, 0.60);
    } else {
      muzzlePos.addScaledVector(right, 0.10);
      muzzlePos.addScaledVector(up, 0.12);
      muzzlePos.addScaledVector(forward, 0.56);
    }

    return muzzlePos;
  }

  function hasBones() {
    return Object.keys(bones).length > 0;
  }

  function hasStaticModel() {
    return !!loadedModel && !hasBones();
  }

  function lerpVisualPose(rx, ry, rz, px, py, pz, speed) {
    visual.rotation.x = THREE.MathUtils.lerp(visual.rotation.x, rx, speed);
    visual.rotation.y = THREE.MathUtils.lerp(visual.rotation.y, MODEL_YAW_OFFSET + ry, speed);
    visual.rotation.z = THREE.MathUtils.lerp(visual.rotation.z, rz, speed);
    visual.position.x = THREE.MathUtils.lerp(visual.position.x, px, speed);
    visual.position.y = THREE.MathUtils.lerp(visual.position.y, py, speed);
    visual.position.z = THREE.MathUtils.lerp(visual.position.z, pz, speed);
  }

  function poseCombatHold() {
    if (!hasBones()) {
      if (!loadedModel) {
        fb.rArm.rotation.x = THREE.MathUtils.lerp(fb.rArm.rotation.x, -1.0, 0.30);
        fb.lArm.rotation.x = THREE.MathUtils.lerp(fb.lArm.rotation.x, -0.8, 0.30);
      } else {
        lerpVisualPose(-0.02, 0.02, -0.12, 0.04, 0.01, -0.06, 0.24);
      }
      return;
    }
    lerpBone(bones.rightUpperArm, -1.10, 0.10, -0.42, 0.26);
    lerpBone(bones.rightForeArm,  -0.95, 0.00, -0.14, 0.26);
    lerpBone(bones.rightHand,     -0.18, 0.00,  0.12, 0.26);
    lerpBone(bones.leftUpperArm,  -0.82, -0.06, 0.42, 0.26);
    lerpBone(bones.leftForeArm,   -0.62, 0.00,  0.10, 0.26);
    lerpBone(bones.leftHand,       0.08, 0.00, -0.08, 0.26);
    lerpBone(bones.spine,          0.12, 0.00,  0.00, 0.22);
    lerpBone(bones.spine1,         0.08, 0.00,  0.00, 0.22);
    lerpBone(bones.neck,          -0.03, 0.00,  0.00, 0.18);
  }

  // ── Procedural bone animations ────────────────────────────────────────────

  // Idle: default standing pose stays in an aiming-ready stance.
  function animIdle(dt) {
    idleTime += dt * 1.5;
    if (!hasBones()) {
      if (!loadedModel) {
        const breathe = Math.sin(idleTime) * 0.04;
        fb.rArm.rotation.x = THREE.MathUtils.lerp(fb.rArm.rotation.x, -1.0 + breathe, 0.18);
        fb.lArm.rotation.x = THREE.MathUtils.lerp(fb.lArm.rotation.x, -0.82 - breathe * 0.6, 0.18);
      } else {
        const breathe = Math.sin(idleTime) * 0.5 + 0.5;
        lerpVisualPose(
          -0.02 - recoilKick * 0.12,
          0.02,
          -0.12,
          0.04,
          0.01 + breathe * 0.02,
          -0.06 - recoilKick * 0.05,
          0.16
        );
      }
      return;
    }
    const breathe = Math.sin(idleTime * 2.0) * 0.01;
    lerpBone(bones.rightUpperArm, -1.06 + breathe, 0.10, -0.42, 0.18);
    lerpBone(bones.rightForeArm,  -0.94,           0.00, -0.14, 0.18);
    lerpBone(bones.rightHand,     -0.16,           0.00,  0.10, 0.18);
    lerpBone(bones.leftUpperArm,  -0.80,          -0.06,  0.42, 0.18);
    lerpBone(bones.leftForeArm,   -0.60,           0.00,  0.10, 0.18);
    lerpBone(bones.leftHand,       0.08,           0.00, -0.08, 0.18);
    lerpBone(bones.spine,          0.11 + breathe, 0.00,  0.00, 0.16);
    lerpBone(bones.spine1,         0.08,           0.00,  0.00, 0.16);
    lerpBone(bones.neck,          -0.02,           0.00,  0.00, 0.14);
  }

  // Run: leg/arm swing
  function animRun(dt) {
    walkTime += dt * 9;
    if (!hasBones()) {
      if (!loadedModel) {
        // Fallback
        const sw = Math.sin(walkTime) * 0.5;
        fb.lLeg.rotation.x = THREE.MathUtils.lerp(fb.lLeg.rotation.x,  sw, 0.2);
        fb.rLeg.rotation.x = THREE.MathUtils.lerp(fb.rLeg.rotation.x, -sw, 0.2);
        fb.lArm.rotation.x = THREE.MathUtils.lerp(fb.lArm.rotation.x, -0.6 + Math.sin(walkTime + Math.PI) * 0.2, 0.2);
        fb.rArm.rotation.x = THREE.MathUtils.lerp(fb.rArm.rotation.x, -0.6 + Math.sin(walkTime) * 0.2, 0.2);
      } else {
        const sway = Math.sin(walkTime);
        const sway2 = Math.cos(walkTime * 0.5);
        lerpVisualPose(
          0.12 - recoilKick * 0.08,
          sway * 0.03,
          sway * 0.06,
          sway * 0.04,
          0.02,
          sway2 * 0.02 - recoilKick * 0.05,
          0.16
        );
      }
      return;
    }
    const leg  = Math.sin(walkTime) * 0.65;
    const arm  = Math.sin(walkTime) * 0.40;
    lerpBone(bones.leftUpLeg,     -leg, 0, 0, 0.25);
    lerpBone(bones.rightUpLeg,     leg, 0, 0, 0.25);
    lerpBone(bones.leftLeg,   Math.max(0,  leg) * 0.8, 0, 0, 0.25);
    lerpBone(bones.rightLeg,  Math.max(0, -leg) * 0.8, 0, 0, 0.25);
    // Arms swing opposite to legs
    lerpBone(bones.leftUpperArm,  0.3 + arm,  0,  1.2, 0.18);
    lerpBone(bones.rightUpperArm, 0.3 - arm,  0, -1.2, 0.18);
    // Torso lean forward
    lerpBone(bones.spine,  0.18, 0, 0, 0.10);
    lerpBone(bones.spine1, 0.10, 0, 0, 0.10);
    // Body bob
    group.position.y = Math.abs(Math.sin(walkTime * 0.5)) * 0.07;
  }

  // Shoot: raise weapon forward (aiming pose)
  function animShoot(dt, isMoving = false) {
    if (!hasBones()) {
      if (!loadedModel) {
        fb.rArm.rotation.x = THREE.MathUtils.lerp(fb.rArm.rotation.x, -1.0, 0.35);
        fb.lArm.rotation.x = THREE.MathUtils.lerp(fb.lArm.rotation.x, -0.8, 0.35);
      } else {
        lerpVisualPose(
          (isMoving ? 0.08 : -0.02) - recoilKick * 0.24,
          0.02,
          -0.12,
          0.04,
          isMoving ? 0.03 : 0.01,
          -0.06 - recoilKick * 0.08,
          isMoving ? 0.20 : 0.28
        );
      }
      return;
    }
    if (isMoving) {
      // Blend toward a supported moving-fire pose.
      lerpBone(bones.rightUpperArm, -0.75, 0.05, -0.55, 0.24);
      lerpBone(bones.rightForeArm,  -0.70, 0.00, -0.12, 0.24);
      lerpBone(bones.leftUpperArm,  -0.55, 0.04,  0.60, 0.24);
      lerpBone(bones.leftForeArm,   -0.40, 0.00,  0.05, 0.24);
      lerpBone(bones.spine,          0.10, 0.00,  0.00, 0.20);
      lerpBone(bones.spine1,         0.08, 0.00,  0.00, 0.20);
    } else {
      // Stationary fire should clearly raise the rifle instead of relaxing toward idle.
      const breathe = Math.sin(idleTime * 2.0) * 0.01;
      lerpBone(bones.rightUpperArm, -1.10 + breathe, 0.10, -0.42, 0.26);
      lerpBone(bones.rightForeArm,  -0.95,           0.00, -0.14, 0.26);
      lerpBone(bones.rightHand,     -0.18,           0.00,  0.12, 0.26);
      lerpBone(bones.leftUpperArm,  -0.82,          -0.06,  0.42, 0.26);
      lerpBone(bones.leftForeArm,   -0.62,           0.00,  0.10, 0.26);
      lerpBone(bones.leftHand,       0.08,           0.00, -0.08, 0.26);
      lerpBone(bones.spine,          0.12,           0.00,  0.00, 0.22);
      lerpBone(bones.spine1,         0.08,           0.00,  0.00, 0.22);
      lerpBone(bones.neck,          -0.03,           0.00,  0.00, 0.18);
    }
  }

  // ── Main update ────────────────────────────────────────────────────────────
  function update(dt, keys, mouseAngle, obstacles) {
    if (hp <= 0) return;

    // Movement
    const moveDir = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp'])    moveDir.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown'])  moveDir.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft'])  moveDir.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveDir.x += 1;
    const isMoving = moveDir.lengthSq() > 0;
    lastIsMoving = isMoving;
    if (isMoving) {
      moveDir.normalize();
    }

    const newPos = group.position.clone().addScaledVector(moveDir, SPEED * dt);
    const delta = newPos.sub(group.position);
    const slidPos = movePositionWithSlide(
      group.position,
      delta,
      PLAYER_COLLISION_SIZE,
      obstacles,
      PLAYABLE_CLAMP_PADDING,
      1.0
    );
    group.position.x = slidPos.x;
    group.position.z = slidPos.z;

    group.rotation.y = mouseAngle;

    // AnimationMixer (embedded clips)
    let usedClip = false;
    let mixerDelta = dt;
    if (mixer) {
      usedClip = isMoving
        ? (
          playClip('shoot', true, 0.16) ||
          playClip('fire', true, 0.16) ||
          playClip('attack', true, 0.16)
        )
        : (
          holdClipPose('shoot', STATIC_COMBAT_POSE_FRACTION, 0.10) ||
          holdClipPose('fire', STATIC_COMBAT_POSE_FRACTION, 0.10) ||
          holdClipPose('attack', STATIC_COMBAT_POSE_FRACTION, 0.10)
        );
      mixer.update(mixerDelta);
      if (!usedClip) {
        stopCurrentClip(0.10);
      } else {
        lockRootMotion();
        group.position.y = THREE.MathUtils.lerp(group.position.y, 0, 0.2);
      }
    }
    wasMoveShootClipActive = usedClip;

    // Procedural bone animations (supplement or replace mixer)
    if (!usedClip) {
      if (isMoving) {
        animShoot(dt, true);
      } else {
        poseCombatHold();
      }

      if (!isMoving) {
        group.position.y = THREE.MathUtils.lerp(group.position.y, 0, 0.2);
      }

      if (!hasStaticModel()) {
        lerpVisualPose(0, 0, 0, 0, 0, 0, 0.18);
      }
    }

    recoilKick = Math.max(0, recoilKick - dt * 8);
    if (shootTimer > 0) shootTimer -= dt;
  }

  // Trigger shooting animation (called from game.js on fire)
  function triggerShoot() {
    shootTimer = 0.35;
    recoilKick = 1;
  }

  function getPosition() { return group.position; }

  function getMuzzleWorldPosition() {
    const rigPos = getRigMuzzleWorldPosition();
    if (rigPos) {
      return rigPos;
    }

    if (player._handMuzzle) {
      const pos = new THREE.Vector3();
      player._handMuzzle.getWorldPosition(pos);
      return pos;
    }

    const pos = new THREE.Vector3();
    muzzlePt.getWorldPosition(pos);
    return pos;
  }

  function getAimDirection() {
    const dir = new THREE.Vector3(0, 0, 1);
    dir.applyQuaternion(group.quaternion);
    return dir;
  }

  function takeDamage(amount) { hp -= amount; return hp; }
  function getHP() { return hp; }

  function reset() {
    hp = 100;
    group.position.set(0, 0, 0);
    group.rotation.y = 0;
    visual.position.set(0, 0, 0);
    visual.rotation.set(0, MODEL_YAW_OFFSET, 0);
    walkTime = 0; idleTime = 0; shootTimer = 0; recoilKick = 0;
    if (mixer) mixer.stopAllAction();
    currentClip = null;
  }

  const player = {
    group, pointLight,
    update, triggerShoot,
    getPosition, getMuzzleWorldPosition, getAimDirection,
    takeDamage, getHP, reset,
    _handMuzzle: null,
  };
  return player;
}
