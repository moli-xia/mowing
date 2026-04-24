import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import sandTextureUrl from './assets/texture/sand_512.jpg?url';

export const PLAYABLE_HALF_SIZE = 54;
export const PLAYABLE_CLAMP_PADDING = 0.6;

const propLoader = new FBXLoader();
const propTemplateCache = new Map();
const MAJOR_PROP_DEFS = [
  {
    id: 'deadtree',
    url: '/assets/props/deadtree/tripo_convert_f5709c37-12bd-40b9-870d-54b9508a9759.fbx',
    targetHeight: 4.8,
    colliderSize: [2.6, 4.8, 2.6],
    accentGrass: true,
    baseSink: 0.28,
  },
  {
    id: 'desertcactus',
    url: '/assets/props/desertcactus/tripo_convert_04ca20c2-81f2-410f-97bd-dc58c11e6a10.fbx',
    targetHeight: 2.7,
    colliderSize: [1.8, 2.7, 1.8],
    accentGrass: false,
  },
  {
    id: 'rustycar',
    url: '/assets/props/rustycar/tripo_convert_ccdd0712-fe44-4b9d-8d72-71849508365e.fbx',
    targetHeight: 2.2,
    colliderSize: [4.8, 1.9, 2.6],
    accentGrass: true,
  },
  {
    id: 'tomb1',
    url: '/assets/props/tomb1/tripo_convert_eae3cd0f-8ca2-4c19-ab2f-6e0fab62e0d5.fbx',
    targetHeight: 2.1,
    colliderSize: [1.8, 2.1, 1.4],
    accentGrass: true,
  },
  {
    id: 'scarecrow',
    url: '/assets/props/scarecrow/tripo_convert_4da61348-7bba-44a2-94f1-36f39b68a118.fbx',
    targetHeight: 2.05,
    colliderSize: [1.6, 2.8, 1.6],
    accentGrass: true,
  },
];
const ACCENT_GRASS_DEF = {
  id: 'desertgrass',
  url: '/assets/props/desertgrass/tripo_convert_0673644a-0f0e-4099-988a-745da5180ba0.fbx',
  targetHeight: 0.85,
};
const EXTRA_PROP_DEFS = [
  {
    id: 'sandpile',
    url: '/assets/props/sandpile/tripo_convert_07ba1748-debe-4e29-828c-cbf0d1a82f99.fbx',
    targetHeight: 2.4,
    materialColor: 0xe6ab72,
    materialBrightness: 1.1,
  },
  {
    id: 'gravelpile',
    url: '/assets/props/gravelpile/tripo_convert_2c66fc22-ef63-499f-90f4-1f46382ab13d.fbx',
    targetHeight: 0.32,
  },
  {
    id: 'wheel',
    url: '/assets/props/wheel/tripo_convert_ff82775f-a169-4657-9e4e-1952c6eb2e5b.fbx',
    targetHeight: 0.95,
  },
  {
    id: 'sandstone',
    url: '/assets/props/sandstone/tripo_convert_e5a05193-f479-47cb-82de-838b32aee442.fbx',
    targetHeight: 1.6,
    materialColor: 0xc4a882,
    materialBrightness: 0.85,
  },
  {
    id: 'signpost',
    url: '/assets/props/signpost/tripo_convert_4e79bef5-dc6b-4b2a-b506-d60711b01cea.fbx',
    targetHeight: 2.2,
    materialColor: 0x8b7355,
    materialBrightness: 1.0,
  },
];

const PROP_BY_ID = new Map([
  ...MAJOR_PROP_DEFS.map(def => [def.id, def]),
  [ACCENT_GRASS_DEF.id, ACCENT_GRASS_DEF],
  ...EXTRA_PROP_DEFS.map(def => [def.id, def]),
]);

export function preloadAllProps(onProgress) {
  const allDefs = [
    ...MAJOR_PROP_DEFS,
    ACCENT_GRASS_DEF,
    ...EXTRA_PROP_DEFS,
  ];
  let loaded = 0;
  const total = allDefs.length;
  const promises = allDefs.map(def => {
    return getPropTemplate(def).then(() => {
      loaded++;
      if (onProgress) onProgress(loaded / total);
    });
  });
  return Promise.all(promises);
}

