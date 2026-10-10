#!/usr/bin/env python3
"""Kogub uudised usaldusväärsetest RSS-allikatest → news.json (äpi vaade „Uudised“).

Jookseb GitHub Actionsis (.github/workflows/news.yml) iga 2 h. Ainult standardteek.
Kategooriad: ee (Eesti), eu (Euroopa), world (maailm), energy (energeetika), sci (teadus/tehnika).
Energeetika märgitakse lisaks märksõnade järgi igale uudisele, mis teemat puudutab.
"""
import email.utils, hashlib, html, json, os, re, sys, time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

# (nimi, kategooria, url)
FEEDS = [
    ("ERR", "ee", "https://www.err.ee/rss"),
    ("ERR News", "ee", "https://news.err.ee/rss"),
    ("Novaator", "sci", "https://novaator.err.ee/rss"),
    ("BBC Europe", "eu", "https://feeds.bbci.co.uk/news/world/europe/rss.xml"),
    ("Politico EU", "eu", "https://www.politico.eu/feed/"),
    ("DW Europe", "eu", "https://rss.dw.com/rdf/rss-en-eu"),
    ("BBC World", "world", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("Guardian World", "world", "https://www.theguardian.com/world/rss"),
    ("Carbon Brief", "energy", "https://www.carbonbrief.org/feed"),
    ("Euractiv Energy", "energy", "https://www.euractiv.com/sections/energy-environment/feed/"),
    ("Guardian Energy", "energy", "https://www.theguardian.com/environment/energy/rss"),
    ("Utility Dive", "energy", "https://www.utilitydive.com/feeds/news/"),
    ("World Nuclear News", "energy", "https://www.world-nuclear-news.org/rss"),
    ("IEEE Spectrum Energy", "energy", "https://spectrum.ieee.org/feeds/topic/energy.rss"),
    ("IEEE Spectrum", "sci", "https://spectrum.ieee.org/feeds/feed.rss"),
    ("Nature", "sci", "https://www.nature.com/nature.rss"),
    ("ScienceDaily", "sci", "https://www.sciencedaily.com/rss/top/science.xml"),
    ("Quanta", "sci", "https://www.quantamagazine.org/feed/"),
    ("Ars Technica", "sci", "https://feeds.arstechnica.com/arstechnica/science"),
]

ENERGY = re.compile(r"""\b(energ\w*|electric\w*|elektri\w*|elekter\w*|power\s?(grid|plant|station|line|price)s?|grid|
    nuclear|tuuma\w*|wind\s?(farm|power|turbine)s?|tuul(e|i)\w*park\w*|tuuleenergia|offshore\swind|solar|päikese\w*|
    photovolt\w*|battery|batteries|akupank\w*|hydrogen|vesinik\w*|renewable\w*|taastuv\w*|fossil|coal|gas\s?(price|pipeline)|
    lng|oil\s?shale|põlevkiv\w*|elering|eesti\senergia|enefit|nord\s?pool|estlink|balticconnector|desynchroni[sz]\w*|
    sünkroni\w*|transformer|substation|alajaam\w*|kilowatt\w*|megawatt\w*|gigawatt\w*|\bmw\b|\bgw\b|\btwh\b|\bmwh\b|
    heat\s?pump|soojuspump\w*|kaugkütte?\w*|interconnector|blackout|elektrikatkestus\w*|decarboni[sz]\w*|emission\w*|heitme\w*)""",
    re.I | re.X)

KEEP_DAYS = 4
PER_SOURCE = 30
MAX_ITEMS = 400
NS = {"media": "http://search.yahoo.com/mrss/", "atom": "http://www.w3.org/2005/Atom",
      "dc": "http://purl.org/dc/elements/1.1/", "content": "http://purl.org/rss/1.0/modules/content/",
      "rss1": "http://purl.org/rss/1.0/"}


def text(el):
    return (el.text or "").strip() if el is not None else ""


def clean(s, n=None):
    s = html.unescape(re.sub(r"<[^>]+>", " ", html.unescape(s or "")))
    s = re.sub(r"\s+", " ", s).strip()
    if n and len(s) > n:
        s = s[:n].rsplit(" ", 1)[0] + "…"
    return s


def when(s):
    if not s:
        return None
    try:
        return int(email.utils.parsedate_to_datetime(s).timestamp())
    except (TypeError, ValueError, IndexError):
        pass
    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())
    except ValueError:
        return None


