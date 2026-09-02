let peer = null;
let conn = null;
let expirationTimer = null;

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

// مهلة صلوحية الـ ID مدتها 10 دقائق (600,000 مللي ثانية)
const TEN_MINUTES = 10 * 60 * 1000;

function getValidShortId() {
  const savedData = sessionStorage.getItem("share_web_session");
  const now = Date.now();

  if (savedData) {
    const { id, timestamp } = JSON.parse(savedData);
    if (now - timestamp < TEN_MINUTES) {
      return { id, timeRemaining: TEN_MINUTES - (now - timestamp) };
    }
  }

  const newId = Math.floor(100000 + Math.random() * 900000).toString();
  sessionStorage.setItem("share_web_session", JSON.stringify({ id: newId, timestamp: now }));
  return { id: newId, timeRemaining: TEN_MINUTES };
}

function initPeer() {
  const { id: customId, timeRemaining } = getValidShortId();

  peer = new Peer(customId, {
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    }
  });

  peer.on("open", (id) => {
    myIdEl.textContent = id;
    startError.classList.add("hidden");
    startExpirationTimer(timeRemaining);
  });

  peer.on("error", (err) => {
    if (err.type === "unavailable-id") {
      sessionStorage.removeItem("share_web_session");
      initPeer();
    } else {
      showError("Connection error: " + err.type + ". Please check your network.");
    }
  });

  peer.on("connection", (connection) => {
    conn = connection;
    setupConnection();
  });
}

function startExpirationTimer(duration) {
  if (expirationTimer) clearTimeout(expirationTimer);
  expirationTimer = setTimeout(() => {
    if (peer && !conn) {
      sessionStorage.removeItem("share_web_session");
      showError("Code expired (10 min passed). Please refresh the page for a new ID.");
      if (peer) peer.destroy();
    }
  }, duration);
}

initPeer();

// إعادة الربط عند العودة من تطبيق آخر خلال الـ 10 دقائق
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (peer && peer.disconnected && !peer.destroyed && !conn) {
      peer.reconnect();
    }
  }
});

// الاتصال بـ Friend
btnConnect.addEventListener("click", () => {
  const targetId = peerIdInput.value.trim();
  if (!targetId) {
    showError("Please enter a valid Friend ID.");
    return;
  }
  startError.classList.add("hidden");
  conn = peer.connect(targetId);
  setupConnection();
});

let incomingFileInfo = null;
let incomingFileData = [];
let bytesReceived = 0;

function setupConnection() {
  conn.on("open", () => {
    if (expirationTimer) clearTimeout(expirationTimer);
    sessionStorage.removeItem("share_web_session");

    screenStart.classList.add("hidden");
    screenSession.classList.remove("hidden");
  });

  conn.on("data", (data) => {
    if (data.type === "text") {
      addTextToList(data.content, false);
    } else if (data.type === "file-start") {
      incomingFileInfo = data;
      incomingFileData = [];
      bytesReceived = 0;
    } else if (data.type === "file-chunk") {
      incomingFileData.push(data.chunk);
      bytesReceived += data.chunk.byteLength;

      if (bytesReceived >= incomingFileInfo.size) {
        const blob = new Blob(incomingFileData);
        addFileDownloadLink(incomingFileInfo.name, blob);
        incomingFileInfo = null;
        incomingFileData = [];
      }
    }
  });

  conn.on("close", () => {
    showError("Friend disconnected.");
  });
}

// إرسال الملفات مع الحفاظ على الأداء ونقل أحجام ضخمة عبر التقطيع
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => sendFiles(fileInput.files));

function sendFiles(files) {
  const CHUNK_SIZE = 64 * 1024;

  Array.from(files).forEach((file) => {
    conn.send({
      type: "file-start",
      name: file.name,
      size: file.size
    });

    let offset = 0;
    const reader = new FileReader();

    reader.onload = (e) => {
      conn.send({
        type: "file-chunk",
        chunk: e.target.result
      });

      offset += e.target.result.byteLength;
      if (offset < file.size) {
        readNextChunk();
      }
    };

    function readNextChunk() {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    }

    readNextChunk();
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
  li.textContent = `${isSelf ? "You" : "Friend"}: ${text}`;
  textsList.appendChild(li);
}

function addFileDownloadLink(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const li = document.createElement("li");
  li.innerHTML = `<a href="${url}" download="${fileName}">📥 Download ${fileName}</a>`;
  filesList.appendChild(li);
}

function showError(msg) {
  startError.textContent = msg;
  startError.classList.remove("hidden");
}
