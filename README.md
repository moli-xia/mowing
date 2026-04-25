# 绝地收割 (Final Mowing)

一款基于 WebGL 的僵尸围城射击游戏，玩家需要在僵尸潮中保卫自己的阵地。项目现已支持服务器端统一排行榜，所有玩家成绩都会写入服务器 `rankings.json`，不再依赖浏览器本地存储。

## 游戏特性

- 🎮 第一人称射击：流畅的 WASD 移动 + 鼠标瞄准射击
- 🧟 僵尸围城：多波次僵尸进攻，难度递增
- 🌵 沙漠战场：精致的 3D 沙漠场景，包含多种障碍物
- 🎵 音效系统：背景音乐 + 射击/击杀音效
- 🏆 服务器排行榜：所有玩家共享同一份排行榜数据

<summary>项目截图</summary>
<img src="https://raw.githubusercontent.com/moli-xia/mowing/master/demo1.png" alt="项目截图" style="max-width:200px">
<br>
<img src="https://raw.githubusercontent.com/moli-xia/mowing/master/demo2.png" alt="项目截图" style="max-width:600px">
<img src="https://raw.githubusercontent.com/moli-xia/mowing/master/demo3.png" alt="项目截图" style="max-width:600px">

## 操作说明

| 按键 | 功能 |
|------|------|
| WASD | 移动 |
| 鼠标 | 瞄准 |
| 左键 | 射击 |
| R | 换弹 |
| ESC | 暂停 |

## 技术栈

- Three.js
- Vite
- Web Audio API
- Python 3 内置 HTTP 服务

## 项目结构

```text
.
├── src/                # 前端源码
├── public/             # 静态资源
├── server.py           # 服务器接口与静态文件服务
├── rankings.json       # 服务器排行榜数据
├── deploy/             # 部署示例配置
└── dist/               # 构建产物（运行 npm run build 后生成）
```

## 本地开发

### 仅开发前端

```bash
npm install
npm run dev
```

### 构建生产文件

```bash
npm run build
```

### 本地启动完整排行榜服务

```bash
python3 server.py
```

启动后可访问：

- 游戏页面：`http://127.0.0.1:8000/`
- 排行榜接口：`http://127.0.0.1:8000/api/rankings`
- 健康检查：`http://127.0.0.1:8000/healthz`

## 服务器排行榜说明

旧版本排行榜使用浏览器 `localStorage`，换浏览器或换设备后数据会消失。当前版本已经改为：

- 前端通过 `/api/rankings` 读取排行榜
- 游戏结束后通过 `/api/rankings` 提交成绩
- 所有成绩统一写入服务器根目录的 `rankings.json`
- 同一用户名默认只保留最佳成绩，避免刷屏

## 部署方式总览

生产环境推荐拆成两部分：

1. Nginx 直接提供 `dist/` 静态页面
2. Python 进程运行 `server.py`，负责 `/api/rankings` 和 `/healthz`

也就是说：

- 外部用户访问：`https://你的域名/`
- Nginx 站点根目录：`/www/wwwroot/final-mowing/dist`
- Python 服务内部监听：`127.0.0.1:8000`
- Nginx 再把 `/api/` 和 `/healthz` 反向代理到 `127.0.0.1:8000`

## 生产部署所需文件

最少需要上传：

- `dist/`
- `server.py`
- `rankings.json`
- `deploy/final-mowing.service`
- `deploy/final-mowing.env.example`
- `deploy/nginx-final-mowing.conf`

如果你想在生产机上继续开发或重新构建，再额外上传：

- `src/`
- `public/`
- `package.json`
- `package-lock.json`
- `index.html`

## Debian / Ubuntu 部署

### 1. 安装基础环境

```bash
sudo apt update
sudo apt install -y python3 nginx
```

### 2. 创建项目目录

```bash
sudo mkdir -p /www/wwwroot/final-mowing
sudo chown -R $USER:$USER /www/wwwroot/final-mowing
```

### 3. 上传项目文件

将以下文件上传到 `/www/wwwroot/final-mowing`：

- `dist/`
- `server.py`
- `rankings.json`
- `deploy/`

### 4. 手工测试启动

```bash
cd /www/wwwroot/final-mowing
python3 server.py
```

### 5. 检查服务是否正常

```bash
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/api/rankings
```

## 宝塔面板详细部署

这是最适合大多数宝塔用户的部署方式。

### 步骤 1：添加网站

在宝塔面板中：

- 进入 `网站`
- 添加你的正式域名
- 网站根目录设置为：`/www/wwwroot/final-mowing/dist`

注意：

- 不要把站点目录设置为 `/www/wwwroot/final-mowing`
- 因为根目录没有用于 Nginx 直接访问的首页文件，设置成项目根目录通常会返回 `403`
- 正确做法是让网站目录指向 `dist/`

### 步骤 2：上传文件

上传你打包好的项目文件到：

```text
/www/wwwroot/final-mowing
```

