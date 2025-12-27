// --- PREVIEW SYSTEM LOGIC (GLOBAL) ---
async function renderPreviewItem(index) {
    const dpiInput = document.getElementById("dpi");
    const imgNavInput = document.getElementById("img-nav-input");
    const imagePreview = document.getElementById("image-preview");

    if (index < 0 || index >= previewItems.length) return;

    currentPreviewIndex = index;
    // Update input field
    if (imgNavInput) imgNavInput.value = index + 1;

    const item = previewItems[index];
    let base64 = null;
    const dpi = parseInt(dpiInput.value, 10) || 150;

    try {
        if (item.type === "base64") {
            base64 = item.data;
        } else if (item.type === "image") {
            base64 = await getBase64FromImage(item.file);
        } else if (item.type === "pdf") {
            base64 = await getBase64FromPdfPage(
                item.doc,
                item.page,
                dpi,
            );
        }

        if (base64) {
            imagePreview.src = base64;
            imagePreview.style.display = "block";
            // Important: Update global var so manual prompts use this displayed image
            lastProcessedImageBase64 = base64;
        } else {
            logMessage(
                `Fehler: Konnte Bild für Element ${index + 1} nicht generieren.`,
            );
        }
    } catch (e) {
        logMessage(`Vorschau-Fehler: ${e.message}`);
        console.error(e);
    }
}

async function loadPreviewContent() {
    const fileInput = document.getElementById("file-input");
    const imagePreview = document.getElementById("image-preview");
    const imgNavControls = document.getElementById("img-nav-controls");
    const imgTotalCount = document.getElementById("img-total-count");

    // Reset Preview State
    previewItems = [];
    currentPreviewIndex = 0;
    imagePreview.src = "";
    imgNavControls.style.display = "none";

    if (cameraQueue.length > 0) {
        cameraQueue.forEach((b64) =>
            previewItems.push({ type: "base64", data: b64 }),
        );
    } else if (fileInput.files.length > 0) {
        const files = Array.from(fileInput.files);

        for (const file of files) {
            // Check for PDF by MIME type or extension
            const isPdf =
                file.type === "application/pdf" ||
                file.name.toLowerCase().endsWith(".pdf");

            if (isPdf) {
                try {
                    if (typeof pdfjsLib === "undefined") {
                        logMessage(
                            "CRITICAL ERROR: PDF.js library not loaded.",
                        );
                        continue;
                    }

                    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                        pdfjsLib.GlobalWorkerOptions.workerSrc =
                            "libs/pdfjs/pdf.worker.min.js";
                    }

                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const loadingTask = pdfjsLib.getDocument({
                        data: uint8Array,
                    });
                    const pdfDoc = await loadingTask.promise;

                    // All pages to stack
                    for (let i = 1; i <= pdfDoc.numPages; i++) {
                        previewItems.push({
                            type: "pdf",
                            doc: pdfDoc,
                            page: i,
                        });
                    }
                } catch (e) {
                    logMessage(
                        `Fehler beim Laden von PDF ${file.name}: ${e.message}`,
                    );
                }
            } else if (file.type.startsWith("image/")) {
                previewItems.push({ type: "image", file: file });
            }
        }
    }

    if (previewItems.length > 0) {
        imgNavControls.style.display =
            previewItems.length > 1 ? "flex" : "none";
        if (imgTotalCount)
            imgTotalCount.textContent = "/ " + previewItems.length;

        await renderPreviewItem(0);
        if (fileInput.files.length > 0) {
            logMessage(
                `${previewItems.length} Seite(n) geladen. Bereit.`,
            );
        }
    }
}

