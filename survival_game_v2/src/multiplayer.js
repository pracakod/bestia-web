const SUPABASE_URL = 'https://kvzuofdkhglcjljsldzz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5e5YVZRziHvKQQ7mboF4Tg_7_uTLZDW';

let supabase = null;
let channel = null;
let myPlayerId = 'guest_' + Math.random().toString(36).substr(2, 9);
let otherPlayersData = new Map();

export function initMultiplayer(onPlayerUpdate, onPlayerJoin, onPlayerLeave, onServerFull, onLocalNumber) {
    if (typeof supabasejs === 'undefined') {
        console.error('Supabase SDK not loaded');
        return;
    }

    supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);

    channel = supabase.channel('survival_world_1', {
        config: {
            presence: {
                key: myPlayerId,
            },
        },
    });

    channel
        .on('presence', { event: 'sync' }, () => {
            const newState = channel.presenceState();
            const players = Object.keys(newState).sort(); // Sorted list of IDs

            // Check Server Limit (2 players)
            if (players.length > 2) {
                const myIndex = players.indexOf(myPlayerId);
                if (myIndex >= 2) {
                    onServerFull();
                    return;
                }
            }

            // Determine numbers
            const myNumber = players.indexOf(myPlayerId) + 1;
            if (onLocalNumber) onLocalNumber(myNumber);

            // Detect joins/leaves
            players.forEach(id => {
                if (id !== myPlayerId && !otherPlayersData.has(id)) {
                    const number = players.indexOf(id) + 1;
                    onPlayerJoin(id, number);
                    otherPlayersData.set(id, { number });
                }
            });

            otherPlayersData.forEach((val, id) => {
                if (!newState[id]) {
                    onPlayerLeave(id);
                    otherPlayersData.delete(id);
                }
            });
        })
        .on('broadcast', { event: 'move' }, ({ payload }) => {
            if (payload.id !== myPlayerId) {
                onPlayerUpdate(payload);
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ online_at: new Date().toISOString() });
            }
        });

    return {
        sendPosition: (x, z, dx, dy) => {
            if (channel) {
                channel.send({
                    type: 'broadcast',
                    event: 'move',
                    payload: { id: myPlayerId, x, z, dx, dy },
                });
            }
        },
        myPlayerId
    };
}
