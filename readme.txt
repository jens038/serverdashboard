🚀 ServerDashboard

A self-hosted dashboard to monitor and manage all your containers, services, and home-server applications — fully local, privacy-friendly, and customizable through the UI.

⭐ Features
📦 Add containers via UI (name, host/domain, port, protocol, type)
🟢 Online / offline status detection
🔗 Clickable tiles to open container dashboards instantly
🎬 Integrations ready (Plex, qBittorrent, Overseerr, Jellyfin, etc.)
💾 Persistent config stored locally in /app/data
🧩 Backend + frontend served from a single container
🔒 No external cloud — fully local
🌐 Runs on LAN, VM, NAS, or Docker Host
⚙️ Works great inside Portainer as a stack


📦 Installation
1. Clone the repository git clone https://github.com/jens038/serverdashboard.git > cd serverdashboard
2. Start the dashboard using Docker Compose > docker compose up -d
3. Open the dashboard > navigate to: http://<your-ip>:3232

🧱 Project Structure
serverdashboard/
│
├── backend/
│   ├── server.js          # Express backend + static file server
│   ├── Dockerfile         # Multi-stage build: frontend → backend → final image
│   └── package.json       # Backend dependencies only
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json       # Frontend dependencies only
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── api/
│       └── ...
│
├── docker-compose.yml     # Stack deploy file
└── README.md              # You are here 🙂

🐳 Docker Deployment
This project includes a multi-stage Dockerfile that:
Builds the frontend (Vite → /dist)
Installs backend dependencies
Merges both into a lightweight production container

📁 Data Storage
All user-configured containers are stored in:
./data/containers.config.json
Inside the container this maps to:
/app/data/containers.config.json
Remove this file to reset configuration.

📤 Deploying on Portainer
Open Portainer
Go to Stacks → Add Stack
Paste the contents of docker-compose.yml
Click Deploy the Stack

Visit:
http://<your-server-ip>:3232

Done! 🎉
Your dashboard is now fully running inside Portainer.

📝 License
Free for personal use

