import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    increment,
} from 'firebase/firestore';
import { db } from './firebase.js';

// ============================================
// Types
// ============================================

export interface Room {
    id: string;
    title: string;
    status: 'live' | 'ended' | 'scheduled';
    teams: [string, string]; // The 2 NFL teams
    listenerCount: number;
    createdAt?: Timestamp;
}

export interface Comment {
    id: string;
    text: string;
    userId: string;
    userName: string;
    createdAt: Timestamp;
}

export interface Participant {
    id: string;
    userId: string;
    userName: string;
    joinedAt: Timestamp;
}

// ============================================
// Rooms
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
 * Get all live rooms
 */
export async function getLiveRooms(): Promise<Room[]> {
    const q = query(
        collection(db, 'rooms'),
        where('status', '==', 'live')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Room[];
}

/**
 * Get a room by ID
 */
export async function getRoom(roomId: string): Promise<Room | null> {
    const docRef = doc(db, 'rooms', roomId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Room;
}

/**
 * Create a new room
 */
export async function createRoom(
    roomData: Omit<Room, 'id' | 'listenerCount' | 'createdAt'>
): Promise<string> {
    const docRef = await addDoc(collection(db, 'rooms'), {
        ...roomData,
        listenerCount: 0,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

/**
 * Update a room
 */
export async function updateRoom(
    roomId: string,
    updates: Partial<Omit<Room, 'id'>>
): Promise<void> {
    const docRef = doc(db, 'rooms', roomId);
    await updateDoc(docRef, updates);
}

/**
 * Delete a room
 */
export async function deleteRoom(roomId: string): Promise<void> {
    const docRef = doc(db, 'rooms', roomId);
    await deleteDoc(docRef);
}

/**
 * Subscribe to a room (real-time updates)
 */
export function subscribeToRoom(
    roomId: string,
    callback: (room: Room | null) => void
): () => void {
    const docRef = doc(db, 'rooms', roomId);
    return onSnapshot(docRef, (snapshot) => {
        if (!snapshot.exists()) {
            callback(null);
            return;
        }
        callback({ id: snapshot.id, ...snapshot.data() } as Room);
    });
}

/**
 * Subscribe to all live rooms (real-time)
 */
export function subscribeToLiveRooms(
    callback: (rooms: Room[]) => void
): () => void {
    const q = query(
        collection(db, 'rooms'),
        where('status', '==', 'live')
    );
    return onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Room[];
        callback(rooms);
    });
}

// ============================================
// Comments (subcollection of rooms)
// ============================================

/**
 * Get all comments for a room
 */
export async function getComments(roomId: string): Promise<Comment[]> {
    const q = query(
        collection(db, 'rooms', roomId, 'comments'),
        orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Comment[];
}

/**
 * Add a comment to a room
 */
export async function addComment(
    roomId: string,
    commentData: Omit<Comment, 'id' | 'createdAt'>
): Promise<string> {
    const docRef = await addDoc(collection(db, 'rooms', roomId, 'comments'), {
        ...commentData,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

/**
 * Delete a comment
 */
export async function deleteComment(
    roomId: string,
    commentId: string
): Promise<void> {
    const docRef = doc(db, 'rooms', roomId, 'comments', commentId);
    await deleteDoc(docRef);
}

/**
 * Subscribe to comments (real-time)
 */
export function subscribeToComments(
    roomId: string,
    callback: (comments: Comment[]) => void
): () => void {
    const q = query(
        collection(db, 'rooms', roomId, 'comments'),
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
// Participants (subcollection of rooms)
// ============================================

/**
 * Get all participants in a room
 */
export async function getParticipants(roomId: string): Promise<Participant[]> {
    const snapshot = await getDocs(collection(db, 'rooms', roomId, 'participants'));
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Participant[];
}

/**
 * Join a room (add participant)
 */
export async function joinRoom(
    roomId: string,
    userData: Omit<Participant, 'id' | 'joinedAt'>
): Promise<string> {
    // Add participant to subcollection
    const docRef = await addDoc(collection(db, 'rooms', roomId, 'participants'), {
        ...userData,
        joinedAt: serverTimestamp(),
    });

    // Increment listener count
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
        listenerCount: increment(1),
    });

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
        collection(db, 'rooms', roomId, 'participants'),
        where('userId', '==', odId)
    );
    const snapshot = await getDocs(q);

    for (const participantDoc of snapshot.docs) {
        await deleteDoc(participantDoc.ref);
    }

    // Decrement listener count
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
        listenerCount: increment(-1),
    });
}

/**
 * Subscribe to participants (real-time)
 */
export function subscribeToParticipants(
    roomId: string,
    callback: (participants: Participant[]) => void
): () => void {
    return onSnapshot(collection(db, 'rooms', roomId, 'participants'), (snapshot) => {
        const participants = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Participant[];
        callback(participants);
    });
}
