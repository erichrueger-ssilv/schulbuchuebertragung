/**
 * Converts an ArrayBuffer to a Base64 string.
 * @param {ArrayBuffer} buffer - The buffer to convert.
 * @returns {string} The Base64 string.
 */
function buf2base64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Converts a Base64 string to an ArrayBuffer.
 * @param {string} base64 - The Base64 string to convert.
 * @returns {ArrayBuffer} The ArrayBuffer.
 */
function base642buf(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 * @param {string} password - The password.
 * @param {Uint8Array} salt - The salt.
 * @returns {Promise<CryptoKey>} The derived key.
 */
async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
    );
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
}

/**
 * Encrypts text using a password.
 * @param {string} text - The text to encrypt.
 * @param {string} password - The password.
 * @returns {Promise<Object>} The encrypted object containing salt, iv, and data.
 */
async function encryptData(text, password) {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(text),
    );
    return {
        isEncrypted: true,
        salt: buf2base64(salt),
        iv: buf2base64(iv),
        data: buf2base64(encryptedContent),
    };
}

/**
 * Decrypts an encrypted object using a password.
 * @param {Object} encryptedObj - The encrypted object.
 * @param {string} password - The password.
 * @returns {Promise<string>} The decrypted text.
 */
async function decryptData(encryptedObj, password) {
    try {
        const salt = base642buf(encryptedObj.salt);
        const iv = base642buf(encryptedObj.iv);
        const data = base642buf(encryptedObj.data);
        const key = await deriveKey(password, salt);
        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            data,
        );
        const dec = new TextDecoder();
        return dec.decode(decryptedContent);
    } catch (e) {
        throw new Error("Entschlüsselung fehlgeschlagen.");
    }
}

/**
 * Formats milliseconds into MM:SS format.
 * @param {number} ms - Time in milliseconds.
 * @returns {string} Formatted time string.
 */
function formatTime(ms) {
    if (!isFinite(ms) || isNaN(ms)) return "--:--";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Generates a filename based on the current timestamp.
 * @returns {string} The formatted filename.
 */
function getTimestampFileName() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `OCR-Scan-${y}-${m}-${d}_${h}-${min}`;
}

/**
 * Reads a file and returns its content as a Base64 string.
 * @param {File} file - The file to read.
 * @returns {Promise<string>} The Base64 string.
 */
function getBase64FromImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * Renders a PDF page to a canvas and returns the image as a Base64 string.
 * @param {Object} pdfDoc - The PDF document object.
 * @param {number} pageNum - The page number to render.
 * @param {number} dpi - The DPI for rendering.
 * @returns {Promise<string>} The Base64 string of the rendered page.
 */
async function getBase64FromPdfPage(pdfDoc, pageNum, dpi) {
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: dpi / 72 });

        const canvas = document.createElement("canvas");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const context = canvas.getContext("2d");
        await page.render({
            canvasContext: context,
            viewport: viewport,
        }).promise;

        return canvas.toDataURL("image/jpeg", 0.9);
    } catch (e) {
        console.error("Fehler beim Rendern der PDF-Seite:", e);
        throw e;
    }
}

/**
 * Unlocks text-to-speech on iOS devices by playing a silent utterance.
 */
function unlockTTS() {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
}

/**
 * Speaks the given text using the Web Speech API.
 * Automatically detects language (DE vs EN).
 * @param {string} text - The text to speak.
 */
function speakText(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); // Vorheriges abbrechen

    if (!text || !text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);

    // Sprache erkennen (einfach)
    const isEnglish =
        /[a-z]/i.test(text) &&
        (text.match(/\b(the|and|is)\b/gi) || []).length >
        (text.match(/\b(der|die|das)\b/gi) || []).length;

    utterance.lang = isEnglish ? "en-US" : "de-DE";

    // Kurze Verzögerung für Stimmen-Laden (besonders mobile)
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        const matchingVoice = voices.find((v) =>
            v.lang.startsWith(utterance.lang),
        );
        if (matchingVoice) utterance.voice = matchingVoice;
    }

    window.speechSynthesis.speak(utterance);
}
