# CodeCafé: Code Together, Instantly.

A hyper-collaborative, real-time development environment right in your browser. CodeCafé makes pair programming, teaching, and building web projects together as fluid and instant as sharing a thought.

[Try CodeCafé Live!](https://www.codecafe.app/)

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

**Prerequisites:**
*   Git
*   Java JDK (17 or higher recommended)
*   Maven
*   Node.js (18 or higher recommended)
*   npm (9 or higher recommended)
*   **Redis Server** (Installation methods vary - see [Redis Quick Start](https://redis.io/learn/howtos/quick-start))

**Steps:**

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/mrktsm/codecafe.git
    cd codecafe
    ```

2.  **Start Redis:**
    Ensure your Redis server is running. If installed locally, the command might be:
    ```bash
    redis-server
    ```
    (This command might differ based on your OS and installation method. If using Docker, start your Redis container.)
    _Keep Redis running in a separate terminal window or run it as a background service._

3.  **Run the Backend:**
    *   Navigate to the backend directory.
    *   *(Optional: Configure Redis connection in `backend/src/main/resources/application.properties` if not using `localhost:6379`)*
    ```bash
    cd backend
    ./mvnw install
    ./mvnw spring-boot:run
    ```
    The backend API will be available at `http://localhost:8080` (or configured port).

4.  **Run the Frontend:**
    *   Navigate to the frontend directory.
    *   **Create a `.env` file** in the `frontend` directory (`frontend/.env`).
    *   Add the following line to the `.env` file, specifying the URL where your backend is running:
        ```dotenv
        VITE_BACKEND_URL=http://localhost:8080
        ```
        *(Adjust the URL if your backend is running on a different port or host).*
    *   Now, install dependencies and start the development server:
        ```bash
        cd ../frontend
        npm install
        npm run dev
        ```
    Access the app in your browser, usually at `http://localhost:5173` (check terminal output for the exact URL).

## On the Horizon

- User authentication & persistent projects
- Integrated voice/text chat
- Session rewind & history playback
- Expanded language support & tooling

## License

CodeCafé is licensed under the GNU Affero General Public License v3.0.

---

_Making collaborative coding magic accessible to everyone._ ✨
