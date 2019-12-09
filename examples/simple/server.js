const Koa = require('koa')
const Router = require('koa-router')
const next = require('next')
const nextI18NextMiddleware = require('next-i18next/middleware').default

const nextI18next = require('./i18n')

const port = process.env.PORT || 3000
const app = next({ dev: process.env.NODE_ENV !== 'production' })
const handle = app.getRequestHandler();

(async () => {
  await app.prepare()
  const server = new Koa()
  const router = new Router()

  // server.use(nextI18NextMiddleware(nextI18next))
  nextI18NextMiddleware(nextI18next).forEach((middleware) => {
    server.use(middleware)
  })

  // server.get('*', (req, res) => handle(req, res))

  router.all('*', async ctx => {
    await handle(ctx.req, ctx.res)
    ctx.respond = false
  })

  // await server.listen(port)
  // console.log(`> Ready on http://localhost:${port}`) // eslint-disable-line no-console

  server.use(router.routes())
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`) // eslint-disable-line no-console
  })
})()
