// public/main.js

import { PublicClientApplication } from "https://cdn.jsdelivr.net/npm/@azure/msal-browser/dist/msal-browser.esm.js";
import { Client } from "https://cdn.jsdelivr.net/npm/@microsoft/microsoft-graph-client/lib/graph-js-sdk-web.esm.js";
import { msalConfig, loginRequest } from "../authConfig.js";

// Variables globales
let msalInstance = new PublicClientApplication(msalConfig);
let graphClient;
let account;
let mediaRecorder, audioChunks = [];

// Elementos del DOM
const loginBtn   = document.getElementById("loginBtn");
const startBtn   = document.getElementById("startBtn");
const stopBtn    = document.getElementById("stopBtn");
const statusEl   = document.getElementById("status");

// 1) Función para iniciar sesión y configurar Graph Client
async function signIn() {
  try {
    // Inicia flujo interactivo (popup)
    const loginResponse = await msalInstance.loginPopup(loginRequest);
    account = loginResponse.account;
    statusEl.innerText = `Usuario: ${account.username}`;

    // Construir Graph Client usando el token obtenido
    graphClient = Client.init({
      authProvider: async (done) => {
        try {
          const silentResult = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: account
          });
          done(null, silentResult.accessToken);
        } catch (error) {
          // Si falla el silent, hacemos popup de nuevo
          const tokenResponse = await msalInstance.acquireTokenPopup(loginRequest);
          done(null, tokenResponse.accessToken);
        }
      }
    });

    // Habilitar botones ahora que estamos autenticados
    loginBtn.disabled = true;
    startBtn.disabled = false;
    statusEl.innerText = `Conectado como: ${account.username}`;
  } catch (err) {
    console.error("Error en signIn():", err);
    statusEl.innerText = "Error al iniciar sesión.";
  }
}

// 2) Función para asegurar que exista la carpeta “AudioParaTranscribir” en OneDrive
async function ensureFolderExists(folderName) {
  try {
    // Intentar buscar la carpeta en la raíz de OneDrive del usuario
    const folder = await graphClient
      .api(`/me/drive/root/children`)
      .filter(`name eq '${folderName}' and folder ne null`)
      .get();

    if (folder.value && folder.value.length > 0) {
      // Si ya existe, devolvemos su id
      return folder.value[0].id;
    } else {
      // Si no existe, la creamos
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

// 3) Función para subir un Blob de audio a OneDrive en la carpeta “AudioParaTranscribir”
async function uploadAudioBlob(blob) {
  try {
    const folderName = "AudioParaTranscribir";
    // 3.1) Asegurarnos de que la carpeta existe, y obtener su ID
    const folderId = await ensureFolderExists(folderName);

    // 3.2) Preparar el nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `meeting_${timestamp}.wav`;

    // 3.3) Llamar a Graph para hacer upload sencillo (puede manejar hasta ~4 MB en una sola llamada)
    //       Si el blob es mayor, deberíamos usar el “upload session”, pero en la mayoría de grabaciones
    //       de audio corto no supera 4 MB. Ajusta según necesites.
    const uploadResult = await graphClient
      .api(`/me/drive/items/${folderId}:/${fileName}:/content`)
      .put(blob);

    console.log("Archivo subido con éxito:", uploadResult);
    statusEl.innerText = `Subido: ${fileName}`;
  } catch (error) {
    console.error("Error en uploadAudioBlob:", error);
    statusEl.innerText = "Error al subir a OneDrive.";
  }
}

// 4) Lógica de grabación + llamada a uploadAudioBlob()
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
