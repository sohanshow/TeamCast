import { NextResponse } from 'next/server';
import { getActiveRooms } from '@/lib/firestore-server';

// GET - List all active rooms (for landing page)
export async function GET() {
  try {
    const rooms = await getActiveRooms();

    const activeRooms = rooms.map(room => ({
      roomId: room.roomId,
      name: room.name,
      listenerCount: room.listenerCount || 0,
      createdAt: room.createdAt?.toMillis?.() || Date.now(),
    }));

    return NextResponse.json({ rooms: activeRooms });
  } catch (error) {
    console.error('[Rooms API] Error fetching active rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}
