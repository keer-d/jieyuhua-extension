# Development Guide

Jieyuhua is a Manifest V3 Chrome extension written with plain HTML, CSS, and JavaScript. There is no bundler, package manager, or build step.

## Local Workflow

1. Edit source files.
2. Go to `chrome://extensions/`.
3. Click the reload button on Jieyuhua.
4. Refresh any webpage that was already open.
5. Test selection and streaming again.

## Debugging

### Background Service Worker

1. Open `chrome://extensions/`.
2. Find Jieyuhua.
3. Click `service worker`.
4. Use the DevTools console to inspect provider request errors.

### Content Script

1. Open the target webpage.
2. Open DevTools.
3. Inspect the page and test text selection.
4. Refresh the page after reloading the extension.

### Side Panel

1. Open the extension Side Panel.
2. Right-click the Side Panel and choose `Inspect`.
3. Test settings persistence and manual chat.

## Main Files

| File | Responsibility |
| --- | --- |
| `manifest.json` | Chrome extension metadata, permissions, content scripts, icons |
| `background.js` | Service worker, context menu, settings loading, streaming provider calls |
| `content.js` | Selection detection, floating button, inline bubble, follow-up questions |
| `sidepanel.html` | Side Panel markup |
| `sidepanel.css` | Side Panel styling |
| `sidepanel.js` | Settings form, manual chat, provider calls from the panel |

## Provider Request Flow

```text
content.js
  -> chrome.runtime.connect("explain-stream")
  -> background.js
  -> configured provider API
  -> streaming chunks
  -> content.js inline bubble
```

Side Panel chat can call providers directly from `sidepanel.js`.

## Adding a Provider Preset

Add the provider to both `background.js` and `sidepanel.js`:

```javascript
const PRESETS = {
  myprovider: {
    baseUrl: "https://api.myprovider.example/v1",
    model: "my-default-model",
    format: "openai"
  }
};
```

Then add the option in `sidepanel.html`:

```html
<option value="myprovider">My Provider</option>
```

If the provider is not OpenAI-compatible, add a dedicated streaming function and route it from `streamChat`.

## Packaging

For a source release, upload the repository files directly.

For a Chrome Web Store package, zip the extension folder while excluding repository metadata and local files:

```bash
zip -r jieyuhua-extension.zip . \
  -x ".git/*" \
  -x ".DS_Store" \
  -x "*.log" \
  -x ".env*" \
  -x "node_modules/*"
```

## Pre-release Checklist

- `manifest.json` parses correctly.
- `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png` exist.
- No real API keys are committed.
- README, privacy policy, and provider examples match the current code.
- The extension loads successfully from `chrome://extensions/`.
