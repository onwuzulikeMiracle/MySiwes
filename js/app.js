/*
  app.js
  ======
  This file only knows about the PAGE (buttons, forms, tables). It never
  writes SQL — it only calls the ready-made functions from db.js, like
  DB.addStudent(...) or DB.listStudents(). If you want to see what SQL
  actually runs, look in db-schema.js.

  Read this file top to bottom: first we grab references to the HTML
  elements we need, then we define one function per feature, then at
  the very bottom we wire buttons to those functions and start the app.
*/

// ---------------------------------------------------------------------
// References to elements already sitting in index.html
// ---------------------------------------------------------------------
const studentForm = document.getElementById("student-form");
const studentNameInput = document.getElementById("student-name");
const studentClassInput = document.getElementById("student-class");
const studentAdmissionInput = document.getElementById("student-admission");
const studentListEl = document.getElementById("student-list");

const dateInput = document.getElementById("record-date");
const dailyFormBody = document.getElementById("daily-form-body");
const saveDayBtn = document.getElementById("save-day-btn");

const reportDateInput = document.getElementById("report-date");
const loadReportBtn = document.getElementById("load-report-btn");
const reportBody = document.getElementById("report-body");

const downloadBtn = document.getElementById("download-db-btn");
const errorBanner = document.getElementById("error-banner");

/**
 * showFatalError(err)
 * --------------------
 * Prints a red banner at the top of the page with the actual error
 * message, and also logs the full error to the browser console.
 *
 * This exists because async errors (from a rejected Promise) do NOT
 * show up anywhere on the page by default — they only appear in the
 * console (F12 → Console tab). Without this, a failure like "the
 * database engine couldn't load" looks exactly like "nothing
 * happened", which is confusing to debug. Now it's a visible message
 * telling you what actually went wrong.
 */
function showFatalError(context, err) {
  console.error(context, err);
  errorBanner.hidden = false;
  errorBanner.textContent =
    `${context}: ${err.message || err}\n\n` +
    `Open your browser's console (press F12, click "Console") for the ` +
    `full technical details. The most common cause is opening this file ` +
    `directly (a "file://" address bar) instead of through a local ` +
    `server — see README.md section 2.`;
}

/**
 * todayString()
 * -------------
 * Returns today's date as 'YYYY-MM-DD', which is the plain-text format
 * we store dates as in SQLite (SQLite has no special date type).
 */
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * refreshStudentList()
 * ---------------------
 * Re-reads every student from the database and redraws:
 *   1. the "Students" list (with a Delete button on each row)
 *   2. the attendance/behaviour form rows (one per student)
 * Call this after ANY change to the students table, so the page never
 * shows stale data.
 */
function refreshStudentList() {
  const students = DB.listStudents();

  // --- 1. Redraw the plain student list ---
  studentListEl.innerHTML = ""; // clear old contents before redrawing
  students.forEach((student) => {
    const li = document.createElement("li");
    li.textContent = `${student.full_name} (${student.class_name || "no class set"}) `;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "small-btn";
    deleteBtn.addEventListener("click", async () => {
      await DB.deleteStudent(student.id);
      refreshStudentList(); // redraw everything now that a student is gone
    });

    li.appendChild(deleteBtn);
    studentListEl.appendChild(li);
  });

  // --- 2. Redraw the daily attendance/behaviour entry rows ---
  dailyFormBody.innerHTML = "";
  students.forEach((student) => {
    const row = document.createElement("tr");
    // data-student-id lets saveDay() (below) know which student each
    // row belongs to when it's time to save.
    row.dataset.studentId = student.id;

    row.innerHTML = `
      <td>${student.full_name}</td>
      <td>
        <select class="attendance-status">
          <option value="">-- skip --</option>
          <option value="Present">Present</option>
          <option value="Absent">Absent</option>
          <option value="Late">Late</option>
        </select>
      </td>
      <td>
        <select class="behavior-rating">
          <option value="">-- skip --</option>
          <option value="Good">Good</option>
          <option value="Fair">Fair</option>
          <option value="Poor">Poor</option>
        </select>
      </td>
      <td>
        <input type="text" class="behavior-notes" placeholder="optional note" />
      </td>
    `;
    dailyFormBody.appendChild(row);
  });
}

/**
 * addStudent(event)
 * ------------------
 * Runs when the "Add Student" form is submitted. Reads the three input
 * boxes, saves a new student, clears the form, and redraws the lists.
 */
async function addStudent(event) {
  event.preventDefault(); // stop the browser from reloading the page

  const name = studentNameInput.value.trim();
  if (!name) return; // name is required; silently do nothing without it

  try {
    await DB.addStudent(
      name,
      studentClassInput.value.trim(),
      studentAdmissionInput.value.trim()
    );

    studentForm.reset();
    refreshStudentList();
  } catch (err) {
    showFatalError("Could not add student", err);
  }
}

/**
 * saveDay()
 * ---------
 * Runs when "Save Day" is clicked. Walks through every row in the
 * attendance/behaviour table and, for any row where the user actually
 * chose something, saves it. Rows left on "-- skip --" are ignored —
 * this lets you fill in only the students you have information for.
 */
async function saveDay() {
  const date = dateInput.value || todayString();
  const rows = dailyFormBody.querySelectorAll("tr");

  try {
    for (const row of rows) {
      const studentId = Number(row.dataset.studentId);
      const status = row.querySelector(".attendance-status").value;
      const rating = row.querySelector(".behavior-rating").value;
      const notes = row.querySelector(".behavior-notes").value.trim();

      if (status) {
        await DB.markAttendance(studentId, date, status);
      }
      if (rating || notes) {
        await DB.addBehaviorNote(studentId, date, rating, notes);
      }
    }

    alert("Saved for " + date);
  } catch (err) {
    showFatalError("Could not save the day's records", err);
  }
}

/**
 * loadReport()
 * ------------
 * Runs when "Load Report" is clicked. Asks db.js for the combined
 * (joined) attendance + behaviour view for the chosen date, and draws
 * it as a table.
 */
function loadReport() {
  try {
    const date = reportDateInput.value || todayString();
    const rows = DB.getDailyReport(date);

    reportBody.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.full_name}</td>
        <td>${row.class_name || ""}</td>
        <td>${row.attendance_status || "-"}</td>
        <td>${row.behavior_rating || "-"}</td>
        <td>${row.behavior_notes || "-"}</td>
      `;
      reportBody.appendChild(tr);
    });

    if (rows.length === 0) {
      reportBody.innerHTML = `<tr><td colspan="5">No students yet — add some first.</td></tr>`;
    }
  } catch (err) {
    showFatalError("Could not load the report", err);
  }
}

/**
 * startApp()
 * ----------
 * The very first thing that runs. Boots the database, sets today's
 * date into the two date pickers, draws the initial (probably empty)
 * lists, and connects every button/form to its function.
 */
async function startApp() {
  try {
    await DB.init();
  } catch (err) {
    // If the database engine itself fails to start, nothing else on the
    // page will work — show the error and stop here rather than wiring
    // up buttons that would just fail silently too.
    showFatalError("The database failed to start", err);
    return;
  }

  dateInput.value = todayString();
  reportDateInput.value = todayString();

  refreshStudentList();

  studentForm.addEventListener("submit", addStudent);
  saveDayBtn.addEventListener("click", saveDay);
  loadReportBtn.addEventListener("click", loadReport);
  downloadBtn.addEventListener("click", () => DB.downloadDatabaseFile());
}

// Kick everything off once the page has loaded.
startApp();
