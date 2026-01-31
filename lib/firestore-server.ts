/**
 * Server-side Firestore utilities for API routes
 * Uses the Firebase client SDK (works with NEXT_PUBLIC_ env vars)
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
    getFirestore, 
    Firestore,
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
    serverTimestamp,
    increment,
    writeBatch,
} from 'firebase/firestore';

// ============================================
// Firebase Initialization
// ============================================

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let db: Firestore;

function getDb(): Firestore {
    if (!db) {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        db = getFirestore(app);
    }
    return db;
}

// ============================================
// Types
// ============================================

export interface Room {
    id: string;
    roomId: string;
    name: string;
    basePrompt: string;
    isActive: boolean;
    listenerCount: number;
    createdAt?: { toMillis?: () => number };
    updatedAt?: { toMillis?: () => number };
}

export interface Comment {
    id: string;
    text: string;
    userId: string;
    username: string;
    roomId: string;
    timestamp: number;
    createdAt?: { toMillis?: () => number };
}

export interface Participant {
    id: string;
    odId: string;
    userName: string;
    roomId: string;
    joinedAt?: { toMillis?: () => number };
}

// ============================================
// Rooms
// ============================================

/**
 * Get all rooms
 */
export async function getRooms(): Promise<Room[]> {
    const firestore = getDb();
    const snapshot = await getDocs(collection(firestore, 'rooms'));
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as Room[];
}

/**
 * Get all active rooms
 */
export async function getActiveRooms(): Promise<Room[]> {
    const firestore = getDb();
    const q = query(
        collection(firestore, 'rooms'),
        where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as Room[];
}

/**
 * Get a room by its URL-friendly roomId
 */
export async function getRoomByRoomId(roomId: string): Promise<Room | null> {
    const firestore = getDb();
    const q = query(
        collection(firestore, 'rooms'),
        where('roomId', '==', roomId)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as Room;
}

/**
 * Create or update a room (upsert by roomId)
 */
export async function upsertRoom(
    roomData: Omit<Room, 'id' | 'listenerCount' | 'createdAt' | 'updatedAt'>
): Promise<Room> {
    const firestore = getDb();
    const existingRoom = await getRoomByRoomId(roomData.roomId);
    
    if (existingRoom) {
        // Update existing room
        const docRef = doc(firestore, 'rooms', existingRoom.id);
        await updateDoc(docRef, {
            name: roomData.name,
            basePrompt: roomData.basePrompt,
            isActive: roomData.isActive,
            updatedAt: serverTimestamp(),
        });
        return { ...existingRoom, ...roomData };
    } else {
        // Create new room
        const docRef = await addDoc(collection(firestore, 'rooms'), {
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
 * Update last comment processed timestamp for a room
 */
export async function updateRoomLastCommentProcessed(roomId: string): Promise<void> {
    const firestore = getDb();
    const existingRoom = await getRoomByRoomId(roomId);
    if (!existingRoom) return;
    
    const docRef = doc(firestore, 'rooms', existingRoom.id);
    await updateDoc(docRef, {
        lastCommentProcessedAt: Date.now(),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a room and all its related data (comments, participants)
 */
export async function deleteRoomWithData(roomId: string): Promise<void> {
    const firestore = getDb();
    const existingRoom = await getRoomByRoomId(roomId);
    if (!existingRoom) throw new Error('Room not found');
    
    const batch = writeBatch(firestore);
    
    // Delete all comments for this room
    const commentsQ = query(
        collection(firestore, 'comments'),
        where('roomId', '==', roomId)
    );
    const commentsSnapshot = await getDocs(commentsQ);
    commentsSnapshot.docs.forEach((d) => {
        batch.delete(d.ref);
    });
    
    // Delete all participants for this room
    const participantsQ = query(
        collection(firestore, 'participants'),
        where('roomId', '==', roomId)
    );
    const participantsSnapshot = await getDocs(participantsQ);
    participantsSnapshot.docs.forEach((d) => {
        batch.delete(d.ref);
    });
    
    // Delete the room itself
    batch.delete(doc(firestore, 'rooms', existingRoom.id));
    
    await batch.commit();
}

// ============================================
// Comments
// ============================================

/**
 * Get all comments for a room
 */
export async function getComments(roomId: string): Promise<Comment[]> {
    const firestore = getDb();
    // Simple query without orderBy to avoid index requirement
    const q = query(
        collection(firestore, 'comments'),
        where('roomId', '==', roomId)
    );
    const snapshot = await getDocs(q);
    const comments = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as Comment[];
    
    // Sort client-side by createdAt or timestamp
    comments.sort((a, b) => {
        const aTime = a.timestamp || (a.createdAt?.toMillis?.() ?? 0);
        const bTime = b.timestamp || (b.createdAt?.toMillis?.() ?? 0);
        return aTime - bTime;
    });
    
    return comments;
}

/**
 * Add a comment
 */
export async function addComment(
    commentData: Omit<Comment, 'id' | 'createdAt'>
): Promise<Comment> {
    const firestore = getDb();
    const docRef = await addDoc(collection(firestore, 'comments'), {
        ...commentData,
        createdAt: serverTimestamp(),
    });
    return {
        id: docRef.id,
        ...commentData,
    };
}

/**
 * Get recent comments (for batch processing)
 */
export async function getRecentComments(roomId: string, limitCount: number = 20): Promise<Comment[]> {
    const firestore = getDb();
    // Simple query without orderBy to avoid index requirement
    const q = query(
        collection(firestore, 'comments'),
        where('roomId', '==', roomId)
    );
    const snapshot = await getDocs(q);
    const comments = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as Comment[];
    
    // Sort client-side by createdAt descending (most recent first)
    comments.sort((a, b) => {
        const aTime = a.timestamp || (a.createdAt?.toMillis?.() ?? 0);
        const bTime = b.timestamp || (b.createdAt?.toMillis?.() ?? 0);
        return bTime - aTime;
    });
    
    return comments.slice(0, limitCount);
}

// ============================================
// Participants
// ============================================

/**
 * Join a room (add participant)
 */
export async function joinRoom(
    participantData: Omit<Participant, 'id' | 'joinedAt'>
): Promise<string> {
    const firestore = getDb();
    
    // Check if user is already in the room
    const existingQ = query(
        collection(firestore, 'participants'),
        where('roomId', '==', participantData.roomId),
        where('odId', '==', participantData.odId)
    );
    const existingSnapshot = await getDocs(existingQ);
    
    if (!existingSnapshot.empty) {
        return existingSnapshot.docs[0].id;
    }
    
    // Add participant
    const docRef = await addDoc(collection(firestore, 'participants'), {
        ...participantData,
        joinedAt: serverTimestamp(),
    });

    // Increment listener count on room
    const room = await getRoomByRoomId(participantData.roomId);
    if (room) {
        const roomRef = doc(firestore, 'rooms', room.id);
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
    const firestore = getDb();
    
    // Find and delete the participant document
    const q = query(
        collection(firestore, 'participants'),
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
        const roomRef = doc(firestore, 'rooms', room.id);
        await updateDoc(roomRef, {
            listenerCount: increment(-1),
        });
    }
}

/**
 * Get participants for a room
 */
export async function getParticipants(roomId: string): Promise<Participant[]> {
    const firestore = getDb();
    const q = query(
        collection(firestore, 'participants'),
        where('roomId', '==', roomId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as Participant[];
}
