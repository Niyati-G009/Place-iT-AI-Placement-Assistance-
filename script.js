// ==========================================
//  GLOBAL DOM ELEMENTS & STATE
// ==========================================

const landingPage = document.getElementById('landing-page');
const authPage = document.getElementById('auth-page');
const dashboardPage = document.getElementById('dashboard-page');
const chatBox = document.getElementById('chat-box');
const historyList = document.getElementById('history-list');
const suggestionsBox = document.getElementById('suggestions-box');

const mainSidebar = document.getElementById('main-sidebar');
const chatSidebar = document.getElementById('chat-sidebar');

// Chats are now driven from Supabase; localStorage is kept as a fallback cache
let savedChats = JSON.parse(localStorage.getItem('placeItChats')) || [];
let currentChatId = null;

let renameTargetType = null;
let renameTargetId = null;

// ── PERSISTENT SCAN STORAGE ──
function loadRecentScans() {
    try { return JSON.parse(localStorage.getItem('placeItScans')) || []; }
    catch (e) { return []; }
}
function saveRecentScans() {
    localStorage.setItem('placeItScans', JSON.stringify(recentScans));
}
let recentScans = loadRecentScans();

// ==========================================
//  🎙️ VOICE CONVERSATION MODE
// ==========================================

let voiceModeActive = false;
let voiceRecognition = null;
let voiceIsListening = false;
let voiceIsSpeaking = false;
let currentAudio = null;

function injectVoiceModal() {
    if (document.getElementById('voice-conv-modal')) return;

    const style = document.createElement('style');
    style.id = 'voice-modal-styles';
    style.textContent = `
        #voice-conv-modal {
            position: fixed; inset: 0; z-index: 99998;
            display: flex; align-items: flex-end; justify-content: center;
            background: rgba(0,0,0,0); backdrop-filter: blur(0px);
            transition: background 0.4s ease, backdrop-filter 0.4s ease;
            pointer-events: none;
        }
        #voice-conv-modal.open {
            background: rgba(0,0,0,0.65); backdrop-filter: blur(16px);
            pointer-events: all;
        }
        #voice-conv-panel {
            width: 100%; max-width: 600px;
            background: linear-gradient(160deg, #1a2436 0%, #25344F 60%, #2a1a2e 100%);
            border-top: 1px solid rgba(213,184,147,0.2);
            border-radius: 28px 28px 0 0; padding: 32px 32px 48px;
            display: flex; flex-direction: column; align-items: center; gap: 24px;
            transform: translateY(100%);
            transition: transform 0.45s cubic-bezier(0.34,1.2,0.64,1);
            box-shadow: 0 -20px 60px rgba(0,0,0,0.5);
        }
        #voice-conv-modal.open #voice-conv-panel { transform: translateY(0); }
        .voice-handle { width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; position: absolute; top: 12px; }
        .voice-label { font-family: 'Poppins',sans-serif; font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-top: -8px; }
        #voice-status-text { font-family: 'Poppins',sans-serif; font-size: 1rem; color: rgba(255,255,255,0.85); min-height: 24px; text-align: center; transition: opacity 0.3s; }
        #voice-transcript { font-family: 'Poppins',sans-serif; font-size: 0.95rem; color: #D5B893; text-align: center; min-height: 40px; max-width: 460px; line-height: 1.5; transition: opacity 0.3s; font-style: italic; opacity: 0.8; }
        .voice-orb-wrapper { position: relative; width: 130px; height: 130px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .voice-ring { position: absolute; border-radius: 50%; border: 1.5px solid rgba(213,184,147,0.25); }
        .voice-ring-1 { width: 130px; height: 130px; }
        .voice-ring-2 { width: 108px; height: 108px; }
        .voice-orb-wrapper.listening .voice-ring { animation: orbRingPulse 1.4s ease-in-out infinite; }
        .voice-orb-wrapper.listening .voice-ring-2 { animation: orbRingPulse 1.4s ease-in-out infinite 0.3s; }
        .voice-orb-wrapper.speaking .voice-ring { animation: orbRingPulseGreen 1.2s ease-in-out infinite; }
        .voice-orb-wrapper.speaking .voice-ring-2 { animation: orbRingPulseGreen 1.2s ease-in-out infinite 0.25s; }
        @keyframes orbRingPulse { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.12); opacity: 0.8; } }
        @keyframes orbRingPulseGreen { 0%,100% { transform: scale(1); opacity: 0.3; border-color: rgba(46,204,113,0.3); } 50% { transform: scale(1.1); opacity: 0.7; border-color: rgba(46,204,113,0.7); } }
        #voice-orb { width: 88px; height: 88px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, rgba(213,184,147,0.9) 0%, rgba(166,95,236,0.7) 45%, rgba(37,52,79,0.9) 100%); box-shadow: 0 0 30px rgba(213,184,147,0.3), inset 0 0 20px rgba(255,255,255,0.1); transition: transform 0.2s ease, box-shadow 0.3s ease; position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
        .voice-orb-wrapper.listening #voice-orb { background: radial-gradient(circle at 35% 35%, rgba(231,76,60,0.9) 0%, rgba(166,95,236,0.7) 45%, rgba(37,52,79,0.95) 100%); box-shadow: 0 0 40px rgba(231,76,60,0.5), inset 0 0 20px rgba(255,255,255,0.1); animation: orbBreath 1.4s ease-in-out infinite; }
        .voice-orb-wrapper.speaking #voice-orb { background: radial-gradient(circle at 35% 35%, rgba(46,204,113,0.9) 0%, rgba(166,95,236,0.6) 45%, rgba(37,52,79,0.95) 100%); box-shadow: 0 0 50px rgba(46,204,113,0.5), inset 0 0 20px rgba(255,255,255,0.1); animation: orbSpeakPulse 0.8s ease-in-out infinite; }
        @keyframes orbBreath { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes orbSpeakPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .voice-controls { display: flex; align-items: center; gap: 20px; margin-top: 8px; }
        .voice-ctrl-btn { width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .voice-ctrl-btn:hover { background: rgba(255,255,255,0.12); color: #fff; border-color: rgba(255,255,255,0.3); transform: scale(1.05); }
        #voice-tap-btn { width: 68px; height: 68px; font-size: 1.5rem; background: linear-gradient(135deg, rgba(213,184,147,0.2), rgba(166,95,236,0.2)); border: 1.5px solid rgba(213,184,147,0.5); color: #D5B893; }
        #voice-tap-btn:hover { background: linear-gradient(135deg, rgba(213,184,147,0.3), rgba(166,95,236,0.3)); border-color: #D5B893; box-shadow: 0 0 20px rgba(213,184,147,0.3); }
        #voice-tap-btn.active { background: linear-gradient(135deg, rgba(231,76,60,0.3), rgba(166,95,236,0.3)); border-color: #e74c3c; color: #e74c3c; box-shadow: 0 0 20px rgba(231,76,60,0.4); }
        #voice-close-btn { position: absolute; top: 20px; right: 24px; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        #voice-close-btn:hover { background: rgba(231,76,60,0.2); color: #e74c3c; border-color: #e74c3c; }
        #voice-ai-reply { background: rgba(255,255,255,0.05); border: 1px solid rgba(213,184,147,0.2); border-radius: 16px; padding: 14px 18px; font-family: 'Poppins',sans-serif; font-size: 0.9rem; color: rgba(255,255,255,0.85); text-align: center; max-width: 460px; min-height: 48px; line-height: 1.6; opacity: 0; transition: opacity 0.4s ease; width: 100%; }
        #voice-ai-reply.visible { opacity: 1; }
        .voice-save-row { display: flex; align-items: center; gap: 10px; font-family: 'Poppins',sans-serif; font-size: 0.78rem; color: rgba(255,255,255,0.4); }
        .voice-save-toggle { width: 34px; height: 18px; background: rgba(255,255,255,0.1); border-radius: 9px; position: relative; cursor: pointer; transition: background 0.3s; }
        .voice-save-toggle.on { background: rgba(46,204,113,0.5); }
        .voice-save-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left 0.3s; }
        .voice-save-toggle.on::after { left: 18px; }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'voice-conv-modal';
    modal.innerHTML = `
        <div id="voice-conv-panel" style="position:relative;">
            <div class="voice-handle"></div>
            <button id="voice-close-btn" onclick="closeVoiceMode()"><i class="ri-close-line"></i></button>
            <span class="voice-label">AI Voice Assistant</span>
            <div class="voice-orb-wrapper" id="voice-orb-wrapper" onclick="toggleVoiceListen()">
                <div class="voice-ring voice-ring-1"></div>
                <div class="voice-ring voice-ring-2"></div>
                <div id="voice-orb"><i class="ri-sparkling-fill" style="color:rgba(255,255,255,0.8);font-size:1.6rem;"></i></div>
            </div>
            <div id="voice-status-text">Tap the orb to start talking</div>
            <div id="voice-transcript"></div>
            <div id="voice-ai-reply"></div>
            <div class="voice-controls">
                <button class="voice-ctrl-btn" onclick="toggleVoiceMute()" id="voice-mute-btn" title="Mute mic"><i class="ri-mic-line"></i></button>
                <button class="voice-ctrl-btn" id="voice-tap-btn" onclick="toggleVoiceListen()" title="Tap to talk"><i class="ri-mic-2-line"></i></button>
                <button class="voice-ctrl-btn" onclick="stopVoiceSpeech()" title="Stop speaking"><i class="ri-stop-circle-line"></i></button>
            </div>
            <div class="voice-save-row">
                <div class="voice-save-toggle" id="voice-save-toggle" onclick="toggleVoiceSave()"></div>
                <span id="voice-save-label">Save conversation to chat history</span>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

let voiceMuted = false;
let voiceSaveToChat = false;

function toggleVoiceMute() {
    voiceMuted = !voiceMuted;
    const btn = document.getElementById('voice-mute-btn');
    if (btn) btn.innerHTML = voiceMuted ? '<i class="ri-mic-off-line" style="color:#e74c3c;"></i>' : '<i class="ri-mic-line"></i>';
    showToast(voiceMuted ? '🔇 Mic muted' : '🎤 Mic unmuted');
}

function toggleVoiceSave() {
    voiceSaveToChat = !voiceSaveToChat;
    const toggle = document.getElementById('voice-save-toggle');
    const label = document.getElementById('voice-save-label');
    if (toggle) toggle.classList.toggle('on', voiceSaveToChat);
    if (label) label.textContent = voiceSaveToChat ? 'Saving to chat history ✓' : 'Save conversation to chat history';
}

function openVoiceMode() {
    injectVoiceModal();
    voiceModeActive = true;
    const modal = document.getElementById('voice-conv-modal');
    if (modal) { modal.style.display = 'flex'; requestAnimationFrame(() => modal.classList.add('open')); }
    setVoiceStatus('idle');
}

function closeVoiceMode() {
    stopVoiceListen();
    stopVoiceSpeech();
    voiceModeActive = false;
    const modal = document.getElementById('voice-conv-modal');
    if (modal) { modal.classList.remove('open'); setTimeout(() => { modal.style.display = 'none'; }, 450); }
}

function setVoiceStatus(state) {
    const statusEl = document.getElementById('voice-status-text');
    const orbWrapper = document.getElementById('voice-orb-wrapper');
    const tapBtn = document.getElementById('voice-tap-btn');
    if (!orbWrapper) return;
    orbWrapper.classList.remove('listening', 'speaking');
    if (tapBtn) tapBtn.classList.remove('active');
    const messages = { idle: 'Tap the orb to start talking', listening: '🎤 Listening…', thinking: '⏳ Thinking…', speaking: '🔊 Speaking…' };
    if (statusEl) statusEl.textContent = messages[state] || '';
    if (state === 'listening') { orbWrapper.classList.add('listening'); if (tapBtn) tapBtn.classList.add('active'); }
    if (state === 'speaking') orbWrapper.classList.add('speaking');
}

function toggleVoiceListen() { if (voiceIsListening) stopVoiceListen(); else startVoiceListen(); }

function startVoiceListen() {
    if (voiceMuted) { showToast('🔇 Mic is muted'); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast('⚠️ Speech recognition not supported in this browser'); return; }
    stopVoiceSpeech();
    const select = document.getElementById('voice-select');
    const lang = select ? select.value : 'en-US';
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = lang;
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = true;
    voiceRecognition.maxAlternatives = 1;
    voiceRecognition.onstart = () => {
        voiceIsListening = true;
        setVoiceStatus('listening');
        const transcriptEl = document.getElementById('voice-transcript');
        if (transcriptEl) transcriptEl.textContent = '';
        const replyEl = document.getElementById('voice-ai-reply');
        if (replyEl) replyEl.classList.remove('visible');
    };
    voiceRecognition.onresult = (event) => {
        let interim = '', final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) final += t; else interim += t;
        }
        const transcriptEl = document.getElementById('voice-transcript');
        if (transcriptEl) transcriptEl.textContent = `"${final || interim}"`;
    };
    voiceRecognition.onerror = (event) => {
        voiceIsListening = false;
        setVoiceStatus('idle');
        if (event.error === 'no-speech') showToast('😶 No speech detected');
        else if (event.error === 'not-allowed') showToast('🚫 Mic access denied — please allow microphone in browser settings');
        else showToast('⚠️ Error: ' + event.error);
    };
    voiceRecognition.onend = () => {
        voiceIsListening = false;
        const transcriptEl = document.getElementById('voice-transcript');
        const spokenText = transcriptEl ? transcriptEl.textContent.replace(/^"|"$/g, '').trim() : '';
        if (spokenText.length > 1) sendVoiceMessage(spokenText);
        else setVoiceStatus('idle');
    };
    try { voiceRecognition.start(); }
    catch (e) { showToast('⚠️ Could not start mic: ' + e.message); }
}

