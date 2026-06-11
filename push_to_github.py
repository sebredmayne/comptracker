"""
push_to_github.py
-----------------
Pushes every file in this folder to https://github.com/sebredmayne/competitor-tracker
via the GitHub API — no git installation needed.

HOW TO RUN:
  1. Get a GitHub Personal Access Token:
       github.com → Settings → Developer Settings
       → Personal access tokens → Tokens (classic)
       → Generate new token → tick "repo" → copy it

  2. Run this script:
       python3 push_to_github.py

  3. Paste your token when prompted. That's it.
"""

import os, base64, json, urllib.request, urllib.error, getpass, sys

REPO   = "sebredmayne/competitor-tracker"
BRANCH = "main"
API    = "https://api.github.com"

# Files to skip
SKIP_DIRS  = {"node_modules", "dist", ".git", "__pycache__", "data"}
SKIP_FILES = {".DS_Store", "push_to_github.py"}
SKIP_EXTS  = {".db", ".db-shm", ".db-wal", ".log", ".pyc"}

def get_token():
    print("\n🔑 GitHub Personal Access Token needed.")
    print("   Get one at: github.com → Settings → Developer Settings → Personal access tokens → Tokens (classic)")
    print("   Tick the 'repo' checkbox when creating it.\n")
    token = getpass.getpass("   Paste token (hidden): ").strip()
    if not token:
        print("No token entered. Exiting.")
        sys.exit(1)
    return token

def api_request(path, token, method="GET", body=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "competitor-tracker-push",
    })
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return json.loads(body) if body else {}, e.code

def get_file_sha(path, token):
    res, status = api_request(f"/repos/{REPO}/contents/{path}?ref={BRANCH}", token)
    return res.get("sha") if status == 200 else None

def push_file(local_path, repo_path, token):
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    sha = get_file_sha(repo_path, token)
    body = {
        "message": f"chore: add {repo_path}",
        "content": content,
        "branch": BRANCH,
    }
    if sha:
        body["sha"] = sha  # required for updates
    res, status = api_request(f"/repos/{REPO}/contents/{repo_path}", token, method="PUT", body=body)
    return status in (200, 201)

def collect_files(root):
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Skip unwanted dirs in-place
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fname in filenames:
            if fname in SKIP_FILES:
                continue
            _, ext = os.path.splitext(fname)
            if ext in SKIP_EXTS:
                continue
            full = os.path.join(dirpath, fname)
            rel  = os.path.relpath(full, root).replace("\\", "/")
            files.append((full, rel))
    return files

def main():
    root  = os.path.dirname(os.path.abspath(__file__))
    token = get_token()

    # Verify token works
    me, status = api_request("/user", token)
    if status != 200:
        print(f"\n❌ Token invalid or no access (status {status}). Check it and try again.")
        sys.exit(1)
    print(f"\n✅ Logged in as: {me.get('login')}")

    # Verify repo access
    repo, status = api_request(f"/repos/{REPO}", token)
    if status != 200:
        print(f"\n❌ Can't access repo {REPO} (status {status}). Make sure the repo exists and the token has 'repo' scope.")
        sys.exit(1)
    print(f"✅ Repo found: {repo.get('full_name')}\n")

    files = collect_files(root)
    print(f"📁 Pushing {len(files)} files to github.com/{REPO} ...\n")

    ok, fail = 0, 0
    for i, (local, repo_path) in enumerate(files, 1):
        label = repo_path[:60].ljust(60)
        print(f"  [{i:02d}/{len(files)}] {label}", end=" ", flush=True)
        try:
            success = push_file(local, repo_path, token)
            if success:
                print("✅")
                ok += 1
            else:
                print("❌ failed")
                fail += 1
        except Exception as e:
            print(f"❌ error: {e}")
            fail += 1

    print(f"\n{'='*50}")
    print(f"✅ {ok} files pushed successfully")
    if fail:
        print(f"❌ {fail} files failed")
    print(f"\n🚀 Repo: https://github.com/{REPO}")
    print(f"\nNext steps:")
    print(f"  1. Clone it:  git clone https://github.com/{REPO}.git")
    print(f"  2. Install:   npm run install:all")
    print(f"  3. Set keys:  cp .env.example .env  (then edit .env)")
    print(f"  4. Run it:    npm run dev")
    print(f"  5. Open:      http://localhost:5173\n")

if __name__ == "__main__":
    main()
