// Updated API endpoints to work with quarter enum
// Add these to your existing index.js file

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

// Get comprehensive quarter information
app.get("/admin/quarters-comprehensive", async (req, res) => {
  try {
    const query = `
      SELECT * FROM quarter_comprehensive
      ORDER BY year DESC, quarter ASC
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
    
    if (!targetYearQuarterId && (year && quarter)) {
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
      
      if (findResult.length === 0) {
        return res.status(404).json({ error: "Year and quarter combination not found" });
      }
      
      targetYearQuarterId = findResult[0].yr_and_qtr_id;
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

// Get reports with quarter enum information
app.get("/reports/assigned_by/:userId", async (req, res) => {
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

        ud.name  AS submitted_by_name,   -- teacher
        ud2.name AS given_by_name        -- coordinator
      FROM submission s
      JOIN report_assignment ra ON ra.report_assignment_id = s.report_assignment_id
      JOIN category c           ON ra.category_id = c.category_id
      LEFT JOIN sub_category sc ON ra.sub_category_id = sc.sub_category_id
      LEFT JOIN user_details ud  ON s.submitted_by = ud.user_id
      LEFT JOIN user_details ud2 ON ra.given_by    = ud2.user_id
      LEFT JOIN school_year sy ON sy.year_id = ra.year
      LEFT JOIN quarter_enum qe ON ra.quarter = qe.quarter_number
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
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching assigned reports:", error);
    res.status(500).json({ error: "Failed to fetch assigned reports", details: error.message });
  }
});