function stopVoiceListen() {
    if (voiceRecognition) { try { voiceRecognition.stop(); } catch (e) {} }
    voiceIsListening = false;
}

async function sendVoiceMessage(text) {
    setVoiceStatus('thinking');
    try {
        const response = await fetch('http://127.0.0.1:5000/voice-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        if (!response.ok) throw new Error('Server error');
        const data = await response.json();
        const reply = data.reply || "Sorry, I couldn't get a response.";
        const replyEl = document.getElementById('voice-ai-reply');
        if (replyEl) { replyEl.textContent = reply; replyEl.classList.add('visible'); }
        if (voiceSaveToChat) {
            if (!currentChatId) startNewChat();
            appendMessageToUI('user', text, true, false);
            appendMessageToUI('ai', reply, true, false);
        }
        speakVoiceReply(reply);
    } catch (err) {
        console.error('Voice chat error:', err);
        setVoiceStatus('idle');
        showToast('⚠️ Could not reach server');
    }
}

async function speakVoiceReply(text) {
    setVoiceStatus('speaking');
    voiceIsSpeaking = true;
    const elSuccess = await tryElevenLabsTTS(text);
    if (!elSuccess) speakWithBrowserTTS(text, () => { voiceIsSpeaking = false; setVoiceStatus('idle'); });
}

async function tryElevenLabsTTS(text) {
    try {
        const response = await fetch('http://127.0.0.1:5000/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        if (!response.ok) return false;
        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer.byteLength) return false;
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => { voiceIsSpeaking = false; setVoiceStatus('idle'); audioCtx.close(); };
        source.start(0);
        return true;
    } catch (e) { return false; }
}

function speakWithBrowserTTS(text, onEnd) {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const select = document.getElementById('voice-select');
    utterance.lang = select ? select.value : 'en-US';
    utterance.rate = 1.0; utterance.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang === utterance.lang) || voices.find(v => v.lang.startsWith(utterance.lang.split('-')[0]));
    if (match) utterance.voice = match;
    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = () => { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utterance);
    currentAudio = utterance;
}

function stopVoiceSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    currentAudio = null;
    voiceIsSpeaking = false;
    setVoiceStatus('idle');
}

// ==========================================
//  🔊 CHAT TTS ENGINE
// ==========================================

let ttsEnabled = false;

function populateVoiceDropdown() {
    const select = document.getElementById('voice-select');
    if (!select) return;
    select.innerHTML = '';
    const languages = [
        { label: '🇺🇸 English (US)', lang: 'en-US' },
        { label: '🇬🇧 English (UK)', lang: 'en-GB' },
        { label: '🇮🇳 English (IN)', lang: 'en-IN' },
        { label: '🇮🇳 Hindi', lang: 'hi-IN' },
        { label: '🇫🇷 French', lang: 'fr-FR' },
        { label: '🇩🇪 German', lang: 'de-DE' },
        { label: '🇪🇸 Spanish', lang: 'es-ES' },
        { label: '🇯🇵 Japanese', lang: 'ja-JP' },
        { label: '🇧🇷 Portuguese', lang: 'pt-BR' },
        { label: '🇦🇪 Arabic', lang: 'ar-SA' },
    ];
    languages.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.lang; opt.textContent = item.label;
        select.appendChild(opt);
    });
}

function toggleVoice() {
    ttsEnabled = !ttsEnabled;
    const btn = document.getElementById('voice-toggle');
    if (!btn) return;
    btn.innerHTML = ttsEnabled
        ? '<i class="ri-volume-up-fill" style="color:#2ecc71;"></i>'
        : '<i class="ri-volume-mute-fill" style="color:var(--tan);"></i>';
    showToast(ttsEnabled ? '🔊 Voice replies enabled' : '🔇 Voice replies disabled');
}

function speakText(text) {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_`#>~\[\]]/g, '').replace(/\n+/g, ' ').trim();
    const utt = new SpeechSynthesisUtterance(clean);
    const select = document.getElementById('voice-select');
    utt.lang = select ? select.value : 'en-US';
    utt.rate = 1.0; utt.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang === utt.lang);
    if (match) utt.voice = match;
    window.speechSynthesis.speak(utt);
}

// ==========================================
//  🎤 STT FOR CHAT INPUT
// ==========================================

let isListening = false;
let recognition = null;

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast('⚠️ Speech recognition not supported'); return null; }
    const rec = new SpeechRecognition();
    rec.continuous = false; rec.interimResults = true;
    const select = document.getElementById('voice-select');
    rec.lang = select ? select.value : 'en-US';
    rec.onstart = () => { isListening = true; updateMicUI(true); showToast('🎤 Listening…'); };
    rec.onresult = (event) => {
        let final = '', interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) final += t; else interim += t;
        }
        const inputEl = document.getElementById('user-input');
        if (inputEl) inputEl.value = final || interim;
    };
    rec.onerror = (e) => {
        isListening = false; updateMicUI(false);
        if (e.error === 'no-speech') showToast('😶 No speech detected');
        else if (e.error === 'not-allowed') showToast('🚫 Mic access denied');
        else showToast('⚠️ STT Error: ' + e.error);
    };
    rec.onend = () => {
        isListening = false; updateMicUI(false);
        const inputEl = document.getElementById('user-input');
        if (inputEl && inputEl.value.trim().length > 0) sendMessage();
    };
    return rec;
}

function toggleListening() {
    if (isListening) { if (recognition) recognition.stop(); isListening = false; updateMicUI(false); return; }
    recognition = initSpeechRecognition();
    if (!recognition) return;
    try { recognition.start(); } catch (e) { showToast('⚠️ Mic error: ' + e.message); }
}

function updateMicUI(listening) {
    const btn = document.getElementById('mic-btn');
    if (!btn) return;
    btn.innerHTML = listening ? '<i class="ri-mic-fill" style="color:#e74c3c;"></i>' : '<i class="ri-mic-line"></i>';
    btn.style.border = listening ? '1px solid #e74c3c' : '1px solid var(--glass-border)';
    btn.style.boxShadow = listening ? '0 0 12px rgba(231,76,60,0.5)' : 'none';
}

// ==========================================
//  🔔 TOAST
// ==========================================

function showToast(message, duration = 2500) {
    const existing = document.getElementById('place-it-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'place-it-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
        background:rgba(37,52,79,0.95);border:1px solid rgba(213,184,147,0.4);
        color:#fff;padding:10px 22px;border-radius:30px;
        font-size:0.85rem;font-family:'Poppins',sans-serif;
        z-index:99999;backdrop-filter:blur(10px);
        box-shadow:0 5px 20px rgba(0,0,0,0.4);
        animation:toastIn 0.3s ease forwards;pointer-events:none;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ==========================================
//  📸 PROFILE PHOTO UPLOAD
// ==========================================

function handleProfilePhotoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        alert('Photo must be under 2MB. Please choose a smaller image.');
        input.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        const dataUrl = e.target.result;
        const previewImg = document.getElementById('edit-photo-preview-img');
        const previewInitials = document.getElementById('edit-avatar-initials');
        if (previewImg) { previewImg.src = dataUrl; previewImg.style.display = 'block'; }
        if (previewInitials) previewInitials.style.display = 'none';
        const removeBtn = document.getElementById('remove-photo-btn');
        if (removeBtn) removeBtn.style.display = 'inline-flex';
        sessionStorage.setItem('pendingProfilePhoto', dataUrl);
        showToast('📸 Photo ready — click Save Changes to apply');
    };
    reader.readAsDataURL(file);
}

function removeProfilePhoto() {
    const previewImg = document.getElementById('edit-photo-preview-img');
    const previewInitials = document.getElementById('edit-avatar-initials');
    if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
    if (previewInitials) previewInitials.style.display = '';
    const input = document.getElementById('p-photo');
    if (input) input.value = '';
    sessionStorage.setItem('pendingProfilePhoto', '__remove__');
    const removeBtn = document.getElementById('remove-photo-btn');
    if (removeBtn) removeBtn.style.display = 'none';
    showToast('🗑️ Photo removed — click Save Changes to apply');
}

function applyProfilePhotoToUI(photoDataUrl) {
    const displayImg = document.getElementById('profile-photo-display');
    const displayInitials = document.getElementById('profile-initials-display');
    if (photoDataUrl && displayImg) {
        displayImg.src = photoDataUrl;
        displayImg.style.display = 'block';
        if (displayInitials) displayInitials.style.display = 'none';
    } else if (displayImg) {
        displayImg.src = '';
        displayImg.style.display = 'none';
        if (displayInitials) displayInitials.style.display = '';
    }
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) {
        if (photoDataUrl) {
            sidebarAvatar.innerHTML = `<img src="${photoDataUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            const data = JSON.parse(localStorage.getItem('studentProfile') || '{}');
            if (data.name) {
                const initials = data.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                sidebarAvatar.innerHTML = initials;
            }
        }
    }
}

// ==========================================
//  📄 RESUME ANALYZER
// ==========================================