const OBSTACLE_VARIANTS = [
  {
    id: 'deadtree',
    weight: 6.4,
    footprintSize: [2.8, 5.2, 2.8],
    colliderParts: [
      { size: [0.95, 4.9, 0.95], offset: [0, 2.45, 0] },
      { size: [2.2, 0.85, 1.2], offset: [0, 0.42, 0] },
      { size: [1.2, 0.8, 2.2], offset: [0, 0.40, 0] },
    ],
  },
  {
    id: 'cactusCluster',
    weight: 1.6,
    footprintSize: [3.8, 3.0, 3.8],
    colliderParts: [
      { size: [1.0, 2.8, 1.0], offset: [0, 1.4, 0] },
      { size: [0.95, 2.1, 0.95], offset: [-0.9, 1.05, 0.45] },
      { size: [0.9, 1.9, 0.9], offset: [0.95, 0.95, -0.35] },
    ],
  },
  {
    id: 'rustycar',
    weight: 3.2,
    footprintSize: [5.6, 2.2, 3.2],
    colliderParts: [
      { size: [3.7, 1.45, 1.95], offset: [0, 0.72, 0] },
      { size: [1.35, 1.05, 1.7], offset: [0, 0.55, 1.18] },
      { size: [1.2, 0.95, 1.45], offset: [0, 0.50, -1.12] },
    ],
  },
  {
    id: 'tomb1',
    weight: 3.0,
    footprintSize: [2.2, 2.2, 1.8],
    colliderParts: [
      { size: [1.18, 0.95, 0.95], offset: [0, 0.48, 0] },
      { size: [0.92, 1.45, 0.62], offset: [0, 1.28, 0] },
    ],
  },
  {
    id: 'scarecrow',
    weight: 2.6,
    footprintSize: [1.9, 2.8, 1.9],
    colliderParts: [
      { size: [0.52, 2.3, 0.52], offset: [0, 1.15, 0] },
      { size: [1.55, 0.34, 0.36], offset: [0, 1.62, 0] },
      { size: [0.95, 0.72, 0.95], offset: [0, 0.38, 0] },
    ],
  },
  {
    id: 'wheelPile',
    weight: 1.8,
    footprintSize: [2.8, 1.8, 2.8],
    colliderParts: [
      { size: [1.9, 1.05, 1.9], offset: [0, 0.52, 0] },
      { size: [1.2, 0.82, 1.2], offset: [0, 1.18, 0] },
    ],
  },
  {
    id: 'sandstone',
    weight: 8.0,
    footprintSize: [2.4, 1.2, 2.0],
    colliderParts: [
      { size: [2.4, 1.2, 2.0], offset: [0, 0.6, 0] },
    ],
    baseSink: 0.35,
  },
  {
    id: 'signpost',
    weight: 2.5,
    footprintSize: [1.2, 2.8, 0.3],
    colliderParts: [
      { size: [0.25, 2.4, 0.25], offset: [-0.35, 1.4, 0] },
      { size: [1.2, 0.7, 0.2], offset: [0.15, 2.35, 0] },
    ],
    baseSink: 0.15,
  },
];

function cloneWithMaterials(root) {
  const cloned = root.clone(true);
  cloned.traverse(child => {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map(material => material?.clone ? material.clone() : material);
    } else if (child.material.clone) {
      child.material = child.material.clone();
    }
  });
  return cloned;
}

function applyMaterialTuning(root, materialColor, materialBrightness = 1) {
  if (!materialColor && materialBrightness === 1) return;

  const tint = materialColor ? new THREE.Color(materialColor) : null;
  root.traverse(child => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(material => {
      if (!material?.color) return;
      if (tint) {
        material.color.copy(tint);
      }
      if (materialBrightness !== 1) {
        material.color.multiplyScalar(materialBrightness);
      }
    });
  });
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function clampToPlayableBounds(position, padding = 0) {
  const limit = Math.max(0, PLAYABLE_HALF_SIZE - padding);
  position.x = THREE.MathUtils.clamp(position.x, -limit, limit);
  position.z = THREE.MathUtils.clamp(position.z, -limit, limit);
  return position;
}

function toCollisionSize(colliderSize) {
  if (colliderSize?.isVector3) return colliderSize;
  return new THREE.Vector3(colliderSize[0], colliderSize[1], colliderSize[2]);
}

export function collidesWithObstacles(position, colliderSize, obstacles, centerY = null) {
  const size = toCollisionSize(colliderSize);
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(position.x, centerY ?? size.y * 0.5, position.z),
    size
  );
  return obstacles.some(obs => box.intersectsBox(obs.bbox));
}

export function movePositionWithSlide(currentPos, delta, colliderSize, obstacles, padding = PLAYABLE_CLAMP_PADDING, centerY = null) {
  const size = toCollisionSize(colliderSize);
  const axesPrimary = Math.abs(delta.x) >= Math.abs(delta.z) ? ['x', 'z'] : ['z', 'x'];
  const axesSecondary = axesPrimary[0] === 'x' ? ['z', 'x'] : ['x', 'z'];

  const applyOrder = (order) => {
    const nextPos = currentPos.clone();
    order.forEach(axis => {
      if (Math.abs(delta[axis]) < 0.00001) return;
      const attempt = nextPos.clone();
      attempt[axis] += delta[axis];
      clampToPlayableBounds(attempt, padding);
      if (!collidesWithObstacles(attempt, size, obstacles, centerY)) {
        nextPos[axis] = attempt[axis];
      }
    });
    return nextPos;
  };

  const primary = applyOrder(axesPrimary);
  const secondary = applyOrder(axesSecondary);
  return primary.distanceToSquared(currentPos) >= secondary.distanceToSquared(currentPos) ? primary : secondary;
}

function chooseWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function normalizePropModel(model, targetHeight) {
  model.updateMatrixWorld(true);

  const sourceBox = new THREE.Box3().setFromObject(model);
  if (!sourceBox.isEmpty()) {
    const size = sourceBox.getSize(new THREE.Vector3());
    const scale = targetHeight / Math.max(size.y, 0.001);
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
  }

  const fittedBox = new THREE.Box3().setFromObject(model);
  if (!fittedBox.isEmpty()) {
    const center = fittedBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= fittedBox.min.y;
  }

  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    }
  });

  model.updateMatrixWorld(true);
  return model;
}

