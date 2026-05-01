import { Router } from "express";
import { getWeatherData } from "../lib/weather";

const router = Router();

router.get("/weather", async (req, res) => {
  try {
    const data = await getWeatherData();
    res.json(data);
  } catch (e) {
    req.log.error({ err: e }, "Error getting weather");
    res.status(500).json({});
  }
});

export default router;
