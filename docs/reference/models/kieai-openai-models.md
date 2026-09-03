# Quick start

## Example:

```typescript
const axios = require("axios");
let data = JSON.stringify({
  model: "gpt-5-6-luna",
  input: [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "What is in this image?",
        },
        {
          type: "input_image",
          image_url:
            "https://file.aiquickdraw.com/custom-page/akr/section-images/1759055072437dqlsclj2.png",
        },
      ],
    },
  ],
  tools: [
    {
      type: "web_search",
    },
  ],
  reasoning: {
    effort: "high",
  },
});

let config = {
  method: "post",
  maxBodyLength: Infinity,
  url: "https://api.kie.ai/codex/v1/responses",
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

## Example gpt image 2 - text to image

```typescript
const axios = require("axios");
let data = JSON.stringify({
  model: "gpt-image-2-text-to-image",
  callBackUrl: "https://your-domain.com/api/callback",
  input: {
    prompt:
      "A cinematic night city poster with neon reflections on a rainy street.",
    aspect_ratio: "auto",
  },
});

let config = {
  method: "post",
  maxBodyLength: Infinity,
  url: "https://api.kie.ai/api/v1/jobs/createTask",
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

## Example gpt image 2 - image to image

```typescript
const axios = require("axios");
let data = JSON.stringify({
  model: "gpt-image-2-image-to-image",
  callBackUrl: "https://your-domain.com/api/callback",
  input: {
    prompt: "take a photo with Sam Altman in the conference room",
    input_urls: [
      "https://static.aiquickdraw.com/tools/example/1776782793756_wrogXTdd.png",
    ],
    aspect_ratio: "auto",
  },
});

let config = {
  method: "post",
  maxBodyLength: Infinity,
  url: "https://api.kie.ai/api/v1/jobs/createTask",
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

- gpt-5-6-luna
- gpt-5-6-terra
- gpt-5-6-sol
- gpt-image-2-image-to-image
- gpt-image-2-text-to-image
