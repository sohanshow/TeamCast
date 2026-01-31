// Test script to verify Firestore connection using utility methods
// Uses dynamic imports to ensure env vars are loaded before Firebase initializes

import { config } from 'dotenv';

// Load environment variables immediately
config({ path: '.env.local' });

async function testConnection() {
    try {
        console.log('🔄 Connecting to Firestore...');

        // Dynamically import utility functions AFTER env vars are loaded
        const {
            getRooms,
            getLiveRooms,
            getComments,
            getParticipants
        } = await import('./src/lib/firestore.ts');

        console.log('✅ Connection initialized. Testing utility functions...\n');

        // Test 1: Get all rooms
        console.log('📝 Test 1: getRooms()');
        const rooms = await getRooms();
        console.log(`   ✅ Found ${rooms.length} room(s)`);

        if (rooms.length > 0) {
            console.log('   📋 Rooms:');
            rooms.forEach((room, i) => {
                console.log(`      ${i + 1}. "${room.title}" - ${room.status} (${room.listenerCount} listeners)`);
                console.log(`         Teams: ${room.teams?.join(' vs ') || 'N/A'}`);
            });

            const firstRoom = rooms[0];

            // Test 2: Get comments
            console.log(`\n📝 Test 2: getComments("${firstRoom.id}")`);
            const comments = await getComments(firstRoom.id);
            console.log(`   ✅ Found ${comments.length} comment(s)`);

            // Test 3: Get participants
            console.log(`\n📝 Test 3: getParticipants("${firstRoom.id}")`);
            const participants = await getParticipants(firstRoom.id);
            console.log(`   ✅ Found ${participants.length} participant(s)`);
        } else {
            console.log('   ℹ️  No rooms found. Run the app to create some!');
        }

        // Test 4: Get live rooms
        console.log('\n📝 Test 4: getLiveRooms()');
        const liveRooms = await getLiveRooms();
        console.log(`   ✅ Found ${liveRooms.length} live room(s)`);

        console.log('\n✅ All utility method tests passed!');
        console.log('📊 Project: gemini3superhack-ef305');

        process.exit(0);

    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        if (error.code === 'invalid-argument') {
            console.error('   Hint: Check if .env.local is loading correctly.');
        }
        console.error('   Full error:', error);
        process.exit(1);
    }
}

testConnection();
