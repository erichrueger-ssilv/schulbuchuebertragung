/**
 * Updates the API settings fields based on the selected pipeline.
 */
function updateApiSettings() {
    const selectedPipeline = document.getElementById("pipeline-select").value;
    const config = pipelineConfigs[selectedPipeline];
    document.getElementById("base-url").value = config.baseUrl;
    document.getElementById("model-name").innerHTML =
        '<option value="" disabled selected>kein Modell gewählt</option>';
    document.getElementById("custom-model-name").style.display = "none";
}

/**
 * Fetches available models from the configured API endpoint.
 */
async function fetchModels() {
    const pipelineSelect = document.getElementById("pipeline-select");
    const baseUrlInput = document.getElementById("base-url");
    const apiKeyInput = document.getElementById("api-key");
    const fetchModelsBtn = document.getElementById("fetch-models-btn");
    const modelNameSelect = document.getElementById("model-name");

    const selectedPipeline = pipelineSelect.value;
    const baseUrl = baseUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    let modelsUrl;
    // We check for both Ollama variants
    if (
        selectedPipeline === "ollama" ||
        selectedPipeline === "ollama-openwebui"
    ) {
        modelsUrl = baseUrl.replace(
            /\/api\/generate\/?$/,
            "/api/tags",
        );
    } else {
        // Covers 'openai' and 'openai-openwebui'
        modelsUrl = baseUrl.replace(
            /\/chat\/completions\/?$/,
            "/models",
        );
    }
    logMessage(`Rufe Modelle von ${modelsUrl} ab...`);
    fetchModelsBtn.disabled = true;
    fetchModelsBtn.textContent = "...";

    try {
        const headers = { "Content-Type": "application/json" };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

        const response = await fetch(modelsUrl, {
            method: "GET",
            headers: headers,
        });
        if (!response.ok)
            throw new Error(`Serverantwort: ${response.status}`);
        const data = await response.json();
        let modelNames = [];

        // We check for both Ollama variants
        if (
            (selectedPipeline === "ollama" ||
                selectedPipeline === "ollama-openwebui") &&
            data.models
        ) {
            modelNames = data.models
                .map((model) => model.name)
                .sort();
        } else if (
            (selectedPipeline === "openai" ||
                selectedPipeline === "openai-openwebui") &&
            data.data
        ) {
            modelNames = data.data.map((model) => model.id).sort();
        } else {
            throw new Error(
                "Unerwartetes Antwortformat vom Server.",
            );
        }
        populateModelSelect(modelNames);
        logMessage(
            `${modelNames.length} Modell(e) erfolgreich geladen.`,
        );
    } catch (error) {
        logMessage(
            `Fehler beim Abrufen der Modelle: ${error.message}`,
        );
        modelNameSelect.innerHTML =
            '<option value="" disabled selected>Abruf fehlgeschlagen</option>';
        populateModelSelect([]);
    } finally {
        fetchModelsBtn.disabled = false;
        fetchModelsBtn.textContent = "Modelle abrufen";
    }
}

/**
 * Populates the model selection dropdown.
 * @param {string[]} models - List of model names.
 */
function populateModelSelect(models) {
    const modelNameSelect = document.getElementById("model-name");
    const pipelineSelect = document.getElementById("pipeline-select");

    modelNameSelect.innerHTML = "";
    const defaultModel = "ministral-8b-bilderkennung";

    if (models.length > 0) {
        models.forEach((modelName) => {
            const option = document.createElement("option");
            option.value = modelName;
            option.textContent = modelName;
            if (modelName === defaultModel) {
                option.selected = true;
            }
            modelNameSelect.appendChild(option);
        });
    } else {
        const option = document.createElement("option");
        option.textContent = "Keine Modelle gefunden";
        option.disabled = true;
        modelNameSelect.appendChild(option);
    }
    const customOption = document.createElement("option");
    customOption.value = "";
    // Cosmetic update
    const pipelineName = pipelineSelect.value.includes("ollama")
        ? "Ollama"
        : "OpenAI";
    customOption.textContent = `Benutzerdefiniert ${pipelineName}...`;
    modelNameSelect.appendChild(customOption);
    modelNameSelect.dispatchEvent(new Event("change"));
}

/**
 * Sends an image and prompt to the LLM.
 * @param {string} base64Image - The image as Base64.
 * @param {number} retries - Number of retries.
 * @param {string} promptOverride - Optional prompt override.
 * @returns {Promise<string>} The LLM response.
 */
