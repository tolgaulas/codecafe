# CodeCafé: Where Code Comes Alive, Together. 🚀

A hyper-collaborative, real-time development environment right in your browser. CodeCafé makes pair programming, teaching, and building web projects together as fluid and instant as sharing a thought.

![demo (2)](https://github.com/user-attachments/assets/e3752a5d-492f-4af9-b85e-dbe7b8a11510)
[Click here to watch the demo video!](https://youtu.be/dvediMrxoQg)

## Why CodeCafé?

We saw coding classes juggling tools built for essays, not engineers. Existing solutions felt clunky for the dynamic nature of real-time programming. CodeCafé was born from the need for a seamless, browser-based coding space designed from the ground up for _true_ collaboration. Learn, teach, and build—together, instantly.

## Core Features

- **Pixel-Perfect Live Preview:** See your HTML, CSS, and JavaScript changes render _instantly_ in an integrated iframe view. What you code is what you see!
- **True Real-Time Collaboration:** Powered by Operational Transformation, multiple users can type in the same files simultaneously, with conflicts resolved seamlessly.
- **VS Code Feel:** Enjoy a familiar, rich editing experience (via Monaco Editor) with syntax highlighting, smart suggestions, and error checking.
- **Multi-Language Backend Execution:** Run Python, Java, C++, and more server-side using the robust Piston API (results appear in the integrated terminal).
- **Zero Setup:** Dive straight into coding. Everything runs in the browser.

## Tech Stack

- **Frontend:** React + TypeScript, Monaco Editor, Framer Motion
- **Backend:** Java Spring Boot
- **Real-time Collaboration:** WebSocket + Operational Transformation (OT)
- **Code Execution (Backend):** Piston API

## Quick Start

```bash
# Clone the cosmic code
git clone https://github.com/mrktsm/codecafe.git
cd codecafe

# Ignite the backend furnace
cd backend
./mvnw install
./mvnw spring-boot:run

# Launch the frontend portal
cd ../frontend
npm install
npm start
```

## On the Horizon

- User authentication & persistent projects
- Integrated voice/text chat
- Session rewind & history playback
- Expanded language support & tooling

## License

CodeCafé is licensed under the GNU Affero General Public License v3.0.

---

_Making collaborative coding magic accessible to everyone._ ✨
