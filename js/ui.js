// --- Theme / Design Logic ---
function initTheme() {
    const themeToggleBtn = document.getElementById("theme-toggle");
    const prefersLight = window.matchMedia(
        "(prefers-color-scheme: light)",
    ).matches;
    if (prefersLight) {
        document.documentElement.classList.add("light-theme");
        updateThemeIcon(true);
    } else {
        document.documentElement.classList.remove("light-theme");
        updateThemeIcon(false);
    }

    window
        .matchMedia("(prefers-color-scheme: light)")
        .addEventListener("change", (event) => {
            const newColorScheme = event.matches ? "light" : "dark";
            if (newColorScheme === "light") {
                document.documentElement.classList.add(
                    "light-theme",
                );
                updateThemeIcon(true);
            } else {
                document.documentElement.classList.remove(
                    "light-theme",
                );
                updateThemeIcon(false);
            }
        });

    themeToggleBtn.addEventListener("click", toggleTheme);
}

function toggleTheme() {
    const isLight =
        document.documentElement.classList.toggle("light-theme");
    updateThemeIcon(isLight);
    // Trigger save when theme changes
    saveToLocalStorage();
}

function updateThemeIcon(isLight) {
    const themeToggleBtn = document.getElementById("theme-toggle");
    // If light -> Show moon to switch to dark
    // If dark -> Show sun to switch to light
    themeToggleBtn.innerHTML = isLight
        ? '<span aria-hidden="true">🌙</span>'
        : '<span aria-hidden="true">☀️</span>';
    themeToggleBtn.setAttribute(
        "aria-label",
        isLight
            ? "Zu dunklem Design wechseln"
            : "Zu hellem Design wechseln",
    );
}

// --- TEXT TO SPEECH (TTS) LOGIC ---
function initTTS() {
    const ttsBtn = document.getElementById("tts-btn");
    const rawPreview = document.getElementById("raw-preview");

    if (!("speechSynthesis" in window)) {
        ttsBtn.style.display = "none";
        return;
    }
    let voices = [];
    function loadVoices() {
        voices = window.speechSynthesis.getVoices();
    }
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    function detectLanguage(text) {
        if (!text) return "de-DE";
        const t = text.toLowerCase();
        const deWords = [
            "der",
            "die",
            "das",
            "und",
            "ist",
            "nicht",
            "mit",
            "den",
            "von",
        ];
        const enWords = [
            "the",
            "and",
            "is",
            "not",
            "with",
            "for",
            "you",
            "that",
            "this",
        ];
        let deCount = 0,
            enCount = 0;
        const words = t.split(/\s+/).slice(0, 100);
        words.forEach((word) => {
            if (deWords.includes(word)) deCount++;
            if (enWords.includes(word)) enCount++;
        });
        if (enCount > deCount) return "en-US";
        return "de-DE";
    }

    function stopSpeaking() {
        window.speechSynthesis.cancel();
        ttsBtn.textContent = "🔊 Vorlesen";
        ttsBtn.classList.remove("speaking");
    }

    function toggleSpeech() {
        if (window.speechSynthesis.speaking) {
            stopSpeaking();
        } else {
            const text = rawPreview.value;
            if (!text.trim()) return;
            const utterance = new SpeechSynthesisUtterance(text);
            const langCode = detectLanguage(text);
            const matchingVoice = voices.find((v) =>
                v.lang.startsWith(langCode),
            );
            if (matchingVoice) utterance.voice = matchingVoice;
            utterance.onend = () => stopSpeaking();
            utterance.onerror = (e) => {
                console.error("TTS Fehler", e);
                stopSpeaking();
            };
            window.speechSynthesis.speak(utterance);
            ttsBtn.textContent = "⏹ Stoppen";
            ttsBtn.classList.add("speaking");
        }
    }
    ttsBtn.addEventListener("click", toggleSpeech);
}

