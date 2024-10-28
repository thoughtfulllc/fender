import { CronJob } from 'cron'
import Fastify from 'fastify'
import { runSchedules } from './lib/cron-schedule'
import { getOrCreateEmailThread, getOrCreateSmsThread, removeQuotedTextFromEmailText } from './lib/functions'
import { sendEmail } from './lib/postmark'
import { prisma } from './lib/prisma'
import { runAssistant } from './lib/run-assistant'
import { runSignupEmail } from './lib/run-signup-email'
import { sendSms } from './lib/textbelt'

async function main() {
  const fastify = Fastify({
    logger: true,
  })

  CronJob.from({
    cronTime: '0 * * * *',
    onTick: runSchedules,
    start: true,
    timeZone: 'UTC',
  })

  fastify.post('/webhooks/textbelt', async function handler(request, reply) {
    const { text: message, fromNumber: phone } = request.body as any

    const { thread, phoneNumber } = await getOrCreateSmsThread(phone)

    const user = phoneNumber.user_id
      ? await prisma.user.findUnique({
          where: {
            id: phoneNumber.user_id,
          },
        })
      : null

    if (!user) {
      const result = await runSignupEmail({ thread, message })
      await sendSms(thread, result)
    } else {
      const result = await runAssistant({ thread, message })
      await sendSms(thread, result)
    }

    return { ok: true }
  })

  fastify.post('/webhooks/postmark', async function handler(request, reply) {
    console.log('request', request.body)

    const {
      TextBody: body,
      From: email,
      FromName: name,
      Subject: subject,
      Headers: headers,
      Date: date,
    } = request.body as {
      TextBody: string
      From: string
      FromName: string
      Subject: string
      Date: string
      Headers: { Name: string; Value: string }[]
    }

    const message = removeQuotedTextFromEmailText(body)

    const { thread, emailAddress } = await getOrCreateEmailThread(email)

    const smtpMessageId = headers.find((header) => header.Name.toLocaleLowerCase() === 'Message-ID'.toLocaleLowerCase())?.Value

    await prisma.emailAddress.update({
      where: {
        id: emailAddress.id,
      },
      data: {
        smtp_message_id: smtpMessageId,
      },
    })

    const user = emailAddress.user_id
      ? await prisma.user.findUnique({
          where: {
            id: emailAddress.user_id,
          },
        })
      : null

    if (!user) {
      const result = await runSignupEmail({ thread, message: `Subject: ${subject}\n\n${message}`, name, date })
      await sendEmail(thread, result, subject)
    } else {
      const result = await runAssistant({ thread, message: `Subject: ${subject}\n\n${message}` })
      await sendEmail(thread, result, subject)
    }

    return { ok: true }
  })

  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    console.trace(err)
    process.exit(1)
  }
}

main()
