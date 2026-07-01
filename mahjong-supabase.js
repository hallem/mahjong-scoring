// Supabase config + small cross-page helpers shared by the lobby, game, and
// results pages. Requires the Supabase JS CDN script to be loaded first:
// <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
//
// See SUPABASE_SETUP.md in the repo root for schema/RLS/Realtime setup.
const SUPABASE_URL = 'https://dysfpufowibqgfwiwfmt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__-IarOGA0Q0jLMOEYuAffA_PQe6nIo_';

let supabaseClient = null;
let supabaseConfigured = false;
try {
    if (SUPABASE_URL && SUPABASE_URL.indexOf('TODO_FILL_IN') === -1 &&
        SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.indexOf('TODO_FILL_IN') === -1 &&
        window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        supabaseConfigured = true;
    }
} catch (e) {
    console.error('Supabase client init failed', e);
}

function getOrCreateDeviceToken() {
    let token = localStorage.getItem('mahjong_device_token');
    if (!token) {
        token = (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)));
        localStorage.setItem('mahjong_device_token', token);
    }
    return token;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function showSyncToast(message) {
    const toast = document.getElementById('sync-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showSyncToast._t);
    showSyncToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

function saveLocalSession(roomCode, gameId, seat, deviceToken) {
    localStorage.setItem('mahjong_current_session', JSON.stringify({ roomCode, gameId, seat, deviceToken }));
}

function loadLocalSession() {
    try {
        const raw = localStorage.getItem('mahjong_current_session');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function clearLocalSession() {
    localStorage.removeItem('mahjong_current_session');
}
