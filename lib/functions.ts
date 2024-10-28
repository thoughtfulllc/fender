import { Medium, ThreadMetadata, Timeframe } from '../types'
import { dayjs } from './dayjs'

import { openai } from './openai'
import { sendEmail } from './postmark'
import { prisma } from './prisma'
import { sendSms } from './textbelt'

export const getCurrentDate = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
  })
  return dayjs().utc().add(user.utc_offset, 'hours').format('YYYY-MM-DD')
}

export const getGoals = async (userId: string, timeframe: Timeframe, timeframeDate: string) => {
  console.log('Getting goals for ', timeframe, timeframeDate)
  return await prisma.goal.findMany({
    where: {
      user_id: userId,
    },
  })
}

export const setGoalStatus = async (userId: string, goalId: string, succeeded: boolean) => {
  console.log('Setting goal status', goalId)

  await prisma.goal.update({
    where: {
      id: goalId,
      user_id: userId,
    },
    data: {
      succeeded,
    },
  })
}

export const setGoals = async (userId: string, timeframe: Timeframe, timeframeDate: string, goals: string[]) => {
  console.log('Setting goals for ', timeframe, timeframeDate, goals)

  const day = dayjs(timeframeDate).utc().startOf(timeframe)

  await prisma.goal.deleteMany({
    where: {
      user_id: userId,
      timeframe,
      timeframe_date: day.toDate(),
    },
  })

  const goalObjects = await prisma.goal.createManyAndReturn({
    data: goals.map((goal) => ({
      user_id: userId,
      goal,
      timeframe,
      timeframe_date: day.toDate(),
    })),
  })
}

export const inviteUser = async (invitedByUserId: string, email: string, firstName: string) => {
  const invitedByUser = await prisma.user.findUniqueOrThrow({
    where: {
      id: invitedByUserId,
    },
  })

  const { thread } = await getOrCreateEmailThread(email)

  const message = `Hey ${firstName},
    
    ${invitedByUser.first_name} ${invitedByUser.last_name} asked me to reach out with an invite to join the Fender beta, which is currently invite-only.

    Fender is a tool for keeping your life on track by breaking big goals (like 5 year goals) into small goals (like daily goals) and tracking your progress.

    Atm, Fender is accessed mainly by messaging an AI agent that via email, though we're working on additional interfaces.

    If you're interested, no need to sign up - I just talk to you via email. Instead, just answer this question to get started:

    > What is your 5 year goal?
    `

  await openai.beta.threads.messages.create(thread.id, {
    role: 'assistant',
    content: message,
  })

  await sendEmail(thread, message, `Fender Beta Invite from ${invitedByUser.first_name} ${invitedByUser.last_name}`)
}

export const getThreadForUser = async (userId: string, medium?: Medium) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
    include: {
      PhoneNumber: true,
      EmailAddress: true,
    },
  })

  const effectiveMedium = medium || user.default_medium

  const threadId = effectiveMedium === 'email' ? user.EmailAddress[0]?.thread_id : user.PhoneNumber[0]?.thread_id

  if (!threadId) {
    throw new Error(`No thread found for user ${userId} for ${effectiveMedium}`)
  }

  return await openai.beta.threads.retrieve(threadId)
}

export const sendMessageOnDefaultThread = async (userId: string, message: string, medium?: Medium) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
  })

  const effectiveMedium = medium || (user.default_medium as Medium)

  const thread = await getThreadForUser(user.id, effectiveMedium)

  await openai.beta.threads.messages.create(thread.id, {
    role: 'assistant',
    content: message,
  })

  switch (effectiveMedium) {
    case 'sms': {
      await sendSms(thread, message)
      break
    }

    case 'email': {
      await sendEmail(thread, message)
      break
    }

    default:
      throw new Error('Unknown medium: ' + effectiveMedium)
  }
}

type SignupUserSystemParams = {
  phone?: string
  email?: string
}

type SignupUserParams = {
  firstName: string
  lastName: string
  utcOffset: number
  defaultMedium?: Medium
  discoveryMethod?: string
}

export const signupUser = async ({ phone, email }: SignupUserSystemParams, { firstName, lastName, utcOffset, defaultMedium = 'email', discoveryMethod }: SignupUserParams) => {
  const phoneNumber = phone ? await prisma.phoneNumber.findUnique({ where: { phone } }) : null

  if (phoneNumber && phoneNumber.user_id) {
    return {
      error: 'Phone number is already in use.',
    }
  }

  const emailAddress = email ? await prisma.emailAddress.findUnique({ where: { email } }) : null

  if (emailAddress && emailAddress.user_id) {
    return {
      error: 'Email address is already in use.',
    }
  }

  const user = await prisma.user.create({
    data: {
      first_name: firstName,
      last_name: lastName,
      utc_offset: utcOffset,
      default_medium: defaultMedium,
      discovery_method: discoveryMethod,
    },
  })

  if (phoneNumber) {
    await prisma.phoneNumber.update({
      data: {
        user_id: user.id,
      },
      where: {
        id: phoneNumber.id,
      },
    })
  }

  if (emailAddress) {
    await prisma.emailAddress.update({
      data: {
        user_id: user.id,
      },
      where: {
        id: emailAddress.id,
      },
    })
  }

  return user
}

export const getOrCreateSmsThread = async (phone: string) => {
  let phoneNumber = await prisma.phoneNumber.findUnique({
    where: {
      phone,
    },
  })

  if (phoneNumber) {
    return {
      phoneNumber,
      thread: await openai.beta.threads.retrieve(phoneNumber.thread_id),
    }
  }

  const thread = await openai.beta.threads.create()

  phoneNumber = await prisma.phoneNumber.create({
    data: {
      phone,
      thread_id: thread.id,
    },
  })

  return { phoneNumber, thread }
}

export const getOrCreateEmailThread = async (email: string) => {
  let emailAddress = await prisma.emailAddress.findUnique({
    where: {
      email,
    },
  })

  if (emailAddress) {
    return {
      emailAddress,
      thread: await openai.beta.threads.retrieve(emailAddress.thread_id),
    }
  }

  const thread = await openai.beta.threads.create({
    metadata: {
      medium: 'email',
      email,
    },
  })

  emailAddress = await prisma.emailAddress.create({
    data: {
      email,
      thread_id: thread.id,
    },
  })

  return { emailAddress, thread }
}

export const removeQuotedTextFromEmailText = (emailBody: string): string => {
  const quotedTextPattern = /On .*\n.* wrote:\n\n([\s\S]*)$/
  const cleanedEmailBody = emailBody.replace(quotedTextPattern, '')
  return cleanedEmailBody.trim()
}

export const getUserFromMetadata = async (metadata: ThreadMetadata) => {
  if (metadata.medium === 'sms') {
    const phoneNumber = await prisma.phoneNumber.findUniqueOrThrow({
      where: {
        phone: metadata.phone,
        user_id: {
          not: null,
        },
      },
    })

    return await prisma.user.findUniqueOrThrow({
      where: {
        id: phoneNumber.user_id!,
      },
    })
  }

  if (metadata.medium === 'email') {
    const emailAddress = await prisma.emailAddress.findUniqueOrThrow({
      where: {
        email: metadata.email,
        user_id: {
          not: null,
        },
      },
    })

    return await prisma.user.findUniqueOrThrow({
      where: {
        id: emailAddress.user_id!,
      },
    })
  }

  throw new Error('Unknown medium: ' + (metadata as any).medium)
}
