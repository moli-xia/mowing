import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { playZombieHeadshotDeath, playZombieNormalDeath, playZombieRoar } from './sound.js';
import zombieWalkUrl from './assets/models/Zombie Walk.fbx?url';
import { clampToPlayableBounds, movePositionWithSlide, PLAYABLE_CLAMP_PADDING } from './scene.js';

const ZOMBIE_SPEED = 2.2;
const ATTACK_RANGE = 1.4;
const ATTACK_DAMAGE = 8;
const ATTACK_COOLDOWN = 1.2;
const HP_PER_ZOMBIE = 100;
const ZOMBIE_COLLISION_SIZE = new THREE.Vector3(0.9, 1.9, 0.9);
const TARGET_ZOMBIE_HEIGHT = 2.0;
const ZOMBIE_HIT_SLOW_DURATION = 0.22;
const ZOMBIE_HIT_FLASH_DURATION = 0.18;
const ZOMBIE_HIT_TINT = new THREE.Color(0xff3a3a);
const WEAK_SPOT_RADIUS = 0.16;
const ZOMBIE_FOOT_SOLE_OFFSET = 0.08;

export const debrisList = [];

function isRootMotionTrack(trackName) {
  return /\.position$/i.test(trackName) && /(^|[.:_])(root|hips|pelvis|mixamorigHips)([.:_]|$)/i.test(trackName);
}

function sanitizeZombieClip(clip) {
  if (!clip) return null;

  const sanitizedTracks = clip.tracks.map(track => {
    if (!isRootMotionTrack(track.name)) return track.clone();

    const cloned = track.clone();
    const values = cloned.values.slice();
    if (values.length >= 3) {
      const baseX = values[0];
      const baseY = values[1];
      const baseZ = values[2];
      for (let i = 0; i < values.length; i += 3) {
        values[i] = baseX;
        values[i + 2] = baseZ;
        if (/^object\./i.test(track.name) || /^[^.:_]+\.position$/i.test(track.name)) {
          values[i + 1] = baseY;
        }
      }
      cloned.values = values;
    }
    return cloned;
  });

  const sanitized = clip.clone();
  sanitized.tracks = sanitizedTracks;
  sanitized.resetDuration();
  return sanitized;
}

function normalizeZombieModel(model) {
  model.updateMatrixWorld(true);

  const sourceBox = new THREE.Box3().setFromObject(model);
  if (!sourceBox.isEmpty()) {
    const size = sourceBox.getSize(new THREE.Vector3());
    const scale = TARGET_ZOMBIE_HEIGHT / Math.max(size.y, 0.001);
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
      // Keep zombie silhouettes readable by avoiding heavy self-shadowing.
      child.receiveShadow = false;
      child.frustumCulled = false;
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
          material.color.multiplyScalar(material.map ? 1.04 : 1.14);
        }
        if ('roughness' in material && typeof material.roughness === 'number') {
          material.roughness = Math.min(material.roughness, material.map ? 0.9 : 0.82);
        }
        if ('metalness' in material && typeof material.metalness === 'number') {
          material.metalness *= material.map ? 0.34 : 0.54;
        }
        if ('aoMapIntensity' in material && typeof material.aoMapIntensity === 'number') {
          material.aoMapIntensity = Math.min(material.aoMapIntensity, 0.84);
        }
        if ('emissive' in material && material.emissive) {
          if (material.color) {
            material.emissive.copy(material.color).multiplyScalar(material.map ? 0.024 : 0.052);
          } else {
            material.emissive.addScalar(0.032);
          }
        }
        if ('emissiveIntensity' in material && typeof material.emissiveIntensity === 'number') {
          material.emissiveIntensity = Math.max(material.emissiveIntensity, material.map ? 0.48 : 0.74);
        }
        material.needsUpdate = true;
      });
    }
  });

  model.updateMatrixWorld(true);
}

function createFallbackZombieVisual() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x35522c });
  const skinMat = new THREE.MeshPhongMaterial({ color: 0x5f7a49 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.80, 0.30), bodyMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.62, 0.20), bodyMat);
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.14, 0.35, 0);
  rightLeg.position.set(0.14, 0.35, 0);
  leftLeg.castShadow = true;
  rightLeg.castShadow = true;
  g.add(leftLeg, rightLeg);

  return { object: g, clip: null };
}

