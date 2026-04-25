# Final Mowing

[中文说明](./README.md)

A top-down WebGL zombie survival game. Stay alive as long as you can, fight through growing enemy waves, and submit your score to the shared server leaderboard.

## Features

- Runs directly in the browser
- WASD movement with mouse aiming and shooting
- Progressive zombie waves, combo feedback, and sound effects
- Server-side leaderboard storage
- Docker-ready deployment

## Screenshots

<img src="https://raw.githubusercontent.com/moli-xia/mowing/master/demo1.png" alt="Screenshot" style="max-width:200px">
<br>
<img src="https://raw.githubusercontent.com/moli-xia/mowing/master/demo2.png" alt="Screenshot" style="max-width:600px">
<img src="https://raw.githubusercontent.com/moli-xia/mowing/master/demo3.png" alt="Screenshot" style="max-width:600px">

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Aim |
| Left Click | Shoot |
| R | Reload |
| ESC | Pause |

## Local Development

```bash
npm install
npm run dev
```

Build the production files and start the local server:

```bash
npm run build
python3 server.py
```

Default endpoints:

- Game: `http://127.0.0.1:8000/`
- Leaderboard API: `http://127.0.0.1:8000/api/rankings`
- Health check: `http://127.0.0.1:8000/healthz`

## Docker Deployment

The container runs `server.py` and stores leaderboard data in `/data/rankings.json`.

### Option 1: Pull from Docker Hub

This command includes a host volume for persistent data:

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

Leaderboard data is stored on the host at:

```text
/srv/mowing-data/rankings.json
```

### Option 2: Build Locally

Use this if you changed the code and want to deploy your own image:

```bash
docker build -t mowing:latest .
docker run -d \
  --name mowing \
  -p 8000:8000 \
  -v $(pwd)/mowing-data:/data \
  --restart unless-stopped \
  mowing:latest
```

### Post-Deploy Check

```bash
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/api/rankings
```

## Deployment Notes

- If you use Nginx or aaPanel, point the site root to `dist/`
- Reverse proxy `/api/` and `/healthz` to `127.0.0.1:8000`
- See `deploy/nginx-final-mowing.conf` for an example

## Project Structure

```text
.
├── src/            # Front-end source
├── public/         # Static assets
├── dist/           # Build output
├── server.py       # Static file and leaderboard server
├── rankings.json   # Default leaderboard data
├── deploy/         # Deployment examples
├── Dockerfile
└── README.md
```

## License

MIT
