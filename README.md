# Smart Tank Monitor 🌊

A real-time, high-availability telemetry dashboard for monitoring liquid levels across multiple physical tanks. Built with Next.js, Socket.IO, and SQLite.

## Features

- 📡 **Real-Time Telemetry**: Sub-second updates via WebSocket.
- ⚡ **Zero-Latency UI**: Optimistic updates with authoritative server reconciliation.
- 🕵️ **Auto-Discovery**: Automatic local network scanning (mDNS) to find new nodes.
- 🔧 **Dynamic Configuration**: Configure tank height, capacity, and names directly from the dashboard.
- 👻 **Ghost Node Prevention**: Robust "Strict Gatekeeper" protocol to prevent stale data and zombie connections.
- 🌑 **Dark Mode**: Beautiful, responsive UI with automatic theme switching.
- 🧪 **Simulation Mode**: Built-in script to simulate multiple hardware nodes for testing.

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/tankmonitor.git
    cd tankmonitor
    ```

2.  **Run the automated helper script:**
    ```bash
    chmod +x run.sh
    ./run.sh
    ```
    This script will:
    - Install dependencies.
    - Initialize the SQLite database.
    - Start the development server.

3.  **Open your browser:**
    Navigate to [http://localhost:3000](http://localhost:3000).

---

## Manual Setup

If you prefer to run commands manually:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Initialize Database:**
    ```bash
    npx drizzle-kit push
    ```

3.  **Start Development Server:**
    ```bash
    npm run server-dev
    ```

## Simulation Mode 🧪

Want to test the dashboard without hardware? We've included a simulator.

1.  Open a new terminal window.
2.  Run the simulator script:
    ```bash
    npx tsx scripts/simulate-nodes.ts
    ```
3.  Go to the **System Discovery** page (`/setup`) in the dashboard.
4.  You will see "Simulated Tank Alpha/Beta/Gamma" appear. Install them to start streaming fake data!

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: SQLite (via Better-SQLite3)
- **ORM**: Drizzle ORM
- **Real-Time**: Socket.IO
- **State Management**: TanStack Store (Unified Client/Server State)
- **Styling**: Tailwind CSS
- **Discovery**: Bonjour / mDNS

## License

MIT
