/*
  db-schema.js
  ============
  THIS FILE CONTAINS SQL ONLY. No app logic, no DOM code, nothing else.

  Why keep it separate?
  Because SQL is its own little language, and mixing it into your JavaScript
  logic makes both harder to read. Here, every "sentence" the database
  understands lives in one place. If you ever want to change *what* is
  stored, you edit THIS file. If you want to change *how the app behaves*,
  you edit db.js or app.js instead.

  Everything below is just plain SQL text stored inside JavaScript strings.
  We are not running anything here — just defining the words we'll send to
  the database later.
*/

// ---------------------------------------------------------------------
// 1. TABLE CREATION ("the generator")
// ---------------------------------------------------------------------
// A "table" is like a spreadsheet tab: rows and columns.
// We have three tables:
//   students        -> one row per student
//   attendance      -> one row per student per day (present/absent/late)
//   behavior_notes  -> one row per behaviour observation you write
//
// attendance and behavior_notes both have a "student_id" column that
// points back to a row in "students". That link is called a
// FOREIGN KEY, and it's how the three tables stay connected instead of
// being three separate, unrelated lists.

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS students (
    id            INTEGER PRIMARY KEY AUTOINCREMENT, -- unique ID, auto-numbered by SQLite
    full_name     TEXT NOT NULL,                      -- student's name, required
    class_name    TEXT,                                -- e.g. "Primary 4", optional
    admission_no  TEXT                                 -- school ID number, optional
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL,                       -- which student this row is about
    date        TEXT NOT NULL,                          -- stored as 'YYYY-MM-DD'
    status      TEXT NOT NULL,                          -- 'Present', 'Absent', or 'Late'
    FOREIGN KEY (student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS behavior_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL,
    date        TEXT NOT NULL,
    rating      TEXT,                                   -- e.g. 'Good', 'Fair', 'Poor'
    notes       TEXT,                                    -- free-text comment
    FOREIGN KEY (student_id) REFERENCES students(id)
  );
`;

// ---------------------------------------------------------------------
// 2. STUDENTS
// ---------------------------------------------------------------------

const INSERT_STUDENT_SQL = `
  INSERT INTO students (full_name, class_name, admission_no)
  VALUES (?, ?, ?);
`;
// The "?" marks are placeholders. We never paste user text straight into
// SQL — instead we hand sql.js the text separately and it fills the "?"
// in safely. This avoids a class of bug/security hole called
// "SQL injection". You don't need to fully understand that yet — just
// always use "?" placeholders instead of gluing strings together.

const SELECT_ALL_STUDENTS_SQL = `
  SELECT id, full_name, class_name, admission_no
  FROM students
  ORDER BY full_name ASC;
`;

const DELETE_STUDENT_SQL = `
  DELETE FROM students WHERE id = ?;
`;

// ---------------------------------------------------------------------
// 3. ATTENDANCE
// ---------------------------------------------------------------------

const INSERT_ATTENDANCE_SQL = `
  INSERT INTO attendance (student_id, date, status)
  VALUES (?, ?, ?);
`;

const SELECT_ATTENDANCE_FOR_DATE_SQL = `
  SELECT attendance.id, attendance.status, students.full_name, students.id AS student_id
  FROM attendance
  JOIN students ON students.id = attendance.student_id
  WHERE attendance.date = ?
  ORDER BY students.full_name ASC;
`;

// ---------------------------------------------------------------------
// 4. BEHAVIOUR NOTES
// ---------------------------------------------------------------------

const INSERT_BEHAVIOR_SQL = `
  INSERT INTO behavior_notes (student_id, date, rating, notes)
  VALUES (?, ?, ?, ?);
`;

// ---------------------------------------------------------------------
// 5. THE COMBINED / "LINKED TABLES" REPORT
// ---------------------------------------------------------------------
// This is the important one for your CSC394 requirement: it "links
// tables" using JOIN, pulling one row per student per day that shows
// BOTH their attendance status AND their behaviour note side by side,
// even though that information lives in two different tables.

const SELECT_DAILY_REPORT_SQL = `
  SELECT
    students.full_name,
    students.class_name,
    attendance.status        AS attendance_status,
    behavior_notes.rating    AS behavior_rating,
    behavior_notes.notes     AS behavior_notes
  FROM students
  LEFT JOIN attendance
    ON attendance.student_id = students.id AND attendance.date = ?
  LEFT JOIN behavior_notes
    ON behavior_notes.student_id = students.id AND behavior_notes.date = ?
  ORDER BY students.full_name ASC;
`;
// LEFT JOIN means: "show every student, and attach their attendance/
// behaviour for this date IF it exists, otherwise leave it blank."
// A plain JOIN would hide students who have no record yet, which isn't
// what we want for a daily register.

// ---------------------------------------------------------------------
// Make all of the above available to db.js
// ---------------------------------------------------------------------
// (Plain <script> tags share one global scope, so this "window.DB_SQL"
// object is simply how db.js reaches the SQL text defined above.)
window.DB_SQL = {
  SCHEMA_SQL,
  INSERT_STUDENT_SQL,
  SELECT_ALL_STUDENTS_SQL,
  DELETE_STUDENT_SQL,
  INSERT_ATTENDANCE_SQL,
  SELECT_ATTENDANCE_FOR_DATE_SQL,
  INSERT_BEHAVIOR_SQL,
  SELECT_DAILY_REPORT_SQL,
};
