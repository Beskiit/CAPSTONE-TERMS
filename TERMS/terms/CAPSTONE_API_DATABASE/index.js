import express from "express";
import cors from "cors";

// Routers
import usersRouter from "./routes/users.js";
import reportAssignmentRouter from "./routes/reportAssignment.js";
import categoryRouter from "./routes/categoryRouter.js";
import subCategoryRouter from "./routes/subCategoryRouter.js";
import submissionsRouter from "./routes/submissionRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

/* ----------------------- CORS (credentials-safe) ----------------------- */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin(origin, cb) {
      // Allow server-to-server or curl (no Origin header)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: Origin not allowed: " + origin));
    },
    credentials: true, // <-- required if your client uses credentials: 'include'
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Optional: fast preflight for all routes
app.options(
  "*",
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

/* --------------------------- Body Parsers ------------------------------ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ------------------------------ Health -------------------------------- */
app.get("/", (_req, res) => {
  res.send("Welcome to the Capstone API");
});

/* ------------------------------ Routes -------------------------------- */
app.use("/users", usersRouter);
app.use("/reports", reportAssignmentRouter);
app.use("/categories", categoryRouter);
app.use("/subcategories", subCategoryRouter);
app.use("/api/submissions", submissionsRouter);

/* ---------------------------- 404 Handler ------------------------------ */
app.use((req, res, _next) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

/* ----------------------- Error Handler (CORS) -------------------------- */
app.use((err, req, res, _next) => {
  // Ensure CORS headers are present even on errors
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

/* ------------------------------ Server -------------------------------- */
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
