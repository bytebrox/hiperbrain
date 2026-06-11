# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

When you make a change to `@hiperbrain/core` that should be released, add a
changeset describing it:

```bash
npm run changeset
```

Pick the bump type (patch / minor / major) and write a short summary. On the
next push to `main`, the release workflow opens (or updates) a "Version
Packages" PR; merging that PR publishes the new version to npm.

The private web app (`hiperbrain`) is ignored and never published.
