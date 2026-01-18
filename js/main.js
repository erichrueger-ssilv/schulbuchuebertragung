// --- INIT APP ---
function initApp() {
    const cameraResFull = document.getElementById("camera-res-full");
    const cameraPixelGroup = document.getElementById("camera-pixel-group");
    const enableNumberingInput = document.getElementById("enable-numbering");
    const numberingOptions = document.getElementById("numbering-options");
    const visionSendBtn = document.getElementById("vision-send-btn");
    const visionUserInput = document.getElementById("vision-user-input");
    const toggleProcessingBtn = document.getElementById("toggle-processing-btn");
    const downloadMdBtn = document.getElementById("download-md-btn");
    const downloadDocxBtn = document.getElementById("download-docx-btn");
    const toggleRawBtn = document.getElementById("toggle-raw-btn");
    const toggleRenderedBtn = document.getElementById("toggle-rendered-btn");
    const fileInput = document.getElementById("file-input");
    const fileNameDisplay = document.getElementById("file-name-display");
    const manualPromptInput = document.getElementById("manual-prompt");
    const rawPreview = document.getElementById("raw-preview");

    const docxOptions = [
        document.getElementById("docx-opt-unit-cm"),
        document.getElementById("docx-opt-unit-circ"),
        document.getElementById("docx-opt-greek"),
        document.getElementById("docx-opt-supsub"),
        document.getElementById("docx-opt-nonascii"),
        document.getElementById("docx-opt-latex-space-block"),
        document.getElementById("docx-opt-latex-space-inline"),
        document.getElementById("docx-opt-nbsp-narrow"),
        document.getElementById("docx-opt-latex"),
        document.getElementById("docx-opt-dollar"),
        document.getElementById("docx-opt-cdot"),
        document.getElementById("docx-opt-images"),
        document.getElementById("docx-opt-dashes"),
        document.getElementById("docx-opt-tables"),
        document.getElementById("docx-opt-quotes"),
        document.getElementById("docx-opt-hyphens"),
        document.getElementById("docx-opt-whitespace"),
    ];

    if (typeof pdfjsLib !== "undefined") {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "libs/pdfjs/pdf.worker.min.js";
    } else {
        return console.error(
            "PDF.js library did not load properly",
        );
    }
    appInitialized = true;
    initTTS();

    // Event Listeners
    document.getElementById("analyze-toc-btn").addEventListener("click", analyzeToc);

    toggleProcessingBtn.addEventListener("click", () => {
        if (isProcessing) {
            stopRequested = true;
            toggleProcessingBtn.textContent = "Stoppt...";
            toggleProcessingBtn.disabled = true;
        } else {
            startProcessing();
        }
    });

    downloadMdBtn.addEventListener("click", () => {
        if (appInitialized) downloadMarkdown(isProcessing);
    });
    downloadDocxBtn.addEventListener("click", () => {
        if (appInitialized) downloadDocx();
    });

    toggleRawBtn.addEventListener("click", () =>
        setPreviewMode("raw"),
    );
    toggleRenderedBtn.addEventListener("click", () =>
        setPreviewMode("rendered"),
    );

    document.getElementById("tab-current").addEventListener("click", () => {
        activeResultTab = 'current';
        document.getElementById("tab-current").classList.add("active");
        document.getElementById("tab-total").classList.remove("active");
        refreshResultView();
    });

    document.getElementById("tab-total").addEventListener("click", () => {
        activeResultTab = 'total';
        document.getElementById("tab-total").classList.add("active");
        document.getElementById("tab-current").classList.remove("active");
        refreshResultView();
    });

    // DOCX Options listener
    docxOptions.forEach((opt) => {
        if (!opt) return;
        opt.addEventListener("change", () => {
            opt.setAttribute("aria-checked", opt.checked);
            if (toggleRenderedBtn.classList.contains("active"))
                updateTextPreview(rawPreview.value);
        });
    });

    // File Input Change
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            updateCameraFileStatus();

            // Display Filename
            const count = fileInput.files.length;
            const text =
                count === 1
                    ? fileInput.files[0].name
                    : `${count} Dateien ausgewählt`;
            fileNameDisplay.textContent = text;
            fileNameDisplay.style.display = "block";

            firstFileName =
                fileInput.files[0].name
                    .split(".")
                    .slice(0, -1)
                    .join(".") || "download";
            logMessage(
                `${fileInput.files.length} Datei(en) ausgewählt.`,
            );
            toggleProcessingBtn.disabled = false;
            loadPreviewContent(); // Trigger immediate preview
        } else {
            fileNameDisplay.style.display = "none";
        }
    });

    // Manual Prompt ENTER Handler
    manualPromptInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (isProcessing) return;
            toggleProcessingBtn.click();
        }
    });

    visionSendBtn.addEventListener("click", handleVisionChat);
    visionUserInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleVisionChat();
    });

    initSettingsListeners();
    initCameraListeners();
    initNavigationListeners();
    initTocEditor();

    document.getElementById("paste-btn").addEventListener("click", async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            const files = [];
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith("image/") || type === "application/pdf") {
                        const blob = await item.getType(type);
                        const file = new File([blob], `clipboard-${Date.now()}.${type.split('/')[1]}`, { type });
                        files.push(file);
                    }
                }
            }
            if (files.length > 0) {
                handleClipboardFiles(files);
            } else {
                logMessage("Keine unterstützten Dateien (Bild/PDF) in der Zwischenablage gefunden.");
            }
        } catch (err) {
            console.error("Paste failed:", err);
            logMessage("Einfügen fehlgeschlagen. Bitte nutzen Sie Strg+V / Cmd+V.");
        }
    });

    updateApiSettings();
    numberingOptions.style.display = enableNumberingInput.checked
        ? "flex"
        : "none";
    setPreviewMode("raw");
    toggleProcessingBtn.disabled = true;
    loadFromLocalStorage();
    cameraPixelGroup.style.display = cameraResFull.checked
        ? "none"
        : "flex";
}

