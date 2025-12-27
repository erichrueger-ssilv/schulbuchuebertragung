let cameraStreamObj = null;
let cameraListLoaded = false;

/**
 * Populates the camera selection dropdown.
 */
async function populateCameraList() {
    if (cameraListLoaded) return;
    const cameraSelect = document.getElementById("camera-select");
    try {
        const tempStream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
            });
        const devices =
            await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
            (device) => device.kind === "videoinput",
        );
        tempStream.getTracks().forEach((track) => track.stop());
        cameraSelect.innerHTML = "";
        if (videoDevices.length > 0) {
            videoDevices.forEach((device, index) => {
                const option = document.createElement("option");
                option.value = device.deviceId;
                option.textContent =
                    device.label || `Kamera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            const savedId = localStorage.getItem("last_camera_id");
            if (
                savedId &&
                videoDevices.some((d) => d.deviceId === savedId)
            ) {
                cameraSelect.value = savedId;
            }
        } else {
            const option = document.createElement("option");
            option.textContent = "Keine Kameras gefunden";
            cameraSelect.appendChild(option);
        }
        cameraListLoaded = true;
    } catch (err) {
        console.error(
            "Kamera-Zugriff für Liste fehlgeschlagen:",
            err,
        );
        cameraSelect.innerHTML =
            '<option value="" disabled>Zugriff erforderlich für Liste</option>';
    }
}

/**
 * Starts the camera stream.
 */
async function startCamera() {
    const cameraModal = document.getElementById("camera-modal");
    const cameraAutoVisionMode = document.getElementById("camera-auto-vision-mode");
    const visionModeToggle = document.getElementById("vision-mode-toggle");
    const cameraBatchCounter = document.getElementById("camera-batch-counter");
    const cameraStatus = document.getElementById("camera-status");
    const cameraSelect = document.getElementById("camera-select");
    const cameraStream = document.getElementById("camera-stream");

    cameraModal.style.display = "flex";
    // Prüfen, ob Auto-Vision aktiv ist
    if (cameraAutoVisionMode && cameraAutoVisionMode.checked) {
        visionModeToggle.checked = true;
    } else {
        // Optional: Zurücksetzen auf Standard (OCR), wenn Auto-Vision aus ist
        visionModeToggle.checked = false;
    }
    // WICHTIG: Change-Event auslösen, damit sich die UI (Chat-Fenster etc.) aktualisiert
    visionModeToggle.dispatchEvent(new Event("change"));
    cameraBatchCounter.style.display = "block";
    cameraBatchCounter.textContent = `Stapel: ${cameraQueue.length}`;
    cameraStatus.textContent = "Kamera wird gestartet...";

    const deviceId = cameraSelect.value;
    const constraints = {
        video:
            deviceId && deviceId.length > 0
                ? { deviceId: { exact: deviceId } }
                : { facingMode: "environment" },
    };

    try {
        if (cameraStreamObj) stopCameraStreamOnly();
        cameraStreamObj =
            await navigator.mediaDevices.getUserMedia(constraints);
        cameraStream.srcObject = cameraStreamObj;
        cameraStatus.textContent = "";

        if (!cameraListLoaded) {
            const devices =
                await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(
                (device) => device.kind === "videoinput",
            );
            if (
                videoDevices.length > 0 &&
                videoDevices[0].label !== ""
            ) {
                cameraSelect.innerHTML = "";
                videoDevices.forEach((device, index) => {
                    const option = document.createElement("option");
                    option.value = device.deviceId;
                    option.textContent =
                        device.label || `Kamera ${index + 1}`;
                    cameraSelect.appendChild(option);
                });
                const track = cameraStreamObj.getVideoTracks()[0];
                const currentId = track.getSettings().deviceId;
                if (currentId) cameraSelect.value = currentId;
                cameraListLoaded = true;
            }
        }
    } catch (err) {
        console.error(err);
        cameraStatus.textContent =
            "Fehler: Kamera konnte nicht gestartet werden. " +
            err.message;
    }
}

/**
 * Stops only the media stream track.
 */
function stopCameraStreamOnly() {
    if (cameraStreamObj) {
        cameraStreamObj
            .getTracks()
            .forEach((track) => track.stop());
        cameraStreamObj = null;
    }
}

/**
 * Stops the camera and closes the modal.
 */
function stopCameraModal() {
    const cameraModal = document.getElementById("camera-modal");
    const manualPromptInput = document.getElementById("manual-prompt");
    const cameraAutoProcess = document.getElementById("camera-auto-process");
    const cameraAutoSave = document.getElementById("camera-auto-save");
    const cameraAutoRead = document.getElementById("camera-auto-read");
    const toggleProcessingBtn = document.getElementById("toggle-processing-btn");

    stopCameraStreamOnly();
    cameraModal.style.display = "none";
    updateCameraFileStatus();

    // Load the new images into the preview system
    if (cameraQueue.length > 0) {
        loadPreviewContent();
    }

    // Focus Manual Prompt
    manualPromptInput.focus();

    if (cameraQueue.length > 0 && cameraAutoProcess.checked) {
        logMessage("Automatische Verarbeitung gestartet...");
        shouldAutoSave = cameraAutoSave.checked;
        shouldAutoRead = cameraAutoRead.checked;
        wasAutoProcessed = true;
        setTimeout(() => {
            if (!isProcessing) toggleProcessingBtn.click();
        }, 500);
    }
}

function initCameraListeners() {
    const cameraSelect = document.getElementById("camera-select");
    const cameraBtn = document.getElementById("camera-btn");
    const cameraCloseBtn = document.getElementById("camera-close");
    const cameraResFull = document.getElementById("camera-res-full");
    const cameraPixelGroup = document.getElementById("camera-pixel-group");
    const visionModeToggle = document.getElementById("vision-mode-toggle");
    const visionUiContainer = document.getElementById("vision-ui-container");
    const cameraBatchCounter = document.getElementById("camera-batch-counter");
    const cameraSnapBtn = document.getElementById("camera-snap");
    const visionResponseArea = document.getElementById("vision-response-area");
    const visionMuteToggle = document.getElementById("vision-mute-toggle");
    const clearCameraBtn = document.getElementById("clear-camera-btn");
    const imagePreview = document.getElementById("image-preview");
    const imgNavControls = document.getElementById("img-nav-controls");
    const visionUserInput = document.getElementById("vision-user-input");
    const visionSendBtn = document.getElementById("vision-send-btn");

    cameraSelect.addEventListener("mousedown", populateCameraList);
    cameraSelect.addEventListener("change", () => {
        localStorage.setItem("last_camera_id", cameraSelect.value);
    });

    cameraBtn.addEventListener("click", () => {
        startCamera();
    });

    cameraCloseBtn.addEventListener("click", stopCameraModal);

    cameraResFull.addEventListener("change", () => {
        cameraPixelGroup.style.display = cameraResFull.checked
            ? "none"
            : "flex";
        cameraResFull.setAttribute(
            "aria-checked",
            cameraResFull.checked,
        );
    });

    // Toggle Event Listener
    visionModeToggle.addEventListener("change", () => {
        const isVision = visionModeToggle.checked;
        visionUiContainer.style.display = isVision ? "flex" : "none";
        cameraBatchCounter.style.display = isVision ? "none" : "block";

        // Button Text anpassen
        cameraSnapBtn.textContent = isVision
            ? "Anschauen & Fragen"
            : "Foto machen";

        if (isVision) {
            visionResponseArea.textContent = "Bereit. Mach ein Foto, um zu starten.";
            // Scroll Vision UI into view if needed
            visionUiContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    });

    // Sofort aufhören zu sprechen, wenn "Stumm" aktiviert wird
    visionMuteToggle.addEventListener("change", () => {
        if (visionMuteToggle.checked) {
            window.speechSynthesis.cancel();
        }
    });

    // Capture Foto Event
    cameraSnapBtn.addEventListener("click", async () => {
        const cameraStream = document.getElementById("camera-stream");
        const cameraMaxPixels = document.getElementById("camera-max-pixels");
        const cameraResFull = document.getElementById("camera-res-full");
        const visionModeToggle = document.getElementById("vision-mode-toggle");
        const cameraBatchCounter = document.getElementById("camera-batch-counter");
        const cameraStatus = document.getElementById("camera-status");

        if (!cameraStreamObj) return;

        cameraStatus.textContent = "Verarbeite Bild...";
        const canvas = document.createElement("canvas");
        let w = cameraStream.videoWidth;
        let h = cameraStream.videoHeight;

        if (!cameraResFull.checked) {
            const max = parseInt(cameraMaxPixels.value, 10) || 1920;
            if (w > h && w > max) {
                h = Math.round((h * max) / w);
                w = max;
            } else if (h > max) {
                w = Math.round((w * max) / h);
                h = max;
            }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(cameraStream, 0, 0, w, h);

        const base64 = canvas.toDataURL("image/jpeg", 0.9);
        cameraStatus.textContent = "";

        if (visionModeToggle.checked) {
            // VISION MODE
            currentVisionBase64 = base64;
            handleVisionChat();
        } else {
            // NORMAL BATCH MODE
            cameraQueue.push(base64);
            cameraBatchCounter.textContent = `Stapel: ${cameraQueue.length}`;
            logMessage(`Foto aufgenommen (${w}x${h}). Stapel: ${cameraQueue.length}`);

            // Visual Feedback
            cameraStatus.textContent = "Aufgenommen!";
            setTimeout(() => { if (cameraStatus.textContent === "Aufgenommen!") cameraStatus.textContent = ""; }, 1000);
        }
    });

    clearCameraBtn.addEventListener("click", () => {
        cameraQueue = [];
        previewItems = []; // Clear preview
        imagePreview.src = "";
        imagePreview.style.display = "none";
        imgNavControls.style.display = "none";
        updateCameraFileStatus();
        logMessage("Foto-Stapel verworfen.");
    });
}
