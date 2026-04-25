import { Game } from './game.js';
import { preloadAllProps } from './scene.js';
import { syncBackgroundMusic, toggleBackgroundMusic } from './sound.js';
import { isValidUsername, renderLeaderboard, setRankingApiBase } from './ranking.js';

const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const loadingScreen = document.getElementById('loading-screen');
const startScreen = document.getElementById('start-screen');
const usernameInput = document.getElementById('username-input');
const usernameError = document.getElementById('username-error');
const leaderboardContainer = document.getElementById('leaderboard-container');

const app = document.getElementById('app');
const game = new Game(app);

setRankingApiBase(window.__RANKING_API_BASE__ || window.location.origin);

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

  setTimeout(async () => {
    loadingBar.style.width = '100%';
    loadingScreen.style.display = 'none';
    startScreen.style.display = 'flex';
    if (leaderboardContainer) {
      await renderLeaderboard(leaderboardContainer, 100);
    }
  }, 200);
}

function validateAndStart() {
  const username = usernameInput ? usernameInput.value.trim() : '';
  const validation = isValidUsername(username);

  if (!validation.valid) {
    if (usernameError) {
      usernameError.textContent = validation.reason;
      usernameError.style.display = 'block';
    }
    return;
  }

  if (usernameError) {
    usernameError.style.display = 'none';
  }

  startScreen.style.display = 'none';
  game.start(username);
  toggleBackgroundMusic();
  syncBackgroundMusic();
  game._syncMusicToggle();
}

document.getElementById('start-btn').addEventListener('click', validateAndStart);

if (usernameInput) {
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      validateAndStart();
    }
  });

  usernameInput.addEventListener('input', () => {
    if (usernameError) {
      usernameError.style.display = 'none';
    }
  });
}

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('gameover-screen').style.display = 'none';
  game.restart();
});

init();