function showScanningOverlay() {
    const overlay = document.getElementById('scanning-overlay');
    if (overlay) overlay.classList.remove('hidden');
}
function hideScanningOverlay() {
    const overlay = document.getElementById('scanning-overlay');
    if (overlay) overlay.classList.add('hidden');
}

async function handleResumeUpload(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    const validExts = /\.(pdf|docx|txt)$/i;
    if (!validExts.test(file.name)) {
        alert("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
        inputElement.value = ''; return;
    }
    const dropZoneP = document.querySelector('.analyzer-upload-area p');
    if (dropZoneP) { dropZoneP.innerText = `📎 ${file.name} — ready to analyze`; dropZoneP.style.color = '#D5B893'; }
    const dropIcon = document.querySelector('.analyzer-upload-area i');
    if (dropIcon) { dropIcon.className = 'ri-file-check-line'; dropIcon.style.color = '#2ecc71'; dropIcon.style.fontSize = '3rem'; }
    showToast('✅ File loaded — click Analyze Match Score');
}

async function analyzeText() {
    const jdText = document.getElementById('jd-text-area').value.trim();
    const formData = new FormData();
    const isUploadMode = !document.getElementById('mode-upload').classList.contains('hidden');
    if (isUploadMode) {
        const fileInput = document.getElementById('resume-file-input');
        if (!fileInput.files || fileInput.files.length === 0) { alert("Please upload a resume file first."); return; }
        const file = fileInput.files[0];
        formData.append('file', file);
        if (jdText) formData.append('jd', jdText);
        showScanningOverlay();
        await sendResumeToBackend(formData, file.name);
    } else {
        const pastedText = document.getElementById('resume-text-area').value.trim();
        if (pastedText.length < 50) { alert("Please paste at least 50 characters of resume text."); return; }
        formData.append('text', pastedText);
        if (jdText) formData.append('jd', jdText);
        showScanningOverlay();
        await sendResumeToBackend(formData, 'Pasted_Resume.txt');
    }
}

async function sendResumeToBackend(formData, fileName) {
    try {
        const response = await fetch('http://127.0.0.1:5000/analyze-resume', { method: 'POST', body: formData });
        const data = await response.json();
        hideScanningOverlay();
        if (!response.ok || data.error) { alert('Analysis Error: ' + (data.error || 'Unknown error.')); return; }
        displayAnalysisResults(data, fileName);
    } catch (err) {
        hideScanningOverlay();
        console.error('Resume analysis error:', err);
        alert('Could not connect to the server. Make sure the Flask backend is running on port 5000.');
    }
}

function displayAnalysisResults(data, fileName) {
    const uploadSection = document.getElementById('resume-upload-section');
    const resultSection = document.getElementById('resume-result-section');
    if (uploadSection) uploadSection.classList.add('hidden');

    const score = parseInt(data.ats_score) || 0;
    const scoreColor = score >= 80 ? '#2ecc71' : score >= 60 ? '#f1c40f' : '#e74c3c';

    const scoreEl = document.getElementById('res-score');
    if (scoreEl) { scoreEl.innerText = score + '%'; scoreEl.style.color = scoreColor; }
    const dashATS = document.getElementById('dash-ats');
    if (dashATS) { dashATS.innerText = score + '%'; dashATS.style.color = scoreColor; }
    const levelEl = document.getElementById('res-level');
    if (levelEl) levelEl.innerText = data.experience_level || 'N/A';
    const kwEl = document.getElementById('res-keywords');
    if (kwEl) kwEl.innerText = data.keyword_match || 'N/A';

    const missingContainer = document.getElementById('res-missing-keywords');
    if (missingContainer) {
        missingContainer.innerHTML = '';
        const missingSkills = data.missing_skills || [];
        if (missingSkills.length === 0) {
            missingContainer.innerHTML = '<span style="color:#2ecc71;font-size:0.9rem;">✓ No critical missing skills found!</span>';
        } else {
            missingSkills.forEach(skill => {
                const span = document.createElement('span');
                span.className = 'badge';
                span.style.cssText = 'background:rgba(231,76,60,0.2);color:#e74c3c;padding:5px 10px;border-radius:4px;font-size:0.8rem;display:inline-block;';
                span.innerText = skill;
                missingContainer.appendChild(span);
            });
        }
    }

    const tipsEl = document.getElementById('res-tips');
    if (tipsEl) {
        tipsEl.innerHTML = '';
        (data.feedback_tips || []).forEach(tip => {
            const li = document.createElement('li');
            li.style.cssText = 'margin-bottom:8px;color:var(--text-muted);';
            li.innerText = tip;
            tipsEl.appendChild(li);
        });
        if (data.weak_phrases && data.weak_phrases.length > 0) {
            const wpHeader = document.createElement('li');
            wpHeader.style.cssText = 'color:#f1c40f;font-weight:600;margin-top:14px;list-style:none;';
            wpHeader.innerHTML = '<i class="ri-alert-line"></i> Weak Phrases Detected:';
            tipsEl.appendChild(wpHeader);
            data.weak_phrases.forEach(phrase => {
                const li = document.createElement('li');
                li.style.cssText = 'color:#f1c40f;margin-bottom:5px;font-size:0.87rem;';
                li.innerText = `"${phrase}"`;
                tipsEl.appendChild(li);
            });
        }
        if (data.strengths && data.strengths.length > 0) {
            const sHeader = document.createElement('li');
            sHeader.style.cssText = 'color:#2ecc71;font-weight:600;margin-top:14px;list-style:none;';
            sHeader.innerHTML = '<i class="ri-checkbox-circle-line"></i> Strengths:';
            tipsEl.appendChild(sHeader);
            data.strengths.forEach(s => {
                const li = document.createElement('li');
                li.style.cssText = 'color:#2ecc71;margin-bottom:5px;';
                li.innerText = s;
                tipsEl.appendChild(li);
            });
        }
    }

    // Remove & re-add dynamic sections
    ['res-summary', 'res-matched'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });

    const tipsSection = tipsEl ? tipsEl.closest('div') : null;
    const parentFlex = tipsSection ? tipsSection.parentElement : null;

    if (data.matched_keywords && data.matched_keywords.length > 0 && parentFlex) {
        const matchedEl = document.createElement('div');
        matchedEl.id = 'res-matched';
        matchedEl.style.cssText = 'background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-left:4px solid #2ecc71;padding:16px 20px;border-radius:12px;margin-top:4px;';
        matchedEl.innerHTML = `<h4 style="color:#2ecc71;margin:0 0 10px;font-size:0.9rem;"><i class="ri-check-double-line"></i> Matched Keywords</h4><div style="display:flex;flex-wrap:wrap;gap:8px;">${data.matched_keywords.map(k => `<span style="background:rgba(46,204,113,0.15);color:#2ecc71;padding:4px 10px;border-radius:4px;font-size:0.8rem;">${k}</span>`).join('')}</div>`;
        parentFlex.appendChild(matchedEl);
    }

    if (data.summary && parentFlex) {
        const summaryEl = document.createElement('div');
        summaryEl.id = 'res-summary';
        summaryEl.style.cssText = 'background:rgba(166,95,236,0.08);border:1px solid rgba(166,95,236,0.3);border-left:4px solid #a65fec;padding:16px 20px;border-radius:12px;margin-top:4px;';
        summaryEl.innerHTML = `<h4 style="color:#a65fec;margin:0 0 8px;font-size:0.9rem;"><i class="ri-sparkling-fill"></i> AI Summary</h4><p style="color:var(--text-muted);font-size:0.88rem;line-height:1.7;margin:0;">${data.summary}</p>`;
        parentFlex.appendChild(summaryEl);
    }

    if (resultSection) resultSection.classList.remove('hidden');

    // Save scan
    const scanData = {
        id: 'scan_' + Date.now(),
        name: fileName,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        score: score,
        color: scoreColor,
        data: data
    };
    recentScans.unshift(scanData);
    if (recentScans.length > 10) recentScans = recentScans.slice(0, 10);
    saveRecentScans();
    renderRecentScans();
    updateDashboardATSScore(score, scoreColor);
    showToast('✅ Resume analyzed successfully!', 3000);
}

