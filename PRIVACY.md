# Privacy Policy

FluentLoop is a local Chrome extension. The project does not run its own backend server and does not include analytics, tracking, advertising, or telemetry scripts.

## Data Stored Locally

The extension uses `chrome.storage.local` to store configuration in your browser:

- AI provider
- API key
- Model name
- Base URL
- Optional system prompt
- Short-lived selected text payloads used to open the Side Panel flow

These values are not sent to the project maintainers.

## Data Sent to AI Providers

When you use inline explanation, follow-up questions, or Side Panel chat, the extension sends the following data to the provider you configured:

- Selected webpage text
- Your prompt or follow-up message
- Current conversation context
- API key or provider-specific authentication headers

You should only use providers you trust. Do not send sensitive, private, or regulated data unless you understand the provider's data handling policy.

## Permissions

The extension injects a content script to show the selection button and inline explanation bubble. It also needs host permissions to call AI provider APIs.

The wildcard host permission `https://*/*` exists to support custom OpenAI-compatible endpoints. If you do not need custom endpoints, you can remove this permission from `manifest.json` and keep only the provider domains you use.

## Contact

Please report privacy or security concerns through GitHub Issues, or contact the repository maintainer privately if the issue should not be public.
