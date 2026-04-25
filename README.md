# 绝地收割 (Final Mowing)

[English README](./README.en.md)

一款基于 WebGL 的俯视角打僵尸生存游戏。你需要在尸潮中尽可能活得更久，并把成绩提交到服务器排行榜。

## 特性

- 浏览器直接运行，无需安装客户端
- WASD 移动 + 鼠标瞄准射击
- 多波次敌人、连杀反馈和音效系统
- 服务器统一保存排行榜，避免本地数据丢失
- 支持 Docker 部署

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

## 本地开发

```bash
npm install
npm run dev
```

构建生产文件并启动本地服务：

```bash
npm run build
python3 server.py
```

默认地址：

- 游戏：`http://127.0.0.1:8000/`
- 排行榜接口：`http://127.0.0.1:8000/api/rankings`
- 健康检查：`http://127.0.0.1:8000/healthz`

## Docker 部署

镜像内会运行 `server.py`，并默认将排行榜读写到 `/data/rankings.json`。

### 方法 1：直接拉取 Docker Hub 镜像

适合直接上线，下面的命令已经包含数据分离挂载：

```bash
mkdir -p /srv/mowing-data
docker pull superneed/mowing:latest
docker run -d \
  --name mowing \
  -p 8000:8000 \
  -v /srv/mowing-data:/data \
  --restart unless-stopped \
  superneed/mowing:latest
```

排行榜数据会保存在宿主机：

```text
/srv/mowing-data/rankings.json
```

### 方法 2：本地构建镜像

适合你自己修改了代码后再部署：

```bash
docker build -t mowing:latest .
docker run -d \
  --name mowing \
  -p 8000:8000 \
  -v $(pwd)/mowing-data:/data \
  --restart unless-stopped \
  mowing:latest
```

### 部署后检查

```bash
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/api/rankings
```

## 部署说明

- 如果使用 Nginx 或宝塔，请把站点根目录指向 `dist/`
- 将 `/api/` 和 `/healthz` 反向代理到 `127.0.0.1:8000`
- 示例配置见 `deploy/nginx-final-mowing.conf`

## 项目结构

```text
.
├── src/            # 前端源码
├── public/         # 静态资源
├── dist/           # 构建产物
├── server.py       # 排行榜接口与静态文件服务
├── rankings.json   # 默认排行榜数据
├── deploy/         # 部署示例配置
├── Dockerfile
└── README.en.md
```

## License

MIT