function getPropTemplate(def) {
  if (!propTemplateCache.has(def.id)) {
    propTemplateCache.set(def.id, new Promise((resolve, reject) => {
      propLoader.load(
        def.url,
        (fbx) => resolve(normalizePropModel(fbx, def.targetHeight)),
        undefined,
        reject
      );
    }));
  }
  return propTemplateCache.get(def.id);
}

function attachPropVisual(root, def) {
  getPropTemplate(def)
    .then(template => {
      if (!root.parent) return;
      root.add(cloneWithMaterials(template));
    })
    .catch(err => {
      console.warn(`[Scene] Failed to load prop "${def.id}".`, err?.message || err);
    });
}

function attachPropInstance(root, defOrId, options = {}) {
  const def = typeof defOrId === 'string' ? PROP_BY_ID.get(defOrId) : defOrId;
  if (!def) return;

  getPropTemplate(def)
    .then(template => {
      if (!root.parent) return;
      const instanceRoot = new THREE.Group();
      const visual = cloneWithMaterials(template);
      const scale = options.scale ?? 1;
      const offset = options.offset ?? [0, 0, 0];
      const baseSink = options.baseSink ?? def.baseSink ?? 0;
      const materialColor = options.materialColor ?? def.materialColor;
      const materialBrightness = options.materialBrightness ?? def.materialBrightness ?? 1;
      applyMaterialTuning(visual, materialColor, materialBrightness);
      instanceRoot.position.set(offset[0], offset[1] - baseSink * scale, offset[2]);
      instanceRoot.rotation.y = options.rotationY ?? 0;
      instanceRoot.scale.setScalar(scale);
      instanceRoot.add(visual);
      root.add(instanceRoot);
    })
    .catch(err => {
      console.warn(`[Scene] Failed to load prop "${def.id}".`, err?.message || err);
    });
}

function createColliderBox(size) {
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  collider.position.y = size[1] * 0.5;
  collider.name = 'obstacle-collider';
  return collider;
}

function createColliderPart(part) {
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  collider.position.set(part.offset[0], part.offset[1], part.offset[2]);
  collider.name = 'obstacle-collider';
  return collider;
}

function getVariantColliderParts(variant) {
  if (variant.colliderParts?.length) return variant.colliderParts;
  const size = variant.footprintSize || variant.colliderSize;
  return [{ size, offset: [0, size[1] * 0.5, 0] }];
}

function getTransformedColliderBoxes(position, rotationY, colliderParts) {
  const matrix = new THREE.Matrix4().makeRotationY(rotationY);
  matrix.setPosition(position);

  return colliderParts.map(part => {
    const localBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(part.offset[0], part.offset[1], part.offset[2]),
      new THREE.Vector3(part.size[0], part.size[1], part.size[2])
    );
    const worldBox = localBox.clone().applyMatrix4(matrix);
    worldBox.expandByScalar(0.12);
    return worldBox;
  });
}

function boxesIntersectObstacles(boxes, obstacles) {
  return boxes.some(box => obstacles.some(obs => box.intersectsBox(obs.bbox)));
}

