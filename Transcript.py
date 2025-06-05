import os
import shutil
import whisper

# -------------------------------------------------------
# Carpeta de entrada y salida definidas por variables de
# entorno para evitar rutas absolutas.  MEETAI_INPUT es
# la carpeta con los audios a transcribir y MEETAI_OUTPUT
# la carpeta donde se guardarán los .txt resultantes.
# -------------------------------------------------------
INPUT_FOLDER = os.getenv("MEETAI_INPUT")
OUTPUT_FOLDER = os.getenv("MEETAI_OUTPUT")
if INPUT_FOLDER is None or OUTPUT_FOLDER is None:
    raise RuntimeError(
        "Debes definir las variables MEETAI_INPUT y MEETAI_OUTPUT"
    )

# Nombre de la subcarpeta donde moveremos los audios ya procesados
DONE_SUBFOLDER = "transcript_done"
# ————————————————————————————————————————————— #

# Si ffmpeg no está en PATH global, se puede indicar mediante la variable de
# entorno FFMPEG_PATH.  Si existe, se añade al PATH del proceso.
ffmpeg_path = os.getenv("FFMPEG_PATH")
if ffmpeg_path:
    os.environ["PATH"] += os.pathsep + ffmpeg_path

# Cargar modelo Whisper (ajusta a "tiny" si necesitas menos VRAM)
model = whisper.load_model("base")


# Extensiones de audio válidas
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}


def es_archivo_audio(nombre_archivo):
    _, ext = os.path.splitext(nombre_archivo.lower())
    return ext in AUDIO_EXTENSIONS


# —————————— Crear carpetas base si no existen —————————— #
os.makedirs(INPUT_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Subcarpeta dentro de INPUT_FOLDER donde guardaremos los audios procesados
done_folder_fullpath = os.path.join(INPUT_FOLDER, DONE_SUBFOLDER)
os.makedirs(done_folder_fullpath, exist_ok=True)
# ———————————————————————————————————————————————— #


print("📂 Carpeta de entrada:", INPUT_FOLDER)
print("📂 Carpeta de salidas:", OUTPUT_FOLDER)
print("📂 Carpeta de audios procesados:", done_folder_fullpath)
print("---------------------------------\n")


# Recorremos recursivamente INPUT_FOLDER
for root, dirs, files in os.walk(INPUT_FOLDER):
    # Saltar la carpeta transcript_done para no procesar dos veces
    if os.path.abspath(root).startswith(os.path.abspath(done_folder_fullpath)):
        continue

    for fname in files:
        if not es_archivo_audio(fname):
            continue

        input_path = os.path.join(root, fname)
        # Nombre base para txt y para crear carpeta equivalente en done_folder
        rel_path = os.path.relpath(input_path, INPUT_FOLDER)
        rel_folder = os.path.dirname(rel_path)
        base_name = os.path.splitext(os.path.basename(fname))[0]
        output_txt_name = f"{base_name}.txt"
        output_txt_path = os.path.join(OUTPUT_FOLDER, output_txt_name)

        # Si el .txt ya existe, saltamos (también moveremos el audio, por si quedó “olvidado”)
        if os.path.exists(output_txt_path):
            print(f"⏭ Ya existe transcripción: {output_txt_name}")
            # Mover el audio a transcript_done, manteniendo subcarpeta si existe
            destino_subcarpeta = os.path.join(done_folder_fullpath, rel_folder)
            os.makedirs(destino_subcarpeta, exist_ok=True)
            shutil.move(input_path, os.path.join(destino_subcarpeta, fname))
            continue

        # Transcribir
        print(f"🔊 Transcribiendo: {rel_path}")
        try:
            result = model.transcribe(input_path)
            texto = result["text"]

            # Guardar .txt
            with open(output_txt_path, "w", encoding="utf-8") as f:
                f.write(texto)

            print(f"✅ Guardado transcripción: {output_txt_name}")

            # Mover el audio a transcript_done/<mismos subdirectorios>
            destino_subcarpeta = os.path.join(done_folder_fullpath, rel_folder)
            os.makedirs(destino_subcarpeta, exist_ok=True)
            shutil.move(input_path, os.path.join(destino_subcarpeta, fname))
            print(f"📁 Movido audio a: {os.path.join(destino_subcarpeta, fname)}")

        except Exception as e:
            print(f"❌ Error procesando {rel_path}: {e}")

print("\n🎉 ¡Proceso completado!\n")
