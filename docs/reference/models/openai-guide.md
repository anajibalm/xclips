# Quick start

Example request

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.responses.create({
  model: "gpt-5.6-luna",
  input: [],
  text: {
    format: {
      type: "text",
    },
    verbosity: "medium",
  },
  reasoning: {
    effort: "medium",
    mode: "standard",
    summary: "auto",
  },
  tools: [],
  store: true,
  include: ["reasoning.encrypted_content", "web_search_call.action.sources"],
});
```

# Model availability

- gpt-5.6-luna
- gpt-5.6-terra
- gpt-5.6-sol
- gpt-transcribe
- gpt-image-2-2026-04-21
- whisper-1
