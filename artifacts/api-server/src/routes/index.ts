import { Router, type IRouter } from "express";
import healthRouter from "./health";
import homeRouter from "./home";

const router: IRouter = Router();

router.use(healthRouter);
router.use(homeRouter);

export default router;