// --- MODAL & PASSWORD ---
function requestPassword(message) {
    const passwordModal = document.getElementById("password-modal");
    const modalInput = document.getElementById("modal-input");
    const modalMessage = document.getElementById("modal-message");
    const modalOkBtn = document.getElementById("modal-ok");
    const modalCancelBtn = document.getElementById("modal-cancel");

    return new Promise((resolve) => {
        modalMessage.textContent = message;
        modalInput.value = "";
        passwordModal.style.display = "flex";
        modalInput.focus();
        const handleOk = () => {
            cleanup();
            resolve(modalInput.value);
        };
        const handleCancel = () => {
            cleanup();
            resolve(null);
        };
        const handleKeydown = (e) => {
            if (e.key === "Enter") handleOk();
            if (e.key === "Escape") handleCancel();
        };
        const cleanup = () => {
            modalOkBtn.removeEventListener("click", handleOk);
            modalCancelBtn.removeEventListener(
                "click",
                handleCancel,
            );
            modalInput.removeEventListener(
                "keydown",
                handleKeydown,
            );
            passwordModal.style.display = "none";
        };
        modalOkBtn.addEventListener("click", handleOk);
        modalCancelBtn.addEventListener("click", handleCancel);
        modalInput.addEventListener("keydown", handleKeydown);
    });
}

// --- EINSTELLUNGEN ---
let quickProfiles = { Standard: {} };
let currentProfileName = "Standard";
const INTERNAL_STORAGE_KEY = "DokumentZuEBuch_Internal_AutoSave_SecureKey_v1";
const LS_KEY_NAME = "ocr_settings_auto_enc";

function gatherSettings() {
    const settings = {};
    settingsIds.forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === "checkbox")
                settings[id] = element.checked;
            else settings[id] = element.value;
        }
    });
    return settings;
}

function applySettings(settings) {
    const pipelineSelect = document.getElementById("pipeline-select");

    if (settings["pipeline-select"]) {
        pipelineSelect.value = settings["pipeline-select"];
        updateApiSettings();
    }
    for (const [id, value] of Object.entries(settings)) {
        if (id.startsWith("_") || id === "pipeline-select")
            continue;
        const element = document.getElementById(id);
        if (element) {
            if (element.type === "checkbox") {
                element.checked = value;
                element.setAttribute("aria-checked", value);
            } else if (id === "model-name") {
                let optionExists = false;
                for (let i = 0; i < element.options.length; i++) {
                    if (element.options[i].value === value) {
                        optionExists = true;
                        break;
                    }
                }
                if (!optionExists && value !== "") {
                    const newOpt = new Option(value, value);
                    element.add(newOpt, 0);
                }
                element.value = value;
            } else {
                element.value = value;
            }
            element.dispatchEvent(new Event("change"));
        }
    }
}

function updateProfileSelect() {
    const quickSettingsSelect = document.getElementById("quick-settings-select");
    quickSettingsSelect.innerHTML = "";
    Object.keys(quickProfiles).forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        quickSettingsSelect.appendChild(option);
    });
    quickSettingsSelect.value = currentProfileName;
}

async function saveToLocalStorage() {
    const autoSaveLocalCheckbox = document.getElementById("auto-save-local");
    if (!autoSaveLocalCheckbox.checked) return;
    if (quickProfiles[currentProfileName])
        quickProfiles[currentProfileName] = gatherSettings();

    const currentTheme =
        document.documentElement.classList.contains("light-theme")
            ? "light"
            : "dark";

    const dataToSave = {
        ...gatherSettings(),
        _quickProfiles: quickProfiles,
        _activeProfile: currentProfileName,
        _theme: currentTheme,
    };
    try {
        const encryptedObj = await encryptData(
            JSON.stringify(dataToSave),
            INTERNAL_STORAGE_KEY,
        );
        localStorage.setItem(
            LS_KEY_NAME,
            JSON.stringify(encryptedObj),
        );
    } catch (e) {
        console.error("Auto-Save Error:", e);
    }
}

