# System Architecture

## Core Design Philosophy
The Smart Tank Monitor follows a **"Database-First, Unified Store"** architecture. This eliminates the "split-brain" issues common in IoT apps where the UI, Server Memory, and Database become desynchronized.

---

## 1. The Unified Store Pattern
Instead of managing state separately on the client (React State) and server, we use **TanStack Store** on both ends.

### Server-Side (`lib/store.ts`)
- **Role**: The authoritative in-memory cache of the current fleet status.
- **Hydration**: On boot, it `hydrates` from the SQLite database. This ensures that only valid, persistent nodes are loaded into memory.
- **Reconciliation**: If a node is in memory but NOT in the DB, it is purged. This prevents "Zombie Nodes".

### Client-Side (`components/telemetry-provider.tsx`)
- **Role**: A reactive mirror of the server store.
- **Sync**: It initializes by fetching the full roster from the API (DB source).
- **Live Updates**: It listens to `tank-live-update` socket events to patch its local store in real-time.

---

## 2. Data Integrity Layers
To prevent "Ghost Nodes" (nodes that shouldn't exist but do), we implement a multi-layer defense:

1.  **Strict Gatekeeper (Socket Layer)**
    - When a device connects (`tank-identify`), the server checks the DB.
    - If the `secret` key is not found, the socket is immediately disconnected.
    - *Result*: Decommissioned hardware cannot send data or stay online.

2.  **Absolute Deletion (API Layer)**
    - When a user deletes a node, the API does 3 things atomically:
        1.  Deletes from SQLite.
        2.  Purges from Server Memory Store.
        3.  Broadcasts `tank-decommissioned` to all dashboards.
    - *Result*: 404 errors are impossible; the cleanup is enforced.

3.  **Unique Identity (Database Layer)**
    - Both `id` (UUID) and `device_id` (MAC Address) have `UNIQUE` constraints.
    - *Result*: Duplicate pairings are rejected at the schema level.

---

## 3. Telemetry Pipeline

1.  **Hardware Node (ESP8266/ESP32)**
    - Measures distance via Ultrasonic Sensor.
    - Connects via Socket.IO.
    - Emits `tank-identify` with a secret key.

2.  **Server (Next.js Custom Server)**
    - Validates Secret against DB.
    - Pushes Config (e.g., Tank Height) to device (`tank-config`).
    - Listens for `tank-update`.

3.  **Dashboard (React Client)**
    - Receives `tank-live-update` via Socket.IO.
    - Updates `TelemetryStore`.
    - UI Components re-render automatically.

---

## 4. Discovery Protocol (mDNS)
- **Nodes** broadcast `_smart-tank-node._tcp` via Bonjour/mDNS.
- **Server** scans for this service signature.
- **Dashboard** requests a scan via API (`/api/setup/scan`).
- **Pairing** allows the server to send generated credentials (Secret/ID) to the Node's HTTP config server.
