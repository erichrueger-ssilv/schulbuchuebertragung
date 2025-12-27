// --- Pipeline Configs ---
const pipelineConfigs = {
    "openai-openwebui": {
        baseUrl:
            "https://openwebui.sbbz-ilvesheim.de/api/chat/completions",
    },

    "ollama-openwebui": {
        baseUrl:
            "https://openwebui.sbbz-ilvesheim.de/ollama/api/generate",
    },

    ollama: {
        baseUrl: "http://localhost:11434/api/generate",
    },

    openai: {
        baseUrl: "http://localhost:1234/v1/chat/completions",
    },
};

// IDs of all setting elements to save/load
const settingsIds = [
    "pipeline-select",
    "base-url",
    "model-name",
    "custom-model-name",
    "api-key",
    "temperature",
    "repeat-penalty",
    "top-p",
    "top-k",
    "prompt",
    "dpi",
    "page-range",
    "enable-numbering",
    "start-pdf-page",
    "start-page-number",
    "delay",
    "retries",
    "docx-opt-latex",
    "docx-opt-dollar",
    "docx-opt-cdot",
    "docx-opt-images",
    "docx-opt-dashes",
    "docx-opt-tables",
    "docx-opt-quotes",
    "docx-opt-hyphens",
    "docx-opt-whitespace",
    "docx-opt-unit-cm",
    "docx-opt-unit-circ",
    "docx-opt-greek",
    "docx-opt-supsub",
    "docx-opt-nonascii",
    "docx-opt-latex-space-block",
    "docx-opt-latex-space-inline",
    "docx-opt-nbsp-narrow",
    "camera-select",
    "camera-res-full",
    "camera-max-pixels",
    "camera-auto-process",
    "camera-auto-save",
    "camera-auto-read",
    "vision-prompt",
    "vision-mute-toggle",
    "camera-auto-vision-mode",
    "toc-pages",
    "toc-offset",
];
