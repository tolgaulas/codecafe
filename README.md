# CodeCafé: Code Together, Instantly.

![Build](https://img.shields.io/github/actions/workflow/status/mrktsm/codecafe/ci.yml?branch=main&label=build&style=for-the-badge&logo=github)
![GitHub stars](https://img.shields.io/github/stars/mrktsm/codecafe?style=for-the-badge&logo=github&cacheSeconds=60)
![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen?style=for-the-badge)
![MIT License](https://img.shields.io/github/license/mrktsm/codecafe?style=for-the-badge&label=license)

A hyper-collaborative, real-time development environment right in your browser. CodeCafé makes pair programming, teaching, and building web projects together as fluid and instant as sharing a thought.

[Try CodeCafé Live!](https://codecafe.app/)

<!--
![image](https://github.com/user-attachments/assets/68590a84-a055-4876-8c66-8f446f83c038)
![Untitled design (12)](https://github.com/user-attachments/assets/4f1ed970-97d9-430c-89ba-a91f1ec17be4)
-->

![Untitled design (14)](https://github.com/user-attachments/assets/3f6875ac-58eb-4a57-8365-778e5a774304)

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

### Option 1: Using Docker (Recommended)

The easiest way to get started with CodeCafé is to use Docker:

```bash
# Clone the repo
git clone https://github.com/mrktsm/codecafe.git
cd codecafe

# Start all services using Docker Compose
docker-compose up
```

Access the app in your browser at http://localhost:80

### Option 2: Manual Setup

**Prerequisites:** Git, Java JDK 23+, Maven, Node.js 18+, npm 9+, Redis Server

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

## CI/CD Pipeline

CodeCafé uses GitHub Actions for continuous integration and deployment:

- **CI Pipeline:** Automatically runs tests for both frontend and backend on every pull request and push to main/develop branches.
- **CD Pipeline:** Automatically deploys:
  - Backend to AWS EC2 when pushing to the main branch
  - Frontend to Vercel when pushing to the main branch

### Setting up CI/CD for your fork:

1. **For AWS deployment:**

   - Add the following secrets to your GitHub repository:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_REGION`

2. **For Vercel deployment:**
   - Add the following secrets to your GitHub repository:
     - `VERCEL_TOKEN`
     - `VERCEL_ORG_ID`
     - `VERCEL_PROJECT_ID`

## On the Horizon

- User authentication & persistent projects
- Integrated voice/text chat
- Session rewind & history playback
- Expanded language support & tooling

## License

CodeCafé is open-sourced under the [MIT License](https://opensource.org/licenses/MIT).

---

_Making collaborative coding magic accessible to everyone._ ✨
