import { runSchedules } from './lib/cron-schedule'

const main = async () => {
  await runSchedules()
}

main()
