import os
import shutil
import time
from transformers import pipeline
from notion_client import Client

# ------------------------------------------
# 1) Leer variables de entorno de Notion
# ------------------------------------------
NOTION_TOKEN = os.getenv("NOTION_TOKEN")
NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

if NOTION_TOKEN is None or NOTION_DATABASE_ID is None:
    raise RuntimeError("Debes definir NOTION_TOKEN y NOTION_DATABASE_ID en tus variables de entorno.")

# ------------------------------------------
# 2) Inicializar cliente de Notion
# ------------------------------------------
notion = Client(auth=NOTION_TOKEN)

# ------------------------------------------
# 3) Cargar pipeline de resumen (summarization) de Hugging Face
# ------------------------------------------
print("Cargando modelo de resumen (Hugging Face)…")
summarizer = pipeline(
    "summarization",
    model="sshleifer/distilbart-cnn-12-6",
    device=0  # 0 = GPU
)

# ------------------------------------------
# 4) Rutas de carpetas (ajusta a tu OneDrive)
# ------------------------------------------
TRANSCRIPTS_FOLDER = r"E:\OneDrive - EMERALD DIGITAL SC\MeetAI"
DONE_FOLDER = os.path.join(TRANSCRIPTS_FOLDER, "transcripts_done")
os.makedirs(DONE_FOLDER, exist_ok=True)

# ------------------------------------------
# 5) Función para crear página en Notion (corregida)
# ------------------------------------------
def create_notion_page(title: str, summary: str, transcript: str):
    """
    Crea una nueva página en la DB con:
      - Title = title
      - children = [
          heading_2: "Resumen",
          paragraph: summary,
          heading_2: "Transcripción",
          paragraph: linea1,
          paragraph: linea2, ...
        ]
    """
    children_blocks = []

    # Bloque Header “Resumen”
    children_blocks.append({
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [
                {"type": "text", "text": {"content": "Resumen"}}
            ]
        }
    })

    # Bloque Párrafo con el resumen
    children_blocks.append({
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [
                {"type": "text", "text": {"content": summary}}
            ]
        }
    })

    # Bloque Header “Transcripción”
    children_blocks.append({
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [
                {"type": "text", "text": {"content": "Transcripción"}}
            ]
        }
    })

    # Bloques de párrafo con cada línea del transcript
    for line in transcript.split("\n"):
        if line.strip() == "":
            continue
        children_blocks.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {"type": "text", "text": {"content": line}}
                ]
            }
        })

    # Crear la página en Notion
    notion.pages.create(
        parent={"database_id": NOTION_DATABASE_ID},
        properties={
            "Name": {
                "title": [
                    {"type": "text", "text": {"content": title}}
                ]
            }
        },
        children=children_blocks
    )

# ------------------------------------------
# 6) Función principal: procesar todos los .txt nuevos
# ------------------------------------------
def main():
    for fname in os.listdir(TRANSCRIPTS_FOLDER):
        if not fname.lower().endswith(".txt"):
            continue
        full_path = os.path.join(TRANSCRIPTS_FOLDER, fname)
        if full_path.startswith(DONE_FOLDER):
            continue

        print(f"\n⏳ Procesando archivo: {fname}")
        with open(full_path, "r", encoding="utf-8") as f:
            transcript_text = f.read()

        # Generar resumen, ajustando longitudes si el texto es muy corto
        length_chars = len(transcript_text)
        if length_chars < 200:
            max_len, min_len = 50, 10
        else:
            max_len, min_len = 150, 40

        try:
            summary_list = summarizer(
                transcript_text,
                max_length=max_len,
                min_length=min_len,
                do_sample=False
            )
            summary_text = summary_list[0]["summary_text"]
        except Exception as e:
            print(f"❌ Error al resumir {fname}: {e}")
            summary_text = "(Error generando resumen)"

        # Crear la página en Notion
        try:
            page_title = os.path.splitext(fname)[0]
            create_notion_page(page_title, summary_text, transcript_text)
            print(f"✅ Página creada en Notion: {page_title}")
        except Exception as e:
            print(f"❌ Error al crear página en Notion para {fname}: {e}")
            continue

        # Mover el .txt a transcripts_done
        dest_path = os.path.join(DONE_FOLDER, fname)
        try:
            shutil.move(full_path, dest_path)
            print(f"📂 Movido {fname} a transcripts_done")
        except Exception as e:
            print(f"❌ Error al mover {fname} a transcripts_done: {e}")

    print("\n🎉 ¡Todos los transcripts procesados y enviados a Notion!")


if __name__ == "__main__":
    start = time.time()
    main()
    elapsed = time.time() - start
    print(f"Tiempo total: {elapsed:.1f}s")
