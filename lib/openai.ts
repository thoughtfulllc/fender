import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
  organization: process.env.OPEN_AI_ORGANIZATION,
  defaultHeaders: {
    'OpenAI-Beta': 'assistants=v2',
  },
})
