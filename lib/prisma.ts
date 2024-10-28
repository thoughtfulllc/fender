import { PrismaClient } from '@prisma/client'

export const getOrInitPrismaClient = (global: any): PrismaClient => {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      //   log: ['query', 'info', 'warn', 'error'],
    })

    // global.prisma.$on('query', (e: any) => {
    //   console.log('Query: ' + e.query)
    //   console.log('Params: ' + e.params)
    //   console.log('Duration: ' + e.duration + 'ms')
    // })
  }

  return global.prisma
}

export const prisma = getOrInitPrismaClient(global)
