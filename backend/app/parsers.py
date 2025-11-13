import os
import json
import pandas as pd
import re
from typing import List, Any, Tuple
from backend.app.giga_client import get_gigachat_token, ask_gigachat_single
from pydantic import BaseModel
from .mappings import KEY_MAP
from pathlib import Path

class Lesson(BaseModel):
    subject: str
    start_time: str
    end_time: str = ""
    teacher: str = ""
    room: str = ""
    weekday: str = ""
    date: str = ""
    group: str = ""
    subgroup: str = ""
    week_type: str = ""
    note: str = ""
    raw: str

def df_to_rows_with_context(df: pd.DataFrame, sheet_name: str) -> list[str]:
    cols = [str(c).strip() for c in df.columns]
    header_guess = ", ".join(cols[:12])  # до 12 колонок в подсказку
    rows = []
    for _, r in df.fillna("").iterrows():
        parts = []
        for col, val in zip(cols, r.values):
            sval = str(val).strip()
            if sval:
                parts.append(f"{col}={sval}")
        if parts:
            rows.append(f"[Sheet: {sheet_name}] [Header: {header_guess}] row: " + " | ".join(parts))
    return rows

def read_any_table(path: str) -> list[str]:
    rows: list[str] = []
    ext = Path(path).suffix.lower()

    # --- Текстовые таблицы ---
    if ext in {".csv", ".tsv", ".txt"}:
        # sep=None + engine="python" — автоопределение разделителя
        df = pd.read_csv(path, dtype=str, sep=None, engine="python")
        rows += df_to_rows_with_context(df, ext.upper().lstrip("."))
        return [r for r in rows if r.strip()]

    # --- Excel-файлы ---
    # xlsx, xls, xlsm, xlsb и т.п. — pandas сам подберёт движок
    try:
        xls = pd.ExcelFile(path)
    except Exception as e:
        raise RuntimeError(f"Не удалось открыть файл как Excel: {e}")

    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet, dtype=str)
        rows += df_to_rows_with_context(df, sheet)

    return [r for r in rows if r.strip()]

def extract_parsed_from_resp(resp_json: dict) -> Tuple[Any, str]:
    """
    Достаём текст ответа модели (choices[0].message.content) и пытаемся превратить в JSON.
    Возвращаем (parsed, raw_text), где parsed: dict|list|None.
    """
     
    # Попытка извлечь типичный текст-ответ
    text = None
    try:
        choices = resp_json.get("choices")
        if choices and isinstance(choices, list) and len(choices) > 0:
            first = choices[0]
            msg = first.get("message")
            if isinstance(msg, dict) and "content" in msg:
                text = msg.get("content")
            elif "text" in first:
                text = first.get("text")
    except Exception:
        text = None

    if not isinstance(text, str):
        # На крайний случай вернём сериализованный ответ сервера
        text = json.dumps(resp_json, ensure_ascii=False)

    raw_text = text

    stripped = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text.strip())

    # Прямая попытка json.loads
    try:
        return json.loads(stripped), raw_text
    except Exception:
        pass
    
    # Вырежем первую JSON-подстроку {...} или [...]
    m = re.search(r"(\{.*\}|\[.*\])", stripped, flags=re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1)), raw_text
        except Exception:
            return None, raw_text

    return None, raw_text

def _clean_hhmm(part: str) -> str:
    """
    '9' -> '09:00', '9:5' -> '09:05', '9.00'/'9-00' -> '09:00'.
    Если не похоже на время — вернёт исходную строку без тримминга смысла.
    """
    if not isinstance(part, str):
        return part
    p = part.strip().replace(".", ":").replace("-", ":")
    m = re.match(r"^(\d{1,2})(?::?(\d{1,2}))?$", p)
    if not m:
        return part.strip()
    hh = int(m.group(1))
    mm = int(m.group(2) or 0)
    if hh > 23 or mm > 59:
        return part.strip()
    return f"{hh:02d}:{mm:02d}"

def _split_time_range(s: str) -> tuple[str, str]:
    """
    Поддерживаем:
      09:00-10:30, 9:00 – 10:30, 9.00–10.30, 9-00—10-30,
      '09:00 до 10:30', '09:00 to 10:30', допускаем пробелы.
    Возвращает (start, end) в формате HH:MM; если не распознано — (s, "").
    """
    if not isinstance(s, str):
        return s, ""
    t = s.strip()
    if not t:
        return "", ""

    # Вариант с разделителем-словом: "до"/"to"
    m = re.match(r"^\s*([0-9:\.\-\s]{3,})\s*(?:до|to)\s*([0-9:\.\-\s]{3,})\s*$", t, flags=re.IGNORECASE)
    if not m:
        # Нормализуем длинные тире к дефису и парсим как 'лево - право'
        t2 = t.replace("—", "-").replace("–", "-")
        m = re.match(r"^\s*([0-9:\.\-\s]{3,})\s*-\s*([0-9:\.\-\s]{3,})\s*$", t2)

    if m:
        a, b = _clean_hhmm(m.group(1)), _clean_hhmm(m.group(2))
        return a, b

    # Иначе — это, похоже, одиночное время
    return _clean_hhmm(t), ""

def _clean_cell(value: Any, strip_punct: str = ",;") -> str:
    """
    Приводим ячейку к нормальной строке:
    - None -> ""
    - обрезаем пробелы и одиночные разделители (",", ";", " |")
    - превращаем мусор вроде "-", "—", "nan", "null" в пустую строку
    """
    if value is None:
        return ""

    s = str(value).strip()

    # убираем одиночные ",", ";", "|" по краям
    s = s.strip(strip_punct + " |")

    # типичный мусор
    if s in {"", "-", "—"}:
        return ""

    low = s.lower()
    if low in {"nan", "none", "null"}:
        return ""

    return s

