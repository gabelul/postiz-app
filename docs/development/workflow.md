# Development Workflow

## Default Setup
- **Primary branch**: `private-main` (your private development)
- **Default pushes go to**: Private repository
- **Public fork**: Only used when contributing to upstream

## Daily Development Workflow

### 1. Normal Development (Private)
```bash
# You're already on private-main by default
git status                    # Shows: On branch private-main

# Make your changes
git add .
git commit -m "Your changes"
git push                      # Goes to private repository
```

### 2. Contributing to Upstream
When you want to contribute a feature back to the original project:

```bash
# 1. Sync main with upstream first
git checkout main
git pull upstream main
git push origin main

# 2. Create feature branch from clean main
git checkout -b feature/my-contribution

# 3. Make your changes
git add .
git commit -m "Add feature for upstream"

# 4. Push to public fork
git push origin feature/my-contribution

# 5. Create PR to gitroomhq/postiz-app
gh pr create --title "Add my feature" --body "Description"

# 6. Return to private development
git checkout private-main
```

## Branch Summary

| Branch | Purpose | Push Destination |
|--------|---------|------------------|
| `private-main` ⭐ | **Your default** - Private development | `private` repo |
| `main` | Clean upstream copy for PRs | `origin` (public fork) |
| `feature/*` | Contributions to upstream | `origin` (public fork) |

## Quick Commands

```bash
# Check which branch you're on
git branch

# Switch to private development (default)
git checkout private-main

# Switch to prepare upstream contribution
git checkout main

# Sync with upstream
./scripts/sync-upstream.sh full-sync
```