def image(it):
    for path in ("media:content", "media:thumbnail", "media:group/media:content"):
        for m in it.findall(path, NS):
            u = m.get("url")
            if u and (m.get("medium") in (None, "image") or re.search(r"\.(jpe?g|png|webp)", u, re.I)):
                return u
    enc = it.find("enclosure")
    if enc is not None and (enc.get("type") or "").startswith("image"):
        return enc.get("url")
    m = re.search(r'<img[^>]+src="([^"]+)"', text(it.find("content:encoded", NS)) + text(it.find("description")))
    return m.group(1) if m else None


def parse(name, cat, raw):
    root = ET.fromstring(raw)
    items = root.findall(".//item") or root.findall(".//rss1:item", NS) or root.findall(".//atom:entry", NS)
    out = []
    for it in items:
        g = lambda tag: it.find(tag, NS)
        title = clean(text(g("title")) or text(g("rss1:title")) or text(g("atom:title")))
        link = text(g("link")) or text(g("rss1:link"))
        if not link and g("atom:link") is not None:
            alts = [l for l in it.findall("atom:link", NS) if l.get("rel") in (None, "alternate")]
            link = (alts or it.findall("atom:link", NS))[0].get("href", "")
        summ = clean(text(g("description")) or text(g("rss1:description")) or text(g("atom:summary"))
                     or text(g("atom:content")), 220)
        t = when(text(g("pubDate")) or text(g("dc:date")) or text(g("atom:published")) or text(g("atom:updated")))
        if not title or not link.startswith("http"):
            continue
        cats = [cat]
        if cat != "energy" and ENERGY.search(title + " " + summ):
            cats.append("energy")
        out.append({"id": hashlib.sha1(link.encode()).hexdigest()[:12], "t": title, "u": link, "s": name,
                    "c": cats, "d": t or int(time.time()), "x": summ, "img": image(it)})
    out.sort(key=lambda x: -x["d"])
    return out[:PER_SOURCE]


def fetch(feed):
    name, cat, url = feed
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (andris-app news; +https://github.com/Insenaarid/andris-app)"})
        with urllib.request.urlopen(req, timeout=20) as r:
            items = parse(name, cat, r.read())
        print(f"ok   {len(items):3} {name}")
        return items
    except Exception as e:  # üks katkine allikas ei tohi kõike peatada
        print(f"VIGA     {name}: {e}", file=sys.stderr)
        return []


def main(out_path):
    try:
        old = json.load(open(out_path)).get("items", [])
    except (FileNotFoundError, ValueError):
        old = []
    with ThreadPoolExecutor(8) as ex:
        fresh = [i for lst in ex.map(fetch, FEEDS) for i in lst]
    if not fresh:
        sys.exit("ühtegi allikat ei saanud kätte")
    cutoff = time.time() - KEEP_DAYS * 86400
    seen, titles, items = set(), set(), []
    for i in sorted(fresh + old, key=lambda x: -x["d"]):
        key = re.sub(r"\W+", "", i["t"].lower())[:60]
        if i["id"] in seen or key in titles or i["d"] < cutoff or i["d"] > time.time() + 3600:
            continue
        seen.add(i["id"]); titles.add(key); items.append(i)
    items = items[:MAX_ITEMS]
    json.dump({"generated": int(time.time()), "items": items}, open(out_path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"kirjutatud {out_path}: {len(items)} uudist")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "news.json"))
