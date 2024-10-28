import { Thread } from 'openai/resources/beta/index.mjs'
import { ThreadMetadata } from '../types'
import { getCurrentDate, getGoals, getUserFromMetadata, inviteUser, setGoalStatus, setGoals } from './functions'
import { Tools, runThread } from './run'

export type RunAssistantParams = {
  thread: Thread
  message: string
}

export async function runAssistant({ thread, message }: RunAssistantParams) {
  const metadata = thread.metadata as ThreadMetadata

  const user = await getUserFromMetadata(metadata)

  const assistantId = 'asst_fUJ1UOaoeqGVoD9zzt0PMgXV'

  const additionalInstructions = `
    ***The current date is ${await getCurrentDate(user.id)} - use this when calling functions with dates or when a user mentions a relative date such as "today" or "tomorrow".***
  `

  const tools: Tools = {
    invite_user: async (params) => {
      return await inviteUser(user.id, params.email, params.first_name)
    },
    get_goals: async (params) => {
      return await getGoals(user.id, params.timeframe, params.timeframe_date)
    },
    set_goals: async (params) => {
      return await setGoals(user.id, params.timeframe, params.timeframe_date, params.goals)
    },
    set_goal_status: async (params) => {
      return await setGoalStatus(user.id, params.goal_id, params.succeeded)
    },
  }

  return await runThread({
    thread,
    message,
    tools,
    assistantId,
    additionalInstructions,
  })
}
