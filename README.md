# TeamCast 🏈

A real-time AI-powered podcast platform for Super Bowl pre-game analysis. Built with Next.js, LiveKit, Gemini AI, and Firebase.

# Developed by:

Aashrit Luthra, Vineet Reddy, Sohan Show

## Features

- **🎙️ AI-Generated Podcasts** - Real-time podcast generation using Gemini AI with two AI hosts (Marcus & Jordan)
- **📡 Live Broadcasting** - Host broadcasts podcast via LiveKit, listeners tune in
- **💬 Interactive Comments** - Listeners can comment, and the AI hosts address popular comments on air
- **👥 Live Listening Rooms** - LiveKit-powered rooms supporting up to 100 concurrent listeners
- **🔊 Gemini TTS** - Natural text-to-speech using Gemini 2.5 Flash TTS
- **🔥 Firebase Firestore** - Persistent storage for rooms, comments, and participants
- **⚙️ Admin Panel** - Create/manage rooms with custom prompts

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Real-time Audio**: LiveKit (audio streaming, participant management)
- **AI**: Google Gemini (script generation, TTS)
- **Database**: Firebase Firestore
- **Package Manager**: pnpm
- **Deployment**: Vercel-ready

## Architecture

```
┌─────────────────┐     generates & publishes    ┌─────────────────┐
│   Host Page     │ ─────────────────────────►   │   LiveKit       │
│  /host/roomId   │         audio track          │    Server       │
└─────────────────┘                              └────────┬────────┘
                                                          │
                                                streams to all
                                                          │
                    ┌────────────────────────────────────┼────────────────────────────────────┐
                    ▼                                    ▼                                    ▼
             ┌──────────┐                         ┌──────────┐                         ┌──────────┐
             │  User 1  │                         │  User 2  │                         │  User N  │
             │ /room/x  │                         │ /room/x  │                         │ /room/x  │
             └──────────┘                         └──────────┘                         └──────────┘
              (listen only)                        (listen only)                        (listen only)
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- LiveKit Cloud account (or self-hosted LiveKit server)
- Google Gemini API key
- Firebase project with Firestore enabled

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd TeamCast
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Fill in your credentials in `.env.local`:
```env
# LiveKit
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Firebase (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

5. Run the development server:
```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Usage

### For Admins (Broadcasting)

1. Go to `/admin` to access the admin panel
2. Create a new room with a custom base prompt (e.g., "Super Bowl 2026 pre-game analysis between Chiefs and Eagles")
3. Click **🎙️ Broadcast** to open the host page
4. Click **Start Broadcasting** to begin generating and streaming the podcast
5. Keep the host page open while broadcasting

### For Listeners

1. Go to the landing page `/`
2. Enter your display name
3. Select an active room or enter a room code
4. Click **Join the Broadcast** to start listening
5. Use the chat to send comments - the AI hosts may address them!

## Project Structure

```
TeamCast/
├── app/
│   ├── api/
│   │   ├── admin/rooms/       # Room CRUD operations
│   │   ├── livekit/           # Token generation (host & user)
│   │   ├── podcast/           # Script & TTS generation
│   │   ├── comments/          # Comment handling
│   │   └── rooms/             # Active rooms API
│   ├── admin/                 # Admin panel
│   ├── host/[roomId]/         # Host broadcasting page
│   ├── room/[roomId]/         # Listener room page
│   └── page.tsx               # Landing page
├── components/
│   ├── Room.tsx               # Listener room component
│   ├── Comments.tsx           # Live chat with Firestore sync
│   └── ParticipantList.tsx    # Listener list
├── lib/
│   ├── types.ts               # TypeScript types
│   ├── livekit.ts             # LiveKit token utilities
│   ├── gemini.ts              # Gemini API (script + TTS)
│   ├── firestore-server.ts    # Server-side Firestore
│   └── podcast-engine.ts      # In-memory track queue
├── src/lib/
│   ├── firebase.ts            # Firebase client init
│   └── firestore.ts           # Client-side Firestore
├── firestore.rules            # Firestore security rules
└── firestore.indexes.json     # Firestore indexes
```

## Firestore Schema

| Collection | Fields | Description |
|------------|--------|-------------|
| `rooms` | `roomId`, `name`, `basePrompt`, `isActive`, `listenerCount`, `createdAt` | Podcast rooms with prompts |
| `comments` | `roomId`, `userId`, `username`, `text`, `timestamp`, `createdAt` | User comments per room |
| `participants` | `roomId`, `odId`, `userName`, `joinedAt` | Active listeners per room |

## How It Works

1. **Admin creates room** with a base prompt (topic context)
2. **Host starts broadcasting** from `/host/roomId`
3. **Gemini generates script** based on the room's base prompt
4. **Gemini TTS converts** script to audio
5. **Host publishes audio** to LiveKit room
6. **Listeners join** and hear the stream via LiveKit
7. **Comments are collected** and periodically addressed by AI hosts

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy Firestore rules:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```
5. Deploy to Vercel!

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |

## Scripts

```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm start      # Start production server
pnpm lint       # Run ESLint
```

## License

MIT

---

Built with ❤️ for Super Bowl fans