function createAuroraBarrierMesh(size, rotationY = 0) {
  const horizontalSpan = Math.max(size[0], size[2]) * 1.08;
  const wallHeight = Math.max(8.5, size[1] * 0.92);
  const geometry = new THREE.PlaneGeometry(horizontalSpan, wallHeight, 24, 12);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(0x49ffd2) },
      uColorB: { value: new THREE.Color(0x5ea3ff) },
      uColorC: { value: new THREE.Color(0xc67cff) },
      uOpacity: { value: 0.34 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vGlow;

      void main() {
        vUv = uv;
        vec3 transformed = position;
        float waveA = sin(uv.x * 8.0 + uTime * 1.6) * 0.35;
        float waveB = sin(uv.x * 17.0 - uTime * 2.1) * 0.18;
        float sway = sin(uv.y * 4.5 + uTime * 1.2) * 0.12;
        transformed.z += (waveA + waveB) * uv.y * 2.1 + sway;
        transformed.x += sin(uv.y * 5.2 + uTime * 0.9) * 0.06;
        vGlow = smoothstep(0.02, 0.9, uv.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying float vGlow;

      void main() {
        float verticalFade = smoothstep(0.02, 0.22, vUv.y) * (1.0 - smoothstep(0.78, 1.0, vUv.y));
        float bandA = 0.5 + 0.5 * sin(vUv.x * 18.0 + uTime * 1.4 + vUv.y * 7.0);
        float bandB = 0.5 + 0.5 * sin(vUv.x * 31.0 - uTime * 2.0 + vUv.y * 11.0);
        float bandMix = clamp(bandA * 0.65 + bandB * 0.55, 0.0, 1.0);
        vec3 color = mix(uColorA, uColorB, bandMix);
        color = mix(color, uColorC, smoothstep(0.55, 1.0, bandB) * 0.45);
        float edgeFade = 1.0 - smoothstep(0.86, 1.0, abs(vUv.x * 2.0 - 1.0));
        float alpha = verticalFade * edgeFade * (0.16 + bandMix * 0.58) * uOpacity * (0.55 + vGlow * 0.7);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'aurora-wall';
  mesh.position.y = wallHeight * 0.5;
  mesh.rotation.y = rotationY + (size[2] > size[0] ? Math.PI / 2 : 0);
  mesh.renderOrder = 6;
  mesh.onBeforeRender = () => {
    material.uniforms.uTime.value = performance.now() * 0.001;
  };
  return mesh;
}

function addEdgeBarrier(obstacles, scene, size, position, rotationY = 0, visualMode = 'none') {
  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  barrier.position.set(position[0], position[1], position[2]);
  barrier.rotation.y = rotationY;
  barrier.name = 'wall';

  if (visualMode === 'aurora') {
    barrier.add(createAuroraBarrierMesh(size, rotationY));
  }

  scene.add(barrier);

  barrier.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(barrier);
  bbox.expandByScalar(0.2);
  obstacles.push({ mesh: barrier, bbox });
}

function addBoundaryBarrierRing(obstacles, scene) {
  const segments = [
    { size: [30, 12, 2.6], position: [-26, 6, -64.0], rotationY: 0.20 },
    { size: [34, 12, 2.6], position: [14, 6, -66.0], rotationY: -0.08 },
    { size: [24, 12, 2.6], position: [44, 6, -60.5], rotationY: -0.30 },
    { size: [27, 12, 2.6], position: [-42, 6, 62.8], rotationY: -0.24 },
    { size: [36, 12, 2.6], position: [-2, 6, 65.6], rotationY: 0.06 },
    { size: [24, 12, 2.6], position: [38, 6, 61.5], rotationY: 0.26 },
    { size: [2.6, 12, 28], position: [-63.8, 6, -35], rotationY: 0.18 },
    { size: [2.6, 12, 34], position: [-66.2, 6, 6], rotationY: -0.04 },
    { size: [2.6, 12, 24], position: [-62.8, 6, 39], rotationY: -0.22 },
    { size: [2.6, 12, 30], position: [63.6, 6, -34], rotationY: -0.16 },
    { size: [2.6, 12, 36], position: [65.6, 6, 8], rotationY: 0.05 },
    { size: [2.6, 12, 23], position: [62.5, 6, 39], rotationY: 0.24 },
    { size: [8.5, 12, 8.5], position: [-62.2, 6, -61.5], rotationY: 0.18 },
    { size: [8.5, 12, 8.5], position: [62.5, 6, -61.8], rotationY: -0.22 },
    { size: [8.5, 12, 8.5], position: [-62.4, 6, 61.0], rotationY: -0.14 },
    { size: [8.5, 12, 8.5], position: [62.0, 6, 61.8], rotationY: 0.16 },
  ];

  segments.forEach(({ size, position, rotationY = 0 }) => {
    addEdgeBarrier(obstacles, scene, size, position, rotationY, 'aurora');
  });
}

function findPlacement(obstacles, mapHalf, size, attempts = 30, centerClear = 6) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const x = (Math.random() - 0.5) * (mapHalf * 2 - 10);
    const z = (Math.random() - 0.5) * (mapHalf * 2 - 10);
    if (Math.abs(x) < centerClear && Math.abs(z) < centerClear) continue;

    if (!size) return { x, z, bbox: null };

    const bbox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(x, size[1] * 0.5, z),
      new THREE.Vector3(...size)
    );
    bbox.expandByScalar(0.35);
    const blocked = obstacles.some(obs => bbox.intersectsBox(obs.bbox));
    if (!blocked) return { x, z, bbox };
  }
  return null;
}

function findCompositePlacement(obstacles, mapHalf, footprintSize, colliderParts, attempts = 30, centerClear = 6) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const x = (Math.random() - 0.5) * (mapHalf * 2 - 10);
    const z = (Math.random() - 0.5) * (mapHalf * 2 - 10);
    if (Math.abs(x) < centerClear && Math.abs(z) < centerClear) continue;

    const rotationY = Math.random() * Math.PI * 2;
    const boxes = getTransformedColliderBoxes(new THREE.Vector3(x, 0, z), rotationY, colliderParts);
    if (boxesIntersectObstacles(boxes, obstacles)) continue;

    const bbox = new THREE.Box3();
    boxes.forEach((box, index) => {
      if (index === 0) bbox.copy(box);
      else bbox.union(box);
    });
    if (footprintSize) {
      bbox.expandByScalar(0.08);
    }
    return { x, z, rotationY, bbox, boxes };
  }
  return null;
}

function scatterAccentGrass(scene, center, radius = 2.4, count = 3) {
  for (let i = 0; i < count; i++) {
    const tuftRoot = new THREE.Group();
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.35 + Math.random() * 0.75);
    tuftRoot.position.set(
      center.x + Math.cos(angle) * dist,
      0,
      center.z + Math.sin(angle) * dist
    );
    tuftRoot.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tuftRoot);
    attachPropInstance(tuftRoot, ACCENT_GRASS_DEF, {
      scale: randomBetween(0.5, 0.85),
      rotationY: Math.random() * Math.PI * 2,
    });
  }
}

