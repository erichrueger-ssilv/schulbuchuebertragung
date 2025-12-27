// --- Globale Variablen ---
let isProcessing = false;
let stopRequested = false;
let appInitialized = false;
let cameraQueue = [];
let allMarkdownResults = [];
let previewItems = [];
let currentPreviewIndex = 0;
let lastProcessedIndex = -1;
let lastProcessedImageBase64 = null;
let currentVisionBase64 = null;
let firstFileName = "scan";
let shouldAutoSave = false;
let shouldAutoRead = false;
let wasAutoProcessed = false;
let totalStartTime = 0;
let globalToc = [];

// DOM Elements often used globally or across modules
// Note: Some might be null if accessed before DOM load, but usually accessed inside functions.
// We'll trust they are available when functions run.
function logMessage(msg) {
    const logEl = document.getElementById("log-area");
    if (!logEl) return;
    const timestamp = new Date().toLocaleTimeString();
    logEl.textContent += `[${timestamp}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

function updateCameraFileStatus() {
    const statusDiv = document.getElementById("file-status-indicator");
    const countSpan = document.getElementById("camera-file-count");
    const toggleProcessingBtn = document.getElementById("toggle-processing-btn");

    if (!statusDiv || !countSpan) return;

    if (cameraQueue.length > 0) {
        statusDiv.style.display = "flex";
        countSpan.textContent = `${cameraQueue.length} Foto(s) aufgenommen`;
        if (toggleProcessingBtn) toggleProcessingBtn.disabled = false;
    } else {
        statusDiv.style.display = "none";
        // Only disable if no files are selected either
        const fileInput = document.getElementById("file-input");
        if (toggleProcessingBtn && (!fileInput || fileInput.files.length === 0)) {
            toggleProcessingBtn.disabled = true;
        }
    }
}
