# Quickstart

## Example

```typescript
import Anthropic from "@anthropic-ai/sdk";

// uses ANTHROPIC_API_KEY or credentials from `ant auth login`
const anthropic = new Anthropic();

const stream = anthropic.messages.stream({
  model: "claude-sonnet-5",
  max_tokens: 20000,
  messages: [],
});

for await (const chunk of stream) {
  if (
    chunk.type === "content_block_delta" &&
    chunk.delta.type === "text_delta"
  ) {
    process.stdout.write(chunk.delta.text);
  }
}
```

```python
import anthropic

# uses ANTHROPIC_API_KEY or credentials from `ant auth login`
client = anthropic.Anthropic()

with client.messages.stream(
    model="claude-sonnet-5",
    max_tokens=20000,
    messages=[],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

## Model availability

- claude-fable-5
- claude-sonnet-5
- claude-opus-5
- claude-haiku-4.5
