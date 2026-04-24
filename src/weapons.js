import * as THREE from 'three';

function createRadialGradientTexture(innerColor = '#ffffff', outerColor = 'rgba(255,255,255,0)') {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    0,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.28, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.62, 'rgba(255,255,255,0.38)');
  gradient.addColorStop(1, outerColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Muzzle flash particle system + bullet tracer.
 */
export class WeaponEffects {
  constructor(scene) {
    this.scene    = scene;
    this.flashes  = []; // { mesh, life }
    this.tracers  = []; // { mesh, core, vel, life, maxLife }
    this.particles = []; // spark particles
    this.bursts = []; // larger impact bursts such as headshots
    this.radialGlowTexture = createRadialGradientTexture();
  }

  /**
   * Fire from muzzlePos toward direction.
   */
  fireMuzzleFlash(muzzlePos, direction, maxDistance = Infinity) {
    // ---- Muzzle flash light ----
    const light = new THREE.PointLight(0xffaa44, 18, 7.5);
    light.position.copy(muzzlePos);
    this.scene.add(light);

    // ---- Flash sprite (star shape via 3 crossed planes) ----
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffdd88,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const flashGroup = new THREE.Group();
    flashGroup.position.copy(muzzlePos);

    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(0.42, 0.42);
      const m   = new THREE.Mesh(geo, flashMat.clone());
      m.rotation.y = (i / 3) * Math.PI;
      flashGroup.add(m);
    }

    // Cross the flash group to face camera direction
    flashGroup.lookAt(muzzlePos.clone().add(direction));
    this.scene.add(flashGroup);

    this.flashes.push({ mesh: flashGroup, light, life: 0.06 });

    // ---- Spark particles ----
    const sparkCount = 10;
    for (let i = 0; i < sparkCount; i++) {
      const size = 0.03 + Math.random() * 0.04;
      const geo  = new THREE.SphereGeometry(size, 4, 4);
      const mat  = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xffcc44 : 0xff8800,
        transparent: true,
      });
      const spark = new THREE.Mesh(geo, mat);
      spark.position.copy(muzzlePos);

      const spread = 0.4;
      const vel = direction.clone()
        .multiplyScalar(5 + Math.random() * 3)
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread
        ));

      this.scene.add(spark);
      this.particles.push({ mesh: spark, vel, life: 0.18 + Math.random() * 0.12 });
    }

    // ---- Bullet tracer projectile ----
    const bulletDir = direction.clone().normalize();
    const bulletRange = Number.isFinite(maxDistance) ? Math.max(0.05, Math.min(180, maxDistance)) : 180;
    const tracerSpeed = 142;
    const tracerLife = Math.max(0.075, Math.min(0.14, bulletRange / tracerSpeed));
    const tracerLength = THREE.MathUtils.clamp(bulletRange * 0.055, 0.65, 1.25);
    const beamRadius = 0.022;

    const tracerGroup = new THREE.Group();
    const tracerCoreGroup = new THREE.Group();
    tracerGroup.renderOrder = 999;
    tracerCoreGroup.renderOrder = 1000;
    tracerGroup.frustumCulled = false;
    tracerCoreGroup.frustumCulled = false;

    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const outerWidth = beamRadius * 5.0;
    for (let i = 0; i < 3; i++) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(outerWidth, tracerLength),
        outerMat.clone()
      );
      plane.position.y = tracerLength * 0.5;
      plane.rotation.y = (i / 3) * Math.PI;
      plane.renderOrder = 999;
      plane.frustumCulled = false;
      tracerGroup.add(plane);
    }

    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(beamRadius * 0.72, beamRadius * 0.46, tracerLength * 0.94, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffd27a,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      })
    );
    shell.position.y = tracerLength * 0.5;
    shell.renderOrder = 998;
    shell.frustumCulled = false;
    tracerGroup.add(shell);

    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const innerWidth = beamRadius * 1.35;
    for (let i = 0; i < 2; i++) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(innerWidth, tracerLength * 0.82),
        innerMat.clone()
      );
      plane.position.y = tracerLength * 0.5;
      plane.rotation.y = (i / 2) * Math.PI * 0.5;
      plane.renderOrder = 1000;
      plane.frustumCulled = false;
      tracerCoreGroup.add(plane);
    }

    const coreCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(beamRadius * 0.2, beamRadius * 0.1, tracerLength * 0.8, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      })
    );
    coreCylinder.position.y = tracerLength * 0.5;
    coreCylinder.renderOrder = 1000;
    coreCylinder.frustumCulled = false;
    coreCylinder.userData.opacityBase = 0.22;
    tracerCoreGroup.add(coreCylinder);

    // Angle-independent glow beads keep the tracer visible even when firing toward the camera.
    const beadCount = 5;
    for (let i = 0; i < beadCount; i++) {
      const t = beadCount === 1 ? 1 : i / (beadCount - 1);
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(beamRadius * (0.52 - t * 0.12), 10, 10),
        new THREE.MeshBasicMaterial({
          color: i === beadCount - 1 ? 0xfff4d0 : 0xffc15a,
          transparent: true,
          opacity: 0.88 - t * 0.18,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        })
      );
      bead.position.y = tracerLength * (0.12 + t * 0.88);
      bead.renderOrder = 1001;
      bead.frustumCulled = false;
      bead.userData.opacityBase = 0.28 - t * 0.04;
      tracerCoreGroup.add(bead);
    }

    // Billboard sprites — always face camera, guarantee visibility from every angle.
    // Layer 1: large soft glow disc (additive)
    const spriteCount = 5;
    for (let i = 0; i < spriteCount; i++) {
      const t = spriteCount === 1 ? 1 : i / (spriteCount - 1);
      const size = beamRadius * (8.0 - t * 1.5);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          color: i === spriteCount - 1 ? 0xfffbe8 : 0xffcc55,
          transparent: true,
          opacity: 0.85 - t * 0.1,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        })
      );
      sprite.scale.set(size, size, 1);
      sprite.position.set(0, tracerLength * (0.1 + t * 0.85), 0);
      sprite.renderOrder = 1002;
      sprite.frustumCulled = false;
      sprite.userData.opacityBase = 0.28 - t * 0.04;
      tracerCoreGroup.add(sprite);
    }

    // Layer 2: tiny bright core dots for a "dot chain" tracer look
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(beamRadius * 0.18, 6, 6),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.88 - t * 0.22,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        })
      );
      dot.position.set(0, tracerLength * (0.08 + t * 0.9), 0);
      dot.renderOrder = 1003;
      dot.frustumCulled = false;
      tracerCoreGroup.add(dot);
    }

    const tipGlow = new THREE.Mesh(
      new THREE.SphereGeometry(beamRadius * 0.9, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c2,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      })
    );
    tipGlow.position.y = tracerLength;
    tipGlow.renderOrder = 1001;
    tipGlow.frustumCulled = false;
    tipGlow.userData.opacityBase = 0.3;
    tracerCoreGroup.add(tipGlow);

    const tracerOrigin = muzzlePos.clone();
    tracerGroup.position.copy(tracerOrigin);
    tracerCoreGroup.position.copy(tracerGroup.position);
    tracerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bulletDir);
    tracerCoreGroup.quaternion.copy(tracerGroup.quaternion);
    this.scene.add(tracerGroup);
    this.scene.add(tracerCoreGroup);

    this.tracers.push({
      mesh: tracerGroup,
      core: tracerCoreGroup,
      vel: bulletDir.multiplyScalar((bulletRange + tracerLength) / tracerLife),
      life: tracerLife,
      maxLife: tracerLife,
    });
  }

  /**
   * Hit impact effect at a world position.
   */
  spawnHitEffect(pos) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const size = 0.04 + Math.random() * 0.065;
      const geo  = new THREE.BoxGeometry(size, size, size);
      const mat  = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.55 ? 0xff2200 : 0xffcc66,
        transparent: true,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4.2,
        1.5 + Math.random() * 2.8,
        (Math.random() - 0.5) * 4.2
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, vel, life: 0.32 + Math.random() * 0.24, gravity: true });
    }
  }

  spawnHeadshotEffect(pos) {
    const burst = new THREE.Group();
    burst.position.copy(pos);
    burst.renderOrder = 1200;

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xffd36a,
        map: this.radialGlowTexture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      })
    );
    halo.scale.set(1.15, 1.15, 1);
    halo.userData.baseScale = 1.15;
    halo.userData.baseOpacity = 0.95;
    burst.add(halo);

    const hotCore = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        alphaMap: this.radialGlowTexture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    hotCore.lookAt(new THREE.Vector3(pos.x, pos.y, pos.z + 1));
    hotCore.userData.baseScale = 1;
    hotCore.userData.baseOpacity = 0.95;
    burst.add(hotCore);

    const shockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.26, 40),
      new THREE.MeshBasicMaterial({
        color: 0xff5a36,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      })
    );
    shockRing.rotation.x = -Math.PI / 2;
    shockRing.userData.baseScale = 1;
    shockRing.userData.baseOpacity = 0.9;
    burst.add(shockRing);

    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.68),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? 0xfff0b8 : 0xff6c48,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        })
      );
      shard.rotation.y = (i / 3) * Math.PI + Math.random() * 0.3;
      shard.rotation.x = randomTilt();
      shard.userData.baseScale = 1;
      shard.userData.baseOpacity = 0.8;
      burst.add(shard);
    }

    const burstLight = new THREE.PointLight(0xff8a54, 6.5, 10, 1.8);
    burstLight.position.copy(pos);
    this.scene.add(burstLight);
    this.scene.add(burst);
    this.bursts.push({ mesh: burst, light: burstLight, life: 0.22, maxLife: 0.22 });

    const particleCount = 10;
    for (let i = 0; i < particleCount; i++) {
      const isHot = Math.random() < 0.35;
      const size = isHot ? 0.04 + Math.random() * 0.045 : 0.028 + Math.random() * 0.035;
      const particle = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({
          color: isHot ? 0xfff0b4 : (Math.random() < 0.5 ? 0xff3c24 : 0xff9b54),
          transparent: true,
          opacity: isHot ? 0.96 : 0.88,
          depthWrite: false,
          toneMapped: false,
        })
      );
      particle.position.copy(pos);
      const horizontal = 2.6 + Math.random() * 2.4;
      const angle = Math.random() * Math.PI * 2;
      const upward = 2.0 + Math.random() * 3.0;
      const vel = new THREE.Vector3(
        Math.cos(angle) * horizontal,
        upward + (isHot ? 1.2 : 0),
        Math.sin(angle) * horizontal
      );
      particle.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(particle);
      this.particles.push({
        mesh: particle,
        vel,
        life: 0.42 + Math.random() * 0.22,
        gravity: true,
      });
    }

    function randomTilt() {
      return -0.25 + Math.random() * 0.5;
    }
  }

  update(dt) {
    // Muzzle flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        this.scene.remove(f.light);
        this.flashes.splice(i, 1);
      } else {
        const t = f.life / 0.06;
        f.mesh.children.forEach(c => { c.material.opacity = t; });
        f.light.intensity = 8 * t;
      }
    }

    // Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      const step = tr.vel.clone().multiplyScalar(dt);
      tr.mesh.position.add(step);
      if (tr.core) tr.core.position.add(step);

      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        if (tr.core) this.scene.remove(tr.core);
        this.tracers.splice(i, 1);
      } else {
        const t = THREE.MathUtils.clamp(tr.life / tr.maxLife, 0, 1);
        tr.mesh.children.forEach((child) => {
          child.material.opacity = 0.35 + t * 0.65;
        });
        if (tr.core) {
          tr.core.children.forEach((child) => {
            child.material.opacity = (child.userData.opacityBase ?? 0.5) + t * 0.5;
          });
        }
      }
    }

    // Headshot bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.life -= dt;
      if (burst.life <= 0) {
        this.scene.remove(burst.mesh);
        this.scene.remove(burst.light);
        this.bursts.splice(i, 1);
        continue;
      }

      const t = THREE.MathUtils.clamp(burst.life / burst.maxLife, 0, 1);
      const expand = 1 + (1 - t) * 1.1;
      burst.mesh.scale.setScalar(expand);
      burst.mesh.rotation.y += dt * 6;
      burst.mesh.children.forEach((child, index) => {
        if (child.material) {
          child.material.opacity = (child.userData.baseOpacity ?? 0.8) * t;
        }
        const childScale = (child.userData.baseScale ?? 1) * (1 + (1 - t) * (index === 2 ? 1.5 : 0.55));
        child.scale.setScalar(childScale);
      });
      burst.light.intensity = 6.5 * t;
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      if (p.gravity) p.vel.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = p.life / 0.4;

      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.vel.y *= -0.3;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
    }
  }

  clear() {
    [...this.flashes, ...this.tracers, ...this.particles, ...this.bursts].forEach(item => {
      this.scene.remove(item.mesh);
      if (item.core) this.scene.remove(item.core);
      if (item.light) this.scene.remove(item.light);
    });
    this.flashes  = [];
    this.tracers  = [];
    this.particles = [];
    this.bursts = [];
  }
}

/**
 * Manages ammo state, reload timing, and firing rate.
 */
export class WeaponState {
  constructor() {
    this.magSize    = Infinity;
    this.totalAmmo  = Infinity;
    this.currentAmmo = Infinity;
    this.isReloading = false;
    this.reloadTime  = 2.0;
    this._reloadTimer = 0;
    this.fireRate   = 0.095; // seconds between shots (about 630 RPM)
    this._fireTimer = 0;
  }

  canShoot() {
    return !this.isReloading && this._fireTimer <= 0;
  }

  shoot() {
    if (!this.canShoot()) return false;
    this._fireTimer = this.fireRate;
    return true;
  }

  startReload() {
    this.isReloading = false;
    this._reloadTimer = 0;
  }

  update(dt) {
    if (this._fireTimer > 0) this._fireTimer -= dt;
  }

  reset() {
    this.magSize     = Infinity;
    this.totalAmmo   = Infinity;
    this.currentAmmo = Infinity;
    this.isReloading = false;
    this._reloadTimer = 0;
    this._fireTimer   = 0;
  }
}