最终目录结构应该类似：

```text
/www/wwwroot/final-mowing/
├── dist/
├── server.py
├── rankings.json
└── deploy/
```

### 步骤 3：安装宝塔插件

推荐安装：

- Python 项目管理器
- PM2 管理器

推荐顺序：

1. 如果 Python 项目管理器可正常使用，就优先用它
2. 如果 Python 项目管理器版本选择为空或创建项目失败，就直接改用 PM2

### 步骤 4：Python 项目管理器填写说明

如果你使用宝塔 `Python 项目管理器`，推荐填写：

- `Name`：`final-mowing`
- `Path`：`/www/wwwroot/final-mowing`
- `Version`：选择已安装的 Python 3.9 或 Python 3.10
- `Framework`：`python`
- `Startup mode`：`python`
- `Startup file/dir`：`/www/wwwroot/final-mowing/server.py`
- `Port`：`8000`
- `Run user`：`www`
- `Command`：`python3 /www/wwwroot/final-mowing/server.py`
- `Install module now`：不勾
- `Start with the sys`：建议勾上

特别说明：

- 如果 `Version` 是空白，说明你还没有在宝塔中安装 Python 版本，必须先去安装 Python 3
- 如果它不允许 `Startup file/dir` 填文件，就填目录 `/www/wwwroot/final-mowing`，命令改为 `python3 server.py`

### 步骤 5：PM2 启动方式

如果你不想折腾 Python 项目管理器，直接用 PM2：

```bash
cd /www/wwwroot/final-mowing
pm2 start server.py --interpreter python3 --name final-mowing
pm2 save
```

查看状态：

```bash
pm2 status
pm2 logs final-mowing
```

### 步骤 6：宝塔反向代理配置

宝塔网站目录仍然保持指向 `dist/`，然后在站点里新增反向代理。

需要增加两个代理：

#### 代理 1

- 代理目录：`/api/`
- 目标 URL：`http://127.0.0.1:8000`

#### 代理 2

- 代理目录：`/healthz`
- 目标 URL：`http://127.0.0.1:8000`

### 步骤 7：SSL 证书

SSL 证书配置在宝塔的 Nginx 站点上，而不是配置在 Python 脚本里。

也就是说：

- 外部访问：`https://你的域名/`
- 内部转发：`http://127.0.0.1:8000`

用户不需要也不应该访问：

```text
https://你的域名:8000/
```

### 步骤 8：宝塔部署完成后的访问地址

- 游戏首页：`https://你的域名/`
- 排行榜接口：`https://你的域名/api/rankings`
- 健康检查：`https://你的域名/healthz`

## systemd 部署

如果你不用宝塔插件，也可以用系统服务。

### 环境变量文件

复制示例文件：

```bash
sudo cp deploy/final-mowing.env.example /etc/final-mowing.env
```

内容示例：

```env
GAME_HOST=127.0.0.1
GAME_PORT=8000
GAME_PROJECT_ROOT=/var/www/final-mowing
GAME_DIST_DIR=/var/www/final-mowing/dist
GAME_DATA_FILE=/var/www/final-mowing/rankings.json
```

### 启动 systemd

```bash
sudo cp deploy/final-mowing.service /etc/systemd/system/final-mowing.service
sudo systemctl daemon-reload
sudo systemctl enable --now final-mowing
sudo systemctl status final-mowing
```

## Nginx 配置文件示例

仓库提供了示例文件：

- `deploy/nginx-final-mowing.conf`

如果你手工写 Nginx，也至少需要如下代理规则：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /healthz {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 常见问题排查

### 1. 网站根目录指向项目根目录后出现 403

原因：

- Nginx 网站目录不能直接指向项目根目录
- 应该指向 `dist/`

解决：

- 网站目录改成 `/www/wwwroot/final-mowing/dist`

### 2. 页面能打开，但排行榜为空

原因通常是：

- Python 服务没有启动
- `/api/rankings` 没配置反向代理
- `rankings.json` 没有写权限

排查顺序：

```bash
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/api/rankings
```

然后浏览器打开：

```text
https://你的域名/api/rankings
```

### 3. Python 项目管理器里 Version 为空

原因：

- 宝塔里还没安装 Python 版本

解决：

- 去宝塔软件商店安装 Python 3.9 或 Python 3.10
- 安装后刷新页面再创建项目

### 4. 用户换浏览器后看不到之前的成绩

旧版本会这样，因为数据存在 `localStorage`。当前版本不会，因为现在成绩统一写在服务器 `rankings.json` 中。

### 5. 为什么会有 8000 端口

`8000` 是 Python 服务内部监听端口，不是给用户直接访问的端口。

用户真正访问的是：

- `https://你的域名/`

Nginx 会把请求转发到：

- `127.0.0.1:8000`

## 系统要求

- 现代浏览器（Chrome、Firefox、Edge、Safari）
- 支持 WebGL 2.0
- 键盘 + 鼠标
- Python 3.8+

## License

MIT