def _normalize_week_type(value: Any) -> str:
    s = _clean_cell(value)
    if not s:
        return ""

    low = s.strip().lower()

    # нормализуем основные кейсы
    if low.startswith("чет"):
        return "четная"
    if low.startswith("нечет") or low.startswith("нечёт"):
        return "нечетная"
    if low in {"оба", "both", "all"}:
        return "оба"

    # Excel-даты вида "2016-01-01 00:00:00" — вычищаем или считаем "все недели"
    if re.match(r"\d{4}-\d{2}-\d{2}", low):
        # для MVP можно вернуть пусто или "all"
        return ""  # или "оба"/"all", если так логичнее под твой фронт

    return s

def fallback_parse_row_from_prompt(prompt: str) -> dict:
    """
    Простейший парсер строки вида:
    [Sheet: ...] [Header: ...] row: Колонка=значение | Колонка2=значение2 | ...
    Возвращает dict с оригинальными именами колонок.
    Потом normalize_parsed сам разрулит их через key_map.
    """
    m = re.search(r"row:\s*(.*)$", prompt)
    if not m:
        return {}

    cells_block = m.group(1)
    obj: dict[str, str] = {}

    for part in cells_block.split("|"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        key, val = part.split("=", 1)
        key = key.strip()
        val = val.strip()
        if key:
            obj[key] = val

    return obj

def normalize_parsed(obj: Any, original_row: str) -> dict:
    """
    Приводим ответ модели к единой схеме.
    Гарантируем поля: subject, start_time, end_time, teacher, room, raw
    """
    out = {"subject": "", "start_time": "", "end_time": "", "teacher": "", "room": "", "raw": original_row}
    if not isinstance(obj, dict):
        return out

    key_map = KEY_MAP

    tmp = {}
    for k, v in obj.items():
        k_norm = key_map.get(str(k).strip().lower())
        if k_norm:
            tmp[k_norm] = v

    # time: "09:00-10:30"
    if isinstance(tmp.get("time"), str):
        s, e = _split_time_range(tmp["time"])
        if s and not tmp.get("start_time"):
            tmp["start_time"] = s
        if e and not tmp.get("end_time"):
            tmp["end_time"] = e

    # time: {"start_time": "...", "end_time": "..."} или русские ключи
    if isinstance(tmp.get("time"), dict):
        t = tmp["time"]
        st = t.get("start_time") or t.get("начало")
        en = t.get("end_time")   or t.get("конец")
        if isinstance(st, str):
            tmp.setdefault("start_time", st)
        if isinstance(en, str):
            tmp.setdefault("end_time",   en)

    # прогоняем через чистилку все основные поля
    out["subject"]    = _clean_cell(tmp.get("subject"))
    # для времени НЕ убираем "-" (поэтому strip_punct без дефиса)
    out["start_time"] = _clean_cell(tmp.get("start_time"), strip_punct=",; ")
    out["end_time"]   = _clean_cell(tmp.get("end_time"),   strip_punct=",; ")

    out["teacher"]    = _clean_cell(tmp.get("teacher"))
    out["room"]       = _clean_cell(tmp.get("room"))
    out["weekday"]    = _clean_cell(tmp.get("weekday"))
    out["date"]       = _clean_cell(tmp.get("date"))
    out["group"]      = _clean_cell(tmp.get("group"))
    out["subgroup"]   = _clean_cell(tmp.get("subgroup"))
    out["week_type"] = _normalize_week_type(tmp.get("week_type"))
    out["note"]       = _clean_cell(tmp.get("note"))

        
    if out["start_time"]:
        out["start_time"] = _clean_hhmm(out["start_time"])
    if out["end_time"]:
        out["end_time"] = _clean_hhmm(out["end_time"])

    return out

async def parse_table_with_giga(path: str) -> dict:
    """
    CSV/Excel -> строки -> GigaChat -> JSON -> нормализация.
    Единственный публичный конвейер для backend и тестов.
    """
    rows: List[str] = []
    try:
        rows = read_any_table(path)
    except Exception as e:
        return {
            "status": "error",
            "error": f"file read error: {e}",
            "file": os.path.basename(path),
        }

    if not rows:
        return {
            "status": "ok",
            "file": os.path.basename(path),
            "count": 0,
            "normalized": [],
        }

    token = await get_gigachat_token()
    api_url = os.getenv(
        "GIGACHAT_API_URL",
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
    ).strip()

    normalized = []

    for prompt in rows:
        prompt = (prompt or "").strip()
        if not prompt:
            continue

        try:
            resp = await ask_gigachat_single(prompt, token, api_url)
            parsed, raw_text = extract_parsed_from_resp(resp)

            fallback = fallback_parse_row_from_prompt(prompt)  

            merged = {}
            if parsed:
                merged.update(parsed)      # сначала LLM
            if fallback:
                merged.update(fallback)   
            obj = normalize_parsed(merged, prompt)

            try:
                # Гарантируем, что на выходе нормальный Lesson
                obj = Lesson(**obj).model_dump()
            except Exception:
                # Если что-то совсем поехало — хотя бы вернём raw и ошибку
                obj = {
                    **obj,
                    "raw": prompt,
                    "error": "validation_failed",
                }

            normalized.append(obj)

        except Exception as e:
            normalized.append({
                "raw": prompt,
                "error": f"{type(e).__name__}: {e}",
            })

    return {
        "status": "ok",
        "file": os.path.basename(path),
        "count": len(rows),
        "normalized": normalized,
    }
