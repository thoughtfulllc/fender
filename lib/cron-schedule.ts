import { Goal, Schedule, User } from '@prisma/client'
import { dayjs } from './dayjs'
import { sendMessageOnDefaultThread as createAndSendMessageOnDefaultThread } from './functions'
import { openai } from './openai'
import { prisma } from './prisma'

type MessageParams = {
  user: User
  goals: Goal[]
  schedule: Schedule
}

export const generateDefaultCompletion = async ({ message, model = 'gpt-4o' }: { message: string; model?: string }) => {
  const result = await openai.beta.chat.completions.stream({
    model,
    messages: [
      {
        role: 'system',
        content: message,
      },
    ],
  })

  const content = await result.finalContent()

  if (!content) {
    console.error('No message returned')
    return 'Sorry, I had a brain fart, try again soon.'
  }

  return content
}

const greetingPrompt = `Say good morning/afternoon/evening to the user using a unique greeting and use a an appropriate and fun emoji.`
const tonePrompt = ` If you there are multiple relevant goals, list them in a numbered list, otherwise just describe the goal in a sentence. If a goal has already been completed, list it as (already completed). Be concise and friendly. Do not comment on their goals or add any additional information or offers.`

export const generateMessageForDayStartWithGoals = async ({ user, goals, schedule }: MessageParams) => {
  return generateDefaultCompletion({
    message: `
      ${greetingPrompt}
      
      Please list the user's goals for today.

      User's Time: ${dayjs().add(user.utc_offset, 'hours').format('YYYY-MM-DD HH:mm')}
      User's First Name: ${user.first_name}
      User's Goals: ${JSON.stringify(goals)}

      ${tonePrompt}
    `,
  })
}

export const generateMessageForDayStartWithoutGoals = async ({ user, goals, schedule }: MessageParams) => {
  return generateDefaultCompletion({
    message: `${greetingPrompt}.
    
      Kindly notify them that they have not set any goals today and ask if they would like to set one.

      User's Time: ${dayjs().add(user.utc_offset, 'hours').format('YYYY-MM-DD HH:mm')}
      User's First Name: ${user.first_name}
    
      ${tonePrompt}
    `,
  })
}

export const generateMessageForDayUpdate = async ({ user, goals, schedule }: MessageParams) => {
  return generateDefaultCompletion({
    message: `
      ${greetingPrompt}

      Kindly remind them what their remaining goals for today are and then ask them if they are still on track to get the goal done today.

      User's Time: ${dayjs().add(user.utc_offset, 'hours').format('YYYY-MM-DD HH:mm')}
      User's First Name: ${user.first_name}
      User's Goals: ${JSON.stringify(goals.filter((goal) => !goal.succeeded))}
          
      ${tonePrompt}
    `,
  })
}

export const generateMessageForDayEnd = async ({ user, goals, schedule }: MessageParams) => {
  return generateDefaultCompletion({
    message: `
      ${greetingPrompt}

      Kindly remind the user of their remaining goals for today and ask them if they were able to complete them. If they were not able to complete them, ask them if they would like to add the uncompleted goals to their list for tomorrow.

      User's Time: ${dayjs().add(user.utc_offset, 'hours').format('YYYY-MM-DD HH:mm')}
      User's First Name: ${user.first_name}
      User's Goals: ${JSON.stringify(goals)}

      ${tonePrompt}
    `,
  })
}

export const generateMessage = async ({ user, goals, schedule }: MessageParams) => {
  switch (`${schedule.timeframe}-${schedule.type}`) {
    case 'day-start': {
      if (goals.length > 0) {
        return generateMessageForDayStartWithGoals({ user, goals, schedule })
      } else {
        return generateMessageForDayStartWithoutGoals({ user, goals, schedule })
      }
    }
    case 'day-update': {
      if (goals.filter((g) => !g.succeeded).length > 0) {
        return generateMessageForDayUpdate({ user, goals, schedule })
      }
    }
    case 'day-end': {
      if (goals.filter((g) => !g.succeeded).length > 0) {
        return generateMessageForDayEnd({ user, goals, schedule })
      }
    }
  }
}

export const runSchedule = async (scheduleId: string) => {
  const schedule = await prisma.schedule.findUniqueOrThrow({
    where: {
      id: scheduleId,
    },
    include: {
      User: true,
    },
  })

  const user = schedule.User

  const goals = await prisma.goal.findMany({
    where: {
      user_id: user.id,
      timeframe_date: dayjs().utc().add(user.utc_offset, 'hours').startOf('day').toDate(),
    },
  })

  const message = await generateMessage({ user, goals, schedule })

  if (!message) {
    return
  }

  await createAndSendMessageOnDefaultThread(user.id, message)
}

export const runSchedules = async () => {
  const schedules = await prisma.schedule.findMany({
    where: {
      utc_time: {
        gte: dayjs().utc().startOf('hour').toDate(),
        lt: dayjs().utc().endOf('hour').toDate(),
      },
      is_enabled: true,
    },
  })

  console.log('Running scheduler', schedules.length, 'schedules')

  for (const schedule of schedules) {
    await runSchedule(schedule.id)
  }
}