function populateDeadTree(root) {
  attachPropInstance(root, 'deadtree', {
    scale: randomBetween(0.75, 1.35),
    rotationY: Math.random() * Math.PI * 2,
  });
}

function populateSingleProp(root, propId, scaleRange = [0.95, 1.08]) {
  attachPropInstance(root, propId, {
    scale: randomBetween(scaleRange[0], scaleRange[1]),
    rotationY: Math.random() * Math.PI * 2,
  });
}

function populateCactusCluster(root) {
  const count = 2 + Math.floor(Math.random() * 3);
  const radius = 0.8 + Math.random() * 0.75;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.8;
    const dist = i === 0 ? 0 : randomBetween(radius * 0.35, radius);
    attachPropInstance(root, 'desertcactus', {
      offset: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
      scale: randomBetween(0.72, 1.18),
      rotationY: Math.random() * Math.PI * 2,
    });
  }
}

function populateGrassPatch(root) {
  const count = 14 + Math.floor(Math.random() * 8);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = randomBetween(0.1, 1.25);
    attachPropInstance(root, 'desertgrass', {
      offset: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
      scale: randomBetween(0.45, 0.78),
      rotationY: Math.random() * Math.PI * 2,
    });
  }
}

function populateWheelPile(root) {
  const layers = 2 + Math.floor(Math.random() * 2);
  let wheelCount = 0;
  for (let y = 0; y < layers; y++) {
    const layerCount = 2 + (y === 0 ? 1 : 0);
    for (let i = 0; i < layerCount; i++) {
      const spread = y === 0 ? 0.8 : 0.45;
      const offsetX = (i - (layerCount - 1) * 0.5) * spread + randomBetween(-0.12, 0.12);
      const offsetZ = randomBetween(-0.5, 0.5);
      attachPropInstance(root, 'wheel', {
        offset: [offsetX, y * 0.6, offsetZ],
        scale: randomBetween(0.85, 1.15),
        rotationY: Math.random() * Math.PI * 2,
      });
      wheelCount++;
      if (wheelCount > 6) return;
    }
  }
}

function scatterGroundGrass(scene, obstacles, mapHalf, count = 96) {
  for (let i = 0; i < count; i++) {
    const placement = findPlacement(obstacles, mapHalf, [1.8, 0.8, 1.8], 20, 3.5);
    if (!placement) continue;
    const patchRoot = new THREE.Group();
    patchRoot.position.set(placement.x, 0, placement.z);
    patchRoot.rotation.y = Math.random() * Math.PI * 2;
    scene.add(patchRoot);
    populateGrassPatch(patchRoot);
  }
}

function scatterGravel(scene, obstacles, mapHalf, count = 14) {
  for (let i = 0; i < count; i++) {
    const placement = findPlacement(obstacles, mapHalf, [2.2, 0.45, 2.2], 20, 4);
    if (!placement) continue;
    const gravelRoot = new THREE.Group();
    gravelRoot.position.set(placement.x, 0, placement.z);
    gravelRoot.rotation.y = Math.random() * Math.PI * 2;
    scene.add(gravelRoot);

    const gravelCount = 4 + Math.floor(Math.random() * 4);
    for (let j = 0; j < gravelCount; j++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = randomBetween(0.1, 1.0);
      attachPropInstance(gravelRoot, 'gravelpile', {
        offset: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
        scale: randomBetween(0.45, 0.8),
        rotationY: Math.random() * Math.PI * 2,
      });
    }
  }
}

function placeNearBackdropDunes(scene, mapHalf) {
  const nearBackdrop = new THREE.Group();
  nearBackdrop.name = 'near-backdrop-dunes';
  scene.add(nearBackdrop);

  const clusters = [
    { edge: 'north', along: -38, distance: mapHalf + 18 },
    { edge: 'south', along: 34, distance: mapHalf + 19.5 },
    { edge: 'west',  along: -32, distance: mapHalf + 20.5 },
    { edge: 'east',  along: 30, distance: mapHalf + 21.5 },
  ];

  clusters.forEach(({ edge, along, distance }) => {
    const clusterRoot = new THREE.Group();
    placeEdgeBackdropRoot(
      clusterRoot,
      edge,
      along + randomBetween(-4.0, 4.0),
      distance + randomBetween(-1.8, 1.8)
    );
    nearBackdrop.add(clusterRoot);

    const moundCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < moundCount; i++) {
      attachPropInstance(clusterRoot, 'sandpile', {
        offset: [
          (i - (moundCount - 1) * 0.5) * randomBetween(3.5, 5.4),
          0,
          randomBetween(-1.0, 1.4),
        ],
        scale: randomBetween(0.85, 1.25),
        rotationY: randomBetween(-0.5, 0.5),
        materialBrightness: randomBetween(0.98, 1.06),
      });
    }

    if (Math.random() < 0.9) {
      const accentCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < accentCount; i++) {
        attachPropInstance(clusterRoot, Math.random() < 0.6 ? 'deadtree' : 'desertcactus', {
          offset: [randomBetween(-7.0, 7.0), 0, randomBetween(-1.5, -4.8)],
          scale: randomBetween(0.72, 1.18),
          rotationY: Math.random() * Math.PI * 2,
          materialBrightness: randomBetween(0.7, 0.88),
        });
      }
    }
  });
}

