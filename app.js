/* ============================================================
   Providence Kids — Class Finder
   Plain JavaScript. No frameworks.
   Staff enter a child's birthday (or age in months) plus which
   service (day + time) they're attending, and the app looks up
   the matching classroom from date-range definitions. No child
   records are stored — this is a lookup tool, not a roster.
   Data layer (Store) swaps between Supabase and localStorage.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "providenceKidsClassFinder.v3";

  var COLOR_CHOICES = [
    "#d96c5f", "#dfa03c", "#6ba368", "#4e9bb0",
    "#5b76c4", "#9b6bc4", "#c05f8f", "#7a8a5a"
  ];

  var DAYS = ["Saturday", "Sunday"];

  /* ---------- date / time helpers ---------- */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  // Age in whole months -> approximate birthdate (YYYY-MM-DD), today minus N months.
  function birthdateFromAgeMonths(months) {
    var d = new Date();
    d.setDate(1); // avoid month-overflow edge cases (e.g. Mar 31 - 1mo)
    d.setMonth(d.getMonth() - months);
    var today = new Date();
    d.setDate(Math.min(today.getDate(), daysInMonth(d.getFullYear(), d.getMonth())));
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function daysInMonth(year, monthIndex0) {
    return new Date(year, monthIndex0 + 1, 0).getDate();
  }

  function fmtDateNice(iso) {
    if (!iso) return "";
    var p = iso.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function fmtDateShort(iso) {
    if (!iso) return "";
    var p = iso.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // "9:30 AM" -> 570 (minutes since midnight), for sorting/comparison.
  function timeToMinutes(label) {
    var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((label || "").trim());
    if (!m) return 0;
    var h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + parseInt(m[2], 10);
  }

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Detects { day, time } to default the sliders to on page load.
  // Uses America/New_York since the church is in Raleigh, NC.
  function detectServiceDefault(availableTimesByDay) {
    var now = new Date();
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long", hour: "numeric", minute: "numeric", hour12: false
    }).formatToParts(now);
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var weekday = map.weekday;
    var minutesNow = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);

    var day = (weekday === "Saturday" || weekday === "Sunday") ? weekday : "Sunday";
    var forceDefaultTime = (weekday !== "Saturday" && weekday !== "Sunday");

    var times = (availableTimesByDay && availableTimesByDay[day]) || [];
    if (!times.length) return { day: day, time: null };

    if (forceDefaultTime) {
      return { day: day, time: times[0] };
    }

    // Pick the slot whose window contains the current time: boundaries
    // sit halfway between each pair of consecutive service start times.
    var sorted = times.slice().sort(function (a, b) { return timeToMinutes(a) - timeToMinutes(b); });
    var chosen = sorted[0];
    for (var i = 0; i < sorted.length; i++) {
      var startMin = timeToMinutes(sorted[i]);
      var nextStart = (i + 1 < sorted.length) ? timeToMinutes(sorted[i + 1]) : Infinity;
      var boundary = (nextStart === Infinity) ? Infinity : (startMin + nextStart) / 2;
      if (minutesNow < boundary) { chosen = sorted[i]; break; }
      chosen = sorted[i];
    }
    return { day: day, time: chosen };
  }

  /* ---------- backend: Supabase (optional) ----------
     If config.js defines SUPABASE_URL + SUPABASE_ANON_KEY, classroom
     definitions live in Supabase. Otherwise falls back to localStorage. */

  var sb = null;
  try {
    if (typeof window !== "undefined" && window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
        window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
  } catch (e) { sb = null; }

  function rowToRoom(r) {
    return {
      id: r.id, name: r.name, day: r.day, time: r.time, room: r.room, color: r.color,
      minBirthdate: r.min_birthdate || null, maxBirthdate: r.max_birthdate || null,
      note: r.note || ""
    };
  }
  function roomToRow(c) {
    return {
      id: c.id, name: c.name, day: c.day, time: c.time, room: c.room, color: c.color,
      min_birthdate: c.minBirthdate || null, max_birthdate: c.maxBirthdate || null,
      note: c.note || ""
    };
  }

  function rq(promise) {
    promise.then(function (res) {
      if (res && res.error) {
        console.error("Supabase write failed:", res.error);
        if (Store.onError) Store.onError("Sync failed — change may not be saved. Check console.");
      }
    });
  }

  /* ---------- seed data (real 2026–2027 Sunday class assignments) ---------- */

  function seedData() {
    function c(id, name, day, time, room, color, minB, maxB, note) {
      return { id: id, name: name, day: day, time: time, room: room, color: color,
        minBirthdate: minB, maxBirthdate: maxB, note: note || "" };
    }
    return [
      // ---- Sunday · 8:00 AM ----
      c("s8_107", "Nursery", "Sunday", "8:00 AM", "107", COLOR_CHOICES[0], "2025-10-02", null),
      c("s8_111", "Nursery", "Sunday", "8:00 AM", "111", COLOR_CHOICES[1], "2025-06-01", "2025-09-30"),
      c("s8_117", "Nursery", "Sunday", "8:00 AM", "117", COLOR_CHOICES[2], "2025-01-01", "2025-05-31"),
      c("s8_120", "Nursery", "Sunday", "8:00 AM", "120", COLOR_CHOICES[3], "2024-09-01", "2024-12-31"),
      c("s8_125", "Twos",    "Sunday", "8:00 AM", "125", COLOR_CHOICES[4], "2023-09-01", "2024-08-31"),
      c("s8_149", "Threes",  "Sunday", "8:00 AM", "149", COLOR_CHOICES[5], "2022-09-01", "2023-08-31"),
      c("s8_154", "Fours",   "Sunday", "8:00 AM", "154", COLOR_CHOICES[6], "2021-09-01", "2022-08-31"),

      // ---- Sunday · 9:30 AM ----
      c("s93_103", "Nursery", "Sunday", "9:30 AM", "103", COLOR_CHOICES[0], "2026-01-02", null),
      c("s93_107", "Nursery", "Sunday", "9:30 AM", "107", COLOR_CHOICES[1], "2025-08-01", "2025-12-31"),
      c("s93_110", "Nursery", "Sunday", "9:30 AM", "110", COLOR_CHOICES[2], "2025-04-01", "2025-07-31"),
      c("s93_111", "Nursery", "Sunday", "9:30 AM", "111", COLOR_CHOICES[3], "2025-01-01", "2025-03-31"),
      c("s93_117", "Nursery", "Sunday", "9:30 AM", "117", COLOR_CHOICES[4], "2024-11-01", "2024-12-31"),
      c("s93_120", "Nursery", "Sunday", "9:30 AM", "120", COLOR_CHOICES[5], "2024-09-01", "2024-10-31"),
      c("s93_143", "Twos",    "Sunday", "9:30 AM", "143", COLOR_CHOICES[6], "2024-03-01", "2024-08-31", "younger"),
      c("s93_147", "Twos",    "Sunday", "9:30 AM", "147", COLOR_CHOICES[7], "2023-09-01", "2024-02-28", "older"),
      c("s93_152", "Threes",  "Sunday", "9:30 AM", "152", COLOR_CHOICES[0], "2023-03-01", "2023-08-31", "younger"),
      c("s93_154", "Threes",  "Sunday", "9:30 AM", "154", COLOR_CHOICES[1], "2022-09-01", "2023-02-28", "older"),
      c("s93_164", "Fours",   "Sunday", "9:30 AM", "164", COLOR_CHOICES[2], "2022-03-01", "2022-08-31", "younger"),
      c("s93_166", "Fours",   "Sunday", "9:30 AM", "166", COLOR_CHOICES[3], "2021-09-01", "2022-02-28", "older"),

      // ---- Sunday · 11:10 AM ----
      c("s1110_103", "Nursery", "Sunday", "11:10 AM", "103", COLOR_CHOICES[0], "2025-11-02", null),
      c("s1110_110", "Nursery", "Sunday", "11:10 AM", "110", COLOR_CHOICES[1], "2025-05-01", "2025-10-31"),
      c("s1110_120", "Nursery", "Sunday", "11:10 AM", "120", COLOR_CHOICES[2], "2024-09-01", "2025-04-30"),
      c("s1110_147", "Twos",    "Sunday", "11:10 AM", "147", COLOR_CHOICES[3], "2023-09-01", "2024-08-31"),
      c("s1110_154", "Threes",  "Sunday", "11:10 AM", "154", COLOR_CHOICES[4], "2022-09-01", "2023-08-31"),
      c("s1110_164", "Fours",   "Sunday", "11:10 AM", "164", COLOR_CHOICES[5], "2021-09-01", "2022-08-31")

      // No Saturday sheet was provided yet — add Saturday classrooms from
      // the admin page (⚙ Add Classroom) once that schedule is available.
    ];
  }

  /* ---------- store ---------- */

  var Store = {
    state: null, // { classrooms: [...] }
    mode: "local",
    onError: null,

    init: function () {
      var self = this;
      if (!sb) {
        self.mode = "local";
        self.loadLocal();
        return Promise.resolve();
      }
      self.mode = "supabase";
      return sb.from("classrooms").select("*").then(function (res) {
        if (res.error) throw res.error;
        self.state = { classrooms: (res.data || []).map(rowToRoom) };
      }).catch(function (err) {
        console.error("Supabase unavailable — falling back to local demo mode:", err);
        sb = null;
        self.mode = "local";
        self.loadLocal();
      });
    },

    loadLocal: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.classrooms)) {
            this.state = parsed;
            return;
          }
        }
      } catch (e) { /* corrupt storage: start fresh */ }
      this.state = { classrooms: seedData() };
      this.save();
    },

    save: function () {
      if (this.mode !== "local") return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) { /* storage unavailable: still works in-memory */ }
    },

    classroom: function (id) {
      return this.state.classrooms.find(function (c) { return c.id === id; }) || null;
    },

    availableTimesByDay: function () {
      var map = {};
      DAYS.forEach(function (d) { map[d] = []; });
      this.state.classrooms.forEach(function (c) {
        if (!map[c.day]) map[c.day] = [];
        if (map[c.day].indexOf(c.time) === -1) map[c.day].push(c.time);
      });
      Object.keys(map).forEach(function (d) {
        map[d].sort(function (a, b) { return timeToMinutes(a) - timeToMinutes(b); });
      });
      return map;
    },

    classroomsFor: function (day, time) {
      return this.state.classrooms
        .filter(function (c) { return c.day === day && c.time === time; })
        .sort(function (a, b) {
          var am = a.minBirthdate || "0000-00-00", bm = b.minBirthdate || "0000-00-00";
          return bm.localeCompare(am); // oldest birthdate range (youngest class... ) — see below
        });
    },

    // Given ISO birthdate, find the matching classroom for a day+time.
    classForBirthdate: function (day, time, birthdateISO) {
      return this.state.classrooms.find(function (c) {
        if (c.day !== day || c.time !== time) return false;
        if (c.minBirthdate && birthdateISO < c.minBirthdate) return false;
        if (c.maxBirthdate && birthdateISO > c.maxBirthdate) return false;
        return true;
      }) || null;
    },

    addClassroom: function () {
      var n = this.state.classrooms.length + 1;
      var room = {
        id: uid("c"), name: "New Classroom", day: "Sunday", time: "8:00 AM", room: "TBD",
        color: COLOR_CHOICES[(n - 1) % COLOR_CHOICES.length],
        minBirthdate: null, maxBirthdate: null, note: ""
      };
      this.state.classrooms.push(room);
      this.save();
      if (sb) rq(sb.from("classrooms").insert(roomToRow(room)));
      return room;
    },

    updateClassroom: function (id, data) {
      var room = this.classroom(id);
      if (!room) return { ok: false, message: "Classroom not found." };
      room.name = data.name;
      room.day = data.day;
      room.time = data.time;
      room.room = data.room;
      room.color = data.color;
      room.minBirthdate = data.minBirthdate || null;
      room.maxBirthdate = data.maxBirthdate || null;
      room.note = data.note || "";
      this.save();
      if (sb) rq(sb.from("classrooms").update(roomToRow(room)).eq("id", id));
      return { ok: true };
    },

    removeClassroom: function (id) {
      this.state.classrooms = this.state.classrooms.filter(function (c) { return c.id !== id; });
      this.save();
      if (sb) rq(sb.from("classrooms").delete().eq("id", id));
    }
  };

  /* ============================================================
     PUBLIC PAGE — Class Finder
     ============================================================ */

  function initPublic() {
    var daySlider = document.getElementById("daySlider");
    var dayLabels = document.getElementById("dayLabels");
    var timeSlider = document.getElementById("timeSlider");
    var timeLabels = document.getElementById("timeLabels");

    var modeBirthdayBtn = document.getElementById("modeBirthdayBtn");
    var modeAgeBtn = document.getElementById("modeAgeBtn");
    var birthdayField = document.getElementById("birthdayField");
    var ageField = document.getElementById("ageField");
    var birthdayInput = document.getElementById("birthdayInput");
    var ageInput = document.getElementById("ageInput");
    var findBtn = document.getElementById("findClassBtn");
    var result = document.getElementById("lookupResult");
    var list = document.getElementById("publicClassList");
    var listHeading = document.getElementById("publicClassListHeading");

    var mode = "birthday";
    var currentTimesForDay = [];

    function selectedDay() { return DAYS[parseInt(daySlider.value, 10)] || "Sunday"; }
    function selectedTime() { return currentTimesForDay[parseInt(timeSlider.value, 10)] || null; }

    function renderDayLabels() {
      dayLabels.innerHTML = DAYS.map(function (d, i) {
        return '<span class="' + (i === parseInt(daySlider.value, 10) ? "slider-label-active" : "") + '">' + d + "</span>";
      }).join("");
    }

    function renderTimeSliderForDay() {
      var byDay = Store.availableTimesByDay();
      currentTimesForDay = byDay[selectedDay()] || [];
      if (!currentTimesForDay.length) {
        timeSlider.min = 0; timeSlider.max = 0; timeSlider.value = 0;
        timeSlider.disabled = true;
        timeLabels.innerHTML = '<span class="slider-label-active">No services configured</span>';
        return;
      }
      timeSlider.disabled = false;
      timeSlider.min = 0;
      timeSlider.max = currentTimesForDay.length - 1;
      if (parseInt(timeSlider.value, 10) > currentTimesForDay.length - 1) {
        timeSlider.value = 0;
      }
      renderTimeLabels();
    }

    function renderTimeLabels() {
      timeLabels.innerHTML = currentTimesForDay.map(function (t, i) {
        return '<span class="' + (i === parseInt(timeSlider.value, 10) ? "slider-label-active" : "") + '">' + t + "</span>";
      }).join("");
    }

    function renderClassList() {
      var day = selectedDay(), time = selectedTime();
      listHeading.textContent = time ? ("Classes for " + day + " · " + time) : ("Classes for " + day);
      if (!time) {
        list.innerHTML = '<p class="empty-note">No classes configured for ' + esc(day) +
          ' yet. Add them from the <a href="admin.html">admin page</a>.</p>';
        return;
      }
      var rooms = Store.classroomsFor(day, time);
      if (!rooms.length) {
        list.innerHTML = '<p class="empty-note">No classes configured for this service yet.</p>';
        return;
      }
      list.innerHTML = rooms.map(function (c) {
        var range = c.minBirthdate
          ? (fmtDateShort(c.minBirthdate) + (c.maxBirthdate ? " – " + fmtDateShort(c.maxBirthdate) : " – present"))
          : "";
        return '<div class="public-class-card" data-classroom-id="' + esc(c.id) + '" style="border-top-color:' + esc(c.color) + '">' +
          '<h3 class="public-class-name">' + esc(c.name) + " · Room " + esc(c.room) +
            (c.note ? ' <span class="class-note-tag">' + esc(c.note) + "</span>" : "") + "</h3>" +
          '<p class="public-class-range">Birthdays ' + range + "</p>" +
          "</div>";
      }).join("");
    }

    function clearHighlight() {
      list.querySelectorAll(".public-class-card.highlight").forEach(function (el) {
        el.classList.remove("highlight");
      });
    }

    function lookup() {
      var day = selectedDay(), time = selectedTime();
      clearHighlight();

      if (!time) {
        result.innerHTML = '<div class="result-card result-none">' +
          '<p class="result-kicker">No services configured</p>' +
          '<p class="result-class">Nothing set up for ' + esc(day) + " yet</p>" +
          "</div>";
        return;
      }

      var birthdateISO = null;
      if (mode === "birthday") {
        if (!birthdayInput.value) {
          result.innerHTML = '<div class="result-card result-none">' +
            '<p class="result-kicker">One more thing</p>' +
            '<p class="result-class">Enter a birthday</p>' +
            "</div>";
          return;
        }
        birthdateISO = birthdayInput.value;
      } else {
        var months = Number(ageInput.value);
        if (ageInput.value === "" || isNaN(months) || months < 0) {
          result.innerHTML = '<div class="result-card result-none">' +
            '<p class="result-kicker">One more thing</p>' +
            '<p class="result-class">Enter an age in months</p>' +
            "</div>";
          return;
        }
        birthdateISO = birthdateFromAgeMonths(Math.floor(months));
      }

      if (birthdateISO > todayISO()) {
        result.innerHTML = '<div class="result-card result-none">' +
          '<p class="result-kicker">Check the date</p>' +
          '<p class="result-class">That birthday is in the future</p>' +
          "</div>";
        return;
      }

      var room = Store.classForBirthdate(day, time, birthdateISO);
      if (room) {
        result.innerHTML = '<div class="result-card" style="border-left-color:' + esc(room.color) + '">' +
          '<p class="result-kicker">' + esc(day) + " · " + esc(time) + "</p>" +
          '<p class="result-class">' + esc(room.name) + " — Room " + esc(room.room) + "</p>" +
          '<p class="result-detail">Birthday ' + fmtDateNice(birthdateISO) +
            (mode === "age" ? " (from " + Math.floor(Number(ageInput.value)) + " months old)" : "") + "</p>" +
          "</div>";
        var card = list.querySelector('[data-classroom-id="' + room.id + '"]');
        if (card) {
          card.classList.add("highlight");
          card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      } else {
        result.innerHTML = '<div class="result-card result-none">' +
          '<p class="result-kicker">No match found</p>' +
          '<p class="result-class">No class covers that birthday for ' + esc(day) + " · " + esc(time) + "</p>" +
          '<p class="result-detail">Please check with the office — the class list may need updating.</p>' +
          "</div>";
      }
    }

    function setMode(next) {
      mode = next;
      modeBirthdayBtn.classList.toggle("mode-tab-active", mode === "birthday");
      modeAgeBtn.classList.toggle("mode-tab-active", mode === "age");
      birthdayField.hidden = mode !== "birthday";
      ageField.hidden = mode !== "age";
    }

    modeBirthdayBtn.addEventListener("click", function () { setMode("birthday"); });
    modeAgeBtn.addEventListener("click", function () { setMode("age"); });

    daySlider.addEventListener("input", function () {
      renderDayLabels();
      renderTimeSliderForDay();
      renderClassList();
    });
    timeSlider.addEventListener("input", function () {
      renderTimeLabels();
      renderClassList();
    });

    findBtn.addEventListener("click", lookup);
    birthdayInput.addEventListener("keydown", function (e) { if (e.key === "Enter") lookup(); });
    ageInput.addEventListener("keydown", function (e) { if (e.key === "Enter") lookup(); });

    // Initial state: auto-detect day/time from the current date/time.
    var byDay = Store.availableTimesByDay();
    var defaults = detectServiceDefault(byDay);
    daySlider.value = DAYS.indexOf(defaults.day) >= 0 ? DAYS.indexOf(defaults.day) : 1;
    renderDayLabels();
    renderTimeSliderForDay();
    if (defaults.time) {
      var idx = currentTimesForDay.indexOf(defaults.time);
      timeSlider.value = idx >= 0 ? idx : 0;
      renderTimeLabels();
    }
    renderClassList();
    setMode("birthday");
    birthdayInput.max = todayISO();
  }

  /* ============================================================
     ADMIN PAGE — manage class definitions
     ============================================================ */

  function initAdmin() {
    var list = document.getElementById("adminClassList");
    var summary = document.getElementById("adminSummary");

    function render() {
      if (Store.mode === "local") {
        var note = document.getElementById("localModeNote");
        if (note) note.hidden = false;
      }

      summary.textContent = Store.state.classrooms.length + " classroom" +
        (Store.state.classrooms.length === 1 ? "" : "s") + " configured";

      var byDay = {};
      DAYS.forEach(function (d) { byDay[d] = {}; });
      Store.state.classrooms.forEach(function (c) {
        if (!byDay[c.day]) byDay[c.day] = {};
        if (!byDay[c.day][c.time]) byDay[c.day][c.time] = [];
        byDay[c.day][c.time].push(c);
      });

      var html = "";
      DAYS.forEach(function (day) {
        var times = Object.keys(byDay[day]).sort(function (a, b) { return timeToMinutes(a) - timeToMinutes(b); });
        html += '<h2 class="day-heading">' + day +
          '<span class="day-count">' + times.reduce(function (n, t) { return n + byDay[day][t].length; }, 0) + " classrooms</span></h2>";
        if (!times.length) {
          html += '<p class="empty-note">No classrooms yet for ' + day + ".</p>";
          return;
        }
        times.forEach(function (time) {
          var rooms = byDay[day][time].slice().sort(function (a, b) {
            return (a.minBirthdate || "").localeCompare(b.minBirthdate || "");
          });
          html += '<h3 class="time-heading">' + time + "</h3>" +
            '<div class="classroom-grid">' +
            rooms.map(function (c) {
              var range = c.minBirthdate
                ? (fmtDateShort(c.minBirthdate) + " – " + (c.maxBirthdate ? fmtDateShort(c.maxBirthdate) : "present"))
                : "No range set";
              return '<div class="classroom-card" style="--room-color:' + esc(c.color) + '">' +
                '<div class="classroom-head">' +
                  '<div class="classroom-title">' +
                    '<h3 class="classroom-name"><span class="color-dot"></span>' + esc(c.name) +
                      (c.note ? ' <span class="class-note-tag">' + esc(c.note) + "</span>" : "") + "</h3>" +
                    '<p class="classroom-range">Room ' + esc(c.room) + " · " + esc(range) + "</p>" +
                  "</div>" +
                  '<button class="slot-mini-btn" data-action="edit" data-id="' + esc(c.id) + '" aria-label="Edit classroom" style="font-size:1.1rem">⚙</button>' +
                "</div>" +
              "</div>";
            }).join("") +
            "</div>";
        });
      });
      list.innerHTML = html;
    }

    list.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action=edit]");
      if (!btn) return;
      openClassroomModal(btn.dataset.id);
    });

    /* ---------- classroom modal ---------- */

    var classroomForm = document.getElementById("classroomForm");
    var classroomFormError = document.getElementById("classroomFormError");
    var swatches = document.getElementById("colorSwatches");
    var selectedColor = COLOR_CHOICES[0];
    var noUpperLimit = document.getElementById("classroomNoMax");
    var maxField = document.getElementById("classroomMax");

    function renderSwatches() {
      swatches.innerHTML = COLOR_CHOICES.map(function (color) {
        return '<button type="button" class="swatch' +
          (color === selectedColor ? " selected" : "") +
          '" style="background:' + color + '" data-color="' + color +
          '" aria-label="Select color ' + color + '"></button>';
      }).join("");
    }
    swatches.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-color]");
      if (!btn) return;
      selectedColor = btn.dataset.color;
      renderSwatches();
    });

    noUpperLimit.addEventListener("change", function () {
      maxField.disabled = noUpperLimit.checked;
      if (noUpperLimit.checked) maxField.value = "";
    });

    function openModal(id) {
      document.getElementById(id).hidden = false;
    }
    function closeModal(id) {
      document.getElementById(id).hidden = true;
    }
    document.querySelectorAll("[data-close-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () { closeModal(btn.dataset.closeModal); });
    });

    function openClassroomModal(roomId) {
      var room = Store.classroom(roomId);
      if (!room) return;
      document.getElementById("classroomId").value = room.id;
      document.getElementById("classroomName").value = room.name;
      document.getElementById("classroomDay").value = room.day || "Sunday";
      document.getElementById("classroomTime").value = room.time || "8:00 AM";
      document.getElementById("classroomRoom").value = room.room || "";
      document.getElementById("classroomMin").value = room.minBirthdate || "";
      document.getElementById("classroomNote").value = room.note || "";
      if (room.maxBirthdate) {
        maxField.value = room.maxBirthdate;
        maxField.disabled = false;
        noUpperLimit.checked = false;
      } else {
        maxField.value = "";
        maxField.disabled = true;
        noUpperLimit.checked = true;
      }
      selectedColor = room.color;
      renderSwatches();
      classroomFormError.hidden = true;
      document.getElementById("classroomModalTitle").textContent = "Edit Classroom";
      openModal("classroomModal");
    }

    classroomForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = document.getElementById("classroomId").value;
      var name = document.getElementById("classroomName").value.trim();
      var day = document.getElementById("classroomDay").value;
      var time = document.getElementById("classroomTime").value.trim();
      var roomNo = document.getElementById("classroomRoom").value.trim();
      var min = document.getElementById("classroomMin").value;
      var max = noUpperLimit.checked ? "" : maxField.value;
      var note = document.getElementById("classroomNote").value.trim();

      if (!name) { showErr("Classroom name is required."); return; }
      if (!time) { showErr("Service time is required (e.g. 8:00 AM)."); return; }
      if (!roomNo) { showErr("Room number is required."); return; }
      if (!min) { showErr("A starting birthdate is required."); return; }
      if (max && max < min) { showErr("End date can't be before the start date."); return; }

      function showErr(msg) {
        classroomFormError.textContent = msg;
        classroomFormError.hidden = false;
      }

      Store.updateClassroom(id, {
        name: name, day: day, time: time, room: roomNo, color: selectedColor,
        minBirthdate: min, maxBirthdate: max || null, note: note
      });
      closeModal("classroomModal");
      render();
      toast("Classroom updated");
    });

    document.getElementById("deleteClassroomBtn").addEventListener("click", function () {
      var id = document.getElementById("classroomId").value;
      var room = Store.classroom(id);
      if (!room) return;
      if (!confirm('Delete "' + room.name + ' — Room ' + room.room + '"?')) return;
      Store.removeClassroom(id);
      closeModal("classroomModal");
      render();
      toast(room.name + " deleted");
    });

    document.getElementById("addClassroomBtn").addEventListener("click", function () {
      var room = Store.addClassroom();
      render();
      openClassroomModal(room.id);
      document.getElementById("classroomModalTitle").textContent = "New Classroom";
      toast("Classroom created — set its details below");
    });

    /* ---------- toast ---------- */

    var toastTimer = null;
    function toast(msg, isError) {
      var el = document.getElementById("toast");
      el.textContent = msg;
      el.className = "toast" + (isError ? " toast-error" : "");
      el.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
    }

    render();
  }

  /* ---------- boot ---------- */

  Store.init().then(function () {
    if (document.body.classList.contains("page-admin")) {
      initAdmin();
    } else {
      initPublic();
    }
  });
})();
