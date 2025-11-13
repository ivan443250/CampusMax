# backend/app/main.py
from fastapi import FastAPI, UploadFile, File
from pathlib import Path
from .parsers import parse_table_with_giga

STORAGE = Path("uploads")
STORAGE.mkdir(exist_ok=True)

app = FastAPI(title="Campus Schedule Uploader")

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    file_path = STORAGE / file.filename
    with open(file_path, "wb") as f:
        f.write(await file.read())

    result = await parse_table_with_giga(str(file_path))
    return result
