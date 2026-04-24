import { Game } from './game.js';
import { preloadAllProps } from './scene.js';
import { syncBackgroundMusic, toggleBackgroundMusic } from './sound.js';

const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const loadingScreen = document.getElementById('loading-screen');
const startScreen = document.getElementById('start-screen');

const app = document.getElementById('app');
const game = new Game(app);

async function init() {
  loadingText.textContent = '正在加载场景资源...';
  loadingBar.style.width = '10%';

  await preloadAllProps((progress) => {
    const percent = Math.round(10 + progress * 80);
    loadingBar.style.width = `${percent}%`;
    loadingText.textContent = `正在加载资源 ${percent}%...`;
  });

  loadingBar.style.width = '90%';
  loadingText.textContent = '正在初始化游戏...';

  setTimeout(() => {
    loadingBar.style.width = '100%';
    loadingScreen.style.display = 'none';
    startScreen.style.display = 'flex';
  }, 200);
}

document.getElementById('start-btn').addEventListener('click', () => {
  startScreen.style.display = 'none';
  game.start();
  toggleBackgroundMusic();
  syncBackgroundMusic();
  game._syncMusicToggle();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('gameover-screen').style.display = 'none';
  game.restart();
});

init();