import { NextFunction, Request, Response } from 'express'
import {ExtendableContext} from 'koa'
import i18nextMiddleware from 'i18next-express-middleware'
import koaI18nextMiddleware from './koa-i18next-middleware'
import pathMatch from 'path-match'

import {
  addSubpath,
  lngFromReq,
  redirectWithoutCache,
  removeSubpath,
  subpathFromLng,
  subpathIsPresent,
  subpathIsRequired,
} from '../utils'

const route = pathMatch()

export default function (nexti18next) {
  const { config, i18n } = nexti18next
  const { allLanguages, ignoreRoutes, localeSubpaths } = config

  const isI18nRoute = (req: Request) => ignoreRoutes.every(x => !req.url.startsWith(x))
  const localeSubpathRoute = route(`/:subpath(${Object.values(localeSubpaths).join('|')})(.*)`)

  const middleware = []

  /*
    If not using server side language detection,
    we need to manually set the language for
    each request
  */
  if (!config.serverLanguageDetection) {
    middleware.push((ctx: ExtendableContext, next: NextFunction) => {
      if (isI18nRoute(ctx.req as any)) {
        (ctx as any).lng = config.defaultLanguage
      }
      next()
    })
  }

  /*
    This does the bulk of the i18next work
  */
  // middleware.push(i18nextMiddleware.handle(i18n))

  middleware.push(koaI18nextMiddleware.getHandler(i18n, {
    ignoreRoutes,
    locals: 'req',
  }))

  /*
    This does the locale subpath work
  */
  middleware.push(async (ctx: ExtendableContext, next: NextFunction) => {
    if (isI18nRoute(ctx.req as any) && (ctx.req as any).i18n) {
      let currentLng = lngFromReq(ctx.req as any)
      const currentLngSubpath = subpathFromLng(config, currentLng)
      const currentLngRequiresSubpath = subpathIsRequired(config, currentLng)
      const currentLngSubpathIsPresent = subpathIsPresent(ctx.req.url, currentLngSubpath)

      const lngFromCurrentSubpath = allLanguages.find((l: string) =>
        subpathIsPresent(ctx.req.url, subpathFromLng(config, l)))

      if (lngFromCurrentSubpath !== undefined && lngFromCurrentSubpath !== currentLng) {
        /*
          If a user has hit a subpath which does not
          match their language, give preference to
          the path, and change user language.
        */
        (ctx.req as any).i18n.changeLanguage(lngFromCurrentSubpath)
        currentLng = lngFromCurrentSubpath

      } else if (currentLngRequiresSubpath && !currentLngSubpathIsPresent) {

        /*
          If a language subpath is required and
          not present, prepend correct subpath
        */
        return redirectWithoutCache(ctx.res as any, addSubpath(ctx.req.url, currentLngSubpath))

      }

      /*
        If a locale subpath is present in the URL,
        modify req.url in place so that NextJs will
        render the correct route
      */
      if (typeof lngFromCurrentSubpath === 'string') {
        const params = localeSubpathRoute(ctx.req.url)
        if (params !== false) {
          const { subpath } = params
          ctx.request.query = { ...ctx.request.query, subpath, lng: currentLng }
          ctx.req.url = removeSubpath(ctx.req.url, subpath)
        }
      }
    }

    await next()
  })

  return middleware
}
