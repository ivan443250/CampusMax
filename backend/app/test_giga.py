# backend/app/test_giga.py
import asyncio, sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.app.parsers import parse_table_with_giga  # async

def pretty(x): return json.dumps(x, ensure_ascii=False, indent=2)

async def main():
    """
    Простой e2e-тест: читаем example.csv и печатаем результат конвейера.
    """
    path = ROOT / "example_5.xlsx"
    if not path.exists():
        print("example.csv не найден по пути:", path)
        return

    print(f"Тестируем файл: {path}\n")

    result = await parse_table_with_giga(str(path))
    #print("\n==== FULL RESULT ====")
    #print(pretty(result))

    print("\n==== NORMALIZED ONLY ====")
    print(pretty(result.get("normalized", [])))

if __name__ == "__main__":
    asyncio.run(main())
