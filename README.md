# CodeCafé
![demo (2)](https://github.com/user-attachments/assets/e3752a5d-492f-4af9-b85e-dbe7b8a11510)


A real-time collaborative development environment that makes coding together as easy as sharing a document. Think VS Code, but multiplayer.

## Why CodeCafé?

We saw coding classes relying on tools meant for writing essays—not code. While they got the job done, they weren’t built for real-time programming. So we created CodeCafé: a seamless, browser-based coding environment designed for true collaboration, making it easier to teach, learn, and build together.

## Features

- **Real Dev Environment:** VS Code-like experience (Monaco Editor) with syntax highlighting, autocomplete, and error detection
- **True Collaboration:** Multiple users can code together in real-time
- **Run Your Code:** Execute code directly in the browser using Piston API
- **Language Support:** Python, Java, C++, JavaScript, and more
- **No Setup Required:** Everything runs in the browser

## Tech Stack

- **Frontend:** React + TypeScript
- **Backend:** Java Spring Boot
- **Real-time:** WebSocket
- **Session Management:** Redis
- **Code Execution:** Piston API

## Quick Start

```bash
# Clone repo
git clone https://github.com/mrktsm/codecafe.git

# Install dependencies & run backend
cd backend
./mvnw install
./mvnw spring-boot:run

# Install & run frontend
cd frontend
npm install
npm start
```

## Coming Soon

- User authentication
- Voice/text chat
- Session history
- More languages and tools

## License

CodeCafé is licensed under the GNU Affero General Public License v3.0.

---
Making collaborative coding accessible for everyone.
