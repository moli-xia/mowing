# 绝地收割 (Final Mowing)

一款基于 WebGL 的僵尸围城射击游戏。玩家需要在不断增强的尸潮中生存下来，并将自己的成绩提交到服务器排行榜。

当前版本支持：

- 浏览器直接运行游戏
- 服务器统一保存排行榜数据
- Docker 容器部署
- 通过 Nginx / 宝塔面板接入正式域名和 HTTPS

## 在线特性

- 流畅的 WASD 移动与鼠标瞄准射击
- 多波次僵尸进攻与递增难度
- 小地图、音效、爆头与连杀反馈
- 所有玩家共享的服务器排行榜

## 项目截图

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
- Docker

## 项目结构

```text
.
├── src/                      # 前端源码
├── public/                   # 静态资源
├── dist/                     # 构建后的生产文件
├── server.py                 # 排行榜接口与静态文件服务
├── rankings.json             # 默认排行榜数据文件
├── deploy/                   # systemd / nginx 示例配置
├── Dockerfile                # Docker 镜像构建文件
├── .dockerignore             # Docker 构建忽略规则
└── docker-compose.yml.example
```

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动前端开发环境

```bash
npm run dev
```

### 构建生产文件

```bash
npm run build
```

### 本地启动完整服务

```bash
python3 server.py
```

启动后可访问：

- 游戏页面：`http://127.0.0.1:8000/`
- 排行榜接口：`http://127.0.0.1:8000/api/rankings`
- 健康检查：`http://127.0.0.1:8000/healthz`

## 排行榜说明

旧版本排行榜使用浏览器 `localStorage`，换浏览器或换设备后数据会消失。当前版本已经改为服务器统一存储：

- 前端通过 `/api/rankings` 获取排行榜
- 游戏结束后通过 `/api/rankings` 提交成绩
- 所有成绩写入服务器端的 `rankings.json`
- 同一用户名默认只保留最佳成绩，避免刷榜刷屏

## 常规部署思路

推荐将游戏拆成两部分部署：

1. Nginx 直接提供 `dist/` 静态页面
2. Python 进程运行 `server.py`，处理 `/api/rankings` 与 `/healthz`

也就是说：

- 外部用户访问：`https://你的域名/`
- Python 服务监听：`127.0.0.1:8000`
- Nginx 将 `/api/` 和 `/healthz` 反向代理到 `127.0.0.1:8000`

## Debian / Ubuntu 部署

### 1. 安装基础环境

```bash
sudo apt update
sudo apt install -y python3 nginx
```

### 2. 准备项目目录

```bash
sudo mkdir -p /www/wwwroot/final-mowing
sudo chown -R $USER:$USER /www/wwwroot/final-mowing
```

### 3. 上传运行文件

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

### 5. 检查服务状态

```bash
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/api/rankings
```

## Docker 部署

项目支持直接使用 Docker 运行。镜像会：

- 在容器内运行 `server.py`
- 对外暴露 `8000` 端口
- 默认从 `/data/rankings.json` 读写排行榜数据
- 通过挂载 `/data` 实现数据持久化

### 构建镜像

```bash
docker build -t mowing:latest .
```

### 运行容器

```bash
docker run -d   --name mowing   -p 8000:8000   -v $(pwd)/mowing-data:/data   --restart unless-stopped   mowing:latest
```

### 检查容器

```bash
docker ps
docker logs -f mowing
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/api/rankings
```

### 使用 Docker Compose

仓库中提供了示例文件：`docker-compose.yml.example`

```bash
cp docker-compose.yml.example docker-compose.yml
mkdir -p mowing-data
docker compose up -d
```

## 数据持久化

推荐把排行榜数据单独挂载到宿主机目录，这样容器升级、删除、重建后数据仍然保留。

### 挂载目录

```bash
mkdir -p /srv/mowing-data
docker run -d   --name mowing   -p 8000:8000   -v /srv/mowing-data:/data   --restart unless-stopped   mowing:latest
```