function placeEdgeBackdropRoot(root, edge, along, distance, y = 0) {
  if (edge === 'north') {
    root.position.set(along, y, -distance);
    root.rotation.y = 0;
    return;
  }
  if (edge === 'south') {
    root.position.set(along, y, distance);
    root.rotation.y = Math.PI;
    return;
  }
  if (edge === 'west') {
    root.position.set(-distance, y, along);
    root.rotation.y = Math.PI / 2;
    return;
  }
  root.position.set(distance, y, along);
  root.rotation.y = -Math.PI / 2;
}

function populateBackdropDuneRidge(root, scaleBias = 1) {
  const rows = 2 + Math.floor(Math.random() * 2);
  for (let row = 0; row < rows; row++) {
    const duneCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < duneCount; i++) {
      const lateral = (i - (duneCount - 1) * 0.5) * randomBetween(5.5, 8.5) + randomBetween(-1.8, 1.8);
      attachPropInstance(root, 'sandpile', {
        offset: [lateral, -0.08 * row, -row * randomBetween(2.8, 4.2)],
        scale: randomBetween(1.5, 2.8) * scaleBias * (1 - row * 0.12),
        rotationY: randomBetween(-0.45, 0.45),
        materialBrightness: randomBetween(0.96, 1.08),
      });
    }
  }
}

function populateBackdropSilhouetteCluster(root) {
  const variant = chooseWeighted([
    { id: 'treeLine', weight: 4.5 },
    { id: 'cactusLine', weight: 3.2 },
    { id: 'graveyard', weight: 2.3 },
    { id: 'wreck', weight: 1.9 },
  ]);

  if (variant.id === 'treeLine') {
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      attachPropInstance(root, 'deadtree', {
        offset: [randomBetween(-7.5, 7.5), 0, randomBetween(-2.0, -6.5)],
        scale: randomBetween(0.85, 1.45),
        rotationY: Math.random() * Math.PI * 2,
        materialBrightness: randomBetween(0.6, 0.78),
      });
    }
    return;
  }

  if (variant.id === 'cactusLine') {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      attachPropInstance(root, 'desertcactus', {
        offset: [randomBetween(-7.0, 7.0), 0, randomBetween(-1.8, -5.8)],
        scale: randomBetween(0.7, 1.25),
        rotationY: Math.random() * Math.PI * 2,
        materialBrightness: randomBetween(0.68, 0.84),
      });
    }
    return;
  }

  if (variant.id === 'graveyard') {
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      attachPropInstance(root, 'tomb1', {
        offset: [randomBetween(-6.0, 6.0), 0, randomBetween(-1.8, -5.0)],
        scale: randomBetween(0.9, 1.15),
        rotationY: randomBetween(-0.45, 0.45),
        materialBrightness: randomBetween(0.66, 0.8),
      });
    }
    if (Math.random() < 0.45) {
      attachPropInstance(root, 'scarecrow', {
        offset: [randomBetween(-3.5, 3.5), 0, randomBetween(-2.0, -4.2)],
        scale: randomBetween(0.92, 1.05),
        rotationY: randomBetween(-0.6, 0.6),
        materialBrightness: randomBetween(0.62, 0.74),
      });
    }
    return;
  }

  attachPropInstance(root, 'rustycar', {
    offset: [randomBetween(-3.8, 3.8), 0, randomBetween(-2.4, -4.6)],
    scale: 1,
    rotationY: Math.random() * Math.PI * 2,
    materialBrightness: randomBetween(0.62, 0.76),
  });
  const wheelCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < wheelCount; i++) {
    attachPropInstance(root, 'wheel', {
      offset: [randomBetween(-4.8, 4.8), 0, randomBetween(-1.0, -3.6)],
      scale: randomBetween(0.72, 0.9),
      rotationY: Math.random() * Math.PI * 2,
      materialBrightness: randomBetween(0.65, 0.8),
    });
  }
}