function viewScanDetails(scanId) {
    const scan = recentScans.find(s => s.id === scanId);
    if (!scan || !scan.data) { showToast('⚠️ Scan data not available'); return; }
    switchTab('resume');
    setTimeout(() => { displayAnalysisResults(scan.data, scan.name); showToast(`📂 Loaded: ${scan.name}`); }, 350);
}

function closeResumeResults() {
    document.getElementById('resume-result-section').classList.add('hidden');
    document.getElementById('resume-upload-section')?.classList.remove('hidden');
    document.getElementById('resume-file-input').value = '';
    document.getElementById('resume-text-area').value = '';
    ['res-summary', 'res-matched'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
    const dropZoneP = document.querySelector('.analyzer-upload-area p');
    if (dropZoneP) { dropZoneP.innerText = 'Drop PDF/DOCX here'; dropZoneP.style.color = ''; }
    const dropIcon = document.querySelector('.analyzer-upload-area i');
    if (dropIcon) { dropIcon.className = 'ri-file-pdf-line'; dropIcon.style.color = ''; dropIcon.style.fontSize = ''; }
}

function switchResumeMode(mode) {
    const tabUpload = document.getElementById('tab-upload');
    const tabPaste = document.getElementById('tab-paste');
    const viewUpload = document.getElementById('mode-upload');
    const viewPaste = document.getElementById('mode-paste');
    if (mode === 'upload') {
        tabUpload.style.background = 'var(--tan)'; tabUpload.style.color = 'var(--space-cadet)';
        tabPaste.style.background = 'rgba(255,255,255,0.1)'; tabPaste.style.color = 'white';
        viewUpload.classList.remove('hidden'); viewPaste.classList.add('hidden');
    } else {
        tabPaste.style.background = 'var(--tan)'; tabPaste.style.color = 'var(--space-cadet)';
        tabUpload.style.background = 'rgba(255,255,255,0.1)'; tabUpload.style.color = 'white';
        viewUpload.classList.add('hidden'); viewPaste.classList.remove('hidden');
    }
}

// Drag and drop
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.querySelector('.analyzer-upload-area');
    if (dropZone) {
        ['dragenter','dragover','dragleave','drop'].forEach(ev =>
            dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false)
        );
        ['dragenter','dragover'].forEach(ev =>
            dropZone.addEventListener(ev, () => { dropZone.style.borderColor = '#fff'; dropZone.style.background = 'rgba(213,184,147,0.15)'; }, false)
        );
        ['dragleave','drop'].forEach(ev =>
            dropZone.addEventListener(ev, () => { dropZone.style.borderColor = 'var(--tan)'; dropZone.style.background = 'rgba(0,0,0,0.2)'; }, false)
        );
        dropZone.addEventListener('drop', async e => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (!/\.(pdf|docx|txt)$/i.test(file.name)) { alert('Please drop a PDF, DOCX, or TXT file.'); return; }
                const dt = new DataTransfer();
                dt.items.add(file);
                const fileInput = document.getElementById('resume-file-input');
                fileInput.files = dt.files;
                handleResumeUpload(fileInput);
            }
        }, false);
    }
});

// ==========================================
//  📊 DASHBOARD ATS UPDATE
// ==========================================

function updateDashboardATSScore(score, color) {
    const el = document.getElementById('dash-ats');
    if (el) {
        el.innerText = score + '%';
        el.style.color = color || (score >= 80 ? '#2ecc71' : score >= 60 ? '#f1c40f' : '#e74c3c');
    }
}
// ==========================================
//  📊 PLACEMENT READINESS SCORE
// ==========================================

function calculatePlacementReadiness() {
    const profile = JSON.parse(localStorage.getItem('studentProfile') || '{}');
    const lastScan = recentScans[0];
    let score = 0;
    const cgpa = parseFloat(profile.cgpa) || 0;
    score += Math.min((cgpa / 10) * 30, 30);
    if (lastScan) score += (lastScan.score / 100) * 40;
    const profileFields = ['name','mobile','location','bio','college','skills','linkedin','github']
        .filter(f => profile[f] && profile[f] !== '#' && String(profile[f]).trim() !== '');
    score += (profileFields.length / 8) * 30;
    return Math.round(Math.min(score, 100));
}

function renderPlacementReadiness() {
    const score = calculatePlacementReadiness();
    const el = document.getElementById('placement-readiness-score');
    const bar = document.getElementById('placement-readiness-bar');
    const label = document.getElementById('placement-readiness-label');
    if (!el) return;
    el.innerText = score + '%';
    if (bar) {
        bar.style.width = score + '%';
        bar.style.background = score >= 75
            ? 'linear-gradient(90deg,#2ecc71,#27ae60)'
            : score >= 50
                ? 'linear-gradient(90deg,#f1c40f,#e67e22)'
                : 'linear-gradient(90deg,#e74c3c,#c0392b)';
    }
    if (label) {
        if (score >= 75) label.innerText = '🚀 Placement Ready!';
        else if (score >= 50) label.innerText = '⚡ Almost There';
        else label.innerText = '📚 Keep Building';
    }
}

// ==========================================
//  NAV & AUTH
// ==========================================

function goToAuth() { landingPage.style.display = 'none'; authPage.style.display = 'flex'; }
function goToLanding() { authPage.style.display = 'none'; landingPage.style.display = 'flex'; }

function goToDashboard() {
    if (!Clerk.user) { goToAuth(); return; }
    const userName = Clerk.user.firstName || "Student";
    const userEmail = Clerk.user.primaryEmailAddress?.emailAddress || '';
    const greeting = document.querySelector('#view-home h1');
    if (greeting) greeting.innerText = `Hello, ${userName}! 👋`;
    const sidebarName = document.getElementById('display-sidebar-name');
    if (sidebarName) sidebarName.innerText = userName;
    authPage.style.display = 'none';
    landingPage.style.display = 'none';
    dashboardPage.style.display = 'flex';
    initializeProfile(userName, userEmail);
    updateProfileDisplay();
    renderRecentScans();
    populateVoiceDropdown();
    renderPlacementReadiness();
}

function toggleSidebar() { if (mainSidebar) mainSidebar.classList.toggle('collapsed'); }

async function handleSignOut() {
    try {
        if (typeof showLoader === "function") showLoader('home');
        await Clerk.signOut();
        dashboardPage.style.display = 'none';
        landingPage.style.display = 'flex';
        window.location.reload();
    } catch (err) {
        console.error("Logout Error:", err);
        alert("Failed to sign out. Please try again.");
    } finally {
        if (typeof hideLoader === "function") hideLoader();
    }
}

// ==========================================
//  VIEW SWITCHING
// ==========================================

function enterChatMode() {
    if (mainSidebar) mainSidebar.classList.add('hidden');
    if (chatSidebar) chatSidebar.classList.remove('hidden');
    ['view-home','view-resume','view-profile','view-about'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('view-chat').classList.remove('hidden');
    populateVoiceDropdown();
    initializeChat();
    scrollToBottom();
    injectVoiceModeButton();
}

function exitChatMode() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (recognition && isListening) recognition.stop();
    if (chatSidebar) chatSidebar.classList.add('hidden');
    if (mainSidebar) mainSidebar.classList.remove('hidden');
    document.getElementById('view-chat').classList.add('hidden');
    switchTab('home');
}

