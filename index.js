// index.js
import express from "express";
import bodyParser from "body-parser";
import brandInfoRoute from "./brandInfo.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use("/", brandInfoRoute);

app.listen(PORT, () => {
  console.log(`🌱 Server running at http://localhost:${PORT}`);
});
