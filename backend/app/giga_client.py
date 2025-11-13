# backend/app/giga_client.py
import os
import httpx
from dotenv import load_dotenv
import base64
import uuid

load_dotenv()

CLIENT_ID = os.getenv("GIGACHAT_CLIENT_ID")
CLIENT_SECRET = os.getenv("GIGACHAT_CLIENT_SECRET")
SCOPE = os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS")
OAUTH_URL = os.getenv("GIGACHAT_OAUTH_URL", "https://ngw.devices.sberbank.ru:9443/api/v2/oauth")
API_URL = os.getenv("GIGACHAT_API_URL", "https://gigachat.devices.sberbank.ru/api/v1/chat/completions").strip()

VERIFY_TLS = os.getenv("GIGACHAT_VERIFY_TLS", "false").lower() in ("1", "true", "yes")
TIMEOUT_S  = float(os.getenv("GIGACHAT_TIMEOUT", "30.0"))



async def get_gigachat_token() -> str:
    """
    Получаем access_token по документации.
    Бросаем исключение при любом не-200 ответе.
    """

    if not CLIENT_ID or not CLIENT_SECRET:
        raise RuntimeError("Missing CLIENT_ID / CLIENT_SECRET")
    
    pair = f"{CLIENT_ID}:{CLIENT_SECRET}".encode("utf-8")
    auth_b64 = base64.b64encode(pair).decode("utf-8")

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "RqUID": str(uuid.uuid4()),        # произвольный UUID — обязателен по доке
        "Authorization": f"Basic {auth_b64}",
    }
    data = {"scope": SCOPE}
    
    async with httpx.AsyncClient(verify=VERIFY_TLS, timeout=TIMEOUT_S) as client:
        resp = await client.post(OAUTH_URL, headers=headers, data=data)
        resp.raise_for_status()            # <— важный момент: сразу фейлим по коду
        j = resp.json()
        token = j.get("access_token")
        if not token:
            raise RuntimeError(f"No access_token in response: {j}")
        return token


async def ask_gigachat_single(prompt: str, token: str, api_url: str) -> dict:
     
    """
    Отправляет ОДНУ строку в чат-модель. Возвращает resp.json() как dict.
    """
     
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Строгий system prompt — по умолчанию из ENV, иначе дефолт
    system_prompt = os.getenv("GIGACHAT_SYSTEM_PROMPT",
        "Ты — парсер учебного расписания."
        "Вход: ОДНА строка в формате:"
        "[Sheet: <название листа>] [Header: <список колонок через запятую>] row: <col>=<value> | <col2>=<value2> | ..."
        "Колонки и значения могут быть на русском или английском, с любыми названиями."
        "Нужно вернуть ОДИН JSON-объект с СТРОГИМИ ключами:"
        "subject, start_time, end_time, teacher, room, weekday, date, group, subgroup, week_type, note."
        "Правила:"
        "Если время дано диапазоном (например ""9:00-10:30"", ""9.00 до 10.30"") — заполни start_time и end_time."
        "Если указано одно время — положи его в start_time, end_time оставь пустым."
        "Если есть и день недели, и дата — заполни оба поля."
        "Все значения — строки (можно пустые)."
        "Если чего-то нет в строке — оставь пустую строку."
        "НЕ добавляй новых ключей."
        "Отвечай ТОЛЬКО валидным JSON-объектом без текста вокруг и без ```."
    )
    
    body = {
        "model": os.getenv("GIGACHAT_MODEL", "GigaChat-2"), 
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.0,
    }

    async with httpx.AsyncClient(verify=VERIFY_TLS, timeout=TIMEOUT_S) as client:
        resp = await client.post(api_url, headers=headers, json=body)
        resp.raise_for_status()
        return resp.json()
