// --- MAIN PROCESSING LOGIC ---
async function startProcessing() {
    const fileInput = document.getElementById("file-input");
    const manualPromptInput = document.getElementById("manual-prompt");
    const toggleProcessingBtn = document.getElementById("toggle-processing-btn");
    const downloadMdBtn = document.getElementById("download-md-btn");
    const downloadDocxBtn = document.getElementById("download-docx-btn");
    const progressWrapper = document.getElementById("progress-wrapper");
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
    const etaText = document.getElementById("eta-text");
    const pageRangeInput = document.getElementById("page-range");
    const dpiInput = document.getElementById("dpi");
    const enableNumberingInput = document.getElementById("enable-numbering");
    const startPdfPageInput = document.getElementById("start-pdf-page");
    const startPageNumberInput = document.getElementById("start-page-number");
    const retriesInput = document.getElementById("retries");

    if (isProcessing) return;

    // Manual Prompt Check
    const manualPrompt = manualPromptInput.value.trim();
    const isManualRun = manualPrompt !== "";

    if (
        !isManualRun &&
        fileInput.files.length === 0 &&
        cameraQueue.length === 0
    ) {
        logMessage(
            "Fehler: Bitte Dateien wählen oder Foto machen.",
        );
        return;
    }
    if (isManualRun && !lastProcessedImageBase64) {
        logMessage(
            "Fehler: Kein Bild für den manuellen Prompt geladen.",
        );
        return;
    }

    isProcessing = true;
    stopRequested = false;

    // Reset results ONLY if full run
    if (!isManualRun) {
        allMarkdownResults = [];
        lastProcessedIndex = -1;
        // Inhaltsverzeichnis Status zurücksetzen
        if (globalToc) globalToc.forEach(h => h.processed = false);
    }

    const logEl = document.getElementById("log-area");
    logEl.textContent = isManualRun
        ? "Führe manuellen Prompt aus...\n"
        : "Starte Verarbeitung...\n";
    // Change Button State
    toggleProcessingBtn.innerHTML = "■ Stop";
    toggleProcessingBtn.classList.add("stop-mode");
    toggleProcessingBtn.disabled = false;
    downloadMdBtn.disabled = true;
    downloadDocxBtn.disabled = true;

    progressWrapper.style.display = "block";
    if (!isManualRun) {
        progressFill.style.width = "0%";
        progressText.textContent = "Initialisiere...";
        etaText.textContent = "Berechne...";
    }

    const pageRange = parsePageRanges(pageRangeInput.value);
    const dpi = parseInt(dpiInput.value, 10);

    const processingOptions = {
        enableNumbering: enableNumberingInput.checked,
        startPdfPage: parseInt(startPdfPageInput.value, 10),
        currentPageNumber: parseInt(
            startPageNumberInput.value,
            10,
        ),
        retries: parseInt(retriesInput.value, 10) || 1,
        promptOverride: isManualRun ? manualPrompt : null,
    };

    totalStartTime = performance.now();
    let totalPagesToProcess = 0;
    let processingQueue = [];

    // Build Queue
    if (isManualRun) {
        // Use currently visible image
        processingQueue.push({
            type: "reprompt",
            data: lastProcessedImageBase64,
        });
        totalPagesToProcess = 1;
        manualPromptInput.value = "";
    } else if (cameraQueue.length > 0) {
        cameraQueue.forEach((b64) =>
            processingQueue.push({ type: "camera", data: b64 }),
        );
        totalPagesToProcess = processingQueue.length;
    } else {
        const files = Array.from(fileInput.files);
        for (const file of files) {
            if (file.type === "application/pdf") {
                try {
                    const pdfData = await file.arrayBuffer();
                    const pdfDoc = await pdfjsLib.getDocument({
                        data: pdfData,
                    }).promise;
                    const pRange =
                        pageRange.length > 0
                            ? pageRange.filter(
                                (p) =>
                                    p > 0 &&
                                    p <= pdfDoc.numPages,
                            )
                            : Array.from(
                                { length: pdfDoc.numPages },
                                (_, i) => i + 1,
                            );
                    for (const pageNum of pRange) {
                        processingQueue.push({
                            type: "pdf",
                            doc: pdfDoc,
                            page: pageNum,
                        });
                    }
                } catch (e) {
                    logMessage("Fehler PDF: " + e.message);
                }
            } else if (file.type.startsWith("image/")) {
                processingQueue.push({
                    type: "image",
                    file: file,
                });
            }
        }
        totalPagesToProcess = processingQueue.length;
    }

    let processedCount = 0;
    try {
        for (const item of processingQueue) {
            if (stopRequested) break;
            progressText.textContent = isManualRun
                ? "Bearbeite manuellen Prompt..."
                : `Seite ${processedCount + 1} von ${totalPagesToProcess}`;

            let base64Provider;
            let pageNumForNumbering =
                processingOptions.startPdfPage;

            if (
                item.type === "reprompt" ||
                item.type === "camera"
            ) {
                base64Provider = async () => item.data;
            } else if (item.type === "image") {
                base64Provider = () =>
                    getBase64FromImage(item.file);
            } else if (item.type === "pdf") {
                base64Provider = () =>
                    getBase64FromPdfPage(
                        item.doc,
                        item.page,
                        dpi,
                    );
                pageNumForNumbering = item.page;
            }

            await processPage(
                base64Provider,
                pageNumForNumbering,
                processingOptions,
                isManualRun,
            );
            processedCount++;
            updateProgress(processedCount, totalPagesToProcess);
        }
    } catch (error) {
        logMessage(`--- FATALER FEHLER: ${error.message} ---`);
    } finally {
        logMessage(
            stopRequested
                ? "--- Abgebrochen ---"
                : "--- Fertig ---",
        );
        isProcessing = false;
        toggleProcessingBtn.innerHTML = "▶ Start";
        toggleProcessingBtn.classList.remove("stop-mode");
        toggleProcessingBtn.disabled = false;

        if (allMarkdownResults.length > 0) {
            downloadMdBtn.disabled = false;
            downloadDocxBtn.disabled = false;
        }

        if (
            !stopRequested &&
            processedCount === totalPagesToProcess
        ) {
            progressFill.style.width = "100%";
            progressText.textContent = "Fertig!";

            if (!isManualRun && allMarkdownResults.length > 0) {
                if (shouldAutoSave) downloadDocx();
                if (shouldAutoRead) {
                    const ttsBtn =
                        document.getElementById("tts-btn");
                    if (
                        ttsBtn &&
                        !ttsBtn.classList.contains("speaking")
                    )
                        ttsBtn.click();
                }
            }
        }

        if (wasAutoProcessed) {
            cameraQueue = [];
            updateCameraFileStatus();
            shouldAutoSave = false;
            shouldAutoRead = false;
            wasAutoProcessed = false;
        }
    }
}

