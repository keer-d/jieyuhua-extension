# Contributing to Jieyuhua

Thanks for your interest in improving Jieyuhua. This project is intentionally small: plain Chrome Extension APIs, no build system, and no project-owned backend.

## Ways to Contribute

- Fix bugs in selection handling, streaming, or provider requests
- Improve provider presets and error messages
- Add documentation and usage examples
- Improve accessibility of the inline bubble and Side Panel
- Test the extension across websites and Chrome versions

## Development Setup

1. Fork the repository.
2. Clone your fork.
3. Open `chrome://extensions/`.
4. Enable `Developer mode`.
5. Click `Load unpacked` and select the repository folder.
6. Edit files locally, reload the extension, and refresh the test webpage.

```bash
git clone https://github.com/YOUR_USERNAME/jieyuhua-extension.git
cd jieyuhua-extension
```

## Branches

Use short descriptive branches:

```bash
git checkout -b fix/stream-timeout-message
git checkout -b docs/provider-examples
git checkout -b feat/keyboard-shortcut
```

## Commit Style

Prefer concise Conventional Commit-style messages:

```bash
fix(content): keep bubble inside viewport
docs(readme): add custom endpoint example
feat(provider): add new OpenAI-compatible preset
```

Common prefixes:

- `feat`: new user-facing feature
- `fix`: bug fix
- `docs`: documentation only
- `style`: formatting or visual polish
- `refactor`: code cleanup without behavior change
- `chore`: repository maintenance

## Pull Request Checklist

Before opening a pull request:

- Reload the extension in `chrome://extensions/`.
- Refresh the target webpage and test selection again.
- Test at least one provider request, or clearly state that provider calls were not tested.
- Confirm no real API keys, logs, screenshots with private data, or packaged zip files are committed.
- Update README or docs when behavior changes.

## Manual Test Plan

Use this checklist for most changes:

1. Load the extension unpacked.
2. Open a normal webpage.
3. Select text and verify the camellia button appears.
4. Click the button and verify the inline bubble opens.
5. Send a follow-up question.
6. Open the Side Panel and save settings.
7. Refresh the webpage and test again.

## Security and Privacy

Do not open public issues containing API keys, tokens, private documents, or sensitive browsing content. See [PRIVACY.md](./PRIVACY.md) for data handling details.
