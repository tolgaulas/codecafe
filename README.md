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

[Click here to see CodeCafé in action and learn how its OT works under the hood!](https://www.youtube.com/watch?v=NRYpmEbF7lk)

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

## CI/CD Pipeline

CodeCafé features a fully automated CI/CD pipeline built with GitHub Actions:

- **Continuous Integration:** Automated testing for both frontend and backend on every pull request and push
- **Continuous Deployment:** Automatic deployment to production (AWS EC2 + Vercel) when changes are merged to main
- **Quality Assurance:** Ensures code quality and prevents regressions before deployment

This enables rapid, reliable development cycles while maintaining production stability.

## Quick Start

Want to try CodeCafé locally? The easiest way is with Docker:

```bash
git clone https://github.com/mrktsm/codecafe.git
cd codecafe
docker-compose up
```

Access the app at http://localhost:80

For detailed setup instructions, development guidelines, and contribution information, see [CONTRIBUTING.md](CONTRIBUTING.md).

## On the Horizon

- User authentication & persistent projects
- Integrated voice/text chat
- Session rewind & history playback
- Expanded language support & tooling

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, guidelines, and how to get started.

## License

CodeCafé is open-sourced under the [MIT License](https://opensource.org/licenses/MIT).

---

_Making collaborative coding magic accessible to everyone._
