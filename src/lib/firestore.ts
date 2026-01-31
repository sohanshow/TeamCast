import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    increment,
    writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================
// Types
// ============================================

export interface Room {
    id: string;
    roomId: string; // URL-friendly ID (e.g., "superbowl-2026")
    name: string;
    basePrompt: string;
    isActive: boolean;
    listenerCount: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface Comment {
    id: string;
    text: string;
    userId: string;
    username: string;
    roomId: string;
    createdAt: Timestamp;
}

export interface Participant {
    id: string;
    odId: string;
    userName: string;
    roomId: string;
    joinedAt: Timestamp;
}

// ============================================
// Rooms Collection
// ============================================

/**
 * Get all rooms
 */
export async function getRooms(): Promise<Room[]> {
    const snapshot = await getDocs(collection(db, 'rooms'));
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Room[];
}

/**
 * Get all active rooms
 */
export async function getActiveRooms(): Promise<Room[]> {
    const q = query(
        collection(db, 'rooms'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Room[];
}

/**
 * Get a room by its URL-friendly roomId
 */
export async function getRoomByRoomId(roomId: string): Promise<Room | null> {
    const q = query(
        collection(db, 'rooms'),
        where('roomId', '==', roomId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Room;
}

/**
 * Get a room by document ID
 */
export async function getRoom(docId: string): Promise<Room | null> {
    const docRef = doc(db, 'rooms', docId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Room;
}

/**
 * Create or update a room (upsert by roomId)
 */
export async function upsertRoom(
    roomData: Omit<Room, 'id' | 'listenerCount' | 'createdAt' | 'updatedAt'>
): Promise<Room> {
    // Check if room already exists
    const existingRoom = await getRoomByRoomId(roomData.roomId);
    
    if (existingRoom) {
        // Update existing room
        const docRef = doc(db, 'rooms', existingRoom.id);
        await updateDoc(docRef, {
            ...roomData,
            updatedAt: serverTimestamp(),
        });
        return { ...existingRoom, ...roomData };
    } else {
        // Create new room
        const docRef = await addDoc(collection(db, 'rooms'), {
            ...roomData,
            listenerCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return { 
            id: docRef.id, 
            ...roomData, 
            listenerCount: 0 
        };
    }
}

/**
 * Update a room
 */
export async function updateRoom(
    roomId: string,
    updates: Partial<Omit<Room, 'id'>>
): Promise<void> {
    const existingRoom = await getRoomByRoomId(roomId);
    if (!existingRoom) throw new Error('Room not found');
    
    const docRef = doc(db, 'rooms', existingRoom.id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a room and all its related data (comments, participants)
 */
export async function deleteRoomWithData(roomId: string): Promise<void> {
    const existingRoom = await getRoomByRoomId(roomId);
    if (!existingRoom) throw new Error('Room not found');
    
    const batch = writeBatch(db);
    
    // Delete all comments for this room
    const commentsSnapshot = await getDocs(
        query(collection(db, 'comments'), where('roomId', '==', roomId))
    );
    commentsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    // Delete all participants for this room
    const participantsSnapshot = await getDocs(
        query(collection(db, 'participants'), where('roomId', '==', roomId))
    );
    participantsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    // Delete the room itself
    batch.delete(doc(db, 'rooms', existingRoom.id));
    
    await batch.commit();
}

/**
 * Subscribe to active rooms (real-time)
 */
export function subscribeToActiveRooms(
    callback: (rooms: Room[]) => void
): () => void {
    const q = query(
        collection(db, 'rooms'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Room[];
        callback(rooms);
    });
}

/**
 * Subscribe to a single room (real-time)
 */
export function subscribeToRoom(
    roomId: string,
    callback: (room: Room | null) => void
): () => void {
    const q = query(
        collection(db, 'rooms'),
        where('roomId', '==', roomId)
    );
    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            callback(null);
            return;
        }
        const doc = snapshot.docs[0];
        callback({ id: doc.id, ...doc.data() } as Room);
    });
}

// ============================================
// Comments Collection
// ============================================

/**
 * Get all comments for a room
 */
export async function getComments(roomId: string): Promise<Comment[]> {
    const q = query(
        collection(db, 'comments'),
        where('roomId', '==', roomId),
        orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Comment[];
}

/**
 * Add a comment
 */
export async function addComment(
    commentData: Omit<Comment, 'id' | 'createdAt'>
): Promise<Comment> {
    const docRef = await addDoc(collection(db, 'comments'), {
        ...commentData,
        createdAt: serverTimestamp(),
    });
    return {
        id: docRef.id,
        ...commentData,
        createdAt: Timestamp.now(),
    };
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
    const docRef = doc(db, 'comments', commentId);
    await deleteDoc(docRef);
}

/**
 * Subscribe to comments for a room (real-time)
 */
export function subscribeToComments(
    roomId: string,
    callback: (comments: Comment[]) => void
): () => void {
    const q = query(
        collection(db, 'comments'),
        where('roomId', '==', roomId),
        orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
        const comments = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Comment[];
        callback(comments);
    });
}

// ============================================
// Participants Collection
// ============================================

/**
 * Get all participants in a room
 */
export async function getParticipants(roomId: string): Promise<Participant[]> {
    const q = query(
        collection(db, 'participants'),
        where('roomId', '==', roomId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Participant[];
}

/**
 * Join a room (add participant)
 */
export async function joinRoom(
    participantData: Omit<Participant, 'id' | 'joinedAt'>
): Promise<string> {
    // Check if user is already in the room
    const existingQ = query(
        collection(db, 'participants'),
        where('roomId', '==', participantData.roomId),
        where('odId', '==', participantData.odId)
    );
    const existingSnapshot = await getDocs(existingQ);
    
    if (!existingSnapshot.empty) {
        // Already joined, return existing ID
        return existingSnapshot.docs[0].id;
    }
    
    // Add participant
    const docRef = await addDoc(collection(db, 'participants'), {
        ...participantData,
        joinedAt: serverTimestamp(),
    });

    // Increment listener count on room
    const room = await getRoomByRoomId(participantData.roomId);
    if (room) {
        const roomRef = doc(db, 'rooms', room.id);
        await updateDoc(roomRef, {
            listenerCount: increment(1),
        });
    }

    return docRef.id;
}

/**
 * Leave a room (remove participant)
 */
export async function leaveRoom(
    roomId: string,
    odId: string
): Promise<void> {
    // Find and delete the participant document
    const q = query(
        collection(db, 'participants'),
        where('roomId', '==', roomId),
        where('odId', '==', odId)
    );
    const snapshot = await getDocs(q);

    for (const participantDoc of snapshot.docs) {
        await deleteDoc(participantDoc.ref);
    }

    // Decrement listener count on room
    const room = await getRoomByRoomId(roomId);
    if (room && room.listenerCount > 0) {
        const roomRef = doc(db, 'rooms', room.id);
        await updateDoc(roomRef, {
            listenerCount: increment(-1),
        });
    }
}

/**
 * Subscribe to participants (real-time)
 */
export function subscribeToParticipants(
    roomId: string,
    callback: (participants: Participant[]) => void
): () => void {
    const q = query(
        collection(db, 'participants'),
        where('roomId', '==', roomId)
    );
    return onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Participant[];
        callback(participants);
    });
}
