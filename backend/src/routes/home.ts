import { Router } from 'express';
import { z } from 'zod';
import { ApiError, sendData } from '../lib/http.js';
import { authOf, type AuthMiddleware } from '../middleware/auth.js';
import type { Home } from '../services/home.js';
import type { Limits } from '../services/limits.js';

/*
 * The home page of a signed-in person, in one read (D-051): who they are to the page, the places
 * their menu has, the composition of the day, and the cards of their day.
 *
 * It answers about the account of the session and nothing else: it takes no user id. An account
 * that has not said its age gets no home (it owes the age step first, as everywhere else).
 *
 * `/guest` is the same read for somebody with no account (D-021, D-056): the onboarding is walked
 * before any account, and "later" at its end goes into the application. It knows nobody: the name
 * and the mentor stay in that person's browser, and all Core gives is the menu and the composition
 * of the day, the same for every guest. It is counted by the visitor's address like any public read.
 *
 * `cards` is the pile of the home. A card belongs to a feature and is added here by that feature
 * when it is built (the next lesson, the tasks, the wallet, the streak); a card is never sent for
 * something that does not exist yet, so today the list is empty.
 */
const Query = z.object({ day: z.string().max(10).optional() }).strict();

export function createHomeRouter(deps: { home: Home; limits: Limits; auth: AuthMiddleware }): Router {
  const { home, limits, auth } = deps;
  const router = Router();

  router.get('/guest', (req, res) => {
    const query = Query.safeParse(req.query);

    if (!query.success) throw new ApiError('BAD_REQUEST');

    sendData(res, {
      home: { displayName: '', mentor: null, destinations: home.guestDestinations(), composition: home.guestCompositionOf(query.data.day), cards: [] },
    });
  });

  router.get('/', auth.requireAuth, async (req, res) => {
    const { userId, account } = authOf(req);

    if (!account.ageDeclared) throw new ApiError('AGE_REQUIRED');

    // counted per account, not per address: a classroom shares one address
    await limits.consume('accountRead', userId);

    const query = Query.safeParse(req.query);

    if (!query.success) throw new ApiError('BAD_REQUEST');

    sendData(res, {
      home: {
        displayName: account.displayName,
        mentor: account.mentor,
        destinations: home.destinationsOf(account),
        composition: home.compositionOf(userId, query.data.day),
        cards: [],
      },
    });
  });

  return router;
}
