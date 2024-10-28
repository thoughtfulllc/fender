import { Thread } from 'openai/resources/beta/index.mjs'
import { openai } from './openai'

export type Tools = {
  [functionName: string]: (params: any) => Promise<any>
}

export type RunThreadParams = {
  thread: Thread
  message: string
  tools: Tools
  assistantId: string
  instructions?: string
  additionalInstructions?: string
}

/**
 * Given a new message for a thread, add the message, run the thread with the provided assistant and tools, and return the new response message from the assistant.
 */
export async function runThread({ thread, message, tools, assistantId, instructions, additionalInstructions }: RunThreadParams) {
  const runs = await openai.beta.threads.runs.list(thread.id)

  const activeRuns = runs.data.filter((run) => ['queued', 'in_progress', 'requires_action'].includes(run.status))

  if (activeRuns.length) {
    const activeRunCancelPromises = activeRuns.map(async (currentRun) => {
      await openai.beta.threads.runs.cancel(thread.id, currentRun.id)
    })
    await Promise.all(activeRunCancelPromises)
    // @todo it takes time to cancel runs, so we need to wait for it to finish canceling.
  }

  let x = await openai.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: assistantId,
    instructions,
    additional_instructions: additionalInstructions,
    // max_completion_tokens: 1000,
    // max_prompt_tokens: 1000,
    model: 'gpt-4o',
    additional_messages: [
      {
        role: 'user',
        content: message,
      },
    ],
  })

  while (x.required_action?.type === 'submit_tool_outputs') {
    const outputPromises = x.required_action.submit_tool_outputs.tool_calls.map(async (toolCall) => {
      const fn = tools[toolCall.function.name]
      if (!fn) throw new Error('Unknown tool call: ' + toolCall.function.name)

      const params = JSON.parse(toolCall.function.arguments)

      console.info(`Calling function "${toolCall.function.name}" with params: ${JSON.stringify(params, null, 2)}`)

      const result = fn(params)

      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify(result),
      }
    })

    const outputs = await Promise.all(outputPromises)

    x = await openai.beta.threads.runs.submitToolOutputsAndPoll(thread.id, x.id, {
      tool_outputs: outputs,
    })
  }

  const messages = await openai.beta.threads.messages.list(thread.id, {
    order: 'desc',
  })

  const lastMessage = (messages.data[0].content[0] as any).text.value

  return lastMessage
}
