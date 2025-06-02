// docs/main.js

import { msalConfig, loginRequest } from "./authConfig.js";

// MSAL y Graph Client se exponen en el global window
const msal = window.msal;                     // MSAL Browser expone window.msal
const microsoftGraph = window.MicrosoftGraph; // Graph Client expone window.MicrosoftGraph

let msalInstance;
let graphClient;
let account;
let mediaRecorder, audioChunks = [];

// Referencias a elementos del DOM
const loginBtn   = document.getElementById("loginBtn");
const startBtn   = document.getElementById("startBtn");
const stopBtn    = document.getElementById("stopBtn");
const statusEl   = document.getElementById("status");

// 1) Iniciar sesión con MSAL y crear graphClient
async function signIn() {
  try {
    if (!msalInstance) {
      // Crear la instancia
      msalInstance = new msal.PublicClientApplication(msalConfig);
      // ¡Obligatorio! Llamar a initialize() antes de usar loginPopup()
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

// 2) Verificar/crear carpeta “AudioParaTranscribir” en OneDrive
async function ensureFolderExists(folderName) {
  try {
    const response = await graphClient
      .api(`/me/drive/root/children?$filter=name eq '${folderName}' and folder ne null`)
      .get();

    if (response.value && response.value.length > 0) {
      return response.value[0].id;
    } else {
      const newFolder = await graphClient
        .api(`/me/drive/root/children`)
        .post({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename"
        });
      return newFolder.id;
    }
  } catch (error) {
    console.error("Error en ensureFolderExists:", error);
    throw error;
  }
}

// 3) Subir Blob de audio a OneDrive
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

// 4) Manejar grabación y, al detener, subir a OneDrive
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

// 5) Conectar el botón “login”
loginBtn.addEventListener("click", () => {
  signIn();
});
