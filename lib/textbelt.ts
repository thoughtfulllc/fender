import { Thread } from 'openai/resources/beta/index.mjs'
import { ThreadSmsMetadata } from '../types'
import { prisma } from './prisma'

export const sendSms = async (thread: Thread, message: string) => {
  const metadata = thread.metadata as ThreadSmsMetadata

  const phoneNumber = await prisma.phoneNumber.findUniqueOrThrow({
    where: {
      phone: metadata.phone,
    },
  })

  await fetch('https://textbelt.com/text', {
    method: 'POST',
    body: JSON.stringify({
      phone: phoneNumber.phone.replace(/^\+1/g, ''),
      message,
      replyWebhookUrl: `${process.env.BASE_URL}/webhooks/textbelt`,
      key: process.env.TEXTBELT_API_KEY,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
