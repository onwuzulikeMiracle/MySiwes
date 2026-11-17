/*
  db.js
  =====
  This file is the "engine room". It does three jobs:

    1. Starts up SQLite-in-the-browser (a library called sql.js).
    2. Saves/loads the actual database file so your data survives after
       you close the browser tab (using a browser storage feature called
       IndexedDB — think of it as a mini hard drive built into the browser).
    3. Wraps every SQL statement from db-schema.js into a small, named
       JavaScript function (e.g. addStudent, listStudents) so that
       app.js never has to write or even look at raw SQL.

  You should never need to edit the SQL text in this file — that all
  lives in db-schema.js. This file just RUNS that SQL.
*/

// A little namespace so we don't pollute the global scope with loose
// variables. Everything the rest of the app needs is on window.DB.
window.DB = (function () {
  // 'sql' is the sql.js library once it has finished loading.
  // 'db'  is the actual open database (kept in memory while the app runs).
  let sql = null;
  let db = null;

  const INDEXEDDB_NAME = "school-tracker";
  const INDEXEDDB_STORE = "sqlite-file";
  const INDEXEDDB_KEY = "diary-db"; // legacy key name from the very first version, kept as-is on purpose

  /**
   * openIndexedDB()
   * ----------------
   * Opens (or creates, the first time) a small IndexedDB database whose
   * ONLY job is to store the raw bytes of our SQLite file, so the data
   * is still there next time you open the page.
   *
   * Returns a Promise that resolves to the open IndexedDB connection.
   */
  function openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(INDEXEDDB_NAME, 1);

      // Runs only the very first time (or when we bump the version
      // number above) — this is where we define the storage "bucket".
      request.onupgradeneeded = () => {
        request.result.createObjectStore(INDEXEDDB_STORE);
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * loadSavedBytes()
   * -----------------
   * Looks inside IndexedDB for a previously saved database file.
   * Returns the raw bytes (a Uint8Array) if one exists, or null if this
   * is the very first time the app has ever run.
   */
  async function loadSavedBytes() {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(INDEXEDDB_STORE, "readonly");
      const request = tx.objectStore(INDEXEDDB_STORE).get(INDEXEDDB_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * persist()
   * ---------
   * Saves the CURRENT state of the database into IndexedDB.
   * We call this after every insert/update/delete, so nothing is lost
   * if you close the tab.
   */
  async function persist() {
    const bytes = db.export(); // sql.js gives us the whole .db file as bytes
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(INDEXEDDB_STORE, "readwrite");
      tx.objectStore(INDEXEDDB_STORE).put(bytes, INDEXEDDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * init()
   * ------
   * Call this ONCE when the page loads, before doing anything else.
   * It boots sql.js, then either re-opens your saved data or creates a
   * brand-new empty database and runs the CREATE TABLE statements.
   */
  async function init() {
    // initSqlJs is provided by vendor/sql-wasm.js (loaded in index.html).
    // locateFile tells it where to find the matching .wasm file — the
    // actual SQLite engine, compiled to run in the browser.
    sql = await initSqlJs({
      locateFile: (file) => `vendor/${file}`,
    });

    const savedBytes = await loadSavedBytes();

    if (savedBytes) {
      // Re-open the database exactly as we left it last time.
      db = new sql.Database(savedBytes);
    } else {
      // First run ever: start empty, then build the tables.
      db = new sql.Database();
      db.run(window.DB_SQL.SCHEMA_SQL);
      await persist();
    }
  }

  /**
   * runAndSave(sqlText, params)
   * ---------------------------
   * Small internal helper used by every "write" function below
   * (add/insert/delete). It runs one SQL statement with its "?"
   * placeholders filled in by `params`, then saves the result to
   * IndexedDB so it isn't lost.
   */
  async function runAndSave(sqlText, params) {
    db.run(sqlText, params);
    await persist();
  }

  /**
   * query(sqlText, params)
   * -----------------------
   * Small internal helper used by every "read" function below. Runs a
   * SELECT statement and converts sql.js's slightly awkward result
   * format into a plain array of easy-to-use JavaScript objects, e.g.
   *   [{ id: 1, full_name: "Ada" }, { id: 2, full_name: "Bode" }]
   */
  function query(sqlText, params) {
    const results = db.exec(sqlText, params);
    if (results.length === 0) return []; // no rows found

    const { columns, values } = results[0];
    return values.map((row) => {
      const record = {};
      columns.forEach((columnName, index) => {
        record[columnName] = row[index];
      });
      return record;
    });
  }

  // ---------------------------------------------------------------
  // Public functions — this is the "menu" app.js is allowed to use.
  // Each one just pairs one SQL statement (from db-schema.js) with
  // the values that fill in its "?" placeholders.
  // ---------------------------------------------------------------

  /** Add a new student. Returns nothing; call listStudents() after. */
  async function addStudent(fullName, className, admissionNo) {
    await runAndSave(window.DB_SQL.INSERT_STUDENT_SQL, [
      fullName,
      className,
      admissionNo,
    ]);
  }

  /** Get every student, alphabetically, as an array of objects. */
  function listStudents() {
    return query(window.DB_SQL.SELECT_ALL_STUDENTS_SQL, []);
  }

  /** Permanently remove a student by their id. */
  async function deleteStudent(studentId) {
    await runAndSave(window.DB_SQL.DELETE_STUDENT_SQL, [studentId]);
  }

  /** Record one attendance entry: status is 'Present' | 'Absent' | 'Late'. */
  async function markAttendance(studentId, date, status) {
    await runAndSave(window.DB_SQL.INSERT_ATTENDANCE_SQL, [
      studentId,
      date,
      status,
    ]);
  }

  /** Record one behaviour observation for a student on a given date. */
  async function addBehaviorNote(studentId, date, rating, notes) {
    await runAndSave(window.DB_SQL.INSERT_BEHAVIOR_SQL, [
      studentId,
      date,
      rating,
      notes,
    ]);
  }

  /**
   * getDailyReport(date)
   * ---------------------
   * The "linked tables" view: every student, plus their attendance and
   * behaviour note for that date, joined together into one row each.
   */
  function getDailyReport(date) {
    return query(window.DB_SQL.SELECT_DAILY_REPORT_SQL, [date, date]);
  }

  /**
   * downloadDatabaseFile()
   * ------------------------
   * Exports the live database as a real .db file and triggers a normal
   * browser download. This is the file you can then open in a tool like
   * "DB Browser for SQLite" to look at or edit the raw data directly —
   * see the README for that walkthrough.
   */
  function downloadDatabaseFile() {
    const bytes = db.export();
    const blob = new Blob([bytes], { type: "application/x-sqlite3" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "school-tracker.db";
    link.click();

    URL.revokeObjectURL(url);
  }

  // Expose only these functions to the rest of the app (app.js).
  return {
    init,
    addStudent,
    listStudents,
    deleteStudent,
    markAttendance,
    addBehaviorNote,
    getDailyReport,
    downloadDatabaseFile,
  };
})();