function createZombieFootRing() {
  const marker = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff2a2a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  ring.userData.ignoreZombieHit = true;
  marker.add(ring);

  const centerDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff7070,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  centerDot.rotation.x = -Math.PI / 2;
  centerDot.position.y = 0.04;
  centerDot.userData.ignoreZombieHit = true;
  marker.add(centerDot);

  return { marker, aimAssist: centerDot };
}

function collectZombieGroundAnchors(root) {
  const anchors = [];
  root.traverse(node => {
    const name = (node.name || '').toLowerCase();
    if (!name) return;
    if (/(left|right|l|r).*(foot|toe|ankle)|(foot|toe|ankle).*(left|right|l|r)/i.test(name)) {
      anchors.push(node);
    }
  });
  return anchors;
}

function isolateZombieMaterials(root) {
  root.traverse(child => {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map(material => material?.clone ? material.clone() : material);
      return;
    }
    if (child.material.clone) {
      child.material = child.material.clone();
    }
  });
}

function collectTintTargets(root) {
  const targets = new Map();
  root.traverse(child => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(material => {
      if (!material?.color || targets.has(material.uuid)) return;
      targets.set(material.uuid, {
        material,
        baseColor: material.color.clone(),
        baseEmissive: material.emissive ? material.emissive.clone() : null,
      });
    });
  });
  return [...targets.values()];
}

export class ZombieManager {
  constructor(scene) {
    this.scene = scene;
    this.zombies = [];
    this.template = null;
    this.templateClip = null;
    this.templateReady = false;
    this.templateFailed = false;
    this.pendingSpawns = [];

    const loader = new FBXLoader();
    loader.load(
      zombieWalkUrl,
      (fbx) => {
        normalizeZombieModel(fbx);
        this.template = fbx;
        this.templateClip = sanitizeZombieClip((fbx.animations && fbx.animations[0]) || null);
        this.templateReady = true;
        this._flushPendingSpawns();
        console.log('[Zombie] FBX model loaded.');
      },
      undefined,
      (err) => {
        this.templateFailed = true;
        this._flushPendingSpawns();
        console.warn('[Zombie] FBX load failed, using fallback zombie mesh.', err?.message || err);
      }
    );
  }

  _flushPendingSpawns() {
    if (this.pendingSpawns.length === 0) return;
    const requests = this.pendingSpawns.splice(0, this.pendingSpawns.length);
    requests.forEach(({ count, playerPos, obstacles }) => {
      this._spawnNow(count, playerPos, obstacles);
    });
  }

  _createZombieVisual() {
    if (!this.templateReady || !this.template) {
      return createFallbackZombieVisual();
    }
    return {
      object: clone(this.template),
      clip: this.templateClip,
    };
  }

  _spawnNow(count, playerPos, obstacles = []) {
    for (let i = 0; i < count; i++) {
      const visual = this._createZombieVisual();
      isolateZombieMaterials(visual.object);
      const groundAnchors = collectZombieGroundAnchors(visual.object);
      const footMarker = createZombieFootRing();
      const group = new THREE.Group();
      group.add(visual.object);
      group.add(footMarker.marker);

      let validPosition = false;
      let attempts = 0;
      while (!validPosition && attempts < 20) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 28 + Math.random() * 18;
        group.position.set(
          playerPos.x + Math.cos(angle) * radius,
          0,
          playerPos.z + Math.sin(angle) * radius
        );
        clampToPlayableBounds(group.position, PLAYABLE_CLAMP_PADDING + 1.4);

        const zombieBox = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(group.position.x, 1.0, group.position.z),
          ZOMBIE_COLLISION_SIZE
        );
        validPosition = !obstacles.some(obs => zombieBox.intersectsBox(obs.bbox));
        attempts++;
      }

      let mixer = null;
      let action = null;
      if (visual.clip) {
        mixer = new THREE.AnimationMixer(visual.object);
        action = mixer.clipAction(visual.clip);
        action.setLoop(THREE.LoopRepeat, Infinity).play();
        mixer.update(0);
      }

      this._lockZombieToGround({ visualRoot: visual.object, groundAnchors });

