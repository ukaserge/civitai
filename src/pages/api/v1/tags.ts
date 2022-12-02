import { TRPCError } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { NextApiRequest, NextApiResponse } from 'next';

import { appRouter } from '~/server/routers';
import { getPaginationLinks } from '~/server/utils/pagination-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET': {
      const apiCaller = appRouter.createCaller({ user: undefined });

      try {
        const { items, ...metadata } = await apiCaller.tag.getAll({
          ...req.query,
          withModels: true,
        });
        const { nextPage, prevPage, baseUrl } = getPaginationLinks({
          ...metadata,
          req,
        });

        res.status(200).json({
          items:
            items?.map(({ tagsOnModels = [], name }) => ({
              name,
              modelCount: tagsOnModels.length ? tagsOnModels.length : undefined,
              link: `${baseUrl.origin}/api/v1/models?tag=${name}`,
            })) ?? [],
          metadata: {
            ...metadata,
            nextPage,
            prevPage,
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) {
          const status = getHTTPStatusCodeFromError(error);
          const parsedError = JSON.parse(error.message);

          res.status(status).json(parsedError);
        } else {
          res.status(500).json({ message: 'An unexpected error occurred', error });
        }
      }

      break;
    }
    default: {
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} not allowed`);
      break;
    }
  }
}