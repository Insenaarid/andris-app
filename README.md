# Andrise äpp

Isiklik PWA Claude'i teavitustele. Ava https://insenaarid.github.io/andris-app/ telefonis → Jaga → „Lisa avakuvale“.
Vaated: Täna, Nädal, Ülesanded, Uudised, Mängud, Teated. Andmed `data.json` on krüpteeritud (kood = teavituste kood).
Uuendus: muuda faile, tõsta `VERSION` (index.html + sw.js), push `main`-i.

- **Uudised** (`news.js`): `news.json` kogub `tools/news.py` GitHub Actionsis iga 2 h (`.github/workflows/news.yml`). 👍/👎 hääled jäävad telefoni (localStorage `nvotes`) ja järjestavad „Sulle“ vaate.
- **Mängud** (`games.js`): lõputu Wordle (EE/EN, sõnad `words-*.json`), 24, Jada.
