import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import mysql from "mysql";
import fs from "fs";
import path from "path";

// Routers
import usersRouter from "./routes/users.js";
import reportAssignmentRouter from "./routes/reportAssignment.js";
import categoryRouter from "./routes/categoryRouter.js";
import subCategoryRouter from "./routes/subCategoryRouter.js";
import submissionsRouter from "./routes/submissionRoutes.js";
import mpsRoutes from "./routes/mpsRoutes.js";
import accomplishmentRouter from "./routes/accomplishmentRoutes.js";
import reportStatus from "./routes/reportStatusRoutes.js";
import reportCountsRoutes from "./routes/reportCountsRoutes.js";
import notificationsRouter from "./routes/notifications.js";
import aiRouter from "./routes/ai.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

/* ----------------- Env URLs ----------------- */
const IS_PROD = process.env.NODE_ENV === "production";
const FRONTEND_URL = (process.env.FRONTEND_URL || "https://your-frontend-domain.com").replace(/\/$/, "");
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, "");

/* trust proxy for secure cookies behind nginx */
app.set("trust proxy", 1);

/* ----------------- MySQL pool ----------------- */
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "capstone_database",
  connectionLimit: 10,
});

pool.getConnection((err, conn) => {
  if (err) {
    console.error("❌ MySQL error:", err.message);
  } else {
    console.log("✅ MySQL pool ready");
    conn.release();
  }
});

/* ----------------- CORS ----------------- */
const BASE_ALLOWED = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://terms-api.kiri8tives.com", // (backend) allowed for diagnostics
  "http://127.0.0.1:5000",
];

const ALLOWED_ORIGINS = Array.from(
  new Set([...BASE_ALLOWED, FRONTEND_URL, PUBLIC_URL].filter(Boolean).map(u => u.replace(/\/$/, "")))
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ""))) return cb(null, true);
      return cb(new Error("CORS: Origin not allowed: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.options(
  "/:path",
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

// Increase JSON/body limits to accommodate AI summarize payloads
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ----------------- Sessions + Passport ----------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    // cookie: { secure: IS_PROD, sameSite: "lax" }, // enable when HTTPS is on
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* ----------------- Google OAuth ----------------- */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${PUBLIC_URL}/auth/google/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      const email =
        profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : null;
      const name = profile.displayName || "";
      const googleId = profile.id;

      if (!email) return done(null, false, { message: "No email returned by Google" });

      pool.getConnection((err, conn) => {
        if (err) return done(err);

        conn.query(
          `SELECT user_id, email, name, role, google_id FROM user_details WHERE email = ? LIMIT 1`,
          [email],
          (err1, rows) => {
            if (err1) {
              conn.release();
              return done(err1);
            }

            if (!rows || rows.length === 0) {
              conn.release();
              return done(null, false, { message: "Account not registered. Contact admin." });
            }

            const dbUser = rows[0];

            const finish = () => {
              const sessionUser = {
                user_id: dbUser.user_id,
                name: dbUser.name || name,
                email: dbUser.email,
                role: dbUser.role,
              };
              conn.release();
              return done(null, sessionUser);
            };

            if (!dbUser.google_id) {
              conn.query(
                `UPDATE user_details SET google_id = ? WHERE user_id = ?`,
                [googleId, dbUser.user_id],
                (err2) => {
                  if (err2) {
                    conn.release();
                    return done(err2);
                  }
                  finish();
                }
              );
            } else {
              finish();
            }
          }
        );
      });
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

/* ----------------- Health + Root ----------------- */
app.get("/health", (_req, res) => res.send("ok"));

app.get("/", (req, res) => {
  if (process.env.NODE_ENV === "production") return res.send("API online");
  if (!req.isAuthenticated?.()) return res.redirect(FRONTEND_URL);

  switch (req.user.role) {
    case "admin":
      return res.redirect(`${FRONTEND_URL}/DashboardAdmin`);
    case "principal":
      return res.redirect(`${FRONTEND_URL}/DashboardPrincipal`);
    case "coordinator":
      return res.redirect(`${FRONTEND_URL}/DashboardCoordinator`);
    default:
      return res.redirect(`${FRONTEND_URL}/DashboardTeacher`);
  }
});

/* ----------------- Auth endpoints ----------------- */
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${FRONTEND_URL}` }),
  (req, res) => {
    switch (req.user.role) {
      case "admin":
        return res.redirect(`${FRONTEND_URL}/DashboardAdmin`);
      case "principal":
        return res.redirect(`${FRONTEND_URL}/DashboardPrincipal`);
      case "coordinator":
        return res.redirect(`${FRONTEND_URL}/DashboardCoordinator`);
      default:
        return res.redirect(`${FRONTEND_URL}/DashboardTeacher`);
    }
  }
);

app.get("/auth/me", (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json(req.user);
});

app.post("/auth/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });
});

/* ----------------- Static uploads ----------------- */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
fs.mkdirSync(path.resolve("uploads/accomplishments"), { recursive: true });

/* ----------------- App routes ----------------- */
app.use("/users", usersRouter);
app.use("/reports", reportAssignmentRouter);
app.use("/categories", categoryRouter);
app.use("/subcategories", subCategoryRouter);
app.use("/submissions", submissionsRouter);
app.use("/mps", mpsRoutes);

// 🔹 This is the base your React uses: `${API_BASE}/reports/accomplishment`
app.use("/reports/accomplishment", accomplishmentRouter);

// Counts first (more specific), then status
app.use("/reports/status/count", reportCountsRoutes);
app.use("/reports/status", reportStatus);
app.use("/notifications", notificationsRouter);
app.use("/ai", aiRouter);

/* ----------------- 404 + Error ----------------- */
app.use((req, res, _next) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

app.use((err, req, res, _next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes((origin || "").replace(/\/$/, ""))) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

/* ----------------- Start ----------------- */
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;