function placeFarBackdrop(scene, mapHalf) {
  const backdrop = new THREE.Group();
  backdrop.name = 'far-backdrop';
  scene.add(backdrop);

  const edgeConfigs = [
    { edge: 'north', ridgeCount: 2, midCount: 3, farCount: 2 },
    { edge: 'south', ridgeCount: 1, midCount: 3, farCount: 2 },
    { edge: 'west', ridgeCount: 1, midCount: 2, farCount: 2 },
    { edge: 'east', ridgeCount: 0, midCount: 3, farCount: 2 },
  ];

  edgeConfigs.forEach(({ edge, ridgeCount, midCount, farCount }) => {
    const nearCount = ridgeCount;
    for (let i = 0; i < nearCount; i++) {
      const ridgeRoot = new THREE.Group();
      const along = (i - (nearCount - 1) * 0.5) * 34 + randomBetween(-8.0, 8.0);
      const distance = mapHalf + randomBetween(28, 36);
      placeEdgeBackdropRoot(ridgeRoot, edge, along, distance);
      backdrop.add(ridgeRoot);
      populateBackdropDuneRidge(ridgeRoot, randomBetween(0.78, 0.98));
    }

    for (let i = 0; i < midCount; i++) {
      const midRoot = new THREE.Group();
      const along = (i - (midCount - 1) * 0.5) * 34 + randomBetween(-8.0, 8.0);
      const distance = mapHalf + randomBetween(34, 42);
      placeEdgeBackdropRoot(midRoot, edge, along, distance);
      backdrop.add(midRoot);
      populateBackdropSilhouetteCluster(midRoot);
    }

    for (let i = 0; i < farCount; i++) {
      const farRoot = new THREE.Group();
      const along = (i - (farCount - 1) * 0.5) * 48 + randomBetween(-10.0, 10.0);
      const distance = mapHalf + randomBetween(46, 56);
      placeEdgeBackdropRoot(farRoot, edge, along, distance);
      backdrop.add(farRoot);

      const treeCount = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < treeCount; j++) {
        attachPropInstance(farRoot, Math.random() < 0.7 ? 'deadtree' : 'desertcactus', {
          offset: [randomBetween(-8.0, 8.0), 0, randomBetween(-2.0, -8.0)],
          scale: randomBetween(0.8, 1.35),
          rotationY: Math.random() * Math.PI * 2,
          materialBrightness: randomBetween(0.52, 0.68),
        });
      }
    }
  });
}

function placeObstacleVariant(scene, obstacles, mapHalf, variantId) {
  const variant = OBSTACLE_VARIANTS.find(item => item.id === variantId);
  if (!variant) return false;

  const colliderParts = getVariantColliderParts(variant);
  const mesh = new THREE.Group();
  colliderParts.forEach(part => {
    mesh.add(createColliderPart(part));
  });

  const placement = findCompositePlacement(
    obstacles,
    mapHalf,
    variant.footprintSize || variant.colliderSize,
    colliderParts
  );
  if (!placement) return false;

  mesh.position.x = placement.x;
  mesh.position.z = placement.z;
  mesh.rotation.y = placement.rotationY;
  mesh.name = 'obstacle';

  placement.boxes.forEach(bbox => {
    obstacles.push({ mesh, bbox });
  });
  scene.add(mesh);
  populateObstacleVisuals(mesh, variant, scene);
  return true;
}

function populateObstacleVisuals(root, variant, scene) {
  if (variant.id === 'deadtree') {
    populateDeadTree(root);
    scatterAccentGrass(scene, root.position, 2.4, 5 + Math.floor(Math.random() * 4));
    return;
  }

  if (variant.id === 'cactusCluster') {
    populateCactusCluster(root);
    scatterAccentGrass(scene, root.position, 2.2, 4 + Math.floor(Math.random() * 3));
    return;
  }

  if (variant.id === 'grassPatch') {
    populateGrassPatch(root);
    return;
  }

  if (variant.id === 'wheelPile') {
    populateWheelPile(root);
    return;
  }

  if (variant.id === 'rustycar') {
    populateSingleProp(root, variant.id, [1, 1]);
  } else if (variant.id === 'scarecrow') {
    populateSingleProp(root, variant.id, [0.98, 1.02]);
  } else {
    populateSingleProp(root, variant.id);
  }
  if (variant.id === 'desertcactus') {
    scatterAccentGrass(scene, root.position, 2.0, 4);
    return;
  }
  if (variant.id === 'rustycar' || variant.id === 'tomb1' || variant.id === 'scarecrow') {
    const size = variant.footprintSize || variant.colliderSize;
    scatterAccentGrass(scene, root.position, Math.max(size[0], size[2]) * 0.95, 4 + Math.floor(Math.random() * 5));
  }
}

function scatterGroundTransition(scene, size) {
  const transition = new THREE.Group();
  transition.name = 'ground-transition';
  scene.add(transition);

  const half = size * 0.5;
  const edgeConfigs = [
    { edge: 'north', count: 11 },
    { edge: 'south', count: 11 },
    { edge: 'west', count: 9 },
    { edge: 'east', count: 9 },
  ];

  edgeConfigs.forEach(({ edge, count }) => {
    for (let i = 0; i < count; i++) {
      const root = new THREE.Group();
      const along = (i - (count - 1) * 0.5) * (size / Math.max(count - 1, 1)) + randomBetween(-2.8, 2.8);
      const edgeOffset = randomBetween(-1.6, 4.8);
      placeEdgeBackdropRoot(root, edge, along, half + edgeOffset, 0);
      transition.add(root);

      const gravelCount = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < gravelCount; j++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = randomBetween(0.1, 1.6);
        attachPropInstance(root, 'gravelpile', {
          offset: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
          scale: randomBetween(0.35, 0.62),
          rotationY: Math.random() * Math.PI * 2,
        });
      }

      const grassCount = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < grassCount; j++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = randomBetween(0.25, 2.1);
        attachPropInstance(root, 'desertgrass', {
          offset: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
          scale: randomBetween(0.38, 0.65),
          rotationY: Math.random() * Math.PI * 2,
        });
      }

      if (Math.random() < 0.55) {
        attachPropInstance(root, 'sandpile', {
          offset: [randomBetween(-1.2, 1.2), 0, randomBetween(-0.8, 0.8)],
          scale: randomBetween(0.42, 0.72),
          rotationY: randomBetween(-0.6, 0.6),
          materialBrightness: randomBetween(0.98, 1.04),
        });
      }
    }
  });
}