function updateProgress(processed, total) {
    if (total === 0) return;
    const progressFill = document.getElementById("progress-fill");
    const etaText = document.getElementById("eta-text");

    const percentage = Math.round((processed / total) * 100);
    progressFill.style.width = `${percentage}%`;
    const now = performance.now();
    const etaMs =
        ((now - totalStartTime) / processed) *
        (total - processed);
    etaText.textContent = `Verbleibend: ~${formatTime(etaMs)}`;
}

async function processPage(
    base64Provider,
    pageNum,
    options,
    isManualRun,
) {
    const promptInput = document.getElementById("prompt");
    const downloadMdBtn = document.getElementById("download-md-btn");
    const downloadDocxBtn = document.getElementById("download-docx-btn");

    logMessage(`Verarbeite Seite ${pageNum}...`);
    const startTime = performance.now();
    const base64Image = await base64Provider();
    // Update global last image for context
    lastProcessedImageBase64 = base64Image;

    // --- ToC Kontext hinzufügen ---
    let extraPrompt = "";
    if (globalToc && globalToc.length > 0) {
        const pageHeadings = globalToc.filter(h => h.seite === pageNum && !h.processed);
        if (pageHeadings.length > 0) {
            extraPrompt = "\n\nNOTE ON STRUCTURE (IF APPLICABLE):\n" +
                "If the following chapters/headings are PRINTED on this page, please format them using the specified Markdown hierarchy. " +
                "If one of these headings is NOT visible in the image, do NOT add it (do not hallucinate it). " +
                "Also ignore running headers that merely repeat the title, unless they are the actual heading of the page.:\n" +
                pageHeadings.map(h => `${"#".repeat(Math.max(1, h.ebene))} ${h.titel}`).join("\n");
        }
    }

    // --- LOG PIXEL COUNT & DIMENSIONS (NEW) ---
    await new Promise((resolve) => {
        const i = new Image();
        i.onload = () => {
            logMessage(
                `Bild-Dimensionen: ${i.width}x${i.height} (${i.width * i.height} Pixel)`,
            );
            resolve();
        };
        i.onerror = resolve; // Don't block if fails
        i.src = base64Image;
    });
    // ------------------------------------------

    const markdown = await sendToLLM(
        base64Image,
        options.retries,
        options.promptOverride ? options.promptOverride + extraPrompt : promptInput.value + extraPrompt,
    );
    const processingTime = performance.now() - startTime;

    let formattedMarkdown = markdown;

    // --- Automatische Überschriften-Reparatur ---
    if (!isManualRun && globalToc && globalToc.length > 0) {
        globalToc.forEach(h => {
            if (h.processed) return;

            const escapedTitle = h.titel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const headerPrefix = "#".repeat(Math.max(1, h.ebene));
            const correctHeader = `${headerPrefix} ${h.titel}`;

            const exactHeaderRegex = new RegExp(`(^|\\n)${headerPrefix}\\s*${escapedTitle}\\s*(\\n|$)`, 'gi');
            if (exactHeaderRegex.test(formattedMarkdown)) {
                h.processed = true;
                return;
            }

            if (h.seite === pageNum) {
                const boldRegex = new RegExp(`\\*\\*\\s*${escapedTitle}\\s*\\*\\*`, 'gi');
                if (boldRegex.test(formattedMarkdown)) {
                    formattedMarkdown = formattedMarkdown.replace(boldRegex, correctHeader);
                    h.processed = true;
                    logMessage(`Fix: Überschrift "${h.titel}" von Fett zu H${h.ebene} korrigiert.`);
                    return;
                }
            }

            if (h.seite === pageNum) {
                const plainLineRegex = new RegExp(`(^|\\n)(?!#)\\s*${escapedTitle}\\s*(\\n|$)`, 'gi');
                if (plainLineRegex.test(formattedMarkdown)) {
                    formattedMarkdown = formattedMarkdown.replace(plainLineRegex, `$1${correctHeader}$2`);
                    h.processed = true;
                    logMessage(`Fix: Text "${h.titel}" zu H${h.ebene} hochgestuft.`);
                }
            }
        });
    }

    if (!isManualRun && options.enableNumbering) {
        const prefix =
            pageNum >= options.startPdfPage
                ? `((${options.currentPageNumber}))\n\n`
                : `(( ))\n\n`;
        formattedMarkdown = prefix + markdown;
        if (pageNum >= options.startPdfPage)
            options.currentPageNumber++;
    }

    if (isManualRun) {
        if (allMarkdownResults.length > 0) {
            allMarkdownResults.push(
                `\n\n--- Manueller Nachtrag ---\n${formattedMarkdown}`,
            );
        } else {
            allMarkdownResults.push(formattedMarkdown);
        }
    } else {
        allMarkdownResults.push(formattedMarkdown);
    }

    if (!isManualRun) {
        updateImagePreview(base64Image);
    }

    updateTextPreview(formattedMarkdown);
    downloadMdBtn.disabled = false;
    downloadDocxBtn.disabled = false;
    logMessage(
        `Dauer: ${(processingTime / 1000).toFixed(1)} s.`,
    );
}

