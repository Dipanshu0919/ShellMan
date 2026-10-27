#!/usr/bin/env bash
# Rewrites the message of all 24 commits on main (original hashes). Local only, nothing is pushed.
# Run with a clean tree:  git stash push -m wip && ./reword_commit.sh && git stash pop
set -euo pipefail

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Uncommitted changes found. Run: git stash push -m wip   (then git stash pop afterwards)"; exit 1
fi

# Start from the ORIGINAL history: the backup branch from the first run, else origin/main.
if git rev-parse --verify -q backup-before-reword >/dev/null; then SRC=backup-before-reword; else SRC=origin/main; fi
git checkout -q -B main "$SRC"
git branch -f backup-before-reword "$SRC"

cat > /tmp/msg-filter.sh <<'FILTER'
#!/usr/bin/env bash
case "${GIT_COMMIT:0:7}" in
07cf822) echo "Add the MIT license for ShellMan" ;;
942d7bd) echo "Build the initial ShellMan remote Linux management workspace with SSH, SFTP, terminal, monitoring, and desktop interface" ;;
4c1d439) echo "Remove the existing application test suite" ;;
836eb4b) echo "Add a screenshot of the ShellMan terminal interface" ;;
a6dd802) echo "Add Nginx and SSL management, custom server actions, enhanced process monitoring, and desktop workspace improvements" ;;
8267bc6) echo "Document Nginx reverse-proxy management, automated Let's Encrypt certificates, and the desktop application dock" ;;
f5bca5d) echo "Secure stored server credentials with per-installation encryption keys and improve startup logging, SSH sessions, and account initialization" ;;
51eee12) echo "Remove the obsolete migration module after moving server encryption and model logic into the application" ;;
44605e0) echo "Validate SSH terminal dimensions and improve code-workspace terminal resizing and focus handling" ;;
4c1316a) echo "Add two-factor authentication, visual cron scheduling, Git deployment, rsync synchronization, and desktop window snapping" ;;
3d1f3a3) echo "Implement Cloudflare domain and DNS management with encrypted credentials and add live network connection monitoring" ;;
d5795e1) echo "Document Cloudflare Origin CA certificate installation, edge-cache purging, and additional security controls" ;;
bee1860) echo "Add remote Docker management, database explorers and backups, firewall controls, and SSH connection diagnostics" ;;
5f33daa) echo "Add Docker and Compose deployment with persistent storage, health checks, terminal themes, and updated setup documentation" ;;
02311d2) echo "Add live progress tracking for file operations, improve SSH and SFTP session handling, and modularize desktop applications" ;;
d5c96aa) echo "Improve file-operation progress reporting and add a compressed ZIP fallback for remote servers" ;;
dcbb216) echo "Remove the temporary file manager patch script" ;;
e028678) echo "Redesign desktop windows with glass effects and refine the premium theme, typography, and application styling" ;;
1644363) echo "Add automatic static asset cache busting, persistent accent colors, dock animations, and loading skeletons" ;;
24b1e0d) echo "Serialize SSH terminal WebSocket writes and refine desktop window, dock, and icon styling" ;;
cee129d) echo "Standardize the application and Docker port on 9874 and support configurable large uploads with clear error responses" ;;
0d9b6ca) echo "Add .gitignore-aware exclusions to local and remote rsync operations" ;;
8e7ebaa) echo "Improve responsive desktop layouts, icon wrapping, widget scrolling, and 8K wallpaper presentation" ;;
f073232) echo "Document desktop and dock customization, terminal themes, hardware widgets, archive exclusions, and cancellable operations" ;;
*) cat ;;
esac
FILTER
chmod +x /tmp/msg-filter.sh

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter /tmp/msg-filter.sh main
echo; git log --format='%h %s' main
echo; echo "Publish yourself:  git push --force-with-lease origin main"
echo "Undo: git reset --hard backup-before-reword"