export function createGround(scene) {
  const size = 120;
  const backdropSize = 320;
  const textureScale = 10 / size;

  const loader = new THREE.TextureLoader();
  const tex = loader.load(sandTextureUrl);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);

  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  const outerTex = tex.clone();
  outerTex.needsUpdate = true;
  outerTex.wrapS = outerTex.wrapT = THREE.RepeatWrapping;
  outerTex.repeat.set(backdropSize * textureScale, backdropSize * textureScale);
  const uvPhase = (((backdropSize - size) * textureScale * 0.5) % 1 + 1) % 1;
  outerTex.offset.set((1 - uvPhase) % 1, (1 - uvPhase) % 1);

  const outerGeo = new THREE.PlaneGeometry(backdropSize, backdropSize);
  const outerMat = new THREE.MeshLambertMaterial({
    map: outerTex,
  });
  const outerGround = new THREE.Mesh(outerGeo, outerMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.015;
  outerGround.receiveShadow = true;
  outerGround.name = 'outer-ground';
  scene.add(outerGround);

  scatterGroundTransition(scene, size);

  // Border walls (invisible collision boundaries)
  const walls = [];
  const wallMat = new THREE.MeshBasicMaterial({ visible: false });
  const wallGeo = new THREE.BoxGeometry(size, 10, 1);
  const positions = [
    { pos: [0, 5, -size / 2], rot: 0 },
    { pos: [0, 5,  size / 2], rot: 0 },
    { pos: [-size / 2, 5, 0], rot: Math.PI / 2 },
    { pos: [ size / 2, 5, 0], rot: Math.PI / 2 },
  ];
  positions.forEach(({ pos, rot }) => {
    const w = new THREE.Mesh(wallGeo, wallMat);
    w.position.set(...pos);
    w.rotation.y = rot;
    w.name = 'wall';
    scene.add(w);
    walls.push(w);
  });

  return { ground, walls, size };
}

/**
 * Creates random obstacles: colored boxes resembling barricades / vehicles.
 */
export function createObstacles(scene) {
  const obstacles = [];
  const count = Math.floor(Math.random() * 7) + 20; // 20-26
  const mapHalf = 50;

  // Hidden segmented barriers keep gameplay inside the arena without creating a visible square wall.
  addBoundaryBarrierRing(obstacles, scene);

  // Guarantee key hero props appear in every map.
  placeObstacleVariant(scene, obstacles, mapHalf, 'rustycar');
  placeObstacleVariant(scene, obstacles, mapHalf, 'rustycar');
  placeObstacleVariant(scene, obstacles, mapHalf, 'scarecrow');
  placeObstacleVariant(scene, obstacles, mapHalf, 'scarecrow');

  // Guarantee some sandstone rocks appear in every map.
  placeObstacleVariant(scene, obstacles, mapHalf, 'sandstone');
  placeObstacleVariant(scene, obstacles, mapHalf, 'sandstone');
  placeObstacleVariant(scene, obstacles, mapHalf, 'sandstone');

  // Guarantee some signposts appear in every map.
  placeObstacleVariant(scene, obstacles, mapHalf, 'signpost');
  placeObstacleVariant(scene, obstacles, mapHalf, 'signpost');

  for (let i = 0; i < count; i++) {
    const variant = chooseWeighted(OBSTACLE_VARIANTS);
    placeObstacleVariant(scene, obstacles, mapHalf, variant.id);
  }

  scatterGroundGrass(scene, obstacles, mapHalf, 70);
  scatterGravel(scene, obstacles, mapHalf, 8);
  placeNearBackdropDunes(scene, mapHalf);
  placeFarBackdrop(scene, mapHalf);

  return obstacles;
}

/**
 * Sets up the scene lighting (directional sun, ambient, and fog).
 */
export function setupLighting(scene) {
  // Dark red sky / fog
  scene.background = new THREE.Color(0x3a1010);
  scene.fog = new THREE.FogExp2(0x3a1010, 0.018);

  // Directional "sun"
  const sun = new THREE.DirectionalLight(0xffe0b6, 1.65);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.width  = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far  = 200;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -60;
  sun.shadow.camera.right = sun.shadow.camera.top  =  60;
  scene.add(sun);

  // Ambient fill keeps imported materials closer to their authored albedo colors.
  const ambient = new THREE.AmbientLight(0x8b7e72, 0.78);
  scene.add(ambient);

  // Hemisphere adds a warmer upper fill so characters do not collapse into the dark red fog.
  const hemi = new THREE.HemisphereLight(0x7a4d40, 0x22180f, 0.62);
  scene.add(hemi);

  return { sun, ambient };
}