此时排行榜文件会保存在：

```text
/srv/mowing-data/rankings.json
```

### 挂载单独文件

```bash
mkdir -p /srv/mowing-data
touch /srv/mowing-data/rankings.json
docker run -d   --name mowing   -p 8000:8000   -v /srv/mowing-data/rankings.json:/data/rankings.json   --restart unless-stopped   mowing:latest
```

## 宝塔面板部署

这是最适合大多数宝塔用户的方式。

### 1. 添加网站

在宝塔面板中：

- 进入 `网站`
- 添加你的正式域名
- 网站根目录设置为：`/www/wwwroot/final-mowing/dist`

注意：

- 不要把站点目录设置为 `/www/wwwroot/final-mowing`
- 项目根目录没有用于 Nginx 直接访问的首页文件，通常会返回 `403`
- 正确做法是让站点目录指向 `dist/`

### 2. 上传文件

将运行文件上传到：

```text
/www/wwwroot/final-mowing
```

推荐结构：

```text
/www/wwwroot/final-mowing/
├── dist/
├── server.py
├── rankings.json
├── Dockerfile
└── deploy/
```

### 3. 启动后端服务

你可以选择以下任意一种方式：

- Python 项目管理器
- PM2 管理器
- Docker 管理器

### 4. Python 项目管理器建议填写

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

如果 `Version` 是空白，说明宝塔里还没有安装 Python 版本，需要先安装 Python 3。

### 5. PM2 启动方式

```bash
cd /www/wwwroot/final-mowing
pm2 start server.py --interpreter python3 --name final-mowing
pm2 save
```

### 6. 反向代理配置

宝塔网站目录保持指向 `dist/`，然后在站点里新增反向代理：

- `代理目录`：`/api/`
- `目标 URL`：`http://127.0.0.1:8000`

再增加一条：

- `代理目录`：`/healthz`
- `目标 URL`：`http://127.0.0.1:8000`

### 7. SSL 证书

SSL 证书配置在宝塔的 Nginx 站点上，而不是配置在 Python 脚本里。

也就是说：

- 外部访问：`https://你的域名/`
- 内部转发：`http://127.0.0.1:8000`

用户不需要也不应该直接访问：

```text
https://你的域名:8000/
```

## Nginx 反向代理示例

仓库中提供了示例文件：

- `deploy/nginx-final-mowing.conf`

如果你手工写 Nginx，至少需要如下代理规则：

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

## 常见问题

### 网站根目录指向项目根目录后出现 403

原因：

- Nginx 网站目录不能直接指向项目根目录
- 应该指向 `dist/`

解决：

- 网站目录改成 `/www/wwwroot/final-mowing/dist`

### 页面能打开，但排行榜为空

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

### Python 项目管理器里 Version 为空

原因：

- 宝塔里还没安装 Python 版本

解决：

- 去宝塔软件商店安装 Python 3.9 或 Python 3.10
- 安装后刷新页面再创建项目

### 用户换浏览器后看不到之前的成绩

旧版本会这样，因为数据存在 `localStorage`。当前版本不会，因为现在成绩统一写在服务器 `rankings.json` 中。

### 为什么会有 8000 端口

`8000` 是 Python 服务内部监听端口，不是给用户直接访问的端口。

用户真正访问的是：

- `https://你的域名/`

Nginx 会把请求转发到：

- `127.0.0.1:8000`

### Docker 容器删除后排行榜丢失

原因：

- 没有挂载 `/data`

解决：

- 使用 `-v /srv/mowing-data:/data`
- 或挂载单独文件到 `/data/rankings.json`

## 系统要求

- 现代浏览器（Chrome、Firefox、Edge、Safari）
- 支持 WebGL 2.0
- 键盘 + 鼠标
- Python 3.8+
- Docker 26+（如果使用容器部署）

## License

MIT
