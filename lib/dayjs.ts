import Dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import utc from 'dayjs/plugin/utc'

Dayjs.extend(quarterOfYear)
Dayjs.extend(utc)

export const dayjs = Dayjs
