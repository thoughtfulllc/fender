import { Thread } from 'openai/resources/beta/index.mjs'
import { ServerClient } from 'postmark'
import { ThreadEmailMetadata } from '../types'
import { prisma } from './prisma'

export const postmark = new ServerClient(process.env.POSTMARK_SERVER_TOKEN)

export const sendEmail = async (thread: Thread, message: string, subject: string = 'Fender') => {
  const metadata = thread.metadata as ThreadEmailMetadata

  const emailAddress = await prisma.emailAddress.findUniqueOrThrow({
    where: {
      email: metadata.email,
    },
  })

  await postmark.sendEmail({
    From: process.env.EMAIL_FROM,
    To: emailAddress.email,
    Subject: subject,
    TextBody: message,
    Headers: emailAddress.smtp_message_id
      ? [
          { Name: 'In-Reply-To', Value: emailAddress.smtp_message_id },
          { Name: 'References', Value: emailAddress.smtp_message_id },
        ]
      : [],
  })
}