async function sendToLLM(base64Image, retries, promptOverride) {
    const pipelineSelect = document.getElementById("pipeline-select");
    const baseUrlInput = document.getElementById("base-url");
    const modelNameSelect = document.getElementById("model-name");
    const customModelNameInput = document.getElementById("custom-model-name");
    const apiKeyInput = document.getElementById("api-key");
    const promptInput = document.getElementById("prompt");
    const temperatureInput = document.getElementById("temperature");
    const repeatPenaltyInput = document.getElementById("repeat-penalty");
    const topPInput = document.getElementById("top-p");
    const topKInput = document.getElementById("top-k");
    const delayInput = document.getElementById("delay");

    const selectedPipeline = pipelineSelect.value;
    const baseUrl = baseUrlInput.value;
    const model =
        modelNameSelect.value === ""
            ? customModelNameInput.value
            : modelNameSelect.value;
    const apiKey = apiKeyInput.value;
    const prompt = promptOverride || promptInput.value;
    const temperature = parseFloat(temperatureInput.value);
    const repeatPenalty = parseFloat(repeatPenaltyInput.value);
    const topP = parseFloat(topPInput.value);
    const topK = parseInt(topKInput.value, 10);
    const delay = parseInt(delayInput.value, 10);

    if (!model) return "[FEHLER: KEIN MODELL]";

    let payload;
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    if (
        selectedPipeline === "ollama" ||
        selectedPipeline === "ollama-openwebui"
    ) {
        payload = {
            model: model,
            prompt: prompt,
            images: [base64Image.split(",")[1]],
            stream: false,
            options: {
                temperature: temperature,
                repeat_penalty: repeatPenalty,
                top_p: topP,
                top_k: topK,
            },
        };
    } else {
        // Covers 'openai' and 'openai-openwebui'
        payload = {
            model: model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: { url: base64Image },
                        },
                    ],
                },
            ],
            temperature: temperature,
            presence_penalty: repeatPenalty,
            top_p: topP,
        };
        // top_k is not standard in OpenAI API, but some providers might support it.
        if (topK > 0) {
            payload.top_k = topK;
        }
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            await new Promise((resolve) =>
                setTimeout(resolve, delay),
            );
            const response = await fetch(baseUrl, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload),
            });
            if (!response.ok)
                throw new Error(`API ${response.status}`);
            const data = await response.json();
            if (data.response) return data.response;
            if (data.choices && data.choices[0].message.content)
                return data.choices[0].message.content;
            throw new Error("Format?");
        } catch (error) {
            if (attempt >= retries)
                return `[FEHLER: ${error.message}]`;
        }
    }
}

/**
 * Analyzes pages to build the Table of Contents (ToC).
 */
async function analyzeToc() {
    const tocInput = document.getElementById("toc-pages").value;
    const tocStatus = document.getElementById("toc-status");
    const fileInput = document.getElementById("file-input");
    const dpiInput = document.getElementById("dpi");
    const tocOffsetInput = document.getElementById("toc-offset");
    const btn = document.getElementById("analyze-toc-btn");


    if (!tocInput) {
        alert("Bitte ToC-Seiten angeben.");
        return;
    }

    if (fileInput.files.length === 0) {
        alert("Bitte zuerst ein PDF laden.");
        return;
    }

    const pages = parsePageRanges(tocInput);
    const dpi = parseInt(dpiInput.value, 10) || 150;
    const tocOffset = parseInt(tocOffsetInput.value) || 0;

    btn.disabled = true;
    btn.textContent = "Analysiere...";
    tocStatus.textContent = "Lade Seiten...";
    globalToc = [];

    try {
        const file = fileInput.files[0];
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (const pageNum of pages) {
            if (pageNum < 1 || pageNum > pdfDoc.numPages) continue;
            tocStatus.textContent = `VLM analysiert Seite ${pageNum}...`;

            const base64 = await getBase64FromPdfPage(pdfDoc, pageNum, dpi);
            const prompt = "Extrahiere das Inhaltsverzeichnis dieser Seite. Gib das Ergebnis ausschließlich als JSON-Array zurück. " +
                "Jedes Element muss 'titel' (String), 'ebene' (Zahl, 1 für h1, 2 für h2 etc.) und 'buchseite' (Zahl der gedruckten Seitenzahl im Buch) enthalten. " +
                "Beispiel: [{\"titel\": \"Einleitung\", \"ebene\": 1, \"buchseite\": 10}]. " +
                "Antworte NUR mit dem JSON-Array, kein Markdown, kein Text drumherum.";

            const result = await sendToLLM(base64, 1, prompt);

            // Robuste JSON-Extraktion für jede Seite einzeln
            const jsonMatch = result.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
                try {
                    const pageToc = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(pageToc)) {
                        // Offset anwenden: Buchseite -> PDF Seite
                        const shiftedToc = pageToc.map(item => ({
                            ...item,
                            seite: (parseInt(item.buchseite) || 0) + tocOffset
                        }));
                        globalToc = globalToc.concat(shiftedToc);
                    }
                } catch (parseErr) {
                    logMessage(`Warnung: Konnte JSON von Seite ${pageNum} nicht parsen.`);
                }
            }
        }

        if (globalToc.length > 0) {
            logMessage(`ToC erfolgreich analysiert: ${globalToc.length} Einträge gefunden.`);
            tocStatus.textContent = `${globalToc.length} Einträge geladen.`;
        } else {
            throw new Error("Konnte keine gültigen Einträge im Inhaltsverzeichnis finden.");
        }
    } catch (e) {
        logMessage(`ToC-Analyse Fehler: ${e.message}`);
        tocStatus.textContent = "Analyse fehlgeschlagen.";
    } finally {
        btn.disabled = false;
        btn.textContent = "ToC analysieren";
    }
}
