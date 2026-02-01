# TeamCast 🏈

A real-time AI-powered podcast platform for Super Bowl pre-game analysis. Built with Next.js, LiveKit, Gemini AI, and Firebase.

## Developed by

Aashrit Luthra, Vineet Reddy, Sohan Show

## Features

- **🎙️ AI-Generated Podcasts** - Real-time podcast generation using Gemini AI with two AI hosts (Marcus & Jordan)
- **📡 Live Broadcasting** - Host broadcasts podcast via LiveKit, listeners tune in
- **💬 Interactive Comments** - Listeners can comment, and the AI hosts address popular comments on air in real-time
- **👥 Live Listening Rooms** - LiveKit-powered rooms supporting concurrent listeners with team-based organization
- **🔊 Gemini TTS** - Natural text-to-speech using Gemini 2.5 Flash TTS with distinct voices (Kore & Puck)
- **🔥 Firebase Firestore** - Real-time sync for rooms, comments, and participants
- **⚙️ Admin Panel** - Create/manage rooms with custom prompts, monitor active broadcasts, and reset data
- **📊 Team Analytics Panel** - Live play-by-play analytics for teams (Seahawks & Patriots) with pass/rush distribution, 3rd down rates, and play type breakdowns
- **🎬 Game Analysis** - NFL play analytics with field visualization, tendency charts, and AI-powered scene descriptions
- **🎥 Video Generation** - AI-powered video generation using Google Veo 3.1 for play visualizations

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Real-time Audio**: LiveKit (audio streaming, participant management)
- **AI**: Google Gemini 2.0 Flash (script generation), Gemini 2.5 Flash TTS (text-to-speech)
- **Video Generation**: Google Veo 3.1
- **Database**: Firebase Firestore (real-time sync)
- **Data Pipeline**: Python (NFL Big Data Bowl enrichment)
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
- Python 3.x (for game analysis pipeline)
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

### Game Analysis Pipeline Setup (Optional)

For NFL play analysis features:

```bash
cd playgenerate
pip install -r requirements.txt
```

## Usage

### For Admins (Broadcasting)

1. Go to `/admin` to access the admin panel
2. Create a new room with a custom base prompt (e.g., "Super Bowl 2026 pre-game analysis between Patriots and Seahawks")
3. Click **🎙️ Broadcast** to open the host page
4. Click **Start Broadcasting** to begin generating and streaming the podcast
5. Keep the host page open while broadcasting

### For Listeners

1. Go to the landing page `/`
2. Enter your display name
3. Select your team (Patriots or Seahawks)
4. Click on your team card to join their broadcast room
5. Use the chat to send comments - the AI hosts may address them!
6. Click **📊 Coach Analytics** to view live team play analytics

### Game Analysis

1. Go to `/game-analysis` for NFL play analytics
2. Click **⚡ Process Plays** to load and analyze play data
3. Browse plays, view field visualizations, and tendency charts
4. Generate AI-powered scene descriptions for plays

## Project Structure

```
TeamCast/
├── app/
│   ├── api/
│   │   ├── admin/rooms/       # Room CRUD operations
│   │   ├── livekit/           # Token generation (host & user)
│   │   ├── podcast/           # Script & TTS generation
│   │   ├── comments/          # Comment handling & summarization
│   │   ├── rooms/             # Active rooms API
│   │   ├── room/status/       # Room status & comment batching
│   │   ├── team-analytics/    # Team play analytics API
│   │   └── game-analysis/     # Play processing & video generation
│   ├── admin/                 # Admin panel
│   ├── host/[roomId]/         # Host broadcasting page
│   ├── room/[roomId]/         # Listener room page
│   ├── game-analysis/         # NFL play analytics page
│   ├── assets/                # Team images & logos
│   └── page.tsx               # Landing page with team selection
├── components/
│   ├── Room.tsx               # Listener room component
│   ├── Comments.tsx           # Live chat with Firestore sync
│   ├── ParticipantList.tsx    # Listener list
│   ├── TeamAnalyticsPanel.tsx # Team play analytics panel
│   ├── AudioPlayer.tsx        # Audio playback component
│   └── game-analysis/         # Game analysis components
│       ├── FieldVisualization.tsx
│       ├── PlayAnalytics.tsx
│       ├── PlayCard.tsx
│       ├── PlayDetailPanel.tsx
│       ├── TendencyChart.tsx
│       └── VideoPlayer.tsx
├── lib/
│   ├── types.ts               # TypeScript types & speaker config
│   ├── livekit.ts             # LiveKit token utilities
│   ├── gemini.ts              # Gemini API (script + TTS)
│   ├── firestore-server.ts    # Server-side Firestore
│   └── podcast-engine.ts      # In-memory track queue
├── src/lib/
│   ├── firebase.ts            # Firebase client init
│   └── firestore.ts           # Client-side Firestore
├── playgenerate/              # NFL play data pipeline
│   ├── src/
│   │   ├── enrichment/        # ESPN API integration
│   │   ├── generation/        # Scene & video generation
│   │   └── pipeline.py        # Main entry point
│   ├── output/                # Generated outputs
│   └── data/                  # NFL Big Data Bowl data
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
3. **Gemini generates script** based on the room's base prompt with conversation context
4. **Gemini TTS converts** script to audio with distinct voices for each host
5. **Host publishes audio** to LiveKit room (track published on first audio play)
6. **Listeners join** and hear the stream via LiveKit with cycling team images
7. **Comments are collected** and prioritized - AI hosts address them in real-time
8. **Team analytics** are available for listeners to view play-by-play data

## AI Hosts

| Host | Voice | Role |
|------|-------|------|
| Marcus | Kore | Lead Analyst - Analytical, data-driven, strategic insights |
| Jordan | Puck | Color Commentator - Energetic, fan-focused, emotional takes |

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy Firestore rules:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Admin Commands

Reset all Firestore data and LiveKit rooms:
```bash
curl -X DELETE http://localhost:3000/api/admin/reset-firestore
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

Built with ❤️ for Super Bowl LIX fans • TeamCast © 2026
