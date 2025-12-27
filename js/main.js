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
            cameraQueue = [];
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
