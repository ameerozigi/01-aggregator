import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { quoteRouter } from "./routes/quote";
import { txRouter } from "./routes/transaction";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/quote", quoteRouter);
app.use("/transaction", txRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  process.stdout.write(`backend listening on ${port}\n`);
});
