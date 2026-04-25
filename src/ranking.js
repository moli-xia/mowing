const BLOCKED_WORDS = [
  'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'crap', 'piss', 'dick', 'cock',
  'pussy', 'sex', 'nigger', 'nigga', 'faggot', 'slut', 'whore', 'douche', 'turd', 'bullshit',
  '死', '杀', '砍', '奸', '淫', '赌', '毒', '嫖', '娼', '妓', '肏', '操', '妈', '逼',
  '尻', '屄', '屌', '你妈', '他妈的', '去你妈', '我草', '我操', '狗屎', '王八', '混蛋',
  '白痴', '智障', '傻逼', '傻b', '装逼', '脑残', '废物', '人渣', '畜生', '禽兽',
  '黄', '赌', '毒', '博', '彩', '嫖', '娼', '妓', '色情', '裸', '露', '成人',
  '共产党', '共匪', '郭文贵', '郭文贵', '江泽民', '胡锦涛', '习近平', '温家宝',
  '法轮功', '全能神', '华藏宗门', '呼喊派', '门徒会', '统一教', '科学教派',
  'ISIS', '基地组织', '塔利班', '博讯', '希望之声', '大纪元', '新唐人', '看中国',
];

const BLOCKED_CHARS = ['@', '#', '$', '%', '^', '&', '*', '!', '~', '`', '<', '>', '/', '\\', '|', '"', "'", ':', ';', '\n', '\t'];

export function containsBlockedWord(text) {
  const lower = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return true;
    }
  }
  return false;
}

export function containsBlockedChar(text) {
  for (const char of BLOCKED_CHARS) {
    if (text.includes(char)) {
      return true;
    }
  }
  return false;
}

export function isValidUsername(username) {
  if (!username || username.trim().length === 0) return { valid: false, reason: '用户名不能为空' };
  if (username.trim().length < 2) return { valid: false, reason: '用户名至少2个字符' };
  if (username.trim().length > 16) return { valid: false, reason: '用户名最多16个字符' };
  if (containsBlockedChar(username)) return { valid: false, reason: '用户名包含非法字符' };
  if (containsBlockedWord(username)) return { valid: false, reason: '用户名包含禁止词汇' };
  return { valid: true, reason: '' };
}

const DEFAULT_API_BASE = window.location.origin;
let apiBase = DEFAULT_API_BASE;

export function setRankingApiBase(base) {
  apiBase = typeof base === 'string' && base.trim() ? base.trim().replace(/\/$/, '') : DEFAULT_API_BASE;
}

async function requestRankingApi(path, options = {}) {
  const url = `${apiBase}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const result = await response.json().catch(() => ({
    success: false,
    error: `服务器返回了无效响应 (${response.status})`,
  }));

  if (!response.ok || result.success === false) {
    throw new Error(result.error || `请求失败 (${response.status})`);
  }

  return result;
}

export async function getTopPlayers(count = 100) {
  const result = await requestRankingApi('/api/rankings');
  return Array.isArray(result.players) ? result.players.slice(0, count) : [];
}

export async function savePlayerRecord(username, kills, wave, headshots = 0, maxStreak = 0) {
  return requestRankingApi('/api/rankings', {
    method: 'POST',
    body: JSON.stringify({
      username: username.trim(),
      kills,
      wave,
      headshots,
      maxStreak,
    }),
  });
}

export async function renderLeaderboard(container, maxCount = 100) {
  if (!container) return;

  container.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'leaderboard-title';
  title.textContent = '排行榜 TOP 100';
  container.appendChild(title);

  const loading = document.createElement('div');
  loading.className = 'leaderboard-empty';
  loading.textContent = '加载中...';
  container.appendChild(loading);

  try {
    const topPlayers = await getTopPlayers(maxCount);
    loading.remove();

    if (topPlayers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'leaderboard-empty';
      empty.textContent = '暂无排名记录';
      container.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'leaderboard-list';

    topPlayers.forEach((player, index) => {
      const rank = index + 1;
      const item = document.createElement('div');
      item.className = `leaderboard-item rank-${rank}`;

      let rankLabel = '';
      if (rank === 1) rankLabel = '🥇';
      else if (rank === 2) rankLabel = '🥈';
      else if (rank === 3) rankLabel = '🥉';
      else rankLabel = `#${rank}`;

      const dateStr = new Date(player.date).toLocaleDateString('zh-CN');

      const header = document.createElement('div');
      header.className = 'leaderboard-header';

      const rankEl = document.createElement('span');
      rankEl.className = 'leaderboard-rank';
      rankEl.textContent = rankLabel;

      const nameEl = document.createElement('span');
      nameEl.className = 'leaderboard-name';
      nameEl.textContent = player.username;
      nameEl.title = player.username;

      const dateEl = document.createElement('span');
      dateEl.className = 'leaderboard-date';
      dateEl.textContent = dateStr;

      header.append(rankEl, nameEl, dateEl);

      const meta = document.createElement('div');
      meta.className = 'leaderboard-meta';
      meta.append(
        createMetaBadge('leaderboard-kills', `${player.kills} 击杀`),
        createMetaBadge('leaderboard-headshots', `爆头 ${player.headshots || 0}`),
        createMetaBadge('leaderboard-streak', `连杀 ${player.maxStreak || 0}`),
        createMetaBadge('leaderboard-wave', `Wave ${player.wave}`),
      );

      item.append(header, meta);
      list.appendChild(item);
    });

    container.appendChild(list);
  } catch (error) {
    console.warn('Failed to render leaderboard:', error);
    loading.textContent = '排行榜加载失败，请稍后重试';
  }
}

function createMetaBadge(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

export async function downloadRankingJSON() {
  const data = await requestRankingApi('/api/rankings');
  const blob = new Blob([JSON.stringify({ players: data.players || [] }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rankings.json';
  a.click();
  URL.revokeObjectURL(url);
}
