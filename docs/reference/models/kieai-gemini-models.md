# Quick start

## Example request (gemini):

```typescript
const axios = require("axios");
let data = JSON.stringify({
  stream: true,
  contents: [
    {
      role: "user",
      parts: [
        {
          text: "What is the weather in Beijing today?",
        },
      ],
    },
  ],
  tools: [
    {
      functionDeclarations: [
        {
          name: "get_weather_forecast",
          description: "Get the weather forecast for a given location",
          parameters: {
            type: "OBJECT",
            properties: {
              location: {
                type: "STRING",
                description: "The city name, e.g. Beijing",
              },
            },
            required: ["location"],
          },
        },
      ],
    },
  ],
  generationConfig: {
    thinkingConfig: {
      includeThoughts: true,
      thinkingLevel: "high",
    },
  },
});

let config = {
  method: "post",
  maxBodyLength: Infinity,
  url: "https://api.kie.ai/gemini/v1/models/gemini-3-7-flash:streamGenerateContent",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  data: data,
};

axios
  .request(config)
  .then((response) => {
    console.log(JSON.stringify(response.data));
  })
  .catch((error) => {
    console.log(error);
  });
```

## Example request (openai chat-completion):

```typescript
const axios = require("axios");
let data = JSON.stringify({
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "What is in this image?",
        },
        {
          type: "image_url",
          image_url: {
            url: "https://file.aiquickdraw.com/custom-page/akr/section-images/1759055072437dqlsclj2.png",
          },
        },
      ],
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "googleSearch",
      },
    },
  ],
  stream: true,
  include_thoughts: true,
  reasoning_effort: "high",
});

let config = {
  method: "post",
  maxBodyLength: Infinity,
  url: "https://api.kie.ai/gemini-3-7-flash-openai/v1/chat/completions",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  data: data,
};

axios
  .request(config)
  .then((response) => {
    console.log(JSON.stringify(response.data));
  })
  .catch((error) => {
    console.log(error);
  });
```

## example gemini 3.6 flash

```typescript
const axios = require("axios");
let data = JSON.stringify({
  stream: true,
  contents: [
    {
      role: "user",
      parts: [
        {
          text: "What is the weather in Beijing today?",
        },
      ],
    },
  ],
  tools: [
    {
      functionDeclarations: [
        {
          name: "get_weather_forecast",
          description: "Get the weather forecast for a given location",
          parameters: {
            type: "OBJECT",
            properties: {
              location: {
                type: "STRING",
                description: "The city name, e.g. Beijing",
              },
            },
            required: ["location"],
          },
        },
      ],
    },
  ],
  generationConfig: {
    thinkingConfig: {
      includeThoughts: true,
      thinkingLevel: "high",
    },
  },
});

let config = {
  method: "post",
  maxBodyLength: Infinity,
  url: "https://api.kie.ai/gemini/v1/models/gemini-3-6-flash:streamGenerateContent",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  data: data,
};

axios
  .request(config)
  .then((response) => {
    console.log(JSON.stringify(response.data));
  })
  .catch((error) => {
    console.log(error);
  });
```

# Model availability

- gemini-3.7-flash
- gemini-3.7-flash-openai (priority)
- gemini-3.6-flash
- gemini-3.6-flash-openai (priority)