function getCleanedMarkdown(markdown) {
    const docxOptUnitCm = document.getElementById("docx-opt-unit-cm");
    const docxOptUnitCirc = document.getElementById("docx-opt-unit-circ");
    const docxOptLatexSpaceBlock = document.getElementById("docx-opt-latex-space-block");
    const docxOptLatexSpaceInline = document.getElementById("docx-opt-latex-space-inline");
    const docxOptGreek = document.getElementById("docx-opt-greek");
    const docxOptSupsub = document.getElementById("docx-opt-supsub");
    const docxOptNonAscii = document.getElementById("docx-opt-nonascii");
    const docxOptNbspNarrow = document.getElementById("docx-opt-nbsp-narrow");
    const docxOptQuotes = document.getElementById("docx-opt-quotes");
    const docxOptHyphens = document.getElementById("docx-opt-hyphens");
    const docxOptWhitespace = document.getElementById("docx-opt-whitespace");
    const docxOptLatex = document.getElementById("docx-opt-latex");
    const docxOptDollar = document.getElementById("docx-opt-dollar");
    const docxOptCdot = document.getElementById("docx-opt-cdot");
    const docxOptImages = document.getElementById("docx-opt-images");
    const docxOptDashes = document.getElementById("docx-opt-dashes");

    let cleaned = markdown;

    // --- 1. Einheiten (\text, \mathrm) bereinigen [PRIORITÄT HOCH] ---
    if (docxOptUnitCm && docxOptUnitCm.checked) {
        cleaned = cleaned.replace(
            /\\(?:text|mathrm|textnormal)\s*\{\s*([^{}]+?)\s*\}/g,
            "$1",
        );
    }

    // --- 2. Zirkumflex (^) zu Grad (°) ---
    if (docxOptUnitCirc && docxOptUnitCirc.checked)
        cleaned = cleaned.replace(/\^circ/g, "°");

    // --- 3a. Leerzeichen in $$...$$ entfernen ---
    if (docxOptLatexSpaceBlock && docxOptLatexSpaceBlock.checked) {
        cleaned = cleaned.replace(
            /\$$([\s\S]*?)\$$/g,
            (match, content) => {
                return (
                    "$$" + content.replace(/\s+/g, "") + "$$"
                );
            },
        );
    }

    // --- 3b. Leerzeichen in $...$ entfernen ---
    if (docxOptLatexSpaceInline && docxOptLatexSpaceInline.checked) {
        cleaned = cleaned.replace(
            /(\$)([^$\n]+?)(\$)/g,
            (match, open, content, close) => {
                return (
                    open + content.replace(/\s+/g, "") + close
                );
            },
        );
    }

    // -- 4. GREEK TO LATEX CONVERSION --
    if (docxOptGreek && docxOptGreek.checked) {
        const greekToLatex = {
            α: "\\alpha", β: "\\beta", γ: "\\gamma", δ: "\\delta", ε: "\\epsilon", ϵ: "\\varepsilon",
            ζ: "\\zeta", η: "\\eta", θ: "\\theta", ϑ: "\\vartheta", ι: "\\iota", κ: "\\kappa",
            λ: "\\lambda", μ: "\\mu", ν: "\\nu", ξ: "\\xi", ο: "o", π: "\\pi", ρ: "\\rho",
            σ: "\\sigma", ς: "\\varsigma", τ: "\\tau", υ: "\\upsilon", φ: "\\phi", ϕ: "\\varphi",
            χ: "\\chi", ψ: "\\psi", ω: "\\omega", Α: "A", Β: "B", Γ: "\\Gamma", Δ: "\\Delta",
            Ε: "E", Ζ: "Z", Η: "H", Θ: "\\Theta", Ι: "I", Κ: "K", Λ: "\\Lambda", Μ: "M",
            Ν: "N", Ξ: "\\Xi", Ο: "O", Π: "\\Pi", Ρ: "P", Σ: "\\Sigma", Τ: "T", Υ: "\\Upsilon",
            Φ: "\\Phi", Χ: "X", Ψ: "\\Psi", Ω: "\\Omega",
        };
        cleaned = cleaned.replace(/[α-ωΑ-Ωϵϑϕς]/g, (match) => {
            return (greekToLatex[match] || match) + " ";
        });
    }

    // -- 5. SUPERSCRIPT / SUBSCRIPT --
    if (docxOptSupsub && docxOptSupsub.checked) {
        const supMap = {
            "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
            "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
        };
        const subMap = {
            "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
            "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
        };
        cleaned = cleaned.replace(
            /[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,
            (m) => "^" + supMap[m],
        );
        cleaned = cleaned.replace(
            /[₀₁₂₃₄₅₆₇₈₉]/g,
            (m) => "_" + subMap[m],
        );
    }

    // -- 6. NON-ASCII TO LATEX --
    if (docxOptNonAscii && docxOptNonAscii.checked) {
        const charMap = {
            "×": "\\times ", "÷": "\\div ", "±": "\\pm ", "∓": "\\mp ", "≤": "\\leq ", "≥": "\\geq ",
            "≠": "\\neq ", "≈": "\\approx ", "∞": "\\infty ", "•": "\\cdot ", "→": "\\to ", "↔": "\\leftrightarrow ",
            "⇐": "\\Leftarrow ", "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ", "∈": "\\in ", "∉": "\\notin ",
            "⊂": "\\subset ", "⊃": "\\supset ", "∪": "\\cup ", "∩": "\\cap ", "∀": "\\forall ", "∃": "\\exists ",
            "∇": "\\nabla ", "∂": "\\partial ", "∑": "\\sum ", "∏": "\\prod ", "∫": "\\int ",
        };
        const keys = Object.keys(charMap)
            .join("")
            .replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const re = new RegExp(`[${keys}]`, "g");
        cleaned = cleaned.replace(re, (m) => charMap[m]);
    }

    // -- Standard Bereinigungen --
    if (docxOptNbspNarrow && docxOptNbspNarrow.checked)
        cleaned = cleaned.replace(/\u00A0/g, "\u202F");

    if (docxOptQuotes && docxOptQuotes.checked)
        cleaned = cleaned
            .replace(/[“„”«»]/g, '"')
            .replace(/[‘‚’‹›]/g, "'");

    if (docxOptHyphens && docxOptHyphens.checked)
        cleaned = cleaned.replace(/[—–]/g, "-");

    if (docxOptWhitespace && docxOptWhitespace.checked) {
        const regex = docxOptNbspNarrow.checked
            ? /[\u1680\u180E\u2000-\u200B\u205F\u3000\uFEFF]/g
            : /[\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g;
        cleaned = cleaned.replace(regex, " ");
        if (!docxOptNbspNarrow.checked)
            cleaned = cleaned.replace(/\u00A0/g, " ");
    }

    if (docxOptLatex && docxOptLatex.checked)
        cleaned = cleaned.replace(
            /\$$([\s\S]*?)\$$/g,
            "&lt;L&gt;$1&lt;/L&gt;",
        );

    if (docxOptDollar && docxOptDollar.checked)
        cleaned = cleaned.replace(/\$/g, "");

    if (docxOptCdot && docxOptCdot.checked)
        cleaned = cleaned.replace(/\\cdot/g, "*");

    if (docxOptImages && docxOptImages.checked)
        cleaned = cleaned
            .replace(/\(\(Bild\)\)/g, "&lt;Bild&gt;")
            .replace(/\(\(\/Bild\)\)/g, "&lt;/Bild&gt;");

    if (docxOptDashes && docxOptDashes.checked)
        cleaned = cleaned
            .split("\n")
            .filter((line) => !/^---\s*$/.test(line))
            .join("\n");

    return cleaned;
}

function updateTextPreview(markdown) {
    const docxOptTables = document.getElementById("docx-opt-tables");
    const rawPreview = document.getElementById("raw-preview");
    const renderedPreview = document.getElementById("rendered-preview");

    rawPreview.value = markdown;
    let textToRender = getCleanedMarkdown(markdown);
    try {
        let html = marked.parse(textToRender);
        if (docxOptTables && docxOptTables.checked)
            html = html
                .replace(
                    /<table/g,
                    '<p style="color:blue;">&lt;Tabelle&gt;</p><table',
                )
                .replace(
                    /<\/table>/g,
                    '</table><p style="color:blue;">&lt;/Tabelle&gt;</p>',
                );
        renderedPreview.innerHTML = html;
        if (typeof renderMathInElement !== "undefined")
            renderMathInElement(renderedPreview, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                ],
                throwOnError: false,
            });
    } catch (e) {
        renderedPreview.innerHTML = `<p>Error</p>`;
    }
}

