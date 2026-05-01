import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storiesRouter from "./stories";
import eventsRouter from "./events";
import weatherRouter from "./weather";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storiesRouter);
router.use(eventsRouter);
router.use(weatherRouter);
router.use(statsRouter);

export default router;