function switchTab(tabName, element) {
    showLoader(tabName);
    setTimeout(() => {
        if (tabName === 'chat') { enterChatMode(); hideLoader(); return; }
        if (element) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            element.classList.add('active');
        }
        ['view-home','view-chat','view-resume','view-profile','view-about'].forEach(id =>
            document.getElementById(id)?.classList.add('hidden')
        );
        const target = document.getElementById(`view-${tabName}`);
        if (target) { target.classList.remove('hidden'); target.classList.add('fade-in'); }
        if (tabName === 'home') renderPlacementReadiness();
        hideLoader();
    }, 300);
}

function injectVoiceModeButton() {
    if (document.getElementById('open-voice-mode-btn')) return;
    const header = document.querySelector('.chat-header > div');
    if (!header) return;
    const btn = document.createElement('button');
    btn.id = 'open-voice-mode-btn';
    btn.title = 'Voice Conversation Mode';
    btn.style.cssText = `display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,rgba(213,184,147,0.15),rgba(166,95,236,0.15));border:1px solid rgba(213,184,147,0.4);color:#D5B893;border-radius:30px;padding:8px 16px;font-family:'Poppins',sans-serif;font-size:0.8rem;font-weight:500;cursor:pointer;transition:all 0.2s;`;
    btn.innerHTML = '<i class="ri-phone-line" style="font-size:1rem;"></i> Voice Mode';
    btn.onmouseenter = () => { btn.style.background = 'linear-gradient(135deg,rgba(213,184,147,0.25),rgba(166,95,236,0.25))'; btn.style.boxShadow = '0 0 16px rgba(213,184,147,0.3)'; };
    btn.onmouseleave = () => { btn.style.background = 'linear-gradient(135deg,rgba(213,184,147,0.15),rgba(166,95,236,0.15))'; btn.style.boxShadow = 'none'; };
    btn.onclick = openVoiceMode;
    const rightControls = header.lastElementChild;
    header.insertBefore(btn, rightControls);
}

// ==========================================
//  CHAT SYSTEM
// ==========================================

function scrollToBottom() { if (chatBox) chatBox.scrollTop = chatBox.scrollHeight; }

async function initializeChat() {
    // Try to load history from Supabase
    try {
        const res = await fetch('http://127.0.0.1:5000/get-history');
        const serverChats = await res.json();
        if (serverChats && serverChats.length > 0) {
            // Merge server chats with local ones (server is source of truth)
            savedChats = serverChats.map(sc => ({
                id: sc.id,
                title: sc.title || 'Conversation',
                messages: [] // messages loaded on demand
            }));
            // Preserve any local-only chats not yet on server
            const serverIds = new Set(serverChats.map(c => c.id));
            const localOnly = (JSON.parse(localStorage.getItem('placeItChats')) || []).filter(c => !serverIds.has(c.id));
            savedChats = [...savedChats, ...localOnly];
            saveToLocalStorage();
        }
    } catch (e) {
        // Server unreachable — fall back to localStorage
        console.warn('Could not fetch chat history from server, using local cache.');
    }

    renderHistoryList();

    if (savedChats.length > 0) {
        if (!currentChatId) await loadChat(savedChats[0].id);
    } else {
        startNewChat();
    }
}

function startNewChat() {
    const id = Date.now().toString();
    savedChats.unshift({ id, title: "New Conversation", messages: [] });
    currentChatId = id;
    localStorage.setItem('current_chat_id', id);
    chatBox.innerHTML = '';
    suggestionsBox.classList.remove('hidden');
    saveToLocalStorage();
    renderHistoryList();
}

async function loadChat(id) {
    currentChatId = id;
    localStorage.setItem('current_chat_id', id);
    const chat = savedChats.find(c => c.id === id);
    if (!chat) return;
    chatBox.innerHTML = '';

    // Try to load messages from Supabase
    try {
        const res = await fetch(`http://127.0.0.1:5000/get-chat/${id}`);
        const serverMessages = await res.json();
        if (serverMessages && serverMessages.length > 0) {
            chat.messages = serverMessages.map(m => ({ role: m.role, text: m.content }));
            saveToLocalStorage();
        }
    } catch (e) {
        // Fall back to locally cached messages
    }

    if (chat.messages.length === 0) {
        suggestionsBox.classList.remove('hidden');
    } else {
        suggestionsBox.classList.add('hidden');
        chat.messages.forEach(msg => appendMessageToUI(msg.role, msg.text, false, false));
    }
    renderHistoryList();
    scrollToBottom();
}

