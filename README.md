# TeamCast 🏈

A real-time AI-powered podcast platform for Super Bowl pre-game analysis. Built with Next.js, LiveKit, and Gemini AI.

## Features

- **🎙️ AI-Generated Podcasts** - Real-time podcast generation using Gemini AI with two AI hosts (Marcus & Jordan)
- **💬 Interactive Comments** - Listeners can comment, and the AI hosts will address popular comments on air
- **👥 Live Listening Rooms** - LiveKit-powered rooms supporting up to 100 concurrent listeners
- **🔊 Gemini TTS** - Natural text-to-speech using Gemini 2.5 Flash TTS
- **⚡ Real-time** - Continuous podcast generation with pre-buffered tracks

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Real-time**: LiveKit (audio rooms, participant management)
- **AI**: Google Gemini (script generation, TTS)
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+
- LiveKit Cloud account (or self-hosted LiveKit server)
- Google Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd teamcast
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Fill in your credentials in `.env.local`:
```env
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
GEMINI_API_KEY=your_gemini_api_key
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
teamcast/
├── app/
│   ├── api/
│   │   ├── livekit/        # LiveKit token generation
│   │   ├── podcast/        # Script & TTS generation
│   │   ├── comments/       # Comment handling & summarization
│   │   └── room/           # Room status
│   ├── room/[roomId]/      # Room page
│   └── page.tsx            # Landing page
├── components/
│   ├── Room.tsx            # Main room component
│   ├── AudioPlayer.tsx     # Podcast audio player
│   ├── Comments.tsx        # Live chat
│   └── ParticipantList.tsx # Listener list
└── lib/
    ├── types.ts            # TypeScript types
    ├── livekit.ts          # LiveKit utilities
    ├── gemini.ts           # Gemini API integration
    └── podcast-engine.ts   # Track queue management
```

## How It Works

1. **Join Room**: Users enter a username and join a podcast room
2. **Podcast Generation**: The system generates podcast scripts using Gemini
3. **TTS Conversion**: Scripts are converted to audio using Gemini 2.5 Flash TTS
4. **Streaming**: Audio is streamed to all room participants via LiveKit
5. **Comments**: Listener comments are collected and summarized
6. **Interactive Segments**: Every 2 minutes or 50 comments, the AI hosts address audience questions

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | Your LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NEXT_PUBLIC_APP_URL` | (Optional) Your app URL |

## License

MIT

---

Built with ❤️ for Super Bowl fans
