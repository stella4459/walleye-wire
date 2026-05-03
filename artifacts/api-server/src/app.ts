import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const isProduction = process.env.NODE_ENV === "production";
const staticDir = path.join(process.cwd(), "artifacts/walleye-wire/dist/public");
const indexHtml = path.join(staticDir, "index.html");
const hasStatic = isProduction && existsSync(staticDir) && existsSync(indexHtml);

if (hasStatic) {
  app.use(express.static(staticDir));
}

app.use("/api", router);

if (hasStatic) {
  app.get(/^(?!\/api).*$/, (_req, res) => {
    res.sendFile(indexHtml);
  });
}

export default app;
