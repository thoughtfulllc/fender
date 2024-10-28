import { dayjs } from './dayjs'
import { sendMessage } from './message'
import { openai } from './openai'
import { prisma } from './prisma'

export const runCron = async () => {
  const users = await prisma.user.findMany({
    // where active or whatever
  })

  for (const user of users) {
    const start = dayjs().add(user.utc_offset, 'hours').startOf('hour').toDate()
    const end = dayjs().add(user.utc_offset, 'hours').endOf('hour').toDate()

    console.log('start', start, end)

    const checkins = await prisma.checkin.findMany({
      where: {
        Goal: {
          user_id: user.id,
        },
        timestamp: {
          gte: start,
          lt: end,
        },
      },
      include: {
        Goal: true,
      },
    })

    const dayGoalCheckins = checkins.filter((checkin) => checkin.Goal.timeframe === 'day').map((checkin) => checkin.Goal.goal)

    const result = await openai.beta.chat.completions.stream({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Say good morning/afternoon/evening to the user and kindly remind them what their goals for today are.
              User's Time: ${dayjs().add(user.utc_offset, 'hours').format('YYYY-MM-DD HH:mm')}
              User's First Name: ${user.first_name}
              User's Goals: ${dayGoalCheckins.join('\n- ')},
            `,
        },
      ],
    })

    const message = await result.finalContent()

    if (!message) {
      console.error('No message returned')
      return
    }

    await openai.beta.threads.messages.create(user.openai_thread_id!, {
      role: 'assistant',
      content: message,
    })

    await sendMessage(user.id, message)

    await prisma.checkin.deleteMany({
      where: {
        id: {
          in: checkins.map((checkin) => checkin.id),
        },
      },
    })
  }
}