function updateImagePreview(base64Image) {
    const imagePreview = document.getElementById("image-preview");
    if (imagePreview) {
        imagePreview.src = base64Image;
        imagePreview.style.display = "block";
    }
}

function handleVisionChat() {
    const visionUserInput = document.getElementById("vision-user-input");
    const visionResponseArea = document.getElementById("vision-response-area");
    const visionSendBtn = document.getElementById("vision-send-btn");
    const visionMuteToggle = document.getElementById("vision-mute-toggle");
    const visionPromptInput = document.getElementById("vision-prompt");

    const userText = visionUserInput.value.trim();
    const systemText = visionPromptInput ? visionPromptInput.value.trim() : "";

    // Falls gar kein Text da ist (weder User noch System), dann Abbruch
    if (!userText && !systemText) return;
    if (!currentVisionBase64) return;

    // iOS Unlock
    unlockTTS();

    // UI Updates: Zeige nur die Nutzerfrage im Log, falls vorhanden
    const displayMsg = userText || "Analysiere Bild...";
    const oldContent = visionResponseArea.textContent;
    visionResponseArea.innerHTML =
        oldContent +
        `\n\nDu: ${displayMsg}\n\n<span class="vision-loading">KI: Denkt nach...</span>`;
    visionResponseArea.scrollTop =
        visionResponseArea.scrollHeight;

    visionUserInput.value = "";
    visionUserInput.disabled = true;
    visionSendBtn.disabled = true;

    // Kombinierten Prompt bauen
    let combinedPrompt = systemText;
    if (userText) {
        combinedPrompt = systemText
            ? `${systemText}\n\nBenutzer-Frage: ${userText}`
            : userText;
    }

    sendToLLM(currentVisionBase64, 0, combinedPrompt)
        .then(response => {
            visionResponseArea.innerHTML =
                oldContent + `\n\nDu: ${displayMsg}\n\nKI: ${response}`;
            visionResponseArea.scrollTop =
                visionResponseArea.scrollHeight;

            if (visionMuteToggle && !visionMuteToggle.checked) {
                speakText(response);
            }
        })
        .catch(e => {
            visionResponseArea.textContent += "\n[Fehler bei der Antwort]";
        })
        .finally(() => {
            visionUserInput.disabled = false;
            visionSendBtn.disabled = false;
            visionUserInput.focus();
        });
}

function parsePageRanges(input) {
    if (!input.trim()) return [];
    const ranges = new Set();
    input.split(",").forEach((part) => {
        if (part.includes("-")) {
            const [start, end] = part
                .split("-")
                .map((num) => parseInt(num.trim(), 10));
            for (let i = start; i <= end; i++) ranges.add(i);
        } else {
            ranges.add(parseInt(part.trim(), 10));
        }
    });
    return Array.from(ranges)
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
}
