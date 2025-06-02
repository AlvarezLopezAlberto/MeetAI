// docs/main.js

import { msalConfig, loginRequest } from "./authConfig.js";

// MSAL y Graph Client globales (UMD que cargaste en index.html)
const msal = window.msal;
const microsoftGraph = window.MicrosoftGraph;

let msalInstance;
let graphClient;
let account;
let mediaRecorder, audioChunks = [];

const loginBtn   = document.getElementById("loginBtn");
const startBtn   = document.getElementById("startBtn");
const stopBtn    = document.getElementById("stopBtn");
const statusEl   = document.getElementById("status");

async function signIn() {
  try {
    if (!msalInstance) {
      msalInstance = new msal.PublicClientApplication(msalConfig);
      await msalInstance.initialize();
    }

    const loginResponse = await msalInstance.loginPopup(loginRequest);
    account = loginResponse.account;
    statusEl.innerText = `Usuario: ${account.username}`;

    graphClient = microsoftGraph.Client.init({
      authProvider: async (done) => {
        try {
          const silentResult = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: account
          });
          done(null, silentResult.accessToken);
        } catch (silentError) {
          const tokenResponse = await msalInstance.acquireTokenPopup(loginRequest);
          done(null, tokenResponse.accessToken);
        }
      }
    });

    loginBtn.disabled = true;
    startBtn.disabled = false;
    statusEl.innerText = `Conectado como: ${account.username}`;
  } catch (err) {
    console.error("Error en signIn():", err);
    statusEl.innerText = "Error al iniciar sesión.";
  }
}

async function ensureFolderExists(folderName) {
  try {
    // Intentamos GET /me/drive/root:/<folderName>
    const folder = await graphClient
      .api(`/me/drive/root:/${folderName}`)
      .get();

    return folder.id;
  } catch (err) {
    if (err.statusCode === 404) {
      // Si no existe (404), creamos en children
      const newFolder = await graphClient
        .api(`/me/drive/root/children`)
        .post({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename"
        });
      return newFolder.id;
    }
    // Si es otro error, mostrarlo y relanzar
    console.error("ERROR en ensureFolderExists (no 404):", err);
    throw err;
  }
}

async function uploadAudioBlob(blob) {
  try {
    const folderName = "AudioParaTranscribir";
    const folderId = await ensureFolderExists(folderName);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `meeting_${timestamp}.wav`;

    await graphClient
      .api(`/me/drive/items/${folderId}:/${fileName}:/content`)
      .put(blob);

    console.log("Subido a OneDrive:", fileName);
    statusEl.innerText = `Subido: ${fileName}`;
  } catch (error) {
    console.error("Error en uploadAudioBlob:", error);
    statusEl.innerText = "Error al subir a OneDrive.";
  }
}

startBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", async () => {
      const blob = new Blob(audioChunks, { type: "audio/wav" });
      statusEl.innerText = "Detenido. Subiendo a OneDrive…";
      await uploadAudioBlob(blob);
    });

    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled  = false;
    statusEl.innerText = "Grabando…";
  } catch (err) {
    console.error("Error al iniciar grabación:", err);
    statusEl.innerText = "Error al acceder al micrófono.";
  }
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    statusEl.innerText = "Procesando…";
  }
});

loginBtn.addEventListener("click", () => {
  signIn();
});
