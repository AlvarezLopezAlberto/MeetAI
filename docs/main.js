// public/main.js

let mediaRecorder, audioChunks = [];

const statusEl   = document.getElementById("status");
const startBtn   = document.getElementById("startBtn");
const stopBtn    = document.getElementById("stopBtn");

startBtn.addEventListener("click", async () => {
  // Solicitar permiso al micrófono
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", () => {
      const blob = new Blob(audioChunks, { type: "audio/wav" });
      // En próximos pasos: subir el blob a OneDrive
      console.log("Grabación detenida, tamaño del blob:", blob.size);
      // Por ahora, lo descargamos local para prueba
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href    = url;
      a.download= "recording_" + new Date().toISOString() + ".wav";
      a.click();
      URL.revokeObjectURL(url);
    });

    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled  = false;
    statusEl.innerText= "Estado: Grabando...";
  } catch (err) {
    console.error("No se pudo acceder al micrófono:", err);
    alert("Error al solicitar permiso de micrófono.");
  }
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    statusEl.innerText= "Estado: Detenido";
  }
});
