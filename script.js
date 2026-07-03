const imageInput = document.querySelector("#imageInput");
const dropZone = document.querySelector("#dropZone");
const languageSelect = document.querySelector("#languageSelect");
const clearButton = document.querySelector("#clearButton");
const scanButton = document.querySelector("#scanButton");
const previewCard = document.querySelector("#previewCard");
const previewImage = document.querySelector("#previewImage");
const fileName = document.querySelector("#fileName");
const fileMeta = document.querySelector("#fileMeta");
const uploadStatus = document.querySelector("#uploadStatus");
const progressWrap = document.querySelector("#progressWrap");
const progressBar = document.querySelector("#progressBar");
const statusText = document.querySelector("#statusText");
const outputText = document.querySelector("#outputText");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const wordCount = document.querySelector("#wordCount");
const charCount = document.querySelector("#charCount");
const toast = document.querySelector("#toast");

let selectedFile = null;
let previewUrl = null;
let toastTimer = null;

// API using to UI
// const FASTAPI_ENDPOINT = "http://localhost:8000/process-ocr/";

const FASTAPI_ENDPOINT = "https://vorovath-ocr-regonization.hf.space/process-ocr/";


// DOM listeners are set up below at the bottom of the file

const formatBytes = (bytes) => {
  if (!bytes) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  const sizeIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / 1024 ** sizeIndex;

  return `${value.toFixed(value >= 10 || sizeIndex === 0 ? 0 : 1)} ${
    units[sizeIndex]
  }`;
};

const showToast = (message, isError = false) => {
  clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");

  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
};

const setProgress = (value, message) => {
  progressBar.style.width = `${Math.round(value * 100)}%`;
  statusText.textContent = message;
};

const updateTextStats = () => {
  const text = outputText.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = outputText.value.length;

  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
  charCount.textContent = `${chars} ${chars === 1 ? "character" : "characters"}`;

  copyButton.disabled = !text;
  downloadButton.disabled = !text;
};

const setBusy = (isBusy) => {
  scanButton.disabled = isBusy || !selectedFile;
  clearButton.disabled = isBusy || !selectedFile;
  // languageSelect.disabled = isBusy;  // this is use for select the language
  imageInput.disabled = isBusy;

  scanButton.querySelector("span").textContent = isBusy
    ? "Scanning..."
    : "Scan Text";
};

// it was be an fucntion that use for input the file
const selectFile = (file) => {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please choose an image file.", true);
    return;
  }
  selectedFile = file;

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = URL.createObjectURL(file);

  previewImage.src = previewUrl;
  fileName.textContent = file.name;
  fileMeta.textContent = `${formatBytes(file.size)} - ${file.type || "Image"}`;
  uploadStatus.textContent = `${file.name} is connected to the OCR result panel. Press Scan Text to extract the text.`;

  previewCard.hidden = false;
  scanButton.disabled = false;
  clearButton.disabled = false;

  showToast("Image ready to scan.");
};

// use for clear app
const clearApp = () => {
  selectedFile = null;
  imageInput.value = "";
  outputText.value = "";

  uploadStatus.textContent = "No image selected yet.";
  previewCard.hidden = true;
  progressWrap.hidden = true;
  scanButton.disabled = true;
  clearButton.disabled = true;
  progressBar.style.width = "0%";

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  updateTextStats();
};

const scanText = async () => {
  if (!selectedFile) {
    showToast("Upload an image before scanning.", true);
    return;
  }

  setBusy(true);
  progressWrap.hidden = false;
  outputText.value = "";
  updateTextStats();
  setProgress(0.1, "Sending image to FastAPI backend...");

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    setProgress(0.4, "Processing OCR on server...");
    const response = await fetch(FASTAPI_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    setProgress(0.8, "Formatting results...");
    const data = await response.json();
    
    if (data.status === "success" && data.results) {
      const text = data.results.map(res => res.text).join(" ").trim();
      outputText.value = text || "No text was detected. Try a clearer or higher-contrast image.";

      setProgress(1, "Scan complete.");
      updateTextStats();
      showToast(text ? "Text extracted successfully." : "Scan finished, but no text was found.");
    } else {
      throw new Error(data.detail || "OCR process was not successful.");
    }
  } catch (error) {
    console.error(error);
    setProgress(0, "OCR failed.");
    showToast("Could not scan this image. Check if backend API is running.", true);
  } finally {
    setBusy(false);
  }
};

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");

  selectFile(event.dataTransfer.files[0]);
});

imageInput.addEventListener("change", (event) => {
  selectFile(event.target.files[0]);
});

 
scanButton.addEventListener("click", scanText);
clearButton.addEventListener("click", clearApp);
outputText.addEventListener("input", updateTextStats);

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputText.value);
    showToast("Copied to clipboard.");
  } catch {
    outputText.select();
    document.execCommand("copy");
    showToast("Copied to clipboard.");
  }
});

// it is use for download 
downloadButton.addEventListener("click", () => {
  const blob = new Blob([outputText.value], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "extracted-text.txt";
  link.click();

  URL.revokeObjectURL(url);

  showToast("Text file downloaded.");
});

updateTextStats();