let initAppCalled = false;
function tryInitApp() {
    if (typeof pdfjsLib !== "undefined" && !initAppCalled) {
        initAppCalled = true;
        initApp();
        return true;
    }
    return false;
}

initTheme();
if (!tryInitApp()) {
    const checkPdfJsInterval = setInterval(() => {
        if (tryInitApp()) clearInterval(checkPdfJsInterval);
    }, 50);
    setTimeout(() => {
        if (!initAppCalled) {
            clearInterval(checkPdfJsInterval);
            initAppCalled = true;
            initApp();
        }
    }, 5000);
}

// --- GLOBAL FILE DRAG-AND-DROP ---
document.body.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.add("drag-over");
});

document.body.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only remove if we actually leave the window
    if (e.relatedTarget === null || e.relatedTarget === document.documentElement) {
        document.body.classList.remove("drag-over");
    }
});

// --- HELPER: ADD FILES TO STACK ---
function addFilesToStack(newFiles) {
    const fileInput = document.getElementById("file-input");
    if (!fileInput) return;

    const dt = new DataTransfer();

    // Add existing files
    if (fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            dt.items.add(fileInput.files[i]);
        }
    }

    // Add new files (filtered)
    for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        const isSupported =
            file.type === "application/pdf" ||
            file.type.startsWith("image/") ||
            file.name.toLowerCase().endsWith(".pdf");
        if (isSupported) {
            dt.items.add(file);
        }
    }

    fileInput.files = dt.files;
    // Trigger the existing change listener
    fileInput.dispatchEvent(new Event("change"));
}

document.body.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.remove("drag-over");

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        addFilesToStack(files);
    }
});

// --- GLOBAL CLIPBOARD PASTE ---
// --- HANDLE CLIPBOARD FILES ---
async function handleClipboardFiles(files) {
    if (files.length === 0) return;

    // Check behavior setting
    const clipboardBehavior = document.getElementById("clipboard-behavior").value;
    if (clipboardBehavior === "ignore") return;

    if (isProcessing) {
        logMessage("Hinweis: Inhalts-Paste während laufender Verarbeitung ignoriert.");
        return;
    }

    if (clipboardBehavior === "ask") {
        const confirmed = await showConfirmModal(
            "Inhalt einfügen?",
            `${files.length} Element(e) in der Zwischenablage erkannt. Zum Stapel hinzufügen?`
        );
        if (!confirmed) return;
    }

    logMessage(`${files.length} Element(e) aus Zwischenablage hinzugefügt.`);
    addFilesToStack(files);

    if (clipboardBehavior === "process") {
        setTimeout(() => {
            const toggleProcessingBtn = document.getElementById("toggle-processing-btn");
            if (toggleProcessingBtn && !toggleProcessingBtn.disabled && !isProcessing) {
                toggleProcessingBtn.click();
            }
        }, 500);
    }
}

window.addEventListener("paste", async (e) => {
    // Only handle if we're not in an input field (except manual-prompt)
    const activeEl = document.activeElement;
    const isInput = ["INPUT", "TEXTAREA"].includes(activeEl.tagName);
    const isManualPrompt = activeEl.id === "manual-prompt" || activeEl.id === "vision-user-input";

    if (isInput && !isManualPrompt) {
        return;
    }

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const files = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
            const file = items[i].getAsFile();
            if (file) files.push(file);
        }
    }

    if (files.length > 0) {
        handleClipboardFiles(files);
    }
});

// --- COPY RESULT ACTIONS ---
const copyResultBtn = document.getElementById("copy-result-btn");
const rawPreview = document.getElementById("raw-preview");

if (copyResultBtn) {
    copyResultBtn.addEventListener("click", () => {
        copyTextToClipboard(rawPreview.value);
    });
}

// Keyboard Shortcut: Cmd/Ctrl + Shift + C
window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyTextToClipboard(rawPreview.value);
    }
});