function appendMessageToUI(role, text, shouldSave = true, useTypewriter = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role === 'user' ? 'msg-user' : 'msg-ai'}`;
    chatBox.appendChild(msgDiv);
    scrollToBottom();

    if (role === 'ai' && useTypewriter) {
        let i = 0;
        const interval = setInterval(() => {
            msgDiv.innerText = text.substring(0, i) + '●';
            i++; scrollToBottom();
            if (i > text.length) {
                clearInterval(interval);
                msgDiv.innerHTML = marked.parse(text);
                if (window.Prism) Prism.highlightAllUnder(msgDiv);
                if (shouldSave) saveMessageData(role, text);
                speakText(text);
            }
        }, 15);
    } else {
        if (role === 'ai') {
            msgDiv.innerHTML = marked.parse(text);
            if (window.Prism) Prism.highlightAllUnder(msgDiv);
            speakText(text);
        } else {
            msgDiv.innerText = text;
        }
        if (shouldSave) saveMessageData(role, text);
        scrollToBottom();
    }
}

function saveMessageData(role, text) {
    if (!currentChatId) return;
    const chat = savedChats.find(c => c.id === currentChatId);
    if (chat) {
        chat.messages.push({ role, text });
        if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
            chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        }
        saveToLocalStorage();
        renderHistoryList();
    }
}

async function sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    suggestionsBox.classList.add('hidden');
    appendMessageToUI('user', text, true);
    input.value = '';

    const loadingId = 'loading-' + Date.now();
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'message msg-ai';
    loadingMsg.id = loadingId;
    loadingMsg.innerHTML = `<span class="thinking-dots">Thinking<span>.</span><span>.</span><span>.</span></span>`;
    chatBox.appendChild(loadingMsg);
    scrollToBottom();

    let activeChatId = currentChatId || localStorage.getItem('current_chat_id');
    if (!activeChatId) { activeChatId = 'chat_' + Date.now(); localStorage.setItem('current_chat_id', activeChatId); currentChatId = activeChatId; }

    try {
        const response = await fetch('http://127.0.0.1:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, chat_id: activeChatId, title: text.substring(0, 30) })
        });
        if (!response.ok) throw new Error('Server returned ' + response.status);
        const data = await response.json();
        document.getElementById(loadingId)?.remove();
        appendMessageToUI('ai', data.reply || "Sorry, I'm having trouble connecting.", true, true);
    } catch (error) {
        console.error("Fetch error:", error);
        document.getElementById(loadingId)?.remove();
        appendMessageToUI('ai', "⚠️ Could not reach the server. Please check that Flask is running on port 5000.", true, true);
    }
}

function downloadTranscript() {
    const chat = savedChats.find(c => c.id === currentChatId);
    if (!chat || chat.messages.length === 0) { showToast('💬 No messages to download yet.'); return; }
    let content = `Place-iT | AI Career Coach — Chat Transcript\nChat: ${chat.title}\nDate: ${new Date().toLocaleString()}\n${'─'.repeat(50)}\n\n`;
    chat.messages.forEach(msg => {
        const label = msg.role === 'user' ? '🧑 You' : '🤖 Place-iT';
        content += `${label}:\n${msg.text.replace(/[*_`#>~\[\]]/g, '').trim()}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PlaceIt_Chat_${chat.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('📥 Transcript downloaded!');
}

function deleteChat(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;
    savedChats = savedChats.filter(c => c.id !== id);
    saveToLocalStorage();
    if (currentChatId === id) { currentChatId = null; startNewChat(); }
    else renderHistoryList();
}

// ==========================================
//  RENAME MODAL
// ==========================================

function openRenameModal(e, id, type) {
    e.stopPropagation();
    renameTargetId = id; renameTargetType = type;
    document.getElementById('rename-modal').classList.remove('hidden');
    document.getElementById('rename-input').value = "";
    setTimeout(() => document.getElementById('rename-input').focus(), 50);
}

function confirmRename() {
    const newName = document.getElementById('rename-input').value.trim();
    if (newName && renameTargetId) {
        if (renameTargetType === 'chat') {
            const chat = savedChats.find(c => c.id === renameTargetId);
            if (chat) { chat.title = newName; saveToLocalStorage(); renderHistoryList(); }
        } else if (renameTargetType === 'scan') {
            const scan = recentScans.find(s => s.id === renameTargetId);
            if (scan) { scan.name = newName; saveRecentScans(); renderRecentScans(); }
        }
    }
    closeModal();
}

function closeModal() {
    document.getElementById('rename-modal').classList.add('hidden');
    renameTargetId = null;
}

// Close modal on Enter key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ==========================================
//  PROFILE
// ==========================================

function initializeProfile(name, email) {
    let saved = JSON.parse(localStorage.getItem('studentProfile'));
    if (!saved) {
        saved = {
            name, email, mobile: "", location: "", bio: "",
            stream: "CSE", cgpa: "", college: "", year: "2025",
            linkedin: "", github: "", skills: ""
        };
        localStorage.setItem('studentProfile', JSON.stringify(saved));
    } else if (!saved.email && email) {
        // Update email if it was missing
        saved.email = email;
        localStorage.setItem('studentProfile', JSON.stringify(saved));
    }
}

function updateProfileDisplay() {
    const data = JSON.parse(localStorage.getItem('studentProfile'));
    if (!data) return;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val || "—"; };
    setText('disp-name', data.name);
    const emailSpan = document.getElementById('disp-email-text');
    if (emailSpan) emailSpan.innerText = data.email || '—';
    setText('disp-phone', data.mobile);
    setText('disp-location', data.location);
    setText('disp-cgpa', data.cgpa);
    setText('disp-cgpa-val', data.cgpa);
    setText('disp-college', data.college);
    setText('disp-bio', data.bio);
    const dashCGPA = document.getElementById('dash-cgpa');
    if (dashCGPA) dashCGPA.innerText = data.cgpa || '—';
    const skillsContainer = document.getElementById('disp-skills');
    if (skillsContainer) {
        skillsContainer.innerHTML = '';
        (data.skills || '').split(',').forEach(skill => {
            if (skill.trim()) {
                const span = document.createElement('span');
                span.style.cssText = "background:rgba(255,255,255,0.1);padding:5px 10px;border-radius:4px;font-size:0.85rem;";
                span.innerText = skill.trim();
                skillsContainer.appendChild(span);
            }
        });
    }
    const setLink = (id, url) => {
        const el = document.getElementById(id);
        if (el) el.href = (url && url !== '#' && url.startsWith('http')) ? url : 'javascript:void(0)';
    };
    setLink('disp-linkedin', data.linkedin);
    setLink('disp-github', data.github);

    // Profile photo / initials
    const savedPhoto = localStorage.getItem('profilePhoto');
    const initialsDisplay = document.getElementById('profile-initials-display');
    if (initialsDisplay && data.name) {
        initialsDisplay.innerText = data.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    applyProfilePhotoToUI(savedPhoto || null);

    const streamBadge = document.getElementById('disp-stream-badge');
    if (streamBadge && data.stream) streamBadge.innerText = data.stream + ' Student';
    const yearBadge = document.getElementById('disp-year-badge');
    if (yearBadge && data.year) yearBadge.innerText = data.year + ' Batch';

    // Sidebar avatar initials
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar && !localStorage.getItem('profilePhoto') && data.name) {
        sidebarAvatar.innerHTML = data.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
}

function populateProfileForm() {
    const data = JSON.parse(localStorage.getItem('studentProfile'));
    if (!data) return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
    setVal('p-name', data.name); setVal('p-mobile', data.mobile); setVal('p-location', data.location);
    setVal('p-bio', data.bio); setVal('p-stream', data.stream); setVal('p-cgpa', data.cgpa);
    setVal('p-college', data.college); setVal('p-year', data.year);
    setVal('p-linkedin', data.linkedin); setVal('p-github', data.github); setVal('p-skills', data.skills);

    const savedPhoto = localStorage.getItem('profilePhoto');
    const editPreviewImg = document.getElementById('edit-photo-preview-img');
    const editInitials = document.getElementById('edit-avatar-initials');
    const removeBtn = document.getElementById('remove-photo-btn');
    if (savedPhoto) {
        if (editPreviewImg) { editPreviewImg.src = savedPhoto; editPreviewImg.style.display = 'block'; }
        if (editInitials) editInitials.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
        if (editPreviewImg) { editPreviewImg.src = ''; editPreviewImg.style.display = 'none'; }
        if (editInitials) {
            editInitials.style.display = '';
            editInitials.innerText = data.name ? data.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '';
        }
        if (removeBtn) removeBtn.style.display = 'none';
    }
    sessionStorage.removeItem('pendingProfilePhoto');
}

function toggleProfileEdit(showEdit) {
    const dv = document.getElementById('profile-display-view');
    const ev = document.getElementById('profile-edit-view');
    if (showEdit) { populateProfileForm(); dv.classList.add('hidden'); ev.classList.remove('hidden'); }
    else { ev.classList.add('hidden'); dv.classList.remove('hidden'); }
}

function saveProfile(event) {
    event.preventDefault();
    const currentData = JSON.parse(localStorage.getItem('studentProfile') || '{}');
    const updatedData = {
        name: document.getElementById('p-name').value.trim(),
        email: currentData.email || '',
        mobile: document.getElementById('p-mobile').value.trim(),
        location: document.getElementById('p-location').value.trim(),
        bio: document.getElementById('p-bio').value.trim(),
        stream: document.getElementById('p-stream').value,
        cgpa: document.getElementById('p-cgpa').value,
        college: document.getElementById('p-college').value.trim(),
        year: document.getElementById('p-year').value,
        linkedin: document.getElementById('p-linkedin').value.trim(),
        github: document.getElementById('p-github').value.trim(),
        skills: document.getElementById('p-skills').value.trim()
    };
    localStorage.setItem('studentProfile', JSON.stringify(updatedData));

    const pendingPhoto = sessionStorage.getItem('pendingProfilePhoto');
    if (pendingPhoto === '__remove__') {
        localStorage.removeItem('profilePhoto');
        sessionStorage.removeItem('pendingProfilePhoto');
    } else if (pendingPhoto) {
        localStorage.setItem('profilePhoto', pendingPhoto);
        sessionStorage.removeItem('pendingProfilePhoto');
    }

    updateProfileDisplay();
    toggleProfileEdit(false);
    showToast('✅ Profile saved successfully!');
    const sidebarName = document.getElementById('display-sidebar-name');
    if (sidebarName) sidebarName.innerText = updatedData.name;
    renderPlacementReadiness();
}

// ==========================================
//  HELPERS
// ==========================================

function fillInput(text) {
    const inputEl = document.getElementById('user-input');
    if (inputEl) { inputEl.value = text; inputEl.focus(); }
    sendMessage();
}

function handleEnter(event) { if (event.key === 'Enter' && !event.shiftKey) sendMessage(); }

function saveToLocalStorage() { localStorage.setItem('placeItChats', JSON.stringify(savedChats)); }

function renderHistoryList() {
    if (!historyList) return;
    historyList.innerHTML = '';
    savedChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        item.innerHTML = `
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">
                <i class="ri-message-3-line" style="margin-right:6px;"></i>${chat.title}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
                <i class="ri-edit-line" style="cursor:pointer;color:var(--text-muted);font-size:0.95rem;" onclick="openRenameModal(event,'${chat.id}','chat')" title="Rename"></i>
                <i class="ri-delete-bin-line" style="cursor:pointer;color:var(--text-muted);font-size:0.95rem;" onclick="deleteChat(event,'${chat.id}')" title="Delete"></i>
            </div>`;
        item.onclick = () => loadChat(chat.id);
        historyList.appendChild(item);
    });
}

function renderRecentScans() {
    const container = document.getElementById('recent-scans-list');
    const countEl = document.getElementById('scans-count');
    if (!container) return;
    container.innerHTML = '';

    if (countEl) countEl.textContent = recentScans.length > 0 ? `${recentScans.length} scan${recentScans.length > 1 ? 's' : ''}` : '';

    if (recentScans.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:30px 15px;color:var(--text-muted);font-size:0.85rem;"><i class="ri-file-search-line" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.4;"></i>No scans yet.<br>Upload a resume to get started.</div>`;
        return;
    }

    recentScans.forEach(scan => {
        const card = document.createElement('div');
        card.className = 'scan-card';
        card.style.cssText = `background:rgba(255,255,255,0.04);padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.07);transition:all 0.25s ease;cursor:pointer;position:relative;overflow:hidden;`;
        const barWidth = Math.min(scan.score, 100);
        card.innerHTML = `
            <div style="position:absolute;bottom:0;left:0;height:3px;width:${barWidth}%;background:${scan.color};border-radius:0 0 0 12px;transition:width 0.5s ease;"></div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                    <i class="ri-file-text-line" style="color:${scan.color};font-size:1.1rem;flex-shrink:0;"></i>
                    <span style="color:#fff;font-size:0.82rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${scan.name}">${scan.name}</span>
                </div>
                <div style="display:flex;gap:8px;flex-shrink:0;margin-left:8px;">
                    <i class="ri-eye-line" title="View Results" onclick="event.stopPropagation();viewScanDetails('${scan.id}')" style="color:var(--tan);cursor:pointer;font-size:1rem;" onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'"></i>
                    <i class="ri-edit-line" title="Rename" onclick="event.stopPropagation();openRenameModal(event,'${scan.id}','scan')" style="color:var(--text-muted);cursor:pointer;font-size:1rem;"></i>
                    <i class="ri-delete-bin-line" title="Delete" onclick="event.stopPropagation();deleteScan(event,'${scan.id}')" style="color:var(--text-muted);cursor:pointer;font-size:1rem;"></i>
                </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.78rem;color:var(--text-muted);">
                <span><i class="ri-calendar-line" style="margin-right:4px;"></i>${scan.date}</span>
                <span style="color:${scan.color};font-weight:700;font-size:0.88rem;">${scan.score}%</span>
            </div>
        `;
        card.onclick = () => viewScanDetails(scan.id);
        card.onmouseenter = () => { card.style.background = 'rgba(255,255,255,0.08)'; card.style.borderColor = 'rgba(213,184,147,0.2)'; card.style.transform = 'translateX(3px)'; };
        card.onmouseleave = () => { card.style.background = 'rgba(255,255,255,0.04)'; card.style.borderColor = 'rgba(255,255,255,0.07)'; card.style.transform = 'translateX(0)'; };
        container.appendChild(card);
    });
}

function deleteScan(e, id) {
    e.stopPropagation();
    if (confirm("Delete this scan?")) {
        recentScans = recentScans.filter(s => s.id !== id);
        saveRecentScans();
        renderRecentScans();
    }
}

// ==========================================
//  CLERK AUTH
// ==========================================

window.addEventListener('load', async function () {
    await Clerk.load();
    populateVoiceDropdown();
    if (Clerk.user) goToDashboard();
    else {
        Clerk.mountSignIn(document.getElementById('clerk-auth-ui'), {
            appearance: {
                theme: 'dark',
                variables: { colorPrimary: '#d5b893', colorBackground: '#1a1a1a', colorText: '#ffffff' }
            },
            afterSignInUrl: 'javascript:goToDashboard()',
            afterSignUpUrl: 'javascript:goToDashboard()'
        });
    }
});

// ==========================================
//  SKILLS RADAR CHART
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    const radarCtx = document.getElementById('skillsRadarChart');
    if (radarCtx) {
        new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: ['Frontend', 'Backend', 'Database', 'DSA', 'UI/UX', 'DevOps'],
                datasets: [{
                    label: 'Skills Proficiency',
                    data: [85, 70, 75, 90, 80, 65],
                    backgroundColor: 'rgba(213,184,147,0.2)',
                    borderColor: '#D5B893',
                    pointBackgroundColor: '#a65fec',
                    pointBorderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255,255,255,0.1)' },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        pointLabels: { color: '#D5B893', font: { family: 'Poppins', size: 12 } },
                        ticks: { display: false, stepSize: 20 },
                        suggestedMin: 0, suggestedMax: 100
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
});

// ==========================================
//  PAGE LOADER
// ==========================================

const pageLoader = document.getElementById("page-loader");
const loaderText = document.getElementById("loader-text");
const loaderMessages = {
    home: "Loading dashboard", chat: "Preparing your workspace",
    resume: "Analyzing tools", profile: "Loading profile", about: "Getting details ready"
};

function showLoader(view) {
    if (!pageLoader || !loaderText) return;
    loaderText.textContent = loaderMessages[view] || "Setting things up";
    pageLoader.classList.remove("hidden");
}
function hideLoader() { setTimeout(() => pageLoader?.classList.add("hidden"), 500); }

// ==========================================
//  1% BETTER TIPS
// ==========================================

const tips = [
    "Recruiters reject resumes in under 7 seconds. Make your first bullet point quantifiable.",
    "If your resume has paragraphs, it's already losing. Use action-driven bullets only.",
    "Most students fail interviews due to weak communication, not lack of knowledge.",
    "If you can't explain your project in 30 seconds, it's not interview-ready.",
    "Your LinkedIn headline matters more than your CGPA to most recruiters.",
    "One strong, deployed project beats five average ones on your resume.",
    "Interviewers remember clarity, not complexity — simplify your answers.",
    "Cold messaging 5 professionals on LinkedIn per week opens more doors than applying online.",
    "A 'Achievements' section with numbers (%, ₹, users) dramatically boosts ATS score.",
    "Practice coding problems daily — consistency beats cramming every time."
];
let currentTip = 0;
const textEl = document.getElementById("onePercentText");
const nextBtn = document.getElementById("nextBtn");
const actBtn = document.getElementById("actBtn");

function showNextTip() {
    currentTip = (currentTip + 1) % tips.length;
    if (textEl) {
        textEl.style.opacity = 0;
        setTimeout(() => {
            textEl.textContent = tips[currentTip];
            textEl.style.transition = 'opacity 0.4s ease';
            textEl.style.opacity = 1;
        }, 200);
    }
}
if (nextBtn) nextBtn.addEventListener("click", showNextTip);
if (actBtn) actBtn.addEventListener("click", () => { showToast('💪 Great! Keep pushing!'); showNextTip(); });
setInterval(showNextTip, 15000);