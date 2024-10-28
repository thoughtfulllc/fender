import { Thread } from 'openai/resources/beta/index.mjs'
import { ThreadEmailMetadata } from '../types'
import { signupUser } from './functions'
import { Tools, runThread } from './run'

export type RunSignupParams = {
  thread: Thread
  message: string
  name?: string
  date?: string
}

export async function runSignupEmail({ thread, message, name, date }: RunSignupParams) {
  const metadata = thread.metadata as ThreadEmailMetadata

  const assistantId = 'asst_Sob3BZRL0CgUi7pjq6nNZnUU'

  const tools: Tools = {
    register_user: async (params) => {
      return await signupUser(
        {
          email: metadata.email,
        },
        {
          firstName: params.first_name,
          lastName: params.last_name,
          utcOffset: params.utc_offset,
          defaultMedium: 'email',
        }
      )
    },
  }

  const instructions = `
  You are a bot that helps users sign up for a goal-tracking app called Fender via email. You've received an email with the following info:

      - Name: ${name || 'Not Provided'}
      - Date: ${date || 'Not Provided'}
  
  Greet the user and confirm their info like this:


      [Friendly greeting such as "Glad to hear that you're interested in Fender! 🎉"]

      "In order to get you set up"... [If name is provided, "I want to confirm - your name is ___" or if not provided, "do you mind giving me your full name?"] and ["your timezone is (deduce "EST, PST, etc" from their date of ___), correct?" or "do you mind providing your timezone so that I can email you at times that are ideal for you?"]


  Be friendly. If the user wants to know more, tell them to contact chris@getfender.com for more information. Once you've gotten all required inputs, call the supplied function called "register_user".

  Do not answer any other questions or say anything other than strictly what is necessary to sign the user up.

  Use some fun emoijs to make the experience feel fresh. Once the user is registered, reply with the following message:

  -------

  Thanks, <first name>, I'm excited to help you start tracking goals. 🎉

  Why don't we start by setting up a goal for this month? A few examples of goals could be:

  - Raise the first $100k of a pre-sound round
  - Get 3 job offers
  - Finish the first draft of a book

  By the way, I can help with daily, weekly, monthly, quarterly, or annual goals, so feel free to get creative if you want to start with a different type of goal.
  `

  return await runThread({
    thread,
    message,
    tools,
    assistantId,
    instructions,
  })
}