async function loadFromLocalStorage() {
    const encryptedDataStr = localStorage.getItem(LS_KEY_NAME);
    const autoSaveLocalCheckbox = document.getElementById("auto-save-local");
    quickProfiles["Standard"] = gatherSettings();

    try {
        if (encryptedDataStr) {
            const encryptedObj = JSON.parse(encryptedDataStr);
            const decryptedString = await decryptData(
                encryptedObj,
                INTERNAL_STORAGE_KEY,
            );
            const settings = JSON.parse(decryptedString);
            if (settings._quickProfiles)
                quickProfiles = settings._quickProfiles;
            if (
                settings._activeProfile &&
                quickProfiles[settings._activeProfile]
            )
                currentProfileName = settings._activeProfile;

            if (settings._theme) {
                if (settings._theme === "light") {
                    document.documentElement.classList.add(
                        "light-theme",
                    );
                    updateThemeIcon(true);
                } else {
                    document.documentElement.classList.remove(
                        "light-theme",
                    );
                    updateThemeIcon(false);
                }
            }

            updateProfileSelect();
            applySettings(settings);
            autoSaveLocalCheckbox.checked = true;
            autoSaveLocalCheckbox.setAttribute(
                "aria-checked",
                true,
            );
            logMessage(
                "Einstellungen und Profile automatisch geladen.",
            );
        } else {
            updateProfileSelect();
        }
    } catch (e) {
        console.error("Auto-Load Error:", e);
        updateProfileSelect();
    }

    checkModelAndFocus();
}

function checkModelAndFocus() {
    const modelNameSelect = document.getElementById("model-name");
    const mainSettings = document.getElementById("main-settings");
    const apiSettingsDetails = document.getElementById("api-settings-details");
    const apiKeyInput = document.getElementById("api-key");

    if (!modelNameSelect.value || modelNameSelect.value === "") {
        mainSettings.open = true;
        apiSettingsDetails.open = true;
        apiKeyInput.focus();
    }
}

async function saveSettingsToFile() {
    quickProfiles[currentProfileName] = gatherSettings();
    const dataToSave = {
        ...gatherSettings(),
        _quickProfiles: quickProfiles,
        _activeProfile: currentProfileName,
    };
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const password = await requestPassword(
        "Passwort für Verschlüsselung eingeben (leer lassen für unverschlüsselt):",
    );
    if (password === null) return;
    let finalOutput = jsonString;
    let isEncrypted = false;
    if (password.trim() !== "") {
        try {
            const encryptedObj = await encryptData(
                jsonString,
                password,
            );
            finalOutput = JSON.stringify(encryptedObj, null, 2);
            isEncrypted = true;
        } catch (e) {
            return alert("Verschlüsselungsfehler: " + e.message);
        }
    }
    let defaultName = isEncrypted
        ? "ocr_einstellungen.enc.json"
        : "ocr_einstellungen.json";
    const blob = new Blob([finalOutput], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logMessage(`Einstellungen gespeichert (${defaultName}).`);
}

function loadSettingsFromFile(event) {
    const configLoader = document.getElementById("config-loader");
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            let parsedJson = JSON.parse(e.target.result);
            let settings = parsedJson;
            if (parsedJson.isEncrypted) {
                const password = await requestPassword(
                    "Datei ist verschlüsselt. Passwort:",
                );
                if (!password) return;
                const decryptedString = await decryptData(
                    parsedJson,
                    password,
                );
                settings = JSON.parse(decryptedString);
            }
            if (settings._quickProfiles)
                quickProfiles = settings._quickProfiles;
            if (settings._activeProfile)
                currentProfileName = settings._activeProfile;
            updateProfileSelect();
            applySettings(settings);
            logMessage("Einstellungen geladen.");
            saveToLocalStorage();
        } catch (err) {
            alert("Fehler: " + err.message);
        }
        configLoader.value = "";
    };
    reader.readAsText(file);
}

