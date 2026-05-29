import type { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { getOpenApiDocument } from "../../lib/openapi";

export function registerDocsRoutes(app: Express) {
  let cached: ReturnType<typeof getOpenApiDocument> | null = null;
  const getDoc = () => {
    if (!cached) cached = getOpenApiDocument();
    return cached;
  };

  app.get("/api/docs/openapi.json", (_req: Request, res: Response) => {
    res.json(getDoc());
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: "/api/docs/openapi.json" },
      customSiteTitle: "PlanGo API Docs",
    }),
  );
}