      this.scene.add(group);
      this.zombies.push({
        group,
        hp: HP_PER_ZOMBIE,
        alive: true,
        attackTimer: 0,
        hitSlowTimer: 0,
        hitFlashTimer: 0,
        state: 'chase',
        mixer,
        action,
        visualRoot: visual.object,
        groundAnchors,
        aimAssist: footMarker.aimAssist,
        tintTargets: collectTintTargets(visual.object),
      });
    }
  }

  spawn(count, playerPos, obstacles = []) {
    if (!this.templateReady && !this.templateFailed) {
      this.pendingSpawns.push({
        count,
        playerPos: playerPos.clone ? playerPos.clone() : new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z),
        obstacles,
      });
      return;
    }
    this._spawnNow(count, playerPos, obstacles);
  }

  update(dt, playerPos, onAttackPlayer, obstacles = []) {
    for (const z of this.zombies) {
      if (!z.alive) continue;
      z.hitSlowTimer = Math.max(0, z.hitSlowTimer - dt);
      z.hitFlashTimer = Math.max(0, z.hitFlashTimer - dt);
      if (z.mixer) z.mixer.update(dt);
      this._lockZombieToGround(z);
      this._updateHitTint(z);

      const pos = z.group.position;
      const dx = playerPos.x - pos.x;
      const dz = playerPos.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      z.group.rotation.y = Math.atan2(dx, dz);
      const slowFactor = z.hitSlowTimer > 0 ? 0.42 : 1.0;

      if (dist > ATTACK_RANGE) {
        z.state = 'chase';
        const spd = ZOMBIE_SPEED * dt * slowFactor;
        const moveX = (dx / dist) * spd;
        const moveZ = (dz / dist) * spd;
        const slidPos = movePositionWithSlide(
          pos,
          new THREE.Vector3(moveX, 0, moveZ),
          ZOMBIE_COLLISION_SIZE,
          obstacles,
          PLAYABLE_CLAMP_PADDING + 0.9,
          1.0
        );
        pos.x = slidPos.x;
        pos.z = slidPos.z;
        clampToPlayableBounds(pos, PLAYABLE_CLAMP_PADDING + 0.9);

        if (Math.random() < 0.0022) {
          playZombieRoar();
        }

        if (z.action) z.action.timeScale = 1.0 * slowFactor;
      } else {
        z.state = 'attack';
        z.attackTimer -= dt;
        if (z.attackTimer <= 0) {
          onAttackPlayer(ATTACK_DAMAGE);
          z.attackTimer = ATTACK_COOLDOWN;
        }
        if (z.action) z.action.timeScale = 0.35 * slowFactor;
      }
    }
  }

  _raycastAlive(raycaster, maxDistance = Infinity) {
    const alive = this.zombies.filter(z => z.alive);
    let proxyHit = null;
    for (const zombie of alive) {
      const hit = this._getZombieProxyHit(zombie, raycaster, maxDistance);
      if (hit && (!proxyHit || hit.distance < proxyHit.distance)) {
        proxyHit = hit;
      }
    }

    const allMeshes = [];
    const meshOwners = new Map();
    alive.forEach(z => {
      z.group.traverse(child => {
        if (child.isMesh && !child.userData.ignoreZombieHit) {
          allMeshes.push(child);
          meshOwners.set(child.uuid, z);
        }
      });
    });

    const hits = raycaster.intersectObjects(allMeshes, false);
    for (const hit of hits) {
      if (hit.distance > maxDistance) break;
      const target = meshOwners.get(hit.object.uuid);
      if (target) {
        const meshHit = {
          target,
          hitMesh: hit.object,
          hitPoint: hit.point.clone(),
          isWeakSpot: false,
          distance: hit.distance,
        };
        return proxyHit && proxyHit.distance <= meshHit.distance ? proxyHit : meshHit;
      }
    }
    return proxyHit;
  }

  _getZombieProxyHit(zombie, raycaster, maxDistance = Infinity) {
    const bbox = new THREE.Box3().setFromObject(zombie.group);
    const fallbackMinY = 0;
    const fallbackHeight = TARGET_ZOMBIE_HEIGHT;
    const center = bbox.isEmpty()
      ? zombie.group.position.clone().setY(fallbackHeight * 0.5)
      : bbox.getCenter(new THREE.Vector3());
    const height = bbox.isEmpty() ? fallbackHeight : Math.max(0.001, bbox.max.y - bbox.min.y);
    const minY = bbox.isEmpty() ? fallbackMinY : bbox.min.y;
    const maxY = bbox.isEmpty() ? fallbackHeight : bbox.max.y;
    const width = bbox.isEmpty() ? 0.9 : Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z);

    const chestCenter = new THREE.Vector3(center.x, minY + height * 0.56, center.z);
    const abdomenCenter = new THREE.Vector3(center.x, minY + height * 0.34, center.z);
    const headCenter = new THREE.Vector3(center.x, maxY - height * 0.14, center.z);

    let best = null;
    const bodyHits = [
      this._getSphereHit(zombie, raycaster, chestCenter, Math.max(0.44, width * 0.38), false, maxDistance),
      this._getSphereHit(zombie, raycaster, abdomenCenter, Math.max(0.38, width * 0.34), false, maxDistance),
      this._getSphereHit(zombie, raycaster, headCenter, Math.max(WEAK_SPOT_RADIUS * 1.35, width * 0.18), true, maxDistance),
    ];

    for (const hit of bodyHits) {
      if (hit && (!best || hit.distance < best.distance)) {
        best = hit;
      }
    }

    return best;
  }

  _getSphereHit(zombie, raycaster, center, radius, isWeakSpot, maxDistance = Infinity) {
    const nearestPoint = raycaster.ray.closestPointToPoint(center, new THREE.Vector3());
    const along = nearestPoint.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
    if (along < 0 || along > maxDistance) return null;

    const distSq = nearestPoint.distanceToSquared(center);
    if (distSq > radius * radius) return null;

    const offset = Math.sqrt(Math.max(0, radius * radius - distSq));
    const entryDistance = Math.max(0, along - offset);
    if (entryDistance > maxDistance) return null;

    return {
      target: zombie,
      hitMesh: null,
      hitPoint: raycaster.ray.at(entryDistance, new THREE.Vector3()),
      isWeakSpot,
      distance: entryDistance,
    };
  }

  getDirectAimTarget(raycaster, maxDistance = Infinity) {
    const directHit = this._raycastAlive(raycaster, maxDistance);
    if (!directHit) return null;
    return {
      target: directHit.target,
      aimPoint: directHit.hitPoint.clone(),
      weakSpot: directHit.isWeakSpot,
    };
  }

  getAimTarget(raycaster, maxDistance = Infinity) {
    const directTarget = this.getDirectAimTarget(raycaster, maxDistance);
    if (directTarget) return directTarget;

    let best = null;
    const thresholdSq = 0.28 * 0.28;
    for (const zombie of this.zombies) {
      if (!zombie.alive) continue;
      const bbox = new THREE.Box3().setFromObject(zombie.visualRoot || zombie.group);
      const center = bbox.isEmpty()
        ? zombie.group.position.clone().setY(TARGET_ZOMBIE_HEIGHT * 0.5)
        : bbox.getCenter(new THREE.Vector3());
      const height = bbox.isEmpty() ? TARGET_ZOMBIE_HEIGHT : Math.max(0.001, bbox.max.y - bbox.min.y);
      const weakSpotCenter = new THREE.Vector3(center.x, (bbox.isEmpty() ? TARGET_ZOMBIE_HEIGHT : bbox.max.y) - height * 0.14, center.z);
      const nearestPoint = raycaster.ray.closestPointToPoint(weakSpotCenter, new THREE.Vector3());
      const along = nearestPoint.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
      if (along < 0 || along > maxDistance) continue;
      const distSq = nearestPoint.distanceToSquared(weakSpotCenter);
      if (distSq > thresholdSq) continue;
      if (!best || along < best.along) {
        best = { target: zombie, aimPoint: weakSpotCenter, weakSpot: true, along };
      }
    }
    return best ? { target: best.target, aimPoint: best.aimPoint, weakSpot: best.weakSpot } : null;
  }

  hitTest(raycaster, onKill, maxDistance = Infinity) {
    const hit = this._raycastAlive(raycaster, maxDistance);
    if (!hit) return { hit: false, killed: false, weakSpot: false, point: null };

    const target = hit.target;
    target.hp -= hit.isWeakSpot ? HP_PER_ZOMBIE : 34;
    if (target.hp <= 0) {
      target.alive = false;
      if (hit.isWeakSpot) playZombieHeadshotDeath();
      else playZombieNormalDeath();
      this.scene.remove(target.group);
      this._spawnDebris(hit.hitPoint);
      onKill(hit.hitPoint, hit.isWeakSpot);
      return { hit: true, killed: true, weakSpot: hit.isWeakSpot, point: hit.hitPoint };
    }

    target.hitSlowTimer = ZOMBIE_HIT_SLOW_DURATION;
    target.hitFlashTimer = ZOMBIE_HIT_FLASH_DURATION;
    return { hit: true, killed: false, weakSpot: hit.isWeakSpot, point: hit.hitPoint };
  }

  _lockZombieToGround(zombie) {
    if (!zombie.visualRoot) return;
    zombie.visualRoot.updateMatrixWorld(true);

    let minY = null;
    if (zombie.groundAnchors?.length) {
      const worldPos = new THREE.Vector3();
      for (const anchor of zombie.groundAnchors) {
        anchor.getWorldPosition(worldPos);
        const anchorY = worldPos.y - ZOMBIE_FOOT_SOLE_OFFSET;
        if (minY === null || anchorY < minY) minY = anchorY;
      }
    }

    if (minY === null) {
      const bbox = new THREE.Box3().setFromObject(zombie.visualRoot);
      if (bbox.isEmpty()) return;
      minY = bbox.min.y;
    }

    if (Math.abs(minY) < 0.0001) return;
    zombie.visualRoot.position.y -= minY;
    zombie.visualRoot.updateMatrixWorld(true);
  }

  _updateHitTint(zombie) {
    const strength = THREE.MathUtils.clamp(zombie.hitFlashTimer / ZOMBIE_HIT_FLASH_DURATION, 0, 1);
    zombie.tintTargets?.forEach(({ material, baseColor, baseEmissive }) => {
      material.color.copy(baseColor).lerp(ZOMBIE_HIT_TINT, strength * 0.85);
      if (material.emissive && baseEmissive) {
        material.emissive.copy(baseEmissive).lerp(ZOMBIE_HIT_TINT, strength * 0.25);
      }
    });
  }

  _spawnDebris(center) {
    const count = 12 + Math.floor(Math.random() * 6);

    for (let i = 0; i < count; i++) {
      const size = 0.06 + Math.random() * 0.16;
      const geo  = new THREE.BoxGeometry(size, size, size);
      const mat  = new THREE.MeshPhongMaterial({
        color: Math.random() > 0.5 ? 0xcc1111 : 0x882211,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(center);
      mesh.position.x += (Math.random() - 0.5) * 0.5;
      mesh.position.y += Math.random() * 0.95;
      mesh.position.z += (Math.random() - 0.5) * 0.5;
      this.scene.add(mesh);

      debrisList.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 7,
          3.5 + Math.random() * 4.8,
          (Math.random() - 0.5) * 7
        ),
        angVel: new THREE.Vector3(
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9
        ),
        life: 1.45 + Math.random() * 0.7,
        maxLife: 1.0,
      });
    }
  }

  getAliveCount() {
    return this.zombies.filter(z => z.alive).length;
  }

  getAlivePositions() {
    return this.zombies
      .filter(z => z.alive)
      .map(z => z.group.position);
  }

  clearAll() {
    for (const z of this.zombies) {
      if (z.group?.parent) this.scene.remove(z.group);
    }
    this.zombies = [];
    this.pendingSpawns = [];
  }
}

export function updateDebris(dt) {
  for (let i = debrisList.length - 1; i >= 0; i--) {
    const d = debrisList[i];
    d.life -= dt;
    if (d.life <= 0) {
      d.mesh.parent && d.mesh.parent.remove(d.mesh);
      debrisList.splice(i, 1);
      continue;
    }
    d.vel.y -= 9.8 * dt;
    d.mesh.position.addScaledVector(d.vel, dt);
    d.mesh.rotation.x += d.angVel.x * dt;
    d.mesh.rotation.y += d.angVel.y * dt;
    d.mesh.rotation.z += d.angVel.z * dt;

    if (d.mesh.position.y < 0.05) {
      d.mesh.position.y = 0.05;
      d.vel.y *= -0.35;
      d.vel.x *= 0.7;
      d.vel.z *= 0.7;
    }
    // Fade out
    const t = Math.max(0, d.life / 1.5);
    d.mesh.material.opacity = t;
    d.mesh.material.transparent = true;
  }
}