function setPreviewMode(mode) {
    const rawPreview = document.getElementById("raw-preview");
    const renderedPreview = document.getElementById("rendered-preview");
    const toggleRawBtn = document.getElementById("toggle-raw-btn");
    const toggleRenderedBtn = document.getElementById("toggle-rendered-btn");

    const isRaw = mode === "raw";
    rawPreview.style.display = isRaw ? "block" : "none";
    renderedPreview.style.display = isRaw ? "none" : "block";
    toggleRawBtn.classList.toggle("active", isRaw);
    toggleRawBtn.setAttribute("aria-pressed", isRaw);
    toggleRenderedBtn.classList.toggle("active", !isRaw);
    toggleRenderedBtn.setAttribute("aria-pressed", !isRaw);
    if (!isRaw) updateTextPreview(rawPreview.value);
}

function downloadMarkdown(isIntermediate) {
    if (allMarkdownResults.length === 0) return;
    const fullMarkdown = allMarkdownResults.join("\n\n\n");
    const blob = new Blob([fullMarkdown], {
        type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${firstFileName}${isIntermediate ? "_zwischenstand" : ""}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadDocx() {
    const docxOptTables = document.getElementById("docx-opt-tables");
    if (allMarkdownResults.length === 0) return;
    const fullMarkdown = allMarkdownResults
        .map((md) => getCleanedMarkdown(md))
        .join("\n\n\n");
    let contentHtml = marked.parse(fullMarkdown);
    if (docxOptTables && docxOptTables.checked)
        contentHtml = contentHtml
            .replace(/<table/g, "<p>&lt;Tabelle&gt;</p><table")
            .replace(
                /<\/table>/g,
                "</table><p>&lt;/Tabelle&gt;</p>",
            );
    const completeHtml = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset="utf-8"><title>Export</title><style>body{font-family:'Calibri','Arial';}</style></head><body>${contentHtml}</body></html>`;
    try {
        const converted = htmlDocx.asBlob(completeHtml);
        const url = URL.createObjectURL(converted);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${firstFileName}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        logMessage(`DOCX gespeichert.`);
    } catch (e) {
        logMessage("Fehler Export: " + e.message);
    }
}
