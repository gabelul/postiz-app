## Code Quality and Documentation Standards

  ### Code Comments Requirements
  - Please comment the code you create, functions and everything so it makes it easy to understand the code, what it does etc.
  - Add JSDoc-style comments for all functions explaining parameters, return values, and purpose
  - Include inline comments for complex logic or business rules
  - Document component props and their purposes
  - Explain any non-obvious algorithms or calculations

  ### Code Style Preferences
  - Use descriptive variable and function names
  - Prefer explicit code over clever one-liners
  - Add TODO comments for future improvements
  - Document any workarounds or temporary solutions

  ### Function Documentation Template
  ```typescript
  /**
   * Brief description of what the function does
   * @param paramName - Description of parameter
   * @returns Description of return value
   */

  Additional Memory Tips:

  You could also add related preferences like:
  - Error Handling: How you prefer errors to be handled
  - Testing: Whether you want tests written for new functions
  - Performance: Any specific performance considerations
  - Accessibility: ARIA labels, screen reader support requirements
  - TypeScript: Strict typing preferences

## Fork Management Commands

### Sync Upstream Script Usage
When working with forked repositories that have both public and private versions:

```bash
# Check configuration
./scripts/sync-upstream.sh check

# Full sync workflow (recommended)
./scripts/sync-upstream.sh full-sync

# Individual commands
./scripts/sync-upstream.sh fetch           # Fetch from all remotes
./scripts/sync-upstream.sh sync-public     # Sync public fork with upstream
./scripts/sync-upstream.sh show-diff       # Show differences between upstream and private
./scripts/sync-upstream.sh merge-private   # Merge upstream changes to private branch
```

### Typical Workflow
1. `./scripts/sync-upstream.sh full-sync` - Check for upstream updates and show differences
2. Review the differences shown
3. `./scripts/sync-upstream.sh merge-private` - Merge upstream changes to private version (if desired)

## Development Workflow

### Default Development (Private Repository)
Your primary development branch is `private-main` and pushes go to the private repository by default:

```bash
# Normal development workflow
git status                    # Shows: On branch private-main
git add .
git commit -m "Your changes"
git push                      # Goes to private repository automatically
```

### Contributing to Upstream
When you want to contribute a feature back to the original gitroomhq/postiz-app project:

```bash
# 1. Switch to main branch and sync with upstream
git checkout main
git pull upstream main
git push origin main

# 2. Create feature branch from clean main
git checkout -b feature/my-contribution

# 3. Make your changes for upstream contribution
git add .
git commit -m "Add feature for upstream"

# 4. Push to your public fork
git push origin feature/my-contribution

# 5. Create PR to gitroomhq/postiz-app
gh pr create --title "Add my feature" --body "Description of the feature"

# 6. Return to private development
git checkout private-main
```

### Branch Usage Summary
- **`private-main`** ⭐ - Your default branch for private development
- **`main`** - Clean upstream copy, used only for creating PRs to original project
- **`feature/*`** - Feature branches for upstream contributions (branch from `main`)