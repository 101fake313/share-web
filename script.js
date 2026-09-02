let peer = null;
let conn = null;

const myIdEl = document.getElementById("my-id");
const peerIdInput = document.getElementById("peer-id-input");
const btnConnect = document.getElementById("btn-connect");
const screenStart = document.getElementById("screen-start");
const screenSession = document.getElementById("screen-session");
const startError = document.getElementById("start-error");

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const textInput = document.getElementById("text-input");
const btnSendText = document.getElementById("btn-send-text");
const textsList = document.getElementById("texts-list");
const filesList = document.getElementById("files-list");

// 1. إنشاء معرف فريد للجهاز الحالي
peer = new Peer();

peer.on("open", (id) => {
  myIdEl.textContent = id;
});

peer.on("error", (err) => {
  showError("Connection error: " + err.type);
});

// 2. استقبال الاتصال من جهاز آخر
peer.on("connection", (connection) => {
  conn = connection;
  setupConnection();
});

// 3. الاتصال بجهاز آخر عن طريق معرف الـ ID
btnConnect.addEventListener("click", () => {
  const targetId = peerIdInput.value.trim();
  if (!targetId) return;
  conn = peer.connect(targetId);
  setupConnection();
});

function setupConnection() {
  conn.on("open", () => {
    screenStart.classList.add("hidden");
    screenSession.classList.remove("hidden");
  });

  conn.on("data", (data) => {
    if (data.type === "text") {
      addTextToList(data.content, false);
    } else if (data.type === "file") {
      addFileDownloadLink(data.name, data.file);
    }
  });
}

// إرسال الملفات
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => sendFiles(fileInput.files));

function sendFiles(files) {
  Array.from(files).forEach((file) => {
    conn.send({
      type: "file",
      name: file.name,
      file: file
    });
  });
}

// إرسال النصوص
btnSendText.addEventListener("click", () => {
  const text = textInput.value.trim();
  if (text && conn) {
    conn.send({ type: "text", content: text });
    addTextToList(text, true);
    textInput.value = "";
  }
});

function addTextToList(text, isSelf) {
  const li = document.createElement("li");
  li.textContent = `${isSelf ? "You" : "Peer"}: ${text}`;
  textsList.appendChild(li);
}

function addFileDownloadLink(fileName, blob) {
  const url = URL.createObjectURL(new Blob([blob]));
  const li = document.createElement("li");
  li.innerHTML = `<a href="${url}" download="${fileName}">📥 Download ${fileName}</a>`;
  filesList.appendChild(li);
}

function showError(msg) {
  startError.textContent = msg;
  startError.classList.remove("hidden");
}