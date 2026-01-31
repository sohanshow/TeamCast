import { NextRequest, NextResponse } from 'next/server';
import { 
  upsertRoom, 
  getRooms, 
  deleteRoomWithData,
  getRoomByRoomId
} from '@/lib/firestore-server';
import { RoomServiceClient } from 'livekit-server-sdk';

// Initialize LiveKit Room Service
const livekitHost = process.env.LIVEKIT_URL || '';
const apiKey = process.env.LIVEKIT_API_KEY || '';
const apiSecret = process.env.LIVEKIT_API_SECRET || '';

function getRoomService() {
  if (!livekitHost || !apiKey || !apiSecret) {
    throw new Error('LiveKit credentials not configured');
  }
  return new RoomServiceClient(livekitHost, apiKey, apiSecret);
}

// GET - List all rooms (syncs with LiveKit)
export async function GET() {
  try {
    // Try to get LiveKit rooms first
    let livekitRooms: { name: string; numParticipants: number }[] = [];
    try {
      const roomService = getRoomService();
      const rooms = await roomService.listRooms();
      livekitRooms = rooms.map(r => ({
        name: r.name,
        numParticipants: r.numParticipants,
      }));
      
      // Auto-register any LiveKit rooms that don't have configs yet
      for (const lkRoom of livekitRooms) {
        const existingConfig = await getRoomByRoomId(lkRoom.name);
        if (!existingConfig) {
          console.log(`[Admin] Auto-registering LiveKit room: ${lkRoom.name}`);
          await upsertRoom({
            roomId: lkRoom.name,
            name: lkRoom.name,
            basePrompt: '',
            isActive: true,
          });
        }
      }
    } catch (err) {
      console.warn('[Admin] Could not fetch LiveKit rooms:', err);
    }

    // Get all rooms from Firestore
    const rooms = await getRooms();

    // Merge with LiveKit room data
    const roomsWithStatus = rooms.map(room => {
      const livekitRoom = livekitRooms.find(r => r.name === room.roomId);
      return {
        roomId: room.roomId,
        name: room.name,
        basePrompt: room.basePrompt,
        isActive: room.isActive,
        createdAt: room.createdAt?.toMillis?.() || Date.now(),
        livekitActive: !!livekitRoom,
        participants: livekitRoom?.numParticipants || room.listenerCount || 0,
      };
    });

    return NextResponse.json({ rooms: roomsWithStatus });
  } catch (error) {
    console.error('[Admin] Error listing rooms:', error);
    return NextResponse.json(
      { error: 'Failed to list rooms' },
      { status: 500 }
    );
  }
}

// POST - Create or update a room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, name, basePrompt, isActive } = body;

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }

    // Create/update room in Firestore
    const room = await upsertRoom({
      roomId,
      name: name || roomId,
      basePrompt: basePrompt || '',
      isActive: isActive !== false,
    });

    // Create LiveKit room if it doesn't exist
    try {
      const roomService = getRoomService();
      await roomService.createRoom({
        name: roomId,
        emptyTimeout: 60 * 60, // 1 hour
        maxParticipants: 100,
      });
      console.log(`[Admin] Created LiveKit room: ${roomId}`);
    } catch (err) {
      // Room might already exist, that's fine
      console.log(`[Admin] LiveKit room may already exist: ${roomId}`);
    }

    return NextResponse.json({ 
      success: true, 
      room: {
        roomId: room.roomId,
        name: room.name,
        basePrompt: room.basePrompt,
        isActive: room.isActive,
        createdAt: Date.now(),
      }
    });
  } catch (error) {
    console.error('[Admin] Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a room and all related data
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }

    // Check if room exists in Firestore
    const room = await getRoomByRoomId(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Delete from LiveKit
    try {
      const roomService = getRoomService();
      await roomService.deleteRoom(roomId);
      console.log(`[Admin] Deleted LiveKit room: ${roomId}`);
    } catch (err) {
      console.warn(`[Admin] Could not delete LiveKit room: ${roomId}`, err);
    }

    // Delete room and all related data (comments, participants) from Firestore
    await deleteRoomWithData(roomId);
    console.log(`[Admin] Deleted Firestore room and related data: ${roomId}`);

    return NextResponse.json({ 
      success: true, 
      message: `Room ${roomId} and all related data deleted` 
    });
  } catch (error) {
    console.error('[Admin] Error deleting room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room' },
      { status: 500 }
    );
  }
}
