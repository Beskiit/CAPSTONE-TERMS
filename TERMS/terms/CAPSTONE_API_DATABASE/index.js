import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import mysql from "mysql2";
import fs from "fs";
import path from "path";
import multer from "multer";
import db from "./db.js";

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
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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

/* ----------------- Multer Configuration ----------------- */
// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'accomplishments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

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
      return res.redirect(`${FRONTEND_URL}/UserManagement`);
    case "principal":
      return res.redirect(`${FRONTEND_URL}/DashboardPrincipal`);
    case "coordinator":
      return res.redirect(`${FRONTEND_URL}/DashboardCoordinator`);
    default:
      return res.redirect(`${FRONTEND_URL}/DashboardTeacher`);
  }
});

/* ----------------- Admin endpoints ----------------- */

// Initialize database schema (add school_id column if it doesn't exist)
app.post("/admin/init-schema", async (req, res) => {
  try {
    // Check if school_id column exists in user_details table
    const checkSchoolIdQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_details' 
      AND COLUMN_NAME = 'school_id'
    `;
    
    const schoolIdExists = await new Promise((resolve, reject) => {
      db.query(checkSchoolIdQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results.length > 0);
      });
    });
    
    // Check if section column exists
    const checkSectionQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_details' 
      AND COLUMN_NAME = 'section'
    `;
    
    const sectionExists = await new Promise((resolve, reject) => {
      db.query(checkSectionQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results.length > 0);
      });
    });
    
    let schemaUpdated = false;
    
    // Add school_id column if it doesn't exist
    if (!schoolIdExists) {
      const addSchoolIdQuery = `
        ALTER TABLE user_details 
        ADD COLUMN school_id INT(11) NULL
      `;
      
      await new Promise((resolve, reject) => {
        db.query(addSchoolIdQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      // Add foreign key constraint
      const addForeignKeyQuery = `
        ALTER TABLE user_details 
        ADD FOREIGN KEY (school_id) REFERENCES school(school_id)
      `;
      
      await new Promise((resolve, reject) => {
        db.query(addForeignKeyQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      schemaUpdated = true;
    }
    
    // Make section and grade_level nullable if they exist
    if (sectionExists) {
      const updateColumnsQuery = `
        ALTER TABLE user_details 
        MODIFY COLUMN section ENUM('Masipag','Matulungin','Masunurin','Magalang','Matapat','Matiyaga') NULL,
        MODIFY COLUMN grade_level INT(11) NULL
      `;
      
      await new Promise((resolve, reject) => {
        db.query(updateColumnsQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      schemaUpdated = true;
    }
    
    if (schemaUpdated) {
      res.json({ success: true, message: "Database schema updated successfully" });
    } else {
      res.json({ success: true, message: "Database schema already up to date" });
    }
  } catch (error) {
    console.error("Error initializing schema:", error);
    res.status(500).json({ error: "Failed to initialize schema", details: error.message });
  }
});

// Manual database fix endpoint
app.post("/admin/fix-database", async (req, res) => {
  try {
    console.log("Fixing database schema...");
    
    // Add school_id column if it doesn't exist
    try {
      await new Promise((resolve, reject) => {
        db.query("ALTER TABLE user_details ADD COLUMN school_id INT(11) NULL", (err, results) => {
          if (err && err.code !== 'ER_DUP_FIELDNAME') reject(err);
          else resolve(results);
        });
      });
      console.log("Added school_id column");
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.log("school_id column already exists or error:", err.message);
      }
    }
    
    // Make section and grade_level nullable
    try {
      await new Promise((resolve, reject) => {
        db.query(`
          ALTER TABLE user_details 
          MODIFY COLUMN section ENUM('Masipag','Matulungin','Masunurin','Magalang','Matapat','Matiyaga') NULL,
          MODIFY COLUMN grade_level INT(11) NULL
        `, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      console.log("Made section and grade_level nullable");
    } catch (err) {
      console.log("Error modifying columns:", err.message);
    }
    
    res.json({ success: true, message: "Database schema fixed successfully" });
  } catch (error) {
    console.error("Error fixing database:", error);
    res.status(500).json({ error: "Failed to fix database", details: error.message });
  }
});

// Set AUTO_INCREMENT to start at 10 for all tables
app.post("/admin/set-auto-increment-10", async (req, res) => {
  try {
    console.log("Setting AUTO_INCREMENT to start at 10 for all tables...");
    
    const tables = [
      'activity_log', 'advisory', 'assignment_distribution', 'category', 
      'coordinator_grade', 'grade_level', 'notifications', 'principal_term',
      'quarter_period', 'report_assignment', 'school', 'school_memorandum',
      'school_year', 'section', 'status', 'submission', 'sub_category',
      'teacher_section', 'user_details', 'year_and_quarter'
    ];
    
    const results = [];
    
    for (const table of tables) {
      try {
        await new Promise((resolve, reject) => {
          db.query(`ALTER TABLE ${table} AUTO_INCREMENT = 10`, (err, result) => {
            if (err) {
              console.log(`Error setting AUTO_INCREMENT for ${table}:`, err.message);
              reject(err);
            } else {
              console.log(`Set AUTO_INCREMENT to 10 for ${table}`);
              resolve(result);
            }
          });
        });
        results.push({ table, status: 'success' });
      } catch (err) {
        console.log(`Failed to set AUTO_INCREMENT for ${table}:`, err.message);
        results.push({ table, status: 'failed', error: err.message });
      }
    }
    
    // Get current AUTO_INCREMENT values to verify
    const verificationQuery = `
      SELECT 
        TABLE_NAME,
        AUTO_INCREMENT
      FROM 
        INFORMATION_SCHEMA.TABLES 
      WHERE 
        TABLE_SCHEMA = 'capstone_database' 
        AND AUTO_INCREMENT IS NOT NULL
      ORDER BY 
        TABLE_NAME
    `;
    
    const verification = await new Promise((resolve, reject) => {
      db.query(verificationQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({ 
      success: true, 
      message: "AUTO_INCREMENT set to 10 for all tables",
      results: results,
      verification: verification
    });
  } catch (error) {
    console.error("Error setting AUTO_INCREMENT:", error);
    res.status(500).json({ error: "Failed to set AUTO_INCREMENT", details: error.message });
  }
});

// Get active year and quarter

// Add new school year (automatically creates all 4 quarters)
app.post("/admin/school-year", async (req, res) => {
  try {
    console.log("=== SCHOOL YEAR CREATION DEBUG START ===");
    console.log("Request body:", req.body);
    
    const { startYear, endYear } = req.body;
    
    if (!startYear || !endYear) {
      console.log("ERROR: Missing startYear or endYear");
      return res.status(400).json({ error: "Start year and end year are required" });
    }
    
    // Validate that end year is greater than start year
    if (parseInt(endYear) <= parseInt(startYear)) {
      console.log("ERROR: End year must be greater than start year");
      return res.status(400).json({ error: "End year must be greater than start year" });
    }
    
    // Create the year string in format "2024-2025"
    const yearString = `${startYear}-${endYear}`;
    console.log("Year string:", yearString);
    
    // Check if this school year already exists
    const checkSchoolYearQuery = `SELECT year_id FROM school_year WHERE school_year = ?`;
    console.log("Checking for existing school year:", yearString);
    
    const existingSchoolYear = await new Promise((resolve, reject) => {
      db.query(checkSchoolYearQuery, [yearString], (err, results) => {
        if (err) {
          console.log("ERROR checking existing school year:", err);
          reject(err);
        } else {
          console.log("Existing school year check result:", results);
          resolve(results);
        }
      });
    });
    
    if (existingSchoolYear.length > 0) {
      console.log("ERROR: School year already exists");
      return res.status(400).json({ error: "This school year already exists" });
    }
    
    // Get the current max ID and use a much higher ID
    const getMaxIdQuery = `SELECT COALESCE(MAX(year_id), 0) as max_id FROM school_year`;
    console.log("Getting max ID from school_year table");
    
    const maxIdResult = await new Promise((resolve, reject) => {
      db.query(getMaxIdQuery, (err, results) => {
        if (err) {
          console.log("ERROR getting max ID:", err);
          reject(err);
        } else {
          console.log("Max ID result:", results);
          resolve(results);
        }
      });
    });
    
    const currentMaxId = maxIdResult[0].max_id;
    const newYearId = Math.max(currentMaxId + 1000, 50000); // Use at least 50000 or current max + 1000
    console.log("Current max ID:", currentMaxId);
    console.log("New year ID will be:", newYearId);
    
    // Set auto-increment to a very high value
    const autoIncrementValue = newYearId + 1;
    console.log("Setting auto-increment to:", autoIncrementValue);
    
    await new Promise((resolve, reject) => {
      db.query(`ALTER TABLE school_year AUTO_INCREMENT = ${autoIncrementValue}`, (err, results) => {
        if (err) {
          console.log("ERROR setting auto-increment:", err);
          reject(err);
        } else {
          console.log("Auto-increment set successfully");
          resolve(results);
        }
      });
    });
    
    // Create new school year with explicit high ID
    const insertSchoolYearQuery = `
      INSERT INTO school_year (year_id, school_year, start_year, end_year, is_active) 
      VALUES (?, ?, ?, ?, 0)
    `;
    console.log("Inserting school year with ID:", newYearId);
    
    const newSchoolYear = await new Promise((resolve, reject) => {
      db.query(insertSchoolYearQuery, [newYearId, yearString, startYear, endYear], (err, results) => {
        if (err) {
          console.log("ERROR inserting school year:", err);
          reject(err);
        } else {
          console.log("School year inserted successfully:", results);
          resolve(results);
        }
      });
    });
    
    console.log("School year created with ID:", newYearId);
    
    // Set quarter_period auto-increment to a very high value
    const quarterAutoIncrement = 100000 + (newYearId * 100);
    console.log("Setting quarter_period auto-increment to:", quarterAutoIncrement);
    
    await new Promise((resolve, reject) => {
      db.query(`ALTER TABLE quarter_period AUTO_INCREMENT = ${quarterAutoIncrement}`, (err, results) => {
        if (err) {
          console.log("ERROR setting quarter_period auto-increment:", err);
          reject(err);
        } else {
          console.log("Quarter period auto-increment set successfully");
          resolve(results);
        }
      });
    });
    
    // Set year_and_quarter auto-increment to a very high value
    const yearQuarterAutoIncrement = 200000 + (newYearId * 100);
    console.log("Setting year_and_quarter auto-increment to:", yearQuarterAutoIncrement);
    
    await new Promise((resolve, reject) => {
      db.query(`ALTER TABLE year_and_quarter AUTO_INCREMENT = ${yearQuarterAutoIncrement}`, (err, results) => {
        if (err) {
          console.log("ERROR setting year_and_quarter auto-increment:", err);
          reject(err);
        } else {
          console.log("Year and quarter auto-increment set successfully");
          resolve(results);
        }
      });
    });
    
    // Automatically create all 4 quarters for this school year
    const quarters = [
      { quarter: 1, name: '1st Quarter' },
      { quarter: 2, name: '2nd Quarter' },
      { quarter: 3, name: '3rd Quarter' },
      { quarter: 4, name: '4th Quarter' }
    ];
    
    console.log("Creating quarters for year ID:", newYearId);
    
    for (let i = 0; i < quarters.length; i++) {
      const q = quarters[i];
      console.log(`Creating quarter ${i + 1}: ${q.name}`);
      
      // Insert quarter into quarter_period table with very high explicit ID
      const quarterPeriodId = quarterAutoIncrement + i;
      console.log(`Quarter period ID: ${quarterPeriodId}`);
      
      const insertQuarterQuery = `
        INSERT INTO quarter_period (quarter_period_id, year_id, quarter) 
        VALUES (?, ?, ?)
      `;
      
      await new Promise((resolve, reject) => {
        db.query(insertQuarterQuery, [quarterPeriodId, newYearId, q.name], (err, results) => {
          if (err) {
            console.log(`ERROR inserting quarter period ${q.name}:`, err);
            reject(err);
          } else {
            console.log(`Quarter period ${q.name} inserted successfully`);
            resolve(results);
          }
        });
      });
      
      // Insert quarter into year_and_quarter table with very high explicit ID
      const yearQuarterId = yearQuarterAutoIncrement + i;
      console.log(`Year quarter ID: ${yearQuarterId}`);
      
      const insertYearQuarterQuery = `
        INSERT INTO year_and_quarter (yr_and_qtr_id, year, quarter, is_active) 
        VALUES (?, ?, ?, 0)
      `;
      
      await new Promise((resolve, reject) => {
        db.query(insertYearQuarterQuery, [yearQuarterId, newYearId, q.quarter], (err, results) => {
          if (err) {
            console.log(`ERROR inserting year-quarter for quarter ${q.quarter}:`, err);
            reject(err);
          } else {
            console.log(`Year-quarter ${q.quarter} inserted successfully`);
            resolve(results);
          }
        });
      });
    }
    
    console.log("=== SCHOOL YEAR CREATION DEBUG END - SUCCESS ===");
    
    res.json({ 
      message: "School year created successfully with all 4 quarters",
      schoolYear: {
        year_id: newYearId,
        school_year: yearString,
        start_year: startYear,
        end_year: endYear,
        quarters_created: 4
      }
    });
  } catch (error) {
    console.log("=== SCHOOL YEAR CREATION DEBUG END - ERROR ===");
    console.error("Error creating school year:", error);
    res.status(500).json({ error: "Failed to create school year", details: error.message });
  }
});

// Add new year and quarter
app.post("/admin/year-quarter", async (req, res) => {
  try {
    const { year, quarter } = req.body;
    
    if (!year || !quarter) {
      return res.status(400).json({ error: "Year and quarter are required" });
    }
    
    // Parse the year string (e.g., "2025-2026") to get start and end years
    const [startYear, endYear] = year.split('-').map(y => parseInt(y));
    
    if (!startYear || !endYear) {
      return res.status(400).json({ error: "Invalid year format. Expected format: YYYY-YYYY" });
    }
    
    // First, check if the school year exists, if not create it
    let yearId;
    const checkSchoolYearQuery = `
      SELECT year_id FROM school_year WHERE school_year = ?
    `;
    
    const existingSchoolYear = await new Promise((resolve, reject) => {
      db.query(checkSchoolYearQuery, [year], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (existingSchoolYear.length > 0) {
      yearId = existingSchoolYear[0].year_id;
    } else {
      // Create new school year
      const insertSchoolYearQuery = `
        INSERT INTO school_year (school_year, start_year, end_year, is_active) 
        VALUES (?, ?, ?, 0)
      `;
      
      const newSchoolYear = await new Promise((resolve, reject) => {
        db.query(insertSchoolYearQuery, [year, startYear, endYear], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      yearId = newSchoolYear.insertId;
    }
    
    // Check if this year and quarter combination already exists
    const checkQuery = `
      SELECT yr_and_qtr_id FROM year_and_quarter 
      WHERE year = ? AND quarter = ?
    `;
    
    const existing = await new Promise((resolve, reject) => {
      db.query(checkQuery, [yearId, quarter], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (existing.length > 0) {
      return res.status(400).json({ error: "This year and quarter combination already exists" });
    }
    
    // Insert new year and quarter
    const insertQuery = `
      INSERT INTO year_and_quarter (year, quarter, is_active) 
      VALUES (?, ?, 0)
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(insertQuery, [yearId, quarter], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const newYearQuarter = {
      yr_and_qtr_id: result.insertId,
      year: year,
      quarter,
      is_active: 0
    };
    
    res.status(201).json(newYearQuarter);
  } catch (error) {
    console.error("Error adding year quarter:", error);
    res.status(500).json({ error: "Failed to add year quarter", details: error.message });
  }
});

// Set active year and quarter
app.post("/admin/set-active-year-quarter", async (req, res) => {
  try {
    console.log("=== SET ACTIVE YEAR QUARTER DEBUG ===");
    console.log("Request body:", req.body);
    
    const { yr_and_qtr_id, year, quarter } = req.body;
    
    // Handle both old format (yr_and_qtr_id) and new format (year, quarter)
    let targetYearQuarterId = yr_and_qtr_id;
    
    if (!targetYearQuarterId && (year && quarter)) {
      console.log("Using new format - finding year-quarter combination for:", { year, quarter });
      
      // Debug: Check what's in the database
      const debugQuery = `
        SELECT yq.yr_and_qtr_id, yq.year, yq.quarter, sy.school_year, sy.year_id
        FROM year_and_quarter yq
        LEFT JOIN school_year sy ON sy.year_id = yq.year
        ORDER BY yq.yr_and_qtr_id
      `;
      
      const debugResult = await new Promise((resolve, reject) => {
        db.query(debugQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      console.log("DEBUG: All year-quarter combinations in database:", debugResult);
      
      // Debug: Check what's in school_year table
      const schoolYearQuery = `SELECT * FROM school_year ORDER BY year_id`;
      const schoolYearResult = await new Promise((resolve, reject) => {
        db.query(schoolYearQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      console.log("DEBUG: All school years in database:", schoolYearResult);
      
      // Find the year-quarter combination in the database
      const findQuery = `
        SELECT yq.yr_and_qtr_id, yq.year, yq.quarter, sy.school_year
        FROM year_and_quarter yq
        LEFT JOIN school_year sy ON sy.year_id = yq.year
        WHERE sy.school_year = ? AND yq.quarter = ?
      `;
      
      const findResult = await new Promise((resolve, reject) => {
        db.query(findQuery, [year, quarter], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      console.log("Find query result:", findResult);
      
      if (findResult.length === 0) {
          console.log("No year-quarter combination found for:", { year, quarter });
          console.log("Attempting to create missing year-quarter combination...");
          
          // Find the year_id for the school year
          const yearQuery = `SELECT year_id FROM school_year WHERE school_year = ?`;
          const yearResult = await new Promise((resolve, reject) => {
            db.query(yearQuery, [year], (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          });
          
          if (yearResult.length === 0) {
            console.log("School year not found:", year);
            return res.status(404).json({ error: "School year not found" });
          }
          
          const yearId = yearResult[0].year_id;
          console.log("Found year_id:", yearId, "for school year:", year);
          
          // Create the missing year-quarter combination
          const createQuery = `INSERT INTO year_and_quarter (year, quarter) VALUES (?, ?) ON DUPLICATE KEY UPDATE year = VALUES(year), quarter = VALUES(quarter)`;
          console.log("DEBUG: Attempting to create year-quarter with:", { yearId, quarter: parseInt(quarter) });
          console.log("DEBUG: SQL Query:", createQuery);
          
          const createResult = await new Promise((resolve, reject) => {
            db.query(createQuery, [yearId, parseInt(quarter)], (err, results) => {
              if (err) {
                console.log("DEBUG: Error creating year-quarter combination:", err);
                reject(err);
              } else {
                console.log("DEBUG: Insert result:", results);
                resolve(results);
              }
            });
          });
          
          console.log("Created new year-quarter combination:", createResult);
          
          // Get the record (either newly created or existing)
          const newRecordQuery = `
            SELECT yq.yr_and_qtr_id, yq.year, yq.quarter, sy.school_year
            FROM year_and_quarter yq
            LEFT JOIN school_year sy ON sy.year_id = yq.year
            WHERE yq.year = ? AND yq.quarter = ?
          `;
          
          console.log("DEBUG: Looking for record with:", { yearId, quarter: parseInt(quarter) });
          console.log("DEBUG: Record lookup query:", newRecordQuery);
          
          const newRecordResult = await new Promise((resolve, reject) => {
            db.query(newRecordQuery, [yearId, parseInt(quarter)], (err, results) => {
              if (err) {
                console.log("DEBUG: Error in record lookup:", err);
                reject(err);
              } else {
                console.log("DEBUG: Record lookup result:", results);
                resolve(results);
              }
            });
          });
          
          console.log("Record found/created:", newRecordResult);
          
          if (newRecordResult.length === 0) {
            console.log("No record found after creation attempt");
            return res.status(500).json({ error: "Failed to create or find year-quarter combination" });
          }
          
          targetYearQuarterId = newRecordResult[0].yr_and_qtr_id;
          
          // Handle case where yr_and_qtr_id is 0 (invalid auto-increment)
          if (targetYearQuarterId === 0) {
            console.log("WARNING: yr_and_qtr_id is 0, attempting to fix AUTO_INCREMENT...");
            
            // Get the maximum ID and set AUTO_INCREMENT to max + 1
            const maxIdQuery = `SELECT MAX(yr_and_qtr_id) as max_id FROM year_and_quarter`;
            const maxIdResult = await new Promise((resolve, reject) => {
              db.query(maxIdQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
            
            const maxId = maxIdResult[0].max_id || 0;
            const newAutoIncrement = Math.max(maxId + 1, 10);
            
            console.log(`Setting AUTO_INCREMENT to ${newAutoIncrement}`);
            
            const fixAutoIncrementQuery = `ALTER TABLE year_and_quarter AUTO_INCREMENT = ${newAutoIncrement}`;
            await new Promise((resolve, reject) => {
              db.query(fixAutoIncrementQuery, (err, results) => {
                if (err) {
                  console.log("Error fixing AUTO_INCREMENT:", err);
                  reject(err);
                } else {
                  console.log("AUTO_INCREMENT fixed successfully");
                  resolve(results);
                }
              });
            });
            
            // Now try to create the record again
            const recreateQuery = `INSERT INTO year_and_quarter (year, quarter) VALUES (?, ?)`;
            const recreateResult = await new Promise((resolve, reject) => {
              db.query(recreateQuery, [yearId, parseInt(quarter)], (err, results) => {
                if (err) {
                  console.log("Error recreating year-quarter:", err);
                  reject(err);
                } else {
                  console.log("Recreated year-quarter:", results);
                  resolve(results);
                }
              });
            });
            
            // Get the new record
            const newRecordResult2 = await new Promise((resolve, reject) => {
              db.query(newRecordQuery, [yearId, parseInt(quarter)], (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
            
            console.log("New record after fix:", newRecordResult2);
            
            if (newRecordResult2.length === 0) {
              console.log("Still no record found after AUTO_INCREMENT fix");
              return res.status(500).json({ error: "Failed to create year-quarter combination even after fixing AUTO_INCREMENT" });
            }
            
            targetYearQuarterId = newRecordResult2[0].yr_and_qtr_id;
            console.log("Fixed targetYearQuarterId:", targetYearQuarterId);
          }
        } else {
          targetYearQuarterId = findResult[0].yr_and_qtr_id;
          console.log("Found yr_and_qtr_id:", targetYearQuarterId);
          
          // Handle case where yr_and_qtr_id is 0 (invalid auto-increment) - even for existing records
          if (targetYearQuarterId === 0) {
            console.log("WARNING: Existing record has yr_and_qtr_id = 0, attempting to fix AUTO_INCREMENT...");
            
            // Get the maximum ID and set AUTO_INCREMENT to max + 1
            const maxIdQuery = `SELECT MAX(yr_and_qtr_id) as max_id FROM year_and_quarter`;
            const maxIdResult = await new Promise((resolve, reject) => {
              db.query(maxIdQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
            
            const maxId = maxIdResult[0].max_id || 0;
            const newAutoIncrement = Math.max(maxId + 1, 10);
            
            console.log(`Setting AUTO_INCREMENT to ${newAutoIncrement}`);
            
            const fixAutoIncrementQuery = `ALTER TABLE year_and_quarter AUTO_INCREMENT = ${newAutoIncrement}`;
            await new Promise((resolve, reject) => {
              db.query(fixAutoIncrementQuery, (err, results) => {
                if (err) {
                  console.log("Error fixing AUTO_INCREMENT:", err);
                  reject(err);
                } else {
                  console.log("AUTO_INCREMENT fixed successfully");
                  resolve(results);
                }
              });
            });
            
            // Delete the record with ID 0 and recreate it
            const deleteQuery = `DELETE FROM year_and_quarter WHERE yr_and_qtr_id = 0 AND year = ? AND quarter = ?`;
            await new Promise((resolve, reject) => {
              db.query(deleteQuery, [findResult[0].year, findResult[0].quarter], (err, results) => {
                if (err) {
                  console.log("Error deleting record with ID 0:", err);
                  reject(err);
                } else {
                  console.log("Deleted record with ID 0:", results);
                  resolve(results);
                }
              });
            });
            
            // Now create the record again with proper auto-increment
            const recreateQuery = `INSERT INTO year_and_quarter (year, quarter) VALUES (?, ?)`;
            const recreateResult = await new Promise((resolve, reject) => {
              db.query(recreateQuery, [findResult[0].year, findResult[0].quarter], (err, results) => {
                if (err) {
                  console.log("Error recreating year-quarter:", err);
                  reject(err);
                } else {
                  console.log("Recreated year-quarter:", results);
                  resolve(results);
                }
              });
            });
            
            // Get the new record
            const newRecordQuery = `
              SELECT yq.yr_and_qtr_id, yq.year, yq.quarter, sy.school_year
              FROM year_and_quarter yq
              LEFT JOIN school_year sy ON sy.year_id = yq.year
              WHERE yq.year = ? AND yq.quarter = ?
            `;
            
            const newRecordResult = await new Promise((resolve, reject) => {
              db.query(newRecordQuery, [findResult[0].year, findResult[0].quarter], (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
            
            console.log("New record after fix:", newRecordResult);
            
            if (newRecordResult.length === 0) {
              console.log("Still no record found after AUTO_INCREMENT fix");
              return res.status(500).json({ error: "Failed to create year-quarter combination even after fixing AUTO_INCREMENT" });
            }
            
            targetYearQuarterId = newRecordResult[0].yr_and_qtr_id;
            console.log("Fixed targetYearQuarterId:", targetYearQuarterId);
          }
        }
      }
    
      if (!targetYearQuarterId) {
        console.log("No valid year-quarter ID provided");
        return res.status(400).json({ error: "Year and quarter ID is required" });
      }
    
      console.log("Setting active year-quarter ID:", targetYearQuarterId);
    
    // First, set all year quarters to inactive
    const deactivateQuery = `UPDATE year_and_quarter SET is_active = 0`;
    console.log("DEBUG: Deactivating all year-quarters...");
    console.log("DEBUG: Deactivate query:", deactivateQuery);
    
    await new Promise((resolve, reject) => {
      db.query(deactivateQuery, (err, results) => {
        if (err) {
          console.log("DEBUG: Error deactivating year-quarters:", err);
          reject(err);
        } else {
          console.log("DEBUG: Deactivation result:", results);
          resolve(results);
        }
      });
    });
    
    // Then set the selected one as active
    const activateQuery = `
      UPDATE year_and_quarter 
      SET is_active = 1 
      WHERE yr_and_qtr_id = ?
    `;
    
    console.log("DEBUG: Activating year-quarter ID:", targetYearQuarterId);
    console.log("DEBUG: Activate query:", activateQuery);
    console.log("DEBUG: Activate parameters:", [targetYearQuarterId]);
    
    await new Promise((resolve, reject) => {
      db.query(activateQuery, [targetYearQuarterId], (err, results) => {
        if (err) {
          console.log("DEBUG: Error activating specific year-quarter:", err);
          reject(err);
        } else {
          console.log("DEBUG: Activation result:", results);
          resolve(results);
        }
      });
    });
    
    console.log("=== SET ACTIVE YEAR QUARTER SUCCESS ===");
    
    res.json({ 
      success: true, 
      message: "Active year and quarter updated successfully",
      yr_and_qtr_id: targetYearQuarterId
    });
  } catch (error) {
    console.error("=== SET ACTIVE YEAR QUARTER ERROR ===");
    console.error("Error setting active year quarter:", error);
    res.status(500).json({ error: "Failed to set active year quarter", details: error.message });
  }
});

// Get all year and quarters
app.get("/admin/year-quarters", async (req, res) => {
  try {
    const query = `
      SELECT 
        yq.yr_and_qtr_id, 
        yq.quarter, 
        yq.is_active,
        sy.school_year,
        sy.start_year,
        sy.end_year
      FROM year_and_quarter yq
      LEFT JOIN school_year sy ON sy.year_id = yq.year
      ORDER BY sy.start_year DESC, yq.quarter DESC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching year quarters:", error);
    res.status(500).json({ error: "Failed to fetch year quarters", details: error.message });
  }
});

// Get unique school years only (for Year dropdown)
app.get("/admin/school-years", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        sy.year_id,
        sy.school_year,
        sy.start_year,
        sy.end_year
      FROM school_year sy
      ORDER BY sy.start_year DESC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching school years:", error);
    res.status(500).json({ error: "Failed to fetch school years", details: error.message });
  }
});

// Get quarters for a specific year
app.get("/admin/quarters/:yearId", async (req, res) => {
  try {
    const { yearId } = req.params;
    
    const query = `
      SELECT 
        yq.yr_and_qtr_id,
        yq.quarter,
        yq.is_active
      FROM year_and_quarter yq
      WHERE yq.year = ?
      ORDER BY yq.quarter ASC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [yearId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching quarters for year:", error);
    res.status(500).json({ error: "Failed to fetch quarters", details: error.message });
  }
});

// Get active year and quarter for report creation
app.get("/admin/active-year-quarter-for-reports", async (req, res) => {
  try {
    const query = `
      SELECT year, quarter 
      FROM year_and_quarter 
      WHERE is_active = 1 
      ORDER BY yr_and_qtr_id DESC 
      LIMIT 1
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (result.length === 0) {
      return res.status(404).json({ error: "No active year and quarter set" });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error("Error fetching active year quarter for reports:", error);
    res.status(500).json({ error: "Failed to fetch active year quarter", details: error.message });
  }
});

// Get coordinator's own submissions (reports submitted by coordinator to principal)
app.get("/reports/submitted_by/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, quarter } = req.query;
    
    let sql = `
      SELECT
        s.submission_id,
        s.report_assignment_id,
        s.category_id,
        s.submitted_by,
        s.number_of_submission,
        s.status,
        s.value AS submission_title,
        DATE_FORMAT(s.date_submitted, '%m/%d/%Y') AS date_submitted,

        ra.report_assignment_id,
        ra.title AS assignment_title,
        DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
        DATE_FORMAT(ra.to_date, '%m/%d/%Y') AS to_date,
        ra.instruction,
        ra.allow_late,
        ra.is_given,
        ra.is_archived,
        ra.quarter,
        ra.year,
        qe.quarter_name,
        qe.quarter_short_name,
        sy.school_year,

        c.category_name,
        sc.sub_category_name,
        COALESCE(sc.sub_category_name, c.category_name) AS report_name,

        ud.name  AS submitted_by_name,   -- coordinator
        ud2.name AS given_by_name        -- principal
      FROM submission s
      JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
      JOIN category c           ON ra.category_id = c.category_id
      LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
      LEFT JOIN user_details ud  ON s.submitted_by = ud.user_id
      LEFT JOIN user_details ud2 ON ra.given_by    = ud2.user_id
      LEFT JOIN school_year sy ON sy.year_id = ra.year
      LEFT JOIN quarter_enum qe ON qe.quarter_number = ra.quarter
      WHERE ra.is_given = 0
        AND s.status = 0
        AND s.submitted_by = ?
    `;
    
    const params = [userId];
    
    if (year && quarter) {
      sql += ` AND ra.year = ? AND ra.quarter = ?`;
      params.push(year, quarter);
    }
    
    sql += `
      ORDER BY ra.to_date DESC, ra.report_assignment_id DESC, s.number_of_submission DESC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result || []);
  } catch (error) {
    console.error("Error fetching coordinator submissions:", error);
    res.status(500).json({ error: "Failed to fetch coordinator submissions", details: error.message });
  }
});

// Get assigned reports filtered by year and quarter
app.get("/reports/assigned_by/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, quarter } = req.query;
    
    // Use the existing controller logic but with year/quarter filtering
    let sql = `
      SELECT
        s.submission_id,
        s.report_assignment_id,
        s.category_id,
        s.submitted_by,
        s.number_of_submission,
        s.status,
        s.value AS submission_title,
        DATE_FORMAT(s.date_submitted, '%m/%d/%Y') AS date_submitted,

        ra.report_assignment_id,
        ra.title AS assignment_title,
        DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
        DATE_FORMAT(ra.to_date, '%m/%d/%Y') AS to_date,
        ra.instruction,
        ra.allow_late,
        ra.is_given,
        ra.is_archived,
        ra.quarter,
        ra.year,
        qe.quarter_name,
        qe.quarter_short_name,
        sy.school_year,

        c.category_name,
        sc.sub_category_name,
        COALESCE(sc.sub_category_name, c.category_name) AS report_name,

        ud.name  AS submitted_by_name,   -- teacher
        ud2.name AS given_by_name,       -- coordinator
        
        -- Grade and section information
        gl.grade_level,
        sec.section AS section_name
      FROM submission s
      JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
      JOIN category c           ON ra.category_id = c.category_id
      LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
      LEFT JOIN user_details ud  ON s.submitted_by = ud.user_id
      LEFT JOIN user_details ud2 ON ra.given_by    = ud2.user_id
      LEFT JOIN school_year sy ON sy.year_id = ra.year
      LEFT JOIN quarter_enum qe ON qe.quarter_number = ra.quarter
      LEFT JOIN teacher_section ts ON ud.user_id = ts.user_id
      LEFT JOIN section sec ON ts.section_id = sec.section_id
      LEFT JOIN grade_level gl ON sec.grade_level_id = gl.grade_level_id
      WHERE ra.given_by = ?
    `;
    
    const params = [userId];
    
    if (year && quarter) {
      sql += ` AND ra.year = ? AND ra.quarter = ?`;
      params.push(year, quarter);
    }
    
    sql += `
      ORDER BY ra.to_date DESC, ra.report_assignment_id DESC, s.number_of_submission DESC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result || []);
  } catch (error) {
    console.error("Error fetching assigned reports:", error);
    res.status(500).json({ error: "Failed to fetch assigned reports", details: error.message });
  }
});

// Get approved submissions by principal
app.get("/submissions/approved-by-principal", async (req, res) => {
  try {
    const principalId = req.user?.user_id;
    
    if (!principalId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sql = `
      SELECT 
        s.submission_id,
        s.category_id,
        s.submitted_by,
        s.status,
        s.number_of_submission,
        s.value as title,
        DATE_FORMAT(s.date_submitted, '%Y-%m-%d %H:%i:%s') AS date_submitted,
        s.fields,
        ud.name as submitted_by_name,
        ud.role as submitted_by_role,
        c.category_name,
        ra.title as assignment_title,
        ra.to_date as due_date,
        ra.given_by as assigned_by_principal,
        ra.year as assignment_year,
        ra.quarter as assignment_quarter,
        sy.school_year,
        qe.quarter_name,
        qe.quarter_short_name
      FROM submission s
      LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
      LEFT JOIN category c ON s.category_id = c.category_id
      LEFT JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
      LEFT JOIN school_year sy ON sy.year_id = ra.year
      LEFT JOIN quarter_enum qe ON qe.quarter_number = ra.quarter
      WHERE s.status = 3 
        AND ra.given_by = ?
      ORDER BY s.date_submitted DESC
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(sql, [principalId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Parse fields for each submission
    const submissions = result.map(row => {
      const out = { ...row };
      try { 
        out.fields = typeof out.fields === 'string' ? JSON.parse(out.fields) : out.fields; 
      } catch {
        out.fields = {};
      }
      return out;
    });
    
    res.json(submissions);
  } catch (error) {
    console.error("Error fetching approved submissions:", error);
    res.status(500).json({ error: "Failed to fetch approved submissions", details: error.message });
  }
});

// Get submitted reports filtered by year and quarter
app.get("/submissions/user/:userId", async (req, res) => {
  try {
    // Check authentication
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { userId } = req.params;
    const { year, quarter } = req.query;
    
    let query = `
      SELECT 
        s.submission_id,
        s.date_submitted,
        s.status,
        s.value as title,
        ra.title as assignment_title,
        ra.quarter,
        ra.year,
        c.category_name,
        sc.sub_category_name,
        st.value as status_text
      FROM submission s
      LEFT JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
      LEFT JOIN category c ON s.category_id = c.category_id
      LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
      LEFT JOIN status st ON s.status = st.status_id
      WHERE s.submitted_by = ?
    `;
    
    const params = [userId];
    
    if (year && quarter) {
      query += ` AND ra.year = ? AND ra.quarter = ?`;
      params.push(year, quarter);
    }
    
    query += ` ORDER BY s.date_submitted DESC`;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching submitted reports:", error);
    res.status(500).json({ error: "Failed to fetch submitted reports", details: error.message });
  }
});

// Get teachers from the same school as the requesting user
app.get("/users/teachers", async (req, res) => {
  try {
    // Check authentication
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // First get the requesting user's school_id
    const getUserQuery = `SELECT school_id FROM user_details WHERE user_id = ?`;
    const userResult = await new Promise((resolve, reject) => {
      db.query(getUserQuery, [req.user?.user_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (userResult.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const requesterSchoolId = userResult[0].school_id;
    
    if (!requesterSchoolId) {
      return res.json([]); // No school assigned, return empty list
    }

    // Get teachers and coordinators from the same school
    const query = `
      SELECT ud.user_id, ud.name, ud.email, ud.role
      FROM user_details ud
      WHERE ud.role IN ('teacher', 'coordinator')
      AND ud.school_id = ?
      ORDER BY ud.role, ud.name
    `;
    
    const teachers = await new Promise((resolve, reject) => {
      db.query(query, [requesterSchoolId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(teachers);
  } catch (error) {
    console.error("Error fetching teachers:", error);
    res.status(500).json({ error: "Failed to fetch teachers", details: error.message });
  }
});

// Get coordinators from the same school as the requesting user
app.get("/users/coordinators", async (req, res) => {
  try {
    // Check authentication
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // First get the requesting user's school_id
    const getUserQuery = `SELECT school_id FROM user_details WHERE user_id = ?`;
    const userResult = await new Promise((resolve, reject) => {
      db.query(getUserQuery, [req.user?.user_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (userResult.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const requesterSchoolId = userResult[0].school_id;
    
    if (!requesterSchoolId) {
      return res.json([]); // No school assigned, return empty list
    }

    // Get coordinators from the same school
    const query = `
      SELECT ud.user_id, ud.name, ud.email
      FROM user_details ud
      WHERE ud.role = 'coordinator' 
      AND ud.school_id = ?
      ORDER BY ud.name
    `;
    
    const coordinators = await new Promise((resolve, reject) => {
      db.query(query, [requesterSchoolId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(coordinators);
  } catch (error) {
    console.error("Error fetching coordinators:", error);
    res.status(500).json({ error: "Failed to fetch coordinators", details: error.message });
  }
});

app.get("/admin/users", async (req, res) => {
  try {
    console.log("Admin users endpoint called");
    
    const query = `
      SELECT 
        ud.user_id,
        ud.name,
        ud.role,
        ud.email,
        s.school_name,
        sec.section as section_name,
        gl.grade_level
      FROM user_details ud
      LEFT JOIN school s ON ud.school_id = s.school_id
      LEFT JOIN teacher_section ts ON ud.user_id = ts.user_id
      LEFT JOIN section sec ON ts.section_id = sec.section_id
      LEFT JOIN grade_level gl ON sec.grade_level_id = gl.grade_level_id
      ORDER BY ud.user_id
    `;
    
    console.log("Executing query:", query);
    const rows = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    console.log("Query result:", rows);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users", details: error.message });
  }
});

// Get available roles from database enum
app.get("/admin/roles", async (req, res) => {
  try {
    const query = `
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_details' 
      AND COLUMN_NAME = 'role'
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Role column not found" });
    }
    
    // Parse the enum values from the column type
    const columnType = result[0].COLUMN_TYPE;
    const enumMatch = columnType.match(/enum\(([^)]+)\)/);
    
    if (!enumMatch) {
      return res.status(404).json({ error: "Role column is not an enum" });
    }
    
    const enumValues = enumMatch[1]
      .split(',')
      .map(value => value.trim().replace(/'/g, ''))
      .filter(value => value.length > 0);
    
    res.json(enumValues);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles", details: error.message });
  }
});

// Add new user
app.post("/admin/users", async (req, res) => {
  try {
    const { name, email, role } = req.body;
    
    if (!name || !email || !role) {
      return res.status(400).json({ error: "Name, email, and role are required" });
    }
    
    // Validate role
    const validRoles = ['teacher', 'coordinator', 'principal', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    
    // Check if email already exists
    const checkEmailQuery = `SELECT user_id FROM user_details WHERE email = ?`;
    const existingUser = await new Promise((resolve, reject) => {
      db.query(checkEmailQuery, [email], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }
    
    // Insert new user
    const insertUserQuery = `
      INSERT INTO user_details (name, email, role) 
      VALUES (?, ?, ?)
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(insertUserQuery, [name, email, role], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const newUser = {
      user_id: result.insertId,
      name,
      email,
      role,
      school_name: null
    };
    
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Failed to add user", details: error.message });
  }
});

// Get all schools
app.get("/admin/schools", async (req, res) => {
  try {
    const query = `
      SELECT 
        school_id,
        school_number,
        school_name
      FROM school
      ORDER BY school_name
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching schools:", error);
    res.status(500).json({ error: "Failed to fetch schools", details: error.message });
  }
});

// Get all school years
app.get("/admin/school-years", async (req, res) => {
  try {
    const query = `
      SELECT 
        year_id,
        school_year,
        start_year,
        end_year,
        is_active
      FROM school_year
      ORDER BY start_year DESC, end_year DESC
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching school years:", error);
    res.status(500).json({ error: "Failed to fetch school years", details: error.message });
  }
});

// Get all quarters
app.get("/admin/quarters", async (req, res) => {
  try {
    const query = `
      SELECT 
        quarter_period_id,
        quarter,
        year_id
      FROM quarter_period
      ORDER BY quarter_period_id
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching quarters:", error);
    res.status(500).json({ error: "Failed to fetch quarters", details: error.message });
  }
});

// Get sections by school
app.get("/admin/sections/:schoolId", async (req, res) => {
  try {
    const { schoolId } = req.params;
    const query = `
      SELECT 
        s.section_id,
        s.section,
        s.grade_level_id,
        gl.grade_level
      FROM section s
      LEFT JOIN grade_level gl ON s.grade_level_id = gl.grade_level_id
      WHERE s.school_id = ?
      ORDER BY gl.grade_level, s.section
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, [schoolId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching sections:", error);
    res.status(500).json({ error: "Failed to fetch sections", details: error.message });
  }
});

// Get all grade levels
app.get("/admin/grade-levels", async (req, res) => {
  try {
    const query = `
      SELECT 
        grade_level_id,
        grade_level
      FROM grade_level
      ORDER BY grade_level
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching grade levels:", error);
    res.status(500).json({ error: "Failed to fetch grade levels", details: error.message });
  }
});

// Get all subjects
app.get("/subjects", async (req, res) => {
  try {
    const query = `
      SELECT 
        subject_id,
        subject_name,
        subject_code,
        grade_level_id
      FROM subject
      WHERE is_active = 1
      ORDER BY subject_name
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, [], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects", details: error.message });
  }
});

// Get subjects by grade level
app.get("/admin/subjects/:gradeLevelId", async (req, res) => {
  try {
    const { gradeLevelId } = req.params;
    const query = `
      SELECT 
        subject_id,
        subject_name,
        subject_code,
        grade_level_id
      FROM subject
      WHERE grade_level_id = ? AND is_active = 1
      ORDER BY subject_name
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, [gradeLevelId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects", details: error.message });
  }
});


// ==================== QUARTER ENUM API ENDPOINTS ====================

// Get all quarter enum values
app.get("/admin/quarter-enum", async (req, res) => {
  try {
    const query = `
      SELECT 
        quarter_id,
        quarter_number,
        quarter_name,
        quarter_short_name
      FROM quarter_enum
      ORDER BY quarter_number ASC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching quarter enum:", error);
    res.status(500).json({ error: "Failed to fetch quarter enum", details: error.message });
  }
});

// Get quarters for a specific year using the new structure
app.get("/admin/quarters/:yearId", async (req, res) => {
  try {
    const { yearId } = req.params;
    
    const query = `
      SELECT 
        yq.yr_and_qtr_id,
        yq.year,
        yq.quarter,
        qe.quarter_name,
        qe.quarter_short_name,
        yq.is_active
      FROM year_and_quarter yq
      JOIN quarter_enum qe ON yq.quarter = qe.quarter_number
      WHERE yq.year = ?
      ORDER BY yq.quarter ASC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [yearId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching quarters for year:", error);
    res.status(500).json({ error: "Failed to fetch quarters", details: error.message });
  }
});

// Get school years and quarters from actual report assignments
app.get("/reports/assignment-years-quarters/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🔍 [DEBUG] Fetching assignment years and quarters for user:', userId);
    console.log('🔍 [DEBUG] User ID type:', typeof userId);
    console.log('🔍 [DEBUG] User ID value:', userId);
    
    // First, let's check if there are any report assignments for this user
    const checkQuery = `SELECT COUNT(*) as count FROM report_assignment WHERE given_by = ?`;
    const checkResult = await new Promise((resolve, reject) => {
      db.query(checkQuery, [parseInt(userId)], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log('🔍 [DEBUG] Report assignments count for user', userId, ':', checkResult[0].count);
    
    // Let's also check what users have report assignments
    const allAssignmentsQuery = `SELECT DISTINCT given_by FROM report_assignment LIMIT 10`;
    const allAssignments = await new Promise((resolve, reject) => {
      db.query(allAssignmentsQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    console.log('🔍 [DEBUG] Users with report assignments:', allAssignments);
    
    if (checkResult[0].count === 0) {
      console.log('🔍 [DEBUG] No report assignments found for user, returning all available school years');
      
      // Return all available school years with all quarters as fallback
      const fallbackQuery = `
        SELECT DISTINCT
          sy.year_id,
          sy.school_year,
          sy.start_year,
          sy.end_year,
          qe.quarter_number as quarter,
          qe.quarter_name,
          qe.quarter_short_name
        FROM school_year sy
        CROSS JOIN quarter_enum qe
        ORDER BY sy.start_year DESC, qe.quarter_number ASC
      `;
      
      const fallbackResult = await new Promise((resolve, reject) => {
        db.query(fallbackQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      // Group by school year and quarters
      const groupedData = {};
      fallbackResult.forEach(row => {
        const yearKey = row.school_year;
        if (!groupedData[yearKey]) {
          groupedData[yearKey] = {
            year_id: row.year_id,
            school_year: row.school_year,
            start_year: row.start_year,
            end_year: row.end_year,
            quarters: []
          };
        }
        
        // Add quarter if not already present
        const quarterExists = groupedData[yearKey].quarters.some(q => q.quarter === row.quarter);
        if (!quarterExists) {
          groupedData[yearKey].quarters.push({
            quarter: row.quarter,
            quarter_name: row.quarter_name,
            quarter_short_name: row.quarter_short_name
          });
        }
      });
      
      const finalResult = Object.values(groupedData);
      console.log('🔍 [DEBUG] Fallback result:', finalResult);
      return res.json(finalResult);
    }
    
    const query = `
      SELECT DISTINCT
        sy.year_id,
        sy.school_year,
        sy.start_year,
        sy.end_year,
        ra.quarter,
        qe.quarter_name,
        qe.quarter_short_name
      FROM report_assignment ra
      JOIN school_year sy ON sy.year_id = ra.year
      JOIN quarter_enum qe ON qe.quarter_number = ra.quarter
      WHERE ra.given_by = ?
      ORDER BY sy.start_year DESC, ra.quarter ASC
    `;
    
    console.log('🔍 [DEBUG] Query:', query);
    console.log('🔍 [DEBUG] User ID:', userId);
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [parseInt(userId)], (err, results) => {
        if (err) {
          console.error('🔍 [DEBUG] Database error:', err);
          reject(err);
        } else {
          console.log('🔍 [DEBUG] Raw database results:', results);
          resolve(results);
        }
      });
    });
    
    // Group by school year and quarters
    const groupedData = {};
    result.forEach(row => {
      const yearKey = row.school_year;
      if (!groupedData[yearKey]) {
        groupedData[yearKey] = {
          year_id: row.year_id,
          school_year: row.school_year,
          start_year: row.start_year,
          end_year: row.end_year,
          quarters: []
        };
      }
      
      // Add quarter if not already present
      const quarterExists = groupedData[yearKey].quarters.some(q => q.quarter === row.quarter);
      if (!quarterExists) {
        groupedData[yearKey].quarters.push({
          quarter: row.quarter,
          quarter_name: row.quarter_name,
          quarter_short_name: row.quarter_short_name
        });
      }
    });
    
    // Convert to array format
    const finalResult = Object.values(groupedData);
    
    console.log('🔍 [DEBUG] Grouped data:', groupedData);
    console.log('🔍 [DEBUG] Final result:', finalResult);
    console.log('🔍 [DEBUG] Final result length:', finalResult.length);
    
    res.json(finalResult);
  } catch (error) {
    console.error("Error fetching assignment years and quarters:", error);
    res.status(500).json({ error: "Failed to fetch assignment years and quarters", details: error.message });
  }
});

// Get school years and quarters from submitted reports (for teachers)
app.get("/reports/submitted-years-quarters/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT DISTINCT
        sy.year_id,
        sy.school_year,
        sy.start_year,
        sy.end_year,
        s.quarter,
        qe.quarter_name,
        qe.quarter_short_name
      FROM submission s
      JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
      JOIN school_year sy ON sy.year_id = ra.year
      JOIN quarter_enum qe ON qe.quarter_number = s.quarter
      WHERE s.submitted_by = ?
      ORDER BY sy.start_year DESC, s.quarter ASC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Group by school year and quarters
    const groupedData = {};
    result.forEach(row => {
      const yearKey = row.school_year;
      if (!groupedData[yearKey]) {
        groupedData[yearKey] = {
          year_id: row.year_id,
          school_year: row.school_year,
          start_year: row.start_year,
          end_year: row.end_year,
          quarters: []
        };
      }
      
      // Add quarter if not already present
      const quarterExists = groupedData[yearKey].quarters.some(q => q.quarter === row.quarter);
      if (!quarterExists) {
        groupedData[yearKey].quarters.push({
          quarter: row.quarter,
          quarter_name: row.quarter_name,
          quarter_short_name: row.quarter_short_name
        });
      }
    });
    
    // Convert to array format
    const finalResult = Object.values(groupedData);
    
    res.json(finalResult);
  } catch (error) {
    console.error("Error fetching submitted years and quarters:", error);
    res.status(500).json({ error: "Failed to fetch submitted years and quarters", details: error.message });
  }
});

// Get school years and quarters from reports for approval (for principals)
app.get("/reports/approval-years-quarters/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT DISTINCT
        sy.year_id,
        sy.school_year,
        sy.start_year,
        sy.end_year,
        s.quarter,
        qe.quarter_name,
        qe.quarter_short_name
      FROM submission s
      JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
      JOIN school_year sy ON sy.year_id = ra.year
      JOIN quarter_enum qe ON qe.quarter_number = s.quarter
      WHERE s.submitted_by IN (
        SELECT user_id FROM user_details 
        WHERE role = 'teacher' AND user_id IN (
          SELECT DISTINCT submitted_by FROM submission
        )
      ) AND s.status IN (2, 3)
      ORDER BY sy.start_year DESC, s.quarter ASC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Group by school year and quarters
    const groupedData = {};
    result.forEach(row => {
      const yearKey = row.school_year;
      if (!groupedData[yearKey]) {
        groupedData[yearKey] = {
          year_id: row.year_id,
          school_year: row.school_year,
          start_year: row.start_year,
          end_year: row.end_year,
          quarters: []
        };
      }
      
      // Add quarter if not already present
      const quarterExists = groupedData[yearKey].quarters.some(q => q.quarter === row.quarter);
      if (!quarterExists) {
        groupedData[yearKey].quarters.push({
          quarter: row.quarter,
          quarter_name: row.quarter_name,
          quarter_short_name: row.quarter_short_name
        });
      }
    });
    
    // Convert to array format
    const finalResult = Object.values(groupedData);
    
    res.json(finalResult);
  } catch (error) {
    console.error("Error fetching approval years and quarters:", error);
    res.status(500).json({ error: "Failed to fetch approval years and quarters", details: error.message });
  }
});

// Get comprehensive quarter information
app.get("/admin/quarters-comprehensive", async (req, res) => {
  try {
    const query = `
      SELECT 
        yq.yr_and_qtr_id,
        yq.year,
        yq.quarter,
        yq.is_active,
        sy.school_year,
        sy.start_year,
        sy.end_year,
        qe.quarter_name,
        qe.quarter_short_name
      FROM year_and_quarter yq
      LEFT JOIN school_year sy ON sy.year_id = yq.year
      LEFT JOIN quarter_enum qe ON qe.quarter_number = yq.quarter
      ORDER BY yq.year DESC, yq.quarter ASC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching comprehensive quarters:", error);
    res.status(500).json({ error: "Failed to fetch comprehensive quarters", details: error.message });
  }
});

// Get active year and quarter with enum information
app.get("/admin/active-year-quarter", async (req, res) => {
  try {
    const query = `
      SELECT 
        yq.yr_and_qtr_id,
        yq.year,
        yq.quarter,
        qe.quarter_name,
        qe.quarter_short_name,
        sy.school_year,
        sy.start_year,
        sy.end_year
      FROM year_and_quarter yq
      JOIN quarter_enum qe ON yq.quarter = qe.quarter_number
      JOIN school_year sy ON yq.year = sy.year_id
      WHERE yq.is_active = 1
      LIMIT 1
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (result.length === 0) {
      return res.status(404).json({ error: "No active year and quarter found" });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error("Error fetching active year and quarter:", error);
    res.status(500).json({ error: "Failed to fetch active year and quarter", details: error.message });
  }
});

// Set active year and quarter with enum validation
app.post("/admin/set-active-year-quarter", async (req, res) => {
  try {
    const { yr_and_qtr_id, year, quarter } = req.body;
    
    // Validate quarter if provided
    if (quarter && ![1, 2, 3, 4].includes(parseInt(quarter))) {
      return res.status(400).json({ error: "Quarter must be 1, 2, 3, or 4" });
    }
    
    // Handle both old format (yr_and_qtr_id) and new format (year, quarter)
    let targetYearQuarterId = yr_and_qtr_id;
    
    console.log("DEBUG: Received parameters:", { yr_and_qtr_id, year, quarter });
    
    if (!targetYearQuarterId && (year && quarter)) {
      console.log("DEBUG: Looking for year-quarter combination:", { year, quarter });
      
      // Find the year-quarter combination
      const findQuery = `
        SELECT yq.yr_and_qtr_id, yq.year, yq.quarter, sy.school_year
        FROM year_and_quarter yq
        LEFT JOIN school_year sy ON sy.year_id = yq.year
        WHERE sy.school_year = ? AND yq.quarter = ?
      `;
      
      const findResult = await new Promise((resolve, reject) => {
        db.query(findQuery, [year, quarter], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      console.log("DEBUG: Find query result:", findResult);
      
      if (findResult.length === 0) {
        return res.status(404).json({ error: "Year and quarter combination not found" });
      }
      
      targetYearQuarterId = findResult[0].yr_and_qtr_id;
      console.log("DEBUG: Found targetYearQuarterId:", targetYearQuarterId);
    }
    
    if (!targetYearQuarterId) {
      return res.status(400).json({ error: "Either yr_and_qtr_id or (year and quarter) must be provided" });
    }
    
    // Deactivate all year-quarters first
    const deactivateQuery = `UPDATE year_and_quarter SET is_active = 0`;
    await new Promise((resolve, reject) => {
      db.query(deactivateQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Activate the target year-quarter
    const activateQuery = `UPDATE year_and_quarter SET is_active = 1 WHERE yr_and_qtr_id = ?`;
    await new Promise((resolve, reject) => {
      db.query(activateQuery, [targetYearQuarterId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Get the activated year-quarter info
    const getActiveQuery = `
      SELECT 
        yq.yr_and_qtr_id,
        yq.year,
        yq.quarter,
        qe.quarter_name,
        qe.quarter_short_name,
        sy.school_year
      FROM year_and_quarter yq
      JOIN quarter_enum qe ON yq.quarter = qe.quarter_number
      JOIN school_year sy ON yq.year = sy.year_id
      WHERE yq.yr_and_qtr_id = ?
    `;
    
    const activeResult = await new Promise((resolve, reject) => {
      db.query(getActiveQuery, [targetYearQuarterId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({ 
      message: "Active year and quarter updated successfully",
      active_year_quarter: activeResult[0]
    });
    
  } catch (error) {
    console.error("Error setting active year and quarter:", error);
    res.status(500).json({ error: "Failed to set active year and quarter", details: error.message });
  }
});

// Create new year and quarter with enum validation
app.post("/admin/year-quarter", async (req, res) => {
  try {
    const { year, quarter } = req.body;
    
    if (!year || !quarter) {
      return res.status(400).json({ error: "Year and quarter are required" });
    }
    
    // Validate quarter is 1-4
    if (![1, 2, 3, 4].includes(parseInt(quarter))) {
      return res.status(400).json({ error: "Quarter must be 1, 2, 3, or 4" });
    }
    
    // Parse the year string (e.g., "2025-2026") to get start and end years
    const [startYear, endYear] = year.split('-').map(y => parseInt(y));
    
    if (!startYear || !endYear) {
      return res.status(400).json({ error: "Invalid year format. Expected format: YYYY-YYYY" });
    }
    
    // First, check if the school year exists, if not create it
    let yearId;
    const checkSchoolYearQuery = `
      SELECT year_id FROM school_year WHERE school_year = ?
    `;
    
    const existingSchoolYear = await new Promise((resolve, reject) => {
      db.query(checkSchoolYearQuery, [year], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (existingSchoolYear.length > 0) {
      yearId = existingSchoolYear[0].year_id;
    } else {
      // Create new school year
      const insertSchoolYearQuery = `
        INSERT INTO school_year (school_year, start_year, end_year, is_active) 
        VALUES (?, ?, ?, 0)
      `;
      
      const newSchoolYear = await new Promise((resolve, reject) => {
        db.query(insertSchoolYearQuery, [year, startYear, endYear], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      yearId = newSchoolYear.insertId;
    }
    
    // Check if this year and quarter combination already exists
    const checkQuery = `
      SELECT yr_and_qtr_id FROM year_and_quarter 
      WHERE year = ? AND quarter = ?
    `;
    
    const existing = await new Promise((resolve, reject) => {
      db.query(checkQuery, [yearId, quarter], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (existing.length > 0) {
      return res.status(400).json({ error: "This year and quarter combination already exists" });
    }
    
    // Get the quarter name from enum
    const quarterNameQuery = `
      SELECT quarter_name, quarter_short_name FROM quarter_enum WHERE quarter_number = ?
    `;
    
    const quarterInfo = await new Promise((resolve, reject) => {
      db.query(quarterNameQuery, [quarter], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (quarterInfo.length === 0) {
      return res.status(400).json({ error: "Invalid quarter number" });
    }
    
    const quarterName = quarterInfo[0].quarter_name;
    const quarterShortName = quarterInfo[0].quarter_short_name;
    
    // Create year and quarter entry
    const insertQuery = `
      INSERT INTO year_and_quarter (year, quarter, is_active) 
      VALUES (?, ?, 0)
    `;
    
    const newYearQuarter = await new Promise((resolve, reject) => {
      db.query(insertQuery, [yearId, quarter], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Create quarter period entry
    const insertQuarterPeriodQuery = `
      INSERT INTO quarter_period (year_id, quarter, quarter_number) 
      VALUES (?, ?, ?)
    `;
    
    await new Promise((resolve, reject) => {
      db.query(insertQuarterPeriodQuery, [yearId, quarterShortName, quarter], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Create school year quarters entry
    const insertSchoolYearQuartersQuery = `
      INSERT INTO school_year_quarters (school_year, quarter_number, quarter_name, start_date, end_date, is_active) 
      VALUES (?, ?, ?, ?, ?, 0)
    `;
    
    // Calculate start and end dates based on quarter
    let startDate, endDate;
    switch (parseInt(quarter)) {
      case 1:
        startDate = `${startYear}-08-01`;
        endDate = `${startYear}-10-31`;
        break;
      case 2:
        startDate = `${startYear}-11-01`;
        endDate = `${endYear}-01-31`;
        break;
      case 3:
        startDate = `${endYear}-02-01`;
        endDate = `${endYear}-04-30`;
        break;
      case 4:
        startDate = `${endYear}-05-01`;
        endDate = `${endYear}-07-31`;
        break;
    }
    
    await new Promise((resolve, reject) => {
      db.query(insertSchoolYearQuartersQuery, [year, quarter, quarterName, startDate, endDate], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({ 
      message: "Year and quarter created successfully",
      year_quarter_id: newYearQuarter.insertId,
      year_id: yearId,
      quarter: quarter,
      quarter_name: quarterName
    });
    
  } catch (error) {
    console.error("Error creating year and quarter:", error);
    res.status(500).json({ error: "Failed to create year and quarter", details: error.message });
  }
});

// Assign user to school
app.post("/admin/assign-user", async (req, res) => {
  try {
    const { user_id, school_name, section, grade_level, category, sub_category } = req.body;
    
    if (!user_id || !school_name) {
      return res.status(400).json({ error: "User ID and school name are required" });
    }
    
    // First, get the school_id from school_name
    const getSchoolIdQuery = `SELECT school_id FROM school WHERE school_name = ?`;
    const schoolResult = await new Promise((resolve, reject) => {
      db.query(getSchoolIdQuery, [school_name], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (schoolResult.length === 0) {
      return res.status(404).json({ error: "School not found" });
    }
    
    const school_id = schoolResult[0].school_id;
    
    // Validation: Check for existing assignments
    if (section && grade_level) {
      // Check if another teacher is already assigned to this section and grade
      const checkTeacherSectionQuery = `
        SELECT ts.user_id, ud.name 
        FROM teacher_section ts
        JOIN user_details ud ON ts.user_id = ud.user_id
        JOIN section s ON ts.section_id = s.section_id
        WHERE s.section = ? AND s.school_id = ? AND s.grade_level_id = ?
        AND ts.user_id != ?
      `;
      
      const existingTeacherResult = await new Promise((resolve, reject) => {
        db.query(checkTeacherSectionQuery, [section, school_id, grade_level, user_id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (existingTeacherResult.length > 0) {
        return res.status(400).json({ 
          error: `Section ${section} in Grade ${grade_level} is already assigned to ${existingTeacherResult[0].name}` 
        });
      }
    }
    
    if (category && sub_category) {
      // Check if another coordinator is already assigned to this category and sub-category
      const checkCoordinatorQuery = `
        SELECT cg.user_id, ud.name 
        FROM coordinator_grade cg
        JOIN user_details ud ON cg.user_id = ud.user_id
        WHERE cg.school_id = ? AND cg.grade_level_id = ?
        AND cg.user_id != ?
      `;
      
      const existingCoordinatorResult = await new Promise((resolve, reject) => {
        db.query(checkCoordinatorQuery, [school_id, grade_level, user_id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (existingCoordinatorResult.length > 0) {
        return res.status(400).json({ 
          error: `Grade ${grade_level} coordinator position is already assigned to ${existingCoordinatorResult[0].name}` 
        });
      }
    }
    
    // Update user_details table to include school assignment
    const updateUserQuery = `
      UPDATE user_details 
      SET school_id = ? 
      WHERE user_id = ?
    `;
    
    await new Promise((resolve, reject) => {
      db.query(updateUserQuery, [school_id, user_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // If section and grade_level are provided, handle them through teacher_section table
    if (section && grade_level) {
      // Get the active year/quarter ID
      const getYearQuery = `SELECT yr_and_qtr_id FROM year_and_quarter WHERE is_active = 1 ORDER BY yr_and_qtr_id DESC LIMIT 1`;
      const yearResult = await new Promise((resolve, reject) => {
        db.query(getYearQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (yearResult.length === 0) {
        return res.status(400).json({ error: "No active year and quarter set. Please set an active year and quarter first." });
      }
      
      const yearId = yearResult[0].yr_and_qtr_id;
      
      // Get the section_id from the section table
      const getSectionIdQuery = `
        SELECT section_id FROM section 
        WHERE section = ? AND school_id = ? AND grade_level_id = ?
      `;
      const sectionResult = await new Promise((resolve, reject) => {
        db.query(getSectionIdQuery, [section, school_id, grade_level], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (sectionResult.length > 0) {
        const sectionId = sectionResult[0].section_id;
        
        // First, remove any existing teacher_section assignments for this user
        const deleteExistingQuery = `DELETE FROM teacher_section WHERE user_id = ?`;
        await new Promise((resolve, reject) => {
          db.query(deleteExistingQuery, [user_id], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
        
        // Insert new teacher_section assignment
        const insertTeacherSectionQuery = `
          INSERT INTO teacher_section (user_id, section_id, yr_and_qtr_id, role) 
          VALUES (?, ?, ?, 'adviser')
        `;
        
        await new Promise((resolve, reject) => {
          db.query(insertTeacherSectionQuery, [user_id, sectionId, yearId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
      }
    }
    
    // Handle coordinator category assignments
    if (category && sub_category) {
      // Get the active year/quarter ID
      const getYearQuery = `SELECT yr_and_qtr_id FROM year_and_quarter WHERE is_active = 1 ORDER BY yr_and_qtr_id DESC LIMIT 1`;
      const yearResult = await new Promise((resolve, reject) => {
        db.query(getYearQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (yearResult.length === 0) {
        return res.status(400).json({ error: "No active year and quarter set. Please set an active year and quarter first." });
      }
      
      const yearId = yearResult[0].yr_and_qtr_id;
      
      // Get the grade_level_id from the grade_level table
      const getGradeLevelQuery = `SELECT grade_level_id FROM grade_level WHERE grade_level = ?`;
      const gradeResult = await new Promise((resolve, reject) => {
        db.query(getGradeLevelQuery, [grade_level], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (gradeResult.length > 0) {
        const gradeLevelId = gradeResult[0].grade_level_id;
        
        // First, remove any existing coordinator_grade assignments for this user
        const deleteExistingCoordinatorQuery = `DELETE FROM coordinator_grade WHERE user_id = ?`;
        await new Promise((resolve, reject) => {
          db.query(deleteExistingCoordinatorQuery, [user_id], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
        
        // Insert new coordinator_grade assignment
        const insertCoordinatorGradeQuery = `
          INSERT INTO coordinator_grade (user_id, school_id, grade_level_id, yr_and_qtr_id, role) 
          VALUES (?, ?, ?, ?, 'coordinator')
        `;
        
        await new Promise((resolve, reject) => {
          db.query(insertCoordinatorGradeQuery, [user_id, school_id, gradeLevelId, yearId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
      }
    }
    
    res.json({ 
      success: true, 
      message: "User assigned to school successfully",
      user_id,
      school_name,
      school_id
    });
  } catch (error) {
    console.error("Error assigning user:", error);
    res.status(500).json({ error: "Failed to assign user", details: error.message });
  }
});

// Unassign user from school
app.post("/admin/unassign-user", async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    // Remove school assignment from user_details
    const updateUserQuery = `
      UPDATE user_details 
      SET school_id = NULL 
      WHERE user_id = ?
    `;
    
    await new Promise((resolve, reject) => {
      db.query(updateUserQuery, [user_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Remove teacher_section assignments
    const deleteTeacherSectionQuery = `DELETE FROM teacher_section WHERE user_id = ?`;
    await new Promise((resolve, reject) => {
      db.query(deleteTeacherSectionQuery, [user_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Remove coordinator_grade assignments
    const deleteCoordinatorGradeQuery = `DELETE FROM coordinator_grade WHERE user_id = ?`;
    await new Promise((resolve, reject) => {
      db.query(deleteCoordinatorGradeQuery, [user_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({ 
      success: true, 
      message: "User unassigned from school successfully",
      user_id
    });
  } catch (error) {
    console.error("Error unassigning user:", error);
    res.status(500).json({ error: "Failed to unassign user", details: error.message });
  }
});

// Delete user
app.delete("/admin/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    // First, remove all related assignments
    const deleteTeacherSectionQuery = `DELETE FROM teacher_section WHERE user_id = ?`;
    await new Promise((resolve, reject) => {
      db.query(deleteTeacherSectionQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const deleteCoordinatorGradeQuery = `DELETE FROM coordinator_grade WHERE user_id = ?`;
    await new Promise((resolve, reject) => {
      db.query(deleteCoordinatorGradeQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Remove school assignment
    const updateUserQuery = `UPDATE user_details SET school_id = NULL WHERE user_id = ?`;
    await new Promise((resolve, reject) => {
      db.query(updateUserQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Finally, delete the user from user_details
    const deleteUserQuery = `DELETE FROM user_details WHERE user_id = ?`;
    await new Promise((resolve, reject) => {
      db.query(deleteUserQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({ 
      success: true, 
      message: "User deleted successfully",
      userId
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user", details: error.message });
  }
});

// Add new school
app.post("/admin/schools", async (req, res) => {
  try {
    const { school_name } = req.body;
    
    if (!school_name || !school_name.trim()) {
      return res.status(400).json({ error: "School name is required" });
    }
    
    // Get the next available school_number
    const getNextSchoolNumberQuery = `
      SELECT COALESCE(MAX(school_number), 0) + 1 as next_number 
      FROM school
    `;
    
    const nextNumberResult = await new Promise((resolve, reject) => {
      db.query(getNextSchoolNumberQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const nextSchoolNumber = nextNumberResult[0].next_number;
    console.log("Current max school_number:", nextNumberResult[0].next_number - 1);
    console.log("Next school_number will be:", nextSchoolNumber);
    
    const query = `
      INSERT INTO school (school_number, school_name) 
      VALUES (?, ?)
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [nextSchoolNumber, school_name.trim()], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const newSchool = {
      school_id: result.insertId,
      school_number: nextSchoolNumber,
      school_name: school_name.trim()
    };
    
    res.status(201).json(newSchool);
  } catch (error) {
    console.error("Error adding school:", error);
    res.status(500).json({ error: "Failed to add school", details: error.message });
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
        return res.redirect(`${FRONTEND_URL}/UserManagement`);
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

// Health check must be defined BEFORE the param route so it isn't captured by :userId
app.get("/reports/upcoming-deadlines/health", (req, res) => {
  res.json({ ok: true, route: "/reports/upcoming-deadlines/:userId" });
});

// Get single report assignment for editing (must be defined BEFORE the param route)
app.get("/reports/assignment/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log('🔄 [DEBUG] Fetching report assignment for editing:', reportId);

    const query = `
      SELECT
        ra.report_assignment_id,
        ra.category_id,
        ra.sub_category_id,
        ra.given_by,
        ra.quarter,
        ra.year,
        ra.title,
        ra.from_date,
        ra.to_date,
        ra.instruction,
        ra.is_given,
        ra.is_archived,
        ra.allow_late,
        c.category_name,
        sc.sub_category_name,
        sy.school_year,
        ud.name AS given_by_name
      FROM report_assignment ra
      JOIN category c ON ra.category_id = c.category_id
      LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
      LEFT JOIN user_details ud ON ra.given_by = ud.user_id
      LEFT JOIN school_year sy ON sy.year_id = ra.year
      WHERE ra.report_assignment_id = ?
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(query, [reportId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (result.length === 0) {
      return res.status(404).json({ error: "Report assignment not found" });
    }

    console.log('🔄 [DEBUG] Report assignment found:', result[0]);
    res.json(result[0]);
  } catch (error) {
    console.error("Error fetching report assignment:", error);
    res.status(500).json({ error: "Failed to fetch report assignment", details: error.message });
  }
});

// Mark an existing report assignment as given (is_given = 1) and bump related submissions to status = 1
app.post("/reports/assignment/:reportId/mark-given", async (req, res) => {
  const { reportId } = req.params;
  try {
    await new Promise((resolve, reject) => {
      const sql = `UPDATE report_assignment SET is_given = 1 WHERE report_assignment_id = ?`;
      db.query(sql, [reportId], (err, result) => (err ? reject(err) : resolve(result)));
    });

    await new Promise((resolve, reject) => {
      const sql = `UPDATE submission SET status = 1 WHERE report_assignment_id = ? AND status = 0`;
      db.query(sql, [reportId], (err, result) => (err ? reject(err) : resolve(result)));
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Error marking report assignment as given:", error);
    res.status(500).json({ error: "Failed to mark assignment as given", details: error.message });
  }
});

// Coordinator upcoming deadlines (must be registered BEFORE the generic /reports router)
app.get("/reports/upcoming-deadlines/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🔄 [DEBUG] Fetching upcoming deadline submissions for coordinator:', userId);

    const query = `
      SELECT
        s.submission_id,
        s.report_assignment_id,
        s.category_id,
        s.submitted_by,
        s.status,
        s.value AS submission_title,
        DATE_FORMAT(s.date_submitted, '%m/%d/%Y') AS date_submitted,

        ra.title AS assignment_title,
        DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
        DATE_FORMAT(ra.to_date, '%m/%d/%Y') AS to_date,
        ra.instruction,
        ra.allow_late,
        ra.is_given,
        ra.is_archived,
        ra.quarter,
        ra.year,

        c.category_name,
        sc.sub_category_name,
        sy.school_year,

        ud.name AS submitted_by_name,
        ud2.name AS given_by_name,
        COALESCE(adc.recipients_count, sdc.sub_recipients, 0) AS recipients_count
      FROM submission s
      JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
      JOIN category c ON ra.category_id = c.category_id
      LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
      LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
      LEFT JOIN user_details ud2 ON ra.given_by = ud2.user_id
      LEFT JOIN school_year sy ON sy.year_id = ra.year
      LEFT JOIN (
        SELECT report_assignment_id, COUNT(DISTINCT user_id) AS recipients_count
        FROM assignment_distribution
        GROUP BY report_assignment_id
      ) adc ON adc.report_assignment_id = ra.report_assignment_id
      LEFT JOIN (
        SELECT report_assignment_id, COUNT(DISTINCT submitted_by) AS sub_recipients
        FROM submission
        GROUP BY report_assignment_id
      ) sdc ON sdc.report_assignment_id = ra.report_assignment_id
      WHERE s.submitted_by = ?
      AND ra.is_given = 0
      AND (s.status = 1 OR s.status = 4)
      ORDER BY ra.to_date ASC, s.date_submitted ASC
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log('🔄 [DEBUG] Upcoming deadline submissions (pending/rejected only):', result.length);
    res.json(result);
  } catch (error) {
    console.error("Error fetching upcoming deadline submissions:", error);
    res.status(500).json({ error: "Failed to fetch upcoming deadline submissions", details: error.message });
  }
});

/* ----------------- App routes ----------------- */
app.use("/users", usersRouter);
app.use("/reports", reportAssignmentRouter);
app.use("/categories", categoryRouter);
app.use("/subcategories", subCategoryRouter);
app.use("/submissions", submissionsRouter);
app.use("/mps", mpsRoutes);

// 🔹 This is the base your React uses: `${API_BASE}/reports/accomplishment`
app.use("/reports/accomplishment", accomplishmentRouter);

// Get peer LAEMPL & MPS data for consolidation
app.get("/reports/laempl-mps/:submissionId/peers", async (req, res) => {
  try {
    const { submissionId } = req.params;
    console.log("Fetching peer LAEMPL & MPS data for submission:", submissionId);
    
    // Get the current submission to find the report assignment
    const currentSubmissionQuery = `
      SELECT s.report_assignment_id, s.submitted_by, ra.title, ra.quarter, ra.year
      FROM submission s
      JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
      WHERE s.submission_id = ?
    `;
    
    const currentSubmission = await new Promise((resolve, reject) => {
      db.query(currentSubmissionQuery, [submissionId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    console.log("Current submission details:", currentSubmission);
    
    if (!currentSubmission) {
      console.log("No current submission found for ID:", submissionId);
      return res.status(404).json({ error: "Submission not found" });
    }
    
    console.log("Current submission report_assignment_id:", currentSubmission.report_assignment_id);
    
    // Find peer submissions with the same report assignment and LAEMPL & MPS type
    // First try to find peers in the same report assignment
    let peersQuery = `
      SELECT 
        s.submission_id,
        s.status,
        s.fields,
        s.date_submitted,
        ud.name,
        ud.role,
        gl.grade_level,
        sec.section,
        ts.role as teacher_role,
        ra.title as report_title
      FROM submission s
      JOIN user_details ud ON s.submitted_by = ud.user_id
      JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
      LEFT JOIN teacher_section ts ON s.submitted_by = ts.user_id
      LEFT JOIN section sec ON ts.section_id = sec.section_id
      LEFT JOIN grade_level gl ON sec.grade_level_id = gl.grade_level_id
      WHERE s.report_assignment_id = ?
        AND s.submission_id != ?
        AND s.status >= 2
        AND JSON_EXTRACT(s.fields, '$.type') IN ('LAEMPL', 'LAEMPL_TEACHER', 'LAEMPL_COORDINATOR')
      ORDER BY s.date_submitted DESC
    `;
    
    console.log("Executing peer query with params:", [currentSubmission.report_assignment_id, submissionId]);
    console.log("Peer query SQL:", peersQuery);
    
    const peers = await new Promise((resolve, reject) => {
      db.query(peersQuery, [currentSubmission.report_assignment_id, submissionId], (err, results) => {
        if (err) {
          console.error("Peer query error:", err);
          reject(err);
        } else {
          console.log("Raw peer query results:", results);
          resolve(results);
        }
      });
    });
    
    console.log("Found", peers.length, "raw peer submissions");
    
    // If no peers found in same report assignment, look for teacher submissions across different report assignments for same grade level
    let allPeers = peers;
    if (peers.length === 0) {
      console.log("No peers found in same report assignment, looking across different report assignments for same grade level...");
      
      const crossAssignmentQuery = `
        SELECT 
          s.submission_id,
          s.status,
          s.fields,
          s.date_submitted,
          ud.name,
          ud.role,
          gl.grade_level,
          sec.section,
          ts.role as teacher_role,
          ra.title as report_title
        FROM submission s
        JOIN user_details ud ON s.submitted_by = ud.user_id
        JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
        LEFT JOIN teacher_section ts ON s.submitted_by = ts.user_id
        LEFT JOIN section sec ON ts.section_id = sec.section_id
        LEFT JOIN grade_level gl ON sec.grade_level_id = gl.grade_level_id
        WHERE ud.role = 'teacher'
          AND s.status >= 2
          AND JSON_EXTRACT(s.fields, '$.type') = 'LAEMPL'
          AND JSON_EXTRACT(s.fields, '$.grade') = ?
        ORDER BY s.date_submitted DESC
      `;
      
      console.log("Executing cross-assignment query for grade level:", currentSubmission.grade || 2);
      
      const crossAssignmentPeers = await new Promise((resolve, reject) => {
        db.query(crossAssignmentQuery, [currentSubmission.grade || 2], (err, results) => {
          if (err) {
            console.error("Cross-assignment query error:", err);
            reject(err);
          } else {
            console.log("Cross-assignment query results:", results);
            resolve(results);
          }
        });
      });
      
      allPeers = crossAssignmentPeers;
      console.log("Found", allPeers.length, "teacher submissions across different report assignments for grade", currentSubmission.grade || 2);
    }
    
    // Let's also check all submissions for this report assignment to see what's available
        const allSubmissionsQuery = `
          SELECT 
            s.submission_id,
            s.status,
            s.fields,
            s.date_submitted,
            ud.name,
            ud.role,
            s.report_assignment_id
          FROM submission s
          JOIN user_details ud ON s.submitted_by = ud.user_id
          WHERE s.report_assignment_id = ?
          ORDER BY s.date_submitted DESC
        `;
    
    const allSubmissions = await new Promise((resolve, reject) => {
      db.query(allSubmissionsQuery, [currentSubmission.report_assignment_id], (err, results) => {
        if (err) {
          console.error("All submissions query error:", err);
          reject(err);
        } else {
          console.log("All submissions for this report assignment:", results);
          resolve(results);
        }
      });
    });
    
    // Let's also check if there are any teacher submissions at all in the database
    const anyTeacherSubmissionsQuery = `
      SELECT 
        s.submission_id,
        s.status,
        s.fields,
        s.date_submitted,
        ud.name,
        ud.role,
        s.report_assignment_id,
        ra.title as report_title
      FROM submission s
      JOIN user_details ud ON s.submitted_by = ud.user_id
      JOIN report_assignment ra ON s.report_assignment_id = ra.report_assignment_id
      WHERE ud.role = 'teacher'
        AND JSON_EXTRACT(s.fields, '$.type') = 'LAEMPL'
        AND s.status >= 2
      ORDER BY s.date_submitted DESC
      LIMIT 10
    `;
    
    const anyTeacherSubmissions = await new Promise((resolve, reject) => {
      db.query(anyTeacherSubmissionsQuery, [], (err, results) => {
        if (err) {
          console.error("Any teacher submissions query error:", err);
          reject(err);
        } else {
          console.log("Any teacher submissions in database:", results);
          resolve(results);
        }
      });
    });
    
    // Format the peer data
    const formattedPeers = allPeers.map(peer => ({
      submission_id: peer.submission_id,
      teacher_name: peer.name,
      grade_level: peer.grade_level,
      section_name: peer.section,
      status: peer.status,
      date_submitted: peer.date_submitted,
      fields: peer.fields,
      role: peer.role
    }));
    
    console.log("Found", formattedPeers.length, "peer submissions after filtering");
    console.log("Formatted peers:", formattedPeers);
    
    // Additional debugging: Check if we should look for teacher submissions across different report assignments
    if (formattedPeers.length === 0) {
      console.log("=== NO PEER SUBMISSIONS FOUND ===");
      console.log("Current submission report_assignment_id:", currentSubmission.report_assignment_id);
      console.log("Looking for teacher submissions in the same report assignment...");
      console.log("But teacher submissions exist for different report assignments:");
      
      anyTeacherSubmissions.forEach(teacher => {
        console.log(`- Teacher submission ${teacher.submission_id}: report_assignment_id ${teacher.report_assignment_id} (${teacher.report_title})`);
      });
      
      console.log("=== SUGGESTION ===");
      console.log("The coordinator might need to consolidate teacher submissions from different report assignments.");
      console.log("Or the teacher submissions need to be created for the same report assignment (ID: 11).");
      
      // Let's also check if there are any teacher submissions for the same grade level (Grade 2)
      const grade2TeacherSubmissions = anyTeacherSubmissions.filter(teacher => {
        try {
          const fields = typeof teacher.fields === 'string' ? JSON.parse(teacher.fields) : teacher.fields;
          return fields.grade === 2;
        } catch (e) {
          return false;
        }
      });
      
      if (grade2TeacherSubmissions.length > 0) {
        console.log("=== FOUND GRADE 2 TEACHER SUBMISSIONS ===");
        console.log("These could potentially be consolidated:");
        grade2TeacherSubmissions.forEach(teacher => {
          console.log(`- Teacher submission ${teacher.submission_id}: ${teacher.report_title} (Grade 2)`);
        });
      }
    }
    
    res.json(formattedPeers);
    
  } catch (error) {
    console.error("Error fetching peer LAEMPL & MPS data:", error);
    res.status(500).json({ error: "Failed to fetch peer data", details: error.message });
  }
});

// Teacher-specific status counts endpoint
app.get("/reports/status/count/teacher/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT
        SUM(CASE WHEN s.status = 1 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN s.status = 2 THEN 1 ELSE 0 END) AS submitted,
        SUM(CASE WHEN s.status = 3 THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN s.status = 4 THEN 1 ELSE 0 END) AS rejected,
        COUNT(*) AS total
      FROM submission s
      WHERE s.submitted_by = ?
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    const counts = result[0] || {};
    res.json({
      submitted: Number(counts.submitted || 0),
      pending: Number(counts.pending || 0),
      approved: Number(counts.approved || 0),
      rejected: Number(counts.rejected || 0),
      total: Number(counts.total || 0)
    });
  } catch (error) {
    console.error("Error fetching teacher status counts:", error);
    res.status(500).json({ error: "Failed to fetch teacher status counts", details: error.message });
  }
});

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

// Get coordinator's assigned grade level
app.get("/users/coordinator-grade/:userId", async (req, res) => {
  try {
    // Check authentication
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { userId } = req.params;
    console.log("Fetching coordinator grade for user ID:", userId);
    
    const query = `
      SELECT 
        cg.grade_level_id,
        gl.grade_level
      FROM coordinator_grade cg
      JOIN grade_level gl ON cg.grade_level_id = gl.grade_level_id
      WHERE cg.user_id = ?
      LIMIT 1
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log("Coordinator grade query results:", rows);
    
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      console.log("No grade level found for coordinator:", userId);
      res.status(404).json({ error: "No grade level assigned to coordinator" });
    }
  } catch (error) {
    console.error("Error fetching coordinator grade:", error);
    res.status(500).json({ error: "Failed to fetch coordinator grade", details: error.message });
  }
});

// Test endpoint to check sections without authentication
app.get("/test/sections/grade/:gradeLevelId", async (req, res) => {
  try {
    const { gradeLevelId } = req.params;
    console.log("Testing sections for grade level:", gradeLevelId);
    
    const query = `
      SELECT 
        s.section_id,
        s.section as section_name,
        s.grade_level_id,
        gl.grade_level
      FROM section s
      JOIN grade_level gl ON s.grade_level_id = gl.grade_level_id
      WHERE s.grade_level_id = ?
      ORDER BY s.section
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, [gradeLevelId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    console.log("Sections found:", rows);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching sections by grade:", error);
    res.status(500).json({ error: "Failed to fetch sections", details: error.message });
  }
});

// Simple test endpoint
app.get("/test", (req, res) => {
  res.json({ message: "Server is working!", timestamp: new Date().toISOString() });
});

// Fix submission type for coordinator
app.patch("/submissions/:id/fix-coordinator-type", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fixing submission type for coordinator, submission ID:", id);
    
    // Get current submission data
    const getCurrentQuery = `SELECT fields FROM submission WHERE submission_id = ?`;
    const currentData = await new Promise((resolve, reject) => {
      db.query(getCurrentQuery, [id], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    if (!currentData) {
      return res.status(404).json({ error: "Submission not found" });
    }
    
    // Parse current fields
    let currentFields = {};
    try {
      currentFields = typeof currentData.fields === 'string' 
        ? JSON.parse(currentData.fields) 
        : currentData.fields;
    } catch (e) {
      console.error("Error parsing current fields:", e);
    }
    
    // Update the type to LAEMPL_COORDINATOR
    const updatedFields = {
      ...currentFields,
      type: "LAEMPL_COORDINATOR",
      grade: 2, // Set grade level
      subjects: [
        { subject_id: 10, subject_name: "Araling Panlipunan", rows: [], totals: {} },
        { subject_id: 8, subject_name: "English", rows: [], totals: {} },
        { subject_id: 6, subject_name: "ESP", rows: [], totals: {} },
        { subject_id: 9, subject_name: "Filipino", rows: [], totals: {} },
        { subject_id: 11, subject_name: "MAPEH", rows: [], totals: {} },
        { subject_id: 7, subject_name: "Mathematics", rows: [], totals: {} },
        { subject_id: 12, subject_name: "MTB", rows: [], totals: {} }
      ],
      title: "LAEMPL & MPS FOR GRADE 2",
      meta: { 
        ...currentFields.meta,
        updatedAt: new Date().toISOString(),
        fixedToCoordinator: true
      }
    };
    
    // Update the submission
    const updateQuery = `UPDATE submission SET fields = ? WHERE submission_id = ?`;
    await new Promise((resolve, reject) => {
      db.query(updateQuery, [JSON.stringify(updatedFields), id], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log("Successfully updated submission to coordinator type");
    res.json({ 
      message: "Submission updated to coordinator type", 
      submission_id: id,
      updated_fields: updatedFields
    });
    
  } catch (error) {
    console.error("Error fixing submission type:", error);
    res.status(500).json({ error: "Failed to fix submission type", details: error.message });
  }
});

// Get sections by grade level
app.get("/sections/grade/:gradeLevelId", async (req, res) => {
  try {
    // Check authentication
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { gradeLevelId } = req.params;
    const query = `
      SELECT 
        s.section_id,
        s.section as section_name,
        s.grade_level_id,
        gl.grade_level
      FROM section s
      JOIN grade_level gl ON s.grade_level_id = gl.grade_level_id
      WHERE s.grade_level_id = ?
      ORDER BY s.section
    `;
    
    const rows = await new Promise((resolve, reject) => {
      db.query(query, [gradeLevelId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching sections by grade:", error);
    res.status(500).json({ error: "Failed to fetch sections", details: error.message });
  }
});

// Update report status from 0 (not given) to 1 (pending) when coordinator assigns to teachers
app.post("/reports/update-status-to-pending", async (req, res) => {
  try {
    const { report_assignment_id, category_id, sub_category_id, quarter, year, assignees } = req.body;

    if (report_assignment_id) {
      // Strict: update just this assignment
      const updateQuery = `
        UPDATE report_assignment SET is_given = 1 WHERE report_assignment_id = ? AND is_given = 0
      `;
      const updateResult = await new Promise((resolve, reject) => {
        db.query(updateQuery, [report_assignment_id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      return res.json({ affectedRows: updateResult.affectedRows, mode: 'report_assignment_id' });
    }

    // Fallback (legacy): update by filter
    const updateQuery = `
      UPDATE report_assignment 
      SET is_given = 1 
      WHERE category_id = ? 
        AND (sub_category_id = ? OR (sub_category_id IS NULL AND ? IS NULL))
        AND quarter = ? 
        AND year = ? 
        AND is_given = 0
    `;

    const updateResult = await new Promise((resolve, reject) => {
      db.query(updateQuery, [category_id, sub_category_id, sub_category_id, quarter, year], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({ affectedRows: updateResult.affectedRows, mode: 'legacy-filter' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single report assignment for editing
app.get("/reports/assignment/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    
    console.log('🔄 [DEBUG] Fetching report assignment for editing:', reportId);

    const query = `
      SELECT 
        ra.report_assignment_id,
        ra.category_id,
        ra.sub_category_id,
        ra.given_by,
        ra.quarter,
        ra.year,
        ra.title,
        ra.from_date,
        ra.to_date,
        ra.instruction,
        ra.is_given,
        ra.is_archived,
        ra.allow_late,
        ra.number_of_submission,
        c.category_name,
        sc.sub_category_name,
        sy.school_year,
        u.name as given_by_name,
        u.role as given_by_role
      FROM report_assignment ra
      LEFT JOIN category c ON c.category_id = ra.category_id
      LEFT JOIN sub_category sc ON sc.sub_category_id = ra.sub_category_id
      LEFT JOIN school_year sy ON sy.year_id = ra.year
      LEFT JOIN user_details u ON u.user_id = ra.given_by
      WHERE ra.report_assignment_id = ?
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [reportId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (result.length === 0) {
      return res.status(404).json({ error: "Report assignment not found" });
    }

    console.log('🔄 [DEBUG] Report assignment data:', result[0]);
    res.json(result[0]);
  } catch (error) {
    console.error("Error fetching report assignment:", error);
    res.status(500).json({ error: "Failed to fetch report assignment", details: error.message });
  }
});

// Update report assignment
app.put("/reports/assignment/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { title, quarter, year, from_date, to_date, instruction, is_given, allow_late, number_of_submission, assignees } = req.body;
    
    console.log('🔄 [DEBUG] Updating report assignment:', reportId, req.body);

    // Update the report assignment
    const updateQuery = `
      UPDATE report_assignment 
      SET title = ?, quarter = ?, year = ?, from_date = ?, to_date = ?, 
          instruction = ?, is_given = ?, allow_late = ?, number_of_submission = ?
      WHERE report_assignment_id = ?
    `;
    
    const updateResult = await new Promise((resolve, reject) => {
      db.query(updateQuery, [
        title, quarter, year, from_date, to_date, 
        instruction, is_given, allow_late, number_of_submission, reportId
      ], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log('🔄 [DEBUG] Updated report assignment:', updateResult.affectedRows);

    // Update existing submissions for the new assignees
    if (assignees && assignees.length > 0) {
      // First, get existing submissions for this report
      const getSubmissionsQuery = `SELECT submission_id FROM submission WHERE report_assignment_id = ?`;
      const existingSubmissions = await new Promise((resolve, reject) => {
        db.query(getSubmissionsQuery, [reportId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      // Update existing submissions to new assignees
      for (const submission of existingSubmissions) {
        const updateSubmissionQuery = `
          UPDATE submission 
          SET submitted_by = ?, status = ?
          WHERE submission_id = ?
        `;
        
        // Assign to first assignee and set status to pending
        await new Promise((resolve, reject) => {
          db.query(updateSubmissionQuery, [assignees[0], 1, submission.submission_id], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
      }

      // Create new submissions for additional assignees
      for (let i = 1; i < assignees.length; i++) {
        const insertSubmissionQuery = `
          INSERT INTO submission (report_assignment_id, category_id, submitted_by, status, number_of_submission, fields)
          SELECT ?, category_id, ?, 1, ?, '{}'
          FROM report_assignment 
          WHERE report_assignment_id = ?
        `;
        
        await new Promise((resolve, reject) => {
          db.query(insertSubmissionQuery, [reportId, assignees[i], number_of_submission, reportId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
      }
    }

    res.json({ 
      success: true, 
      affectedRows: updateResult.affectedRows,
      message: "Report assignment updated successfully"
    });
  } catch (error) {
    console.error("Error updating report assignment:", error);
    res.status(500).json({ error: "Failed to update report assignment", details: error.message });
  }
});

// Get upcoming deadline submissions for coordinators (individual submissions with is_given = 0)
// NOTE: This is a duplicate endpoint - the one above (line 3072) takes precedence since it's registered first
// Both are updated to filter by status = 1 (pending) or status = 4 (rejected) only
app.get("/reports/upcoming-deadlines/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🔄 [DEBUG] Fetching upcoming deadline submissions for coordinator:', userId);

    const query = `
      SELECT
        s.submission_id,
        s.report_assignment_id,
        s.category_id,
        s.submitted_by,
        s.status,
        s.value AS submission_title,
        DATE_FORMAT(s.date_submitted, '%m/%d/%Y') AS date_submitted,

        ra.title AS assignment_title,
        DATE_FORMAT(ra.from_date, '%m/%d/%Y') AS from_date,
        DATE_FORMAT(ra.to_date, '%m/%d/%Y') AS to_date,
        ra.instruction,
        ra.allow_late,
        ra.is_given,
        ra.is_archived,
        ra.quarter,
        ra.year,
        ra.number_of_submission,

        c.category_name,
        sc.sub_category_name,
        sy.school_year,

        ud.name AS submitted_by_name,
        ud2.name AS given_by_name
      FROM submission s
      JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
      JOIN category c ON ra.category_id = c.category_id
      LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
      LEFT JOIN user_details ud ON s.submitted_by = ud.user_id
      LEFT JOIN user_details ud2 ON ra.given_by = ud2.user_id
      LEFT JOIN school_year sy ON sy.year_id = ra.year
      WHERE s.submitted_by = ?
      AND ra.is_given = 0
      AND (s.status = 1 OR s.status = 4)
      ORDER BY ra.to_date ASC, s.date_submitted ASC
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log('🔄 [DEBUG] Upcoming deadline submissions (pending/rejected only):', result.length);
    console.log('🔄 [DEBUG] Query results:', result);
    res.json(result);
  } catch (error) {
    console.error("Error fetching upcoming deadline submissions:", error);
    res.status(500).json({ error: "Failed to fetch upcoming deadline submissions", details: error.message });
  }
});

/* ----------------- Start ----------------- */
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;
