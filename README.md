# CodeCafé: Code Together, Instantly.

A hyper-collaborative, real-time development environment right in your browser. CodeCafé makes pair programming, teaching, and building web projects together as fluid and instant as sharing a thought.

[Try CodeCafé Live!](https://codecafe.app/)

![image](https://github.com/user-attachments/assets/68590a84-a055-4876-8c66-8f446f83c038)


[Click here to watch the demo video!](https://youtu.be/FL0qg1Uo-MQ?si=czYlT2vyO6qMIyL1)


## Why CodeCafé?

We saw coding classes juggling tools built for essays, not engineers. Existing solutions felt clunky for the dynamic nature of real-time programming. CodeCafé was born from the need for a seamless, browser-based coding space designed from the ground up for _true_ collaboration. Learn, teach, and build—together, instantly.

## Core Features

- **Pixel-Perfect Live Preview:** See your HTML, CSS, and JavaScript changes render _instantly_ in an integrated Web View. What you code is what you see!
- **True Real-Time Collaboration:** Powered by Operational Transformation, multiple users can type in the same files simultaneously, with conflicts resolved seamlessly.
- **VS Code Feel:** Enjoy a familiar, rich editing experience (via Monaco Editor) with syntax highlighting, smart suggestions, and error checking.
- **Zero Setup:** Dive straight into coding. Everything runs in the browser.

## Tech Stack

- **Frontend:** React, TypeScript, Zustand (State Management), Tailwind CSS, Monaco Editor, Xterm.js (Integrated Terminal), Framer Motion, Axios, WebSocket Client
- **Backend:** Java Spring Boot, WebSocket API, Jackson (JSON Processing)
- **Real-time Collaboration:** Custom Operational Transformation (OT) Implementation
- **State Management / Messaging:** Redis (AWS ElastiCache) utilizing Lua Scripting for atomic operations
- **Hosting**: AWS EC2 (Backend), Vercel (Frontend), AWS ElastiCache (Redis)

## Real-Time Collaboration with Operational Transformation

At the heart of CodeCafé's seamless collaborative editing is our custom-built Operational Transformation (OT) system, implemented on both the frontend and backend.

### What is Operational Transformation?

Operational Transformation is the technology that powers real-time collaborative editing in systems like Google Docs. It allows multiple users to simultaneously edit the same document by:

1. Transforming operations (like insertions and deletions) to preserve user intentions
2. Ensuring eventual consistency across all clients
3. Resolving conflicts automatically when users edit the same regions of text

Our implementation handles the complex synchronization challenges of collaborative editing, including:
- Managing concurrent edits from multiple users
- Resolving edit conflicts deterministically
- Maintaining document consistency across all connected clients
- Preserving intention semantics of user operations

This enables truly fluid, Google Docs-like collaboration where everyone can type simultaneously without stepping on each other's toes.

## Quick Start

**Prerequisites:** Git, Java JDK 17+, Maven, Node.js 18+, npm 9+, Redis Server

**Setup and Run:**
```bash
# Clone the repo
git clone https://github.com/mrktsm/codecafe.git
cd codecafe

# Start Redis (keep this running in a separate terminal or as a background service)
redis-server &

# Create backend config file with Redis connection
mkdir -p backend/src/main/resources
echo "spring.redis.host=localhost
spring.redis.port=6379" > backend/src/main/resources/application.properties

# Run the backend
cd backend
./mvnw install
./mvnw spring-boot:run &

# Create frontend config and run
cd ../frontend
echo "VITE_BACKEND_URL=http://localhost:8080" > .env
npm install
npm run dev
```

Access the app in your browser at the URL shown in terminal (typically http://localhost:5173).

## On the Horizon

- User authentication & persistent projects
- Integrated voice/text chat
- Session rewind & history playback
- Expanded language support & tooling

## License

CodeCafé is licensed under the GNU Affero General Public License v3.0.

---

_Making collaborative coding magic accessible to everyone._ ✨
