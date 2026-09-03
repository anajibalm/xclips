# Quick start

## Example:

```typescript
const axios = require("axios");
let data = JSON.stringify({
  model: "claude-sonnet-5",
  messages: [
    {
      role: "user",
      content: "What is the weather like in Boston today?",
    },
  ],
  tools: [
    {
      name: "get_current_weather",
      description: "Get the current weather in a given location",
      input_schema: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. Boston, MA",
          },
        },
        required: ["location"],
      },
    },
  ],
  thinkingFlag: true,
  stream: false,
  max_tokens: 4096,
});

let config = {
  method: "post",
  maxBodyLength: Infinity,
  url: "https://api.kie.ai/claude/v1/messages",
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

const axios = require('axios');
let data = JSON.stringify({
"model": "claude-opus-4-8",
"messages": [
{
"role": "user",
"content": "What is the weather like in Boston today?"
}
],
"tools": [
{
"name": "get_current_weather",
"description": "Get the current weather in a given location",
"input_schema": {
"type": "object",
"properties": {
"location": {
"type": "string",
"description": "The city and state, e.g. Boston, MA"
}
},
"required": [
"location"
]
}
}
],
"thinkingFlag": true,
"stream": false,
"max_tokens": 4096
});

let config = {
method: 'post',
maxBodyLength: Infinity,
url: 'https://api.kie.ai/claude/v1/messages',
headers: {
'Authorization': 'Bearer <token>',
'Content-Type': 'application/json'
},
data : data
};

axios.request(config)
.then((response) => {
console.log(JSON.stringify(response.data));
})
.catch((error) => {
console.log(error);
});

# Model availability

- claude-sonnet-5
- claude-opus-4-8
