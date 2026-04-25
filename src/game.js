import * as THREE from 'three';
import { createGround, createObstacles, PLAYABLE_HALF_SIZE, setupLighting } from './scene.js';
import { createPlayer } from './player.js';
import { ZombieManager, debrisList, updateDebris } from './zombie.js';
import { WeaponEffects, WeaponState } from './weapons.js';
import {
  initAudio,
  isBackgroundMusicEnabled,
  isSoundEffectsEnabled,
  playShoot,
  playWeakSpotHit,
  setMasterVolume,
  syncBackgroundMusic,
  toggleBackgroundMusic,
  toggleSoundEffects,
} from './sound.js';
import { savePlayerRecord } from './ranking.js';

export class Game {
  constructor(container) {
    this.container   = container;
    this.running      = false;
    this.kills        = 0;
    this.wave         = 1;
    this.health       = 3;
    this.username     = '';
    this.headshots    = 0;
    this.maxStreak    = 0;
    this.mouseAngle   = 0;     // horizontal aim angle (radians)
    this.mouseWorldX  = 0;
    this.mouseWorldZ  = 0;
    this.mouseScreenX = window.innerWidth * 0.5;
    this.mouseScreenY = window.innerHeight * 0.5;
    this.mouseNdc     = new THREE.Vector2(0, 0);
    this.keys         = {};
    this.isMouseDown  = false;
    this.obstacles    = [];
    this._wavePending = false; // guard: prevent multiple wave-spawn timeouts
    this._screenShakeTime = 0;
    this._screenShakeStrength = 0;
    this._streakShakeTime = 0;
    this._streakShakeStrength = 0;
    this._spreadAngle = 0;
    this._slowMoTime = 0;
    this._timeScale = 1;
    this._killStreak = 0;
    this._lastKillAt = 0;

    // HUD refs
    this.hudKills      = document.getElementById('kill-count');
    this.hudWave       = document.getElementById('wave-num');
    this.hudEnemyLeft  = document.getElementById('enemy-left');
    this.hudHearts     = [
      document.getElementById('heart-1'),
      document.getElementById('heart-2'),
      document.getElementById('heart-3'),
    ];
    this.hudAmmo       = document.getElementById('ammo-count');
    this.hudAmmoTotal  = document.getElementById('ammo-total');
    this.hudReloadMsg  = document.getElementById('reload-msg');
    this.hudHitFlash   = document.getElementById('hit-flash');
    this.hudCrosshair  = document.getElementById('crosshair');
    this.hudWaveWarn   = document.getElementById('wave-warning');
    this.hudStreak     = document.getElementById('streak-banner');
    this.hudMusicToggle = document.getElementById('music-toggle');
    this.hudSfxToggle   = document.getElementById('sfx-toggle');
    this.hudVolumeSlider = document.getElementById('volume-slider');
    this.hudVolumeValue  = document.getElementById('volume-value');
    this.gameoverScr   = document.getElementById('gameover-screen');
    this.gameoverScore = document.getElementById('gameover-score');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx    = this.minimapCanvas?.getContext('2d') || null;

    this._initRenderer();
    this._initScene();
    this._initMinimap();
    this._initInputs();

    // Start animation loop regardless (renders the title screen background)
    this._lastTime = performance.now();
    this._syncMusicToggle();
    this._syncSfxToggle();
    this._animate();
  }

