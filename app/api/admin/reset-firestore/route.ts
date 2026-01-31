import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    deleteDoc,
    writeBatch,
    doc,
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getDb() {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    return getFirestore(app);
}

// DELETE - Wipe all Firestore data
export async function DELETE() {
    try {
        const db = getDb();
        const collections = ['rooms', 'comments', 'participants'];
        const stats: Record<string, number> = {};

        for (const collectionName of collections) {
            const snapshot = await getDocs(collection(db, collectionName));
            stats[collectionName] = snapshot.size;

            // Delete in batches of 500 (Firestore limit)
            const batchSize = 500;
            let deleted = 0;
            
            while (deleted < snapshot.size) {
                const batch = writeBatch(db);
                const docsToDelete = snapshot.docs.slice(deleted, deleted + batchSize);
                
                docsToDelete.forEach((docSnap) => {
                    batch.delete(docSnap.ref);
                });
                
                await batch.commit();
                deleted += docsToDelete.length;
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Firestore wiped successfully',
            deleted: stats,
        });
    } catch (error) {
        console.error('[Reset Firestore] Error:', error);
        return NextResponse.json(
            { error: 'Failed to wipe Firestore', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}

// GET - Show current document counts
export async function GET() {
    try {
        const db = getDb();
        const collections = ['rooms', 'comments', 'participants'];
        const stats: Record<string, number> = {};

        for (const collectionName of collections) {
            const snapshot = await getDocs(collection(db, collectionName));
            stats[collectionName] = snapshot.size;
        }

        return NextResponse.json({
            collections: stats,
            schema: {
                rooms: {
                    fields: ['roomId', 'name', 'basePrompt', 'isActive', 'listenerCount', 'createdAt', 'updatedAt'],
                    description: 'Podcast rooms with their prompts and settings',
                },
                comments: {
                    fields: ['roomId', 'userId', 'username', 'text', 'timestamp', 'createdAt'],
                    description: 'User comments linked to rooms by roomId',
                },
                participants: {
                    fields: ['roomId', 'odId', 'userName', 'joinedAt'],
                    description: 'Active participants in rooms',
                },
            },
        });
    } catch (error) {
        console.error('[Reset Firestore] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get Firestore stats', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