function initSettingsListeners() {
    const autoSaveLocalCheckbox = document.getElementById("auto-save-local");
    const saveSettingsBtn = document.getElementById("save-settings-btn");
    const loadSettingsBtn = document.getElementById("load-settings-btn");
    const configLoader = document.getElementById("config-loader");
    const quickSettingsSelect = document.getElementById("quick-settings-select");
    const addProfileBtn = document.getElementById("add-profile-btn");
    const delProfileBtn = document.getElementById("del-profile-btn");
    const pipelineSelect = document.getElementById("pipeline-select");
    const fetchModelsBtn = document.getElementById("fetch-models-btn");
    const modelNameSelect = document.getElementById("model-name");
    const customModelNameInput = document.getElementById("custom-model-name");
    const enableNumberingInput = document.getElementById("enable-numbering");
    const numberingOptions = document.getElementById("numbering-options");

    autoSaveLocalCheckbox.addEventListener("change", () => {
        if (autoSaveLocalCheckbox.checked) saveToLocalStorage();
        else localStorage.removeItem(LS_KEY_NAME);
    });
    settingsIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el)
            el.addEventListener("change", () => {
                if (quickProfiles[currentProfileName])
                    quickProfiles[currentProfileName] =
                        gatherSettings();
                saveToLocalStorage();
            });
    });

    saveSettingsBtn.addEventListener("click", saveSettingsToFile);
    loadSettingsBtn.addEventListener("click", () =>
        configLoader.click(),
    );
    configLoader.addEventListener("change", loadSettingsFromFile);

    quickSettingsSelect.addEventListener("change", () => {
        const selectedName = quickSettingsSelect.value;
        if (quickProfiles[selectedName]) {
            currentProfileName = selectedName;
            applySettings(quickProfiles[selectedName]);
            logMessage(`Profil "${selectedName}" geladen.`);
        }
    });

    addProfileBtn.addEventListener("click", () => {
        const name = prompt("Name für das neue Profil:");
        if (name && name.trim() !== "") {
            quickProfiles[name.trim()] = gatherSettings();
            currentProfileName = name.trim();
            updateProfileSelect();
            logMessage(`Profil "${currentProfileName}" erstellt.`);
            saveToLocalStorage();
        }
    });

    delProfileBtn.addEventListener("click", () => {
        const selectedName = quickSettingsSelect.value;
        if (selectedName === "Standard")
            return alert("Standard kann nicht gelöscht werden.");
        if (confirm(`Profil "${selectedName}" löschen?`)) {
            delete quickProfiles[selectedName];
            currentProfileName = "Standard";
            updateProfileSelect();
            applySettings(quickProfiles["Standard"]);
            logMessage(`Profil "${selectedName}" gelöscht.`);
            saveToLocalStorage();
        }
    });

    // API settings listeners
    pipelineSelect.addEventListener("change", updateApiSettings);
    fetchModelsBtn.addEventListener("click", fetchModels);
    modelNameSelect.addEventListener("change", () => {
        customModelNameInput.style.display =
            modelNameSelect.value === "" ? "block" : "none";
    });

    enableNumberingInput.addEventListener("change", () => {
        numberingOptions.style.display = enableNumberingInput.checked
            ? "flex"
            : "none";
        enableNumberingInput.setAttribute(
            "aria-checked",
            enableNumberingInput.checked,
        );
    });
}


// --- NAVIGATION ---
function jumpToPage() {
    const imgNavInput = document.getElementById("img-nav-input");

    // Sicherheitscheck, falls Element nicht geladen
    if (!imgNavInput) return;

    let val = parseInt(imgNavInput.value);

    // Falls Eingabe ungültig ist (leer oder Text), auf aktuelle Seite zurücksetzen
    if (isNaN(val)) {
        val = currentPreviewIndex + 1;
    }

    // Grenzen prüfen (nicht kleiner als 1, nicht größer als Anzahl Bilder)
    if (val < 1) val = 1;
    if (previewItems.length > 0 && val > previewItems.length)
        val = previewItems.length;

    // Nur neu laden, wenn sich die Seite wirklich geändert hat
    if (val - 1 !== currentPreviewIndex) {
        renderPreviewItem(val - 1);
    } else {
        // Falls wir auf der gleichen Seite bleiben, nur den Wert im Feld korrigieren
        imgNavInput.value = val;
    }
}

function initNavigationListeners() {
    const imgNavInput = document.getElementById("img-nav-input");
    const imgPrevBtn = document.getElementById("img-prev-btn");
    const imgNextBtn = document.getElementById("img-next-btn");

    imgPrevBtn.addEventListener("click", () => {
        if (currentPreviewIndex > 0)
            renderPreviewItem(currentPreviewIndex - 1);
    });
    imgNextBtn.addEventListener("click", () => {
        if (currentPreviewIndex < previewItems.length - 1)
            renderPreviewItem(currentPreviewIndex + 1);
    });

    if (imgNavInput) {
        imgNavInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault(); // Verhindert Standardverhalten
                jumpToPage(); // Seite wechseln
                imgNavInput.blur(); // Fokus vom Feld nehmen (löst 'blur' aus)
            }
        });

        // Beim Verlassen des Feldes (Klick woanders hin oder Tab)
        imgNavInput.addEventListener("blur", () => {
            // Kurze Verzögerung, um Konflikte mit Enter zu vermeiden
            setTimeout(jumpToPage, 50);
        });
    }
}
