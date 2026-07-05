// ─── DOM Elements ─────────────────────────────────────────────────────────────
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const welcomeContainer = document.getElementById('welcome-container');
const welcomeTitle = document.getElementById('welcome-title');
const newChatBtn = document.getElementById('new-chat-btn');
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const sidebar = document.getElementById('sidebar');
const micBtn = document.getElementById('mic-btn');
const micIcon = document.getElementById('mic-icon');
const imageBtn = document.getElementById('image-btn');
const imageFileInput = document.getElementById('image-file-input');
const imagePreviewArea = document.getElementById('image-preview-area');
const imagePreviewThumb = document.getElementById('image-preview-thumb');
const removeImageBtn = document.getElementById('remove-image-btn');
const headerAvatar = document.getElementById('header-avatar');
const userSidebarPhoto = document.getElementById('user-sidebar-photo');
const userSidebarName = document.getElementById('user-sidebar-name');
const userSidebarEmail = document.getElementById('user-sidebar-email');
const logoutBtn = document.getElementById('logout-btn');

// ─── State ────────────────────────────────────────────────────────────────────
let conversation = [];
let selectedImageBase64 = null;
let selectedImageMime = null;
let isRecording = false;
let recognition = null;

// ─── Load User Info ───────────────────────────────────────────────────────────
async function loadUser() {
    try {
        const res = await fetch('/api/user');
        const data = await res.json();

        if (data.loggedIn && data.user) {
            const { name, email, photo } = data.user;

            // Update welcome message
            const firstName = name ? name.split(' ')[0] : 'Kamu';
            if (welcomeTitle) welcomeTitle.textContent = `Halo, ${firstName}! Ada yang bisa saya bantu?`;

            // Update sidebar user info
            if (name) userSidebarName.textContent = name;
            if (email) userSidebarEmail.textContent = email;

            // Update photo
            if (photo) {
                userSidebarPhoto.src = photo;
                headerAvatar.src = photo;
            } else {
                userSidebarPhoto.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'U')}`;
                headerAvatar.src = userSidebarPhoto.src;
            }

            // In demo mode, hide logout button
            if (data.demo) {
                if (logoutBtn) logoutBtn.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn('Gagal memuat info user:', e);
    }
}

loadUser();

// ─── Sidebar Toggle ───────────────────────────────────────────────────────────
if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
}

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuToggleBtn.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    }
});

// ─── New Chat ─────────────────────────────────────────────────────────────────
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        conversation = [];
        chatBox.innerHTML = '';
        clearImageSelection();
        welcomeContainer.style.display = 'flex';
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
    });
}

// ─── Quick Prompt Filler ──────────────────────────────────────────────────────
window.fillInput = function (text) {
    userInput.value = text;
    userInput.focus();
};

// ─── 🖼️ IMAGE UPLOAD ──────────────────────────────────────────────────────────
imageBtn.addEventListener('click', () => imageFileInput.click());

imageFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const result = event.target.result;
        // result is like "data:image/jpeg;base64,XXXX"
        const [header, base64] = result.split(',');
        selectedImageBase64 = base64;
        selectedImageMime = file.type;

        // Show preview
        imagePreviewThumb.src = result;
        imagePreviewArea.style.display = 'block';
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected
    imageFileInput.value = '';
});

removeImageBtn.addEventListener('click', clearImageSelection);

function clearImageSelection() {
    selectedImageBase64 = null;
    selectedImageMime = null;
    imagePreviewThumb.src = '';
    imagePreviewArea.style.display = 'none';
}

// ─── 🎙️ VOICE NOTE (Web Speech API) ──────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    micBtn.title = 'Voice Note tidak didukung browser ini (gunakan Chrome)';
    micBtn.style.opacity = '0.4';
    micBtn.style.cursor = 'not-allowed';
}

micBtn.addEventListener('click', () => {
    if (!SpeechRecognition) {
        alert('Fitur suara hanya bisa digunakan di Google Chrome.');
        return;
    }

    if (isRecording) {
        // Stop recording
        recognition.stop();
    } else {
        // Start recording
        recognition = new SpeechRecognition();
        recognition.lang = 'id-ID'; // Bahasa Indonesia
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            micIcon.className = 'fa-solid fa-stop';
            micBtn.title = 'Klik untuk berhenti merekam';
        };

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            userInput.value = transcript;
        };

        recognition.onend = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
            micIcon.className = 'fa-solid fa-microphone';
            micBtn.title = 'Rekam Suara';
        };

        recognition.onerror = (e) => {
            console.error('Speech error:', e.error);
            isRecording = false;
            micBtn.classList.remove('recording');
            micIcon.className = 'fa-solid fa-microphone';
        };

        recognition.start();
    }
});

// ─── 💬 FORM SUBMIT ───────────────────────────────────────────────────────────
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const messageText = userInput.value.trim();
    if (!messageText && !selectedImageBase64) return;

    const textToSend = messageText || 'Apa yang ada di gambar ini?';
    const imageBase64 = selectedImageBase64;
    const imageMime = selectedImageMime;

    // Add user message to conversation state
    conversation.push({ role: 'user', text: textToSend });

    // Display user message in UI (with optional image)
    appendUserMessage(textToSend, imageBase64 ? `data:${imageMime};base64,${imageBase64}` : null);

    // Clear inputs
    userInput.value = '';
    clearImageSelection();

    // Hide welcome screen
    if (welcomeContainer.style.display !== 'none') {
        welcomeContainer.style.display = 'none';
    }

    // Show thinking indicator
    const thinkingEl = appendThinkingIndicator();
    scrollToBottom();

    try {
        const payload = { conversation };
        if (imageBase64) {
            payload.imageData = imageBase64;
            payload.imageMimeType = imageMime;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP Error ${response.status}`);
        }

        const data = await response.json();
        if (data && data.result) {
            updateBotMessage(thinkingEl, data.result);
            conversation.push({ role: 'model', text: data.result });
        } else {
            updateBotMessage(thinkingEl, 'Maaf, tidak ada respons dari server.');
        }
    } catch (err) {
        console.error('Chat error:', err);
        updateBotMessage(thinkingEl, `⚠️ Error: ${err.message}`);
    } finally {
        scrollToBottom();
    }
});

