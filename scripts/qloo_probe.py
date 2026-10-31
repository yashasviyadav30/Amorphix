"""Query the Qloo hackathon API. Reads QLOO_API_KEY from the environment.

Example:
    python scripts/qloo_probe.py /search query="West Elm" take=3
"""
import json, os, sys, urllib.error, urllib.parse, urllib.request

BASE = os.environ.get("QLOO_BASE_URL", "https://hackathon.api.qloo.com")


def get(path, **params):
    url = f"{BASE}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"X-Api-Key": os.environ["QLOO_API_KEY"]})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()[:400]}


if __name__ == "__main__":
    path, *pairs = sys.argv[1:]
    print(json.dumps(get(path, **dict(p.split("=", 1) for p in pairs)), indent=2)[:4000])
