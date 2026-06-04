# Release notes

Versioned release notes for GitHub Releases. One file per tag:

```text
docs/releases/v0.1.0.md   →  tag v0.1.0
docs/releases/v0.2.0.md   →  tag v0.2.0
```

## Workflow

1. Add or update `docs/releases/vX.Y.Z.md` in a PR (user-facing changes, install notes, breaking changes).
2. Merge to `main`.
3. Tag and push:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

The [Release workflow](../../.github/workflows/release.yml) sets the GitHub Release body from the matching file. If the file is missing, the release job fails.

## File format

- Markdown body only (no YAML frontmatter required).
- Start with a one-line summary, then sections such as **Install**, **Highlights**, **Breaking changes**.
- Link to [`docs/roadmap.md`](../roadmap.md) for phase context when helpful.
