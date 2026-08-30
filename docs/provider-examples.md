# Provider Examples

This page contains copy-paste configuration examples for the FluentLoop Side Panel.

## OpenAI

```text
Provider: OpenAI
Base URL: https://api.openai.com/v1
Model: gpt-4o-mini
API Key: sk-...
```

Request shape:

```json
{
  "model": "gpt-4o-mini",
  "stream": true,
  "messages": [
    {
      "role": "user",
      "content": "Explain the selected text in plain language."
    }
  ]
}
```

## DeepSeek

```text
Provider: DeepSeek
Base URL: https://api.deepseek.com/v1
Model: deepseek-chat
API Key: sk-...
```

## Moonshot / Kimi

```text
Provider: Moonshot / Kimi
Base URL: https://api.moonshot.cn/v1
Model: moonshot-v1-8k
API Key: sk-...
```

## Zhipu GLM

```text
Provider: Zhipu GLM
Base URL: https://open.bigmodel.cn/api/paas/v4
Model: glm-4-plus
API Key: your-zhipu-api-key
```

## Doubao / Volcano Engine

```text
Provider: Doubao
Base URL: https://ark.cn-beijing.volces.com/api/v3
Model: doubao-seed-1-6-251015
API Key: your-volcano-api-key
```

Some Volcano Engine projects require an endpoint ID such as `ep-xxxxxxxx`. If your request fails, copy the model or endpoint ID from your console.

## Qwen / DashScope

```text
Provider: Qwen
Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
Model: qwen-plus
API Key: sk-...
```

## OpenRouter

```text
Provider: OpenRouter
Base URL: https://openrouter.ai/api/v1
Model: openai/gpt-4o-mini
API Key: sk-or-...
```

OpenRouter model names usually include the provider namespace, for example:

```text
anthropic/claude-3.5-sonnet
openai/gpt-4o-mini
google/gemini-flash-1.5
```

## Anthropic Claude

```text
Provider: Anthropic
Base URL: https://api.anthropic.com/v1
Model: claude-3-5-sonnet-20241022
API Key: sk-ant-...
```

FluentLoop uses the Anthropic Messages API with streaming enabled.

## Custom OpenAI-compatible Endpoint

Use this for local gateways, self-hosted proxies, or compatible model services:

```text
Provider: Custom
Base URL: https://your-endpoint.example.com/v1
Model: your-model-name
API Key: your-api-key
```

The endpoint must support:

```http
POST /chat/completions
```

and stream Server-Sent Events with `data:` lines compatible with OpenAI Chat Completions.

## System Prompt Examples

Concise explanation:

```text
Explain selected text in clear, concise English. Start with a one-sentence summary, then provide the key details.
```

Beginner-friendly:

```text
You are a patient teacher. Explain technical terms using simple language and short examples.
```

Translation-focused:

```text
When the selected text is not English, translate it first, then explain the meaning, tone, and context.
```