// ─── DOM Helpers ──────────────────────────────────────────────────────────────
function appendUserMessage(text, imageDataUrl) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', 'user');

    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    const avatarSrc = headerAvatar?.src;
    if (avatarSrc && !avatarSrc.includes('dicebear')) {
        avatar.innerHTML = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
        avatar.innerHTML = '<i class="fa-solid fa-user"></i>';
    }

    const content = document.createElement('div');
    content.classList.add('message-content');

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');

    if (imageDataUrl) {
        const img = document.createElement('img');
        img.src = imageDataUrl;
        img.classList.add('chat-image');
        img.alt = 'Gambar yang dikirim';
        bubble.appendChild(img);
    }

    if (text) {
        const p = document.createElement('p');
        p.style.marginBottom = '0';
        p.textContent = text;
        bubble.appendChild(p);
    }

    content.appendChild(bubble);
    wrapper.appendChild(avatar);
    wrapper.appendChild(content);
    chatBox.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
}

function appendThinkingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', 'bot');

    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    avatar.innerHTML = '<i class="fa-solid fa-sparkles"></i>';

    const content = document.createElement('div');
    content.classList.add('message-content');

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.innerHTML = `
        <div class="thinking-bubble">
            <div class="dot-pulse"></div>
            <div class="dot-pulse"></div>
            <div class="dot-pulse"></div>
        </div>`;

    content.appendChild(bubble);
    wrapper.appendChild(avatar);
    wrapper.appendChild(content);
    chatBox.appendChild(wrapper);
    return wrapper;
}

function updateBotMessage(wrapperElement, text) {
    const bubble = wrapperElement.querySelector('.message-bubble');
    if (bubble) bubble.innerHTML = parseMarkdown(text);
}

function scrollToBottom() {
    const container = document.getElementById('conversation-container');
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

// ─── Markdown Parser ──────────────────────────────────────────────────────────
function parseMarkdown(markdown) {
    if (!markdown) return '';

    let html = markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

    // Process line by line for lists and paragraphs
    const lines = html.split('\n');
    let inUl = false, inOl = false;
    const result = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (/^[-*] /.test(trimmed)) {
            if (!inUl) { if (inOl) { result.push('</ol>'); inOl = false; } result.push('<ul>'); inUl = true; }
            result.push(`<li>${trimmed.slice(2)}</li>`);
        } else if (/^\d+\. /.test(trimmed)) {
            if (!inOl) { if (inUl) { result.push('</ul>'); inUl = false; } result.push('<ol>'); inOl = true; }
            result.push(`<li>${trimmed.replace(/^\d+\. /, '')}</li>`);
        } else {
            if (inUl) { result.push('</ul>'); inUl = false; }
            if (inOl) { result.push('</ol>'); inOl = false; }
            if (trimmed) {
                result.push(`<p>${trimmed}</p>`);
            }
        }
    }

    if (inUl) result.push('</ul>');
    if (inOl) result.push('</ol>');

    return result.join('');
}