  // ─────────────────────────────────────────
  //  RENDERER
  // ─────────────────────────────────────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.BasicShadowMap;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ─────────────────────────────────────────
  //  SCENE  (rebuilt on restart)
  // ─────────────────────────────────────────
  _initScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 10, -12);
    this.camera.lookAt(0, 0, 0);

    setupLighting(this.scene);
    createGround(this.scene);
    this.obstacles = createObstacles(this.scene);

    this.player       = createPlayer(this.scene);
    this.zombieMgr    = new ZombieManager(this.scene);
    this.weaponFx     = new WeaponEffects(this.scene);
    this.weaponState  = new WeaponState();
    this.raycaster    = new THREE.Raycaster();

    // Ground plane for mouse→world projection
    this.groundPlane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  }

  _initMinimap() {
    if (!this.minimapCanvas) return;
    this.minimapCanvas.width = 150;
    this.minimapCanvas.height = 150;
  }

  // ─────────────────────────────────────────
  //  INPUTS
  // ─────────────────────────────────────────
  _initInputs() {
    const isAudioToggleEvent = (e) => {
      if (!e) return false;
      const toggleEl = this.hudMusicToggle;
      const sfxEl = this.hudSfxToggle;
      const checkEl = (el) => {
        if (!el) return false;
        if (typeof e.composedPath === 'function') {
          return e.composedPath().includes(el);
        }
        return e.target === el || el.contains(e.target);
      };
      return checkEl(toggleEl) || checkEl(sfxEl);
    };

    window.addEventListener('pointerdown', e => {
      if (isAudioToggleEvent(e)) return;
      initAudio();
      syncBackgroundMusic();
    }, { passive: true });
    window.addEventListener('touchstart', e => {
      if (isAudioToggleEvent(e)) return;
      initAudio();
      syncBackgroundMusic();
    }, { passive: true });
    window.addEventListener('keydown', e => {
      initAudio();
      syncBackgroundMusic();
      this.keys[e.code] = true;
      if (e.code === 'KeyR' && this.running) this.weaponState.startReload();
    });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });

    window.addEventListener('mousemove', e => this._onMouseMove(e));
    window.addEventListener('mousedown', e => {
      if (isAudioToggleEvent(e)) return;
      initAudio();
      syncBackgroundMusic();
      if (e.button === 0) this.isMouseDown = true; 
    });
    window.addEventListener('mouseup',   e => { if (e.button === 0) this.isMouseDown = false; });
    window.addEventListener('contextmenu', e => e.preventDefault());
    this.hudMusicToggle?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await initAudio();
      toggleBackgroundMusic();
      this._syncMusicToggle();
    });
    this.hudSfxToggle?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await initAudio();
      toggleSoundEffects();
      this._syncSfxToggle();
    });
    this.hudVolumeSlider?.addEventListener('input', (e) => {
      const volume = parseInt(e.target.value, 10) / 100;
      setMasterVolume(volume);
      if (this.hudVolumeValue) {
        this.hudVolumeValue.textContent = `${e.target.value}%`;
      }
    });
  }

  _onMouseMove(e) {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
    if (this.hudCrosshair) {
      this.hudCrosshair.style.left = `${this.mouseScreenX}px`;
      this.hudCrosshair.style.top = `${this.mouseScreenY}px`;
    }

    // Project mouse onto ground plane for aim angle
    const ndcX =  (e.clientX / window.innerWidth)  * 2 - 1;
    const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    this.mouseNdc.set(ndcX, ndcY);

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);

    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);

    if (hit) {
      const pp = this.player.getPosition();
      const dx = target.x - pp.x;
      const dz = target.z - pp.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.001) {
        this.mouseAngle  = Math.atan2(dx, dz);
      }
      this.mouseWorldX = target.x;
      this.mouseWorldZ = target.z;
      
    }
  }

  // ─────────────────────────────────────────
  //  GAME LIFECYCLE
  // ─────────────────────────────────────────
  start(username) {
    this.username     = username || '匿名玩家';
    this.kills        = 0;
    this.wave         = 1;
    this.health       = 3;
    this.headshots    = 0;
    this.maxStreak    = 0;
    this.running      = true;
    this._wavePending = false;
    this._streakShakeTime = 0;
    this._streakShakeStrength = 0;
    this._spreadAngle = 0;
    this._killStreak = 0;
    this._lastKillAt = 0;
    this._slowMoTime = 0;
    this._timeScale = 1;
    this._updateHUD();
    this._spawnWave();
  }

  restart() {
    // Clear old scene objects
    this.zombieMgr.clearAll();
    this.weaponFx.clear();
    debrisList.length = 0;

    // Rebuild scene (new obstacle layout)
    this.scene.clear();
    setupLighting(this.scene);
    createGround(this.scene);
    this.obstacles = createObstacles(this.scene);
    this.player    = createPlayer(this.scene);
    this.zombieMgr = new ZombieManager(this.scene);
    this.weaponFx  = new WeaponEffects(this.scene);
    
    this.weaponState.reset();
    this.kills        = 0;
    this.wave         = 1;
    this.health       = 3;
    this.headshots    = 0;
    this.maxStreak    = 0;
    this.running      = true;
    this._wavePending = false;
    this._streakShakeTime = 0;
    this._streakShakeStrength = 0;
    this._spreadAngle = 0;
    this._killStreak = 0;
    this._lastKillAt = 0;
    this._slowMoTime = 0;
    this._timeScale = 1;
    this._updateHUD();
    this._spawnWave();
  }

  _spawnWave() {
    this._wavePending = false;
    const count = 10 + (this.wave - 1) * 5;
    this.zombieMgr.spawn(count, this.player.getPosition(), this.obstacles);
    this._updateHUD();
  }

  _showWaveWarning(text, durationMs = 1200) {
    if (!this.hudWaveWarn) return;
    this.hudWaveWarn.textContent = text;
    this.hudWaveWarn.classList.add('active');
    clearTimeout(this._warnHideTimer);
    this._warnHideTimer = setTimeout(() => {
      this.hudWaveWarn.classList.remove('active');
    }, durationMs);
  }

  _gameOver() {
    this.running = false;
    if (this.username) {
      void savePlayerRecord(this.username, this.kills, this.wave, this.headshots, this.maxStreak);
    }
    this.gameoverScore.textContent = `${this.username} - 击杀数: ${this.kills} - 爆头: ${this.headshots} - 最大连杀: ${this.maxStreak} - Wave: ${this.wave}`;
    this.gameoverScr.style.display = 'flex';
  }

  // ─────────────────────────────────────────
  //  HUD
  // ─────────────────────────────────────────
  _updateHUD() {
    const ammoDisplay = Number.isFinite(this.weaponState.currentAmmo) ? this.weaponState.currentAmmo : '∞';
    const totalAmmoDisplay = Number.isFinite(this.weaponState.totalAmmo) ? this.weaponState.totalAmmo : '∞';

    this.hudKills.textContent     = this.kills;
    this.hudWave.textContent      = `WAVE ${this.wave}`;
    this.hudEnemyLeft.textContent = `${this.zombieMgr.getAliveCount()} ENEMIES`;
    this.hudAmmo.textContent      = ammoDisplay;
    this.hudAmmoTotal.textContent  = `/ ${totalAmmoDisplay}`;
    this.hudReloadMsg.style.display = this.weaponState.isReloading ? 'block' : 'none';

    if (this.hudHearts) {
      for (let i = 0; i < this.hudHearts.length; i++) {
        const heart = this.hudHearts[i];
        if (!heart) continue;
        if (i < this.health) {
          heart.classList.remove('empty');
        } else {
          if (!heart.classList.contains('empty')) {
            heart.classList.add('lost');
            setTimeout(() => heart.classList.remove('lost'), 300);
          }
          heart.classList.add('empty');
        }
      }
    }
  }

  _triggerHitFlash() {
    this.hudHitFlash.classList.add('active');
    setTimeout(() => this.hudHitFlash.classList.remove('active'), 150);
  }

  _triggerMuzzleFlash() {
    this.hudCrosshair.classList.add('shooting');
    setTimeout(() => this.hudCrosshair.classList.remove('shooting'), 80);
  }

  _triggerCrosshairHit(weakSpot = false) {
    if (!this.hudCrosshair) return;
    this.hudCrosshair.classList.remove('hit-confirm', 'weakspot-hit');
    void this.hudCrosshair.offsetWidth;
    this.hudCrosshair.classList.add('hit-confirm');
    if (weakSpot) this.hudCrosshair.classList.add('weakspot-hit');
    setTimeout(() => {
      this.hudCrosshair.classList.remove('hit-confirm', 'weakspot-hit');
    }, weakSpot ? 180 : 140);
  }

  _triggerScreenShake(strength = 0.18, duration = 0.09) {
    this._screenShakeStrength = Math.max(this._screenShakeStrength, strength);
    this._screenShakeTime = Math.max(this._screenShakeTime, duration);
  }

  _triggerNearMissShake() {
    this._triggerScreenShake(0.05, 0.035);
  }

  _triggerStreakShake(strength = 0.28, duration = 0.48) {
    this._streakShakeStrength = Math.max(this._streakShakeStrength, strength);
    this._streakShakeTime = Math.max(this._streakShakeTime, duration);
  }

  _syncMusicToggle() {
    if (!this.hudMusicToggle) return;
    const enabled = isBackgroundMusicEnabled();
    this.hudMusicToggle.textContent = enabled ? 'MUSIC ON' : 'MUSIC OFF';
    this.hudMusicToggle.classList.toggle('off', !enabled);
  }

  _syncSfxToggle() {
    if (!this.hudSfxToggle) return;
    const enabled = isSoundEffectsEnabled();
    this.hudSfxToggle.textContent = enabled ? 'SFX ON' : 'SFX OFF';
    this.hudSfxToggle.classList.toggle('off', !enabled);
  }

  _worldToMinimap(position, padding = 12) {
    if (!this.minimapCanvas) return { x: 0, y: 0 };
    const size = this.minimapCanvas.width;
    const drawable = size - padding * 2;
    const normalizedX = (position.x + PLAYABLE_HALF_SIZE) / (PLAYABLE_HALF_SIZE * 2);
    const normalizedZ = (position.z + PLAYABLE_HALF_SIZE) / (PLAYABLE_HALF_SIZE * 2);

    return {
      x: padding + THREE.MathUtils.clamp(normalizedX, 0, 1) * drawable,
      y: padding + THREE.MathUtils.clamp(normalizedZ, 0, 1) * drawable,
    };
  }

  _drawMinimap() {
    if (!this.minimapCanvas || !this.minimapCtx || !this.player || !this.zombieMgr) return;

    const ctx = this.minimapCtx;
    const { width, height } = this.minimapCanvas;
    const padding = 12;
    const innerSize = width - padding * 2;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#091015';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, padding);
    ctx.lineTo(width * 0.5, height - padding);
    ctx.moveTo(padding, height * 0.5);
    ctx.lineTo(width - padding, height * 0.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,220,170,0.28)';
    ctx.strokeRect(padding, padding, innerSize, innerSize);

    const zombiePositions = this.zombieMgr.getAlivePositions();
    ctx.fillStyle = '#ff5c5c';
    zombiePositions.forEach(position => {
      const point = this._worldToMinimap(position, padding);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    const playerPos = this.player.getPosition();
    const playerPoint = this._worldToMinimap(playerPos, padding);
    const facingLength = 10;
    const facingX = Math.sin(this.mouseAngle) * facingLength;
    const facingY = Math.cos(this.mouseAngle) * facingLength;

    ctx.strokeStyle = '#8cffb0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playerPoint.x, playerPoint.y);
    ctx.lineTo(playerPoint.x + facingX, playerPoint.y + facingY);
    ctx.stroke();

    ctx.fillStyle = '#3dff81';
    ctx.beginPath();
    ctx.arc(playerPoint.x, playerPoint.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px Segoe UI';
    ctx.fillText(`${zombiePositions.length}`, width - 18, 16);
  }

  _showStreakBanner(text, { headshot = false, durationMs = 800 } = {}) {
    if (!this.hudStreak) return;
    this.hudStreak.textContent = text;
    this.hudStreak.classList.remove('headshot', 'active');
    if (headshot) this.hudStreak.classList.add('headshot');
    void this.hudStreak.offsetWidth;
    this.hudStreak.classList.add('active');
    clearTimeout(this._streakHideTimer);
    this._streakHideTimer = setTimeout(() => {
      this.hudStreak.classList.remove('active', 'headshot');
    }, durationMs);
  }

  _registerKillFeedback(weakSpot = false) {
    const now = performance.now();
    this._killStreak = now - this._lastKillAt < 1250 ? this._killStreak + 1 : 1;
    this._lastKillAt = now;

    if (weakSpot) {
      this.headshots++;
      this._slowMoTime = Math.max(this._slowMoTime, 0.12);
    }

    if (this._killStreak > this.maxStreak) {
      this.maxStreak = this._killStreak;
    }

    if (this._killStreak >= 2) {
      const streakLabels = {
        2: '双杀',
        3: '三连杀',
        4: '狂暴连杀',
      };
      const label = streakLabels[this._killStreak] || `${this._killStreak}连杀`;
      this._showStreakBanner(weakSpot ? `${label} 爆头!` : `${label}!`, {
        headshot: weakSpot,
        durationMs: this._killStreak >= 3 ? 1050 : 820,
      });
      this._triggerScreenShake(0.18 + Math.min(0.08, this._killStreak * 0.018), 0.09 + Math.min(0.04, this._killStreak * 0.01));
      if (this._killStreak >= 3) {
        const streakProgress = THREE.MathUtils.clamp((this._killStreak - 3) / 7, 0, 1);
        this._triggerStreakShake(
          THREE.MathUtils.lerp(0.12, 0.34, streakProgress),
          THREE.MathUtils.lerp(0.28, 0.68, streakProgress)
        );
      }
      return;
    }

    if (weakSpot) {
      this._showStreakBanner('爆头!', { headshot: true, durationMs: 720 });
      this._triggerScreenShake(0.22, 0.11);
    }
  }

  _setCrosshairTargeting(isTargeting) {
    if (!this.hudCrosshair) return;
    this.hudCrosshair.classList.toggle('targeting', isTargeting);
  }

  _getObstacleHit(raycaster) {
    const obstacleRoots = this.obstacles.map(o => o.mesh).filter(Boolean);
    if (obstacleRoots.length === 0) {
      return { distance: Infinity, point: null };
    }
    const hits = raycaster.intersectObjects(obstacleRoots, true);
    if (hits.length === 0) {
      return { distance: Infinity, point: null };
    }
    return {
      distance: hits[0].distance,
      point: hits[0].point.clone(),
    };
  }

  _getCursorAimInfo() {
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const obstacleHit = this._getObstacleHit(this.raycaster);
    const directZombieTarget = this.zombieMgr.getDirectAimTarget(this.raycaster, obstacleHit.distance);

    const groundPoint = new THREE.Vector3();
    const hasGroundPoint = this.raycaster.ray.intersectPlane(this.groundPlane, groundPoint);

    return {
      directZombieTarget,
      zombieTarget: directZombieTarget,
      obstacleDistance: obstacleHit.distance,
      obstaclePoint: obstacleHit.point,
      groundPoint: hasGroundPoint ? groundPoint.clone() : null,
      farPoint: this.raycaster.ray.origin.clone().addScaledVector(this.raycaster.ray.direction, 120),
    };
  }

  _getShotDirection(muzzlePos) {
    const aimInfo = this._getCursorAimInfo();
    const aimDir = this.player.getAimDirection().clone().normalize();
    const spreadAmount = 0.02 + this._spreadAngle;
    const spreadYaw = (Math.random() - 0.5) * spreadAmount;
    const spreadPitch = (Math.random() - 0.5) * spreadAmount * 0.65;
    aimDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadYaw);
    const right = new THREE.Vector3().crossVectors(aimDir, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() > 0.0001) {
      right.normalize();
      aimDir.applyAxisAngle(right, spreadPitch);
    }
    aimDir.normalize();
    const targetPoint = muzzlePos.clone().addScaledVector(aimDir, 180);

    return {
      aimInfo,
      targetPoint,
      aimDir,
    };
  }

  _handleZombieKilled(killPos, weakSpot = false) {
    this.kills++;
    this._registerKillFeedback(weakSpot);
    if (killPos) {
      if (weakSpot) this.weaponFx.spawnHeadshotEffect(killPos);
      else this.weaponFx.spawnHitEffect(killPos);
    }
  }

  // ─────────────────────────────────────────
  //  SHOOTING
  // ─────────────────────────────────────────
  _tryShoot() {
    if (!this.weaponState.canShoot()) return;
    if (!this.weaponState.shoot()) return;
    this._spreadAngle = Math.min(0.14, this._spreadAngle + 0.02);

    initAudio();
    playShoot();
    this._triggerMuzzleFlash();

    // Trigger player shooting animation
    if (this.player.triggerShoot) this.player.triggerShoot();

    const muzzlePos  = this.player.getMuzzleWorldPosition();
    const { aimInfo, targetPoint, aimDir } = this._getShotDirection(muzzlePos);
    this.raycaster.set(muzzlePos, aimDir);

    // Raycast against obstacles first to enforce physical occlusion.
    const obstacleHit = this._getObstacleHit(this.raycaster);
    const obstacleDistance = obstacleHit.distance;

    // Raycast against zombies (blocked if obstacle is closer).
    const shotResult = this.zombieMgr.hitTest(
      this.raycaster,
      (killPos, weakSpot) => this._handleZombieKilled(killPos, weakSpot),
      obstacleDistance
    );

    // Stop tracer at whichever is closer: obstacle or zombie.
    const hitZombie = shotResult.hit;
    const zombieDistance = shotResult.point ? shotResult.point.distanceTo(muzzlePos) : Infinity;
    const actualHitDistance = Math.min(obstacleDistance, zombieDistance);

    this.weaponFx.fireMuzzleFlash(muzzlePos, aimDir, actualHitDistance);
    if (hitZombie && !shotResult.killed && shotResult.point) {
      if (shotResult.weakSpot) this.weaponFx.spawnHeadshotEffect(shotResult.point);
      else this.weaponFx.spawnHitEffect(shotResult.point);
    }
    if (hitZombie) {
      this._triggerScreenShake(
        shotResult.killed ? (shotResult.weakSpot ? 0.46 : 0.34) : (shotResult.weakSpot ? 0.32 : 0.16),
        shotResult.killed ? (shotResult.weakSpot ? 0.2 : 0.14) : (shotResult.weakSpot ? 0.14 : 0.08)
      );
      this._triggerCrosshairHit(shotResult.weakSpot);
      if (shotResult.weakSpot) playWeakSpotHit();
    } else {
      this._triggerNearMissShake();
    }

    // If an obstacle blocks the line of fire, show impact effect there.
    if (!hitZombie && obstacleHit.point) {
      this.weaponFx.spawnHitEffect(obstacleHit.point);
    }

    this._updateHUD();
  }

  // ─────────────────────────────────────────
  //  CAMERA  (third-person follow)
  // ─────────────────────────────────────────
  _updateCamera(dt) {
    const pp = this.player.getPosition();

    // Fixed isometric camera offset for solid control feel
    const offset = new THREE.Vector3(0, 16, 12);

    // Pan camera slightly towards mouse for better visibility
    const lookOffsetX = (this.mouseWorldX - pp.x) * 0.15;
    const lookOffsetZ = (this.mouseWorldZ - pp.z) * 0.15;
    
    const maxPan = 3.0;
    const clampedX = Math.max(-maxPan, Math.min(maxPan, lookOffsetX));
    const clampedZ = Math.max(-maxPan, Math.min(maxPan, lookOffsetZ));

    const targetPos = new THREE.Vector3(
      pp.x + offset.x + clampedX,
      offset.y,
      pp.z + offset.z + clampedZ
    );

    if (this._screenShakeTime > 0) {
      const shake = this._screenShakeStrength * (this._screenShakeTime / 0.12);
      targetPos.x += (Math.random() - 0.5) * shake;
      targetPos.y += (Math.random() - 0.5) * shake * 0.45;
      targetPos.z += (Math.random() - 0.5) * shake;
      this._screenShakeTime = Math.max(0, this._screenShakeTime - dt);
      this._screenShakeStrength = Math.max(0, this._screenShakeStrength - dt * 2.8);
    }
    const streakPulse = this._streakShakeTime > 0
      ? this._streakShakeStrength * (0.58 + Math.sin(performance.now() * 0.06) * 0.36)
      : 0;
    if (this._streakShakeTime > 0) {
      this._streakShakeTime = Math.max(0, this._streakShakeTime - dt);
      this._streakShakeStrength = Math.max(0, this._streakShakeStrength - dt * 0.42);
    }

    // Smooth camera follow
    this.camera.position.lerp(targetPos, 5 * dt);
    if (streakPulse > 0) {
      this.camera.position.x += (Math.random() - 0.5) * streakPulse;
      this.camera.position.y += (Math.random() - 0.5) * streakPulse * 0.18;
      this.camera.position.z += (Math.random() - 0.5) * streakPulse;
    }
    
    // Locked camera angle relative to position to prevent jitter and rotational nausea
    const lookTarget = new THREE.Vector3(
      this.camera.position.x - offset.x,
      1.2,
      this.camera.position.z - offset.z
    );
    if (streakPulse > 0) {
      lookTarget.x += (Math.random() - 0.5) * streakPulse * 0.24;
      lookTarget.y += (Math.random() - 0.5) * streakPulse * 0.08;
      lookTarget.z += (Math.random() - 0.5) * streakPulse * 0.24;
    }
    this.camera.lookAt(lookTarget);
  }

  // ─────────────────────────────────────────
  //  MAIN LOOP
  // ─────────────────────────────────────────
  _animate() {
    requestAnimationFrame(() => this._animate());

    const now = performance.now();
    const rawDt  = Math.min((now - this._lastTime) / 1000, 0.05); // cap 50ms
    this._lastTime = now;
    if (this._slowMoTime > 0) {
      this._slowMoTime = Math.max(0, this._slowMoTime - rawDt);
    }
    const targetTimeScale = this._slowMoTime > 0 ? 0.36 : 1;
    this._timeScale = THREE.MathUtils.lerp(this._timeScale, targetTimeScale, this._slowMoTime > 0 ? 0.32 : 0.16);
    const dt = rawDt * this._timeScale;

    if (this.running) {
      this._spreadAngle = Math.max(0, this._spreadAngle - rawDt * (this.isMouseDown ? 0.018 : 0.04));

      // Player update
      this.player.update(dt, this.keys, this.mouseAngle, this.obstacles.map(o => o));

      // Auto-fire on mouse held
      if (this.isMouseDown) this._tryShoot();

      // Weapon state (reload timer, fire cooldown)
      this.weaponState.update(dt);

      // Zombie AI
      this.zombieMgr.update(dt, this.player.getPosition(), (dmg) => {
        this.health -= 1;
        this._triggerHitFlash();
        this._updateHUD();
        if (this.health <= 0) this._gameOver();
      }, this.obstacles);

      // VFX
      this.weaponFx.update(dt);
      updateDebris(dt);

      // Wave completion check (guard with _wavePending to fire only once)
      if (this.zombieMgr.getAliveCount() === 0 && !this._wavePending) {
        this._wavePending = true;
        this.wave++;
        const nextWaveCount = 10 + (this.wave - 1) * 5;
        this._showWaveWarning(`警告：第 ${this.wave} 波即将来袭（${nextWaveCount} 只僵尸）`, 1600);
        setTimeout(() => this._spawnWave(), 1800);
      }

      // HUD ammo refresh every frame (reload progress)
      this._setCrosshairTargeting(!!this._getCursorAimInfo().zombieTarget);
      this._updateHUD();
      this._updateCamera(dt);

    }

    this._drawMinimap();
    this.renderer.render(this.scene, this.camera);
  }
}
