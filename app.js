/* ============================================================
   Providence Kids — demo app
   Plain JavaScript + localStorage. No frameworks, no backend.
   Designed so the data layer (Store) can be swapped for
   Supabase later without touching the UI code much.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "providenceKidsDemo.v2";
  var CAPACITY = 12;

  var COLOR_CHOICES = [
    "#d96c5f", // coral
    "#dfa03c", // amber
    "#6ba368", // green
    "#4e9bb0", // teal
    "#5b76c4", // blue
    "#9b6bc4", // violet
    "#c05f8f", // rose
    "#7a8a5a"  // olive
  ];

  /* ---------- date helpers ---------- */

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // Birthdate string "YYYY-MM-DD" -> whole months old (never negative).
  function monthsOld(birthdate) {
    if (!birthdate) return 0;
    var parts = birthdate.split("-").map(Number);
    var b = new Date(parts[0], parts[1] - 1, parts[2]);
    var now = new Date();
    var months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
    if (now.getDate() < b.getDate()) months -= 1;
    return Math.max(0, months);
  }

  // Make a birthdate that is `months` months (and a few days) in the past.
  function birthdateForAge(months, dayJitter) {
    var d = new Date();
    d.setMonth(d.getMonth() - months);
    d.setDate(Math.max(1, d.getDate() - (dayJitter || 3)));
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    return p[1] + "/" + p[2] + "/" + p[0];
  }

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- seed data ---------- */

  function seedData() {
    var classrooms = [
      // Saturday — 2 classes
      { id: "c_sat110", name: "Little Lambs",  day: "Saturday", room: "110", color: COLOR_CHOICES[0], minMonths: 0,  maxMonths: 36 },
      { id: "c_sat120", name: "Kingdom Kids",  day: "Saturday", room: "120", color: COLOR_CHOICES[1], minMonths: 37, maxMonths: 72 },
      // Sunday — 4 classes
      { id: "c_sun110", name: "Nursery",       day: "Sunday",   room: "110", color: COLOR_CHOICES[2], minMonths: 0,  maxMonths: 18 },
      { id: "c_sun120", name: "Toddlers",      day: "Sunday",   room: "120", color: COLOR_CHOICES[3], minMonths: 19, maxMonths: 36 },
      { id: "c_sun130", name: "Preschool",     day: "Sunday",   room: "130", color: COLOR_CHOICES[4], minMonths: 37, maxMonths: 54 },
      { id: "c_sun140", name: "Pre-K & Kinder", day: "Sunday",  room: "140", color: COLOR_CHOICES[5], minMonths: 55, maxMonths: 72 }
    ];

    // [name, ageMonths, classroomId|null, guardianName, guardianEmail, notes]
    var kids = [
      ["Ava Thompson",   6,  "c_sat110", "Rachel Thompson", "rachel.t@example.com",   "Peanut allergy — EpiPen in bag"],
      ["Noah Williams",  9,  "c_sat110", "Chris Williams",  "chris.w@example.com",    ""],
      ["Elijah Brooks",  15, "c_sat110", "Dana Brooks",     "dana.brooks@example.com", "Naps around 10:30"],
      ["Sadie Nguyen",   33, "c_sat110", "Linh Nguyen",     "linh.n@example.com",     ""],
      ["Ella Martin",    40, "c_sat120", "Beth Martin",     "beth.martin@example.com", "Only mom or grandma may pick up"],
      ["Isaac Rivera",   52, "c_sat120", "Maria Rivera",    "maria.rivera@example.com", ""],
      ["Ruby Hayes",     68, "c_sat120", "Tom Hayes",       "",                        "Wears glasses"],
      ["Lily Chen",      11, "c_sun110", "Grace Chen",      "grace.chen@example.com", ""],
      ["Mia Rodriguez",  18, "c_sun110", "Sofia Rodriguez", "sofia.r@example.com",    "Dairy sensitivity"],
      ["John Smith",     24, "c_sun120", "Emily Smith",     "emily.smith@example.com", ""],
      ["Harper Davis",   20, "c_sun120", "Kyle Davis",      "",                        ""],
      ["Owen Patel",     28, "c_sun120", "Priya Patel",     "priya.patel@example.com", "First-time visitor 8/2026"],
      ["Caleb Johnson",  36, "c_sun120", "Marcus Johnson",  "marcus.j@example.com",   ""],
      ["Levi Anderson",  45, "c_sun130", "Paul Anderson",   "",                        "Shy at drop-off; warms up fast"],
      ["Zoe Carter",     47, "c_sun130", "Renee Carter",    "renee.carter@example.com", ""],
      ["Nora Bell",      57, "c_sun140", "Aaron Bell",      "aaron.bell@example.com", ""],
      ["Micah Foster",   63, "c_sun140", "Jill Foster",     "jill.foster@example.com", "Sister Ruby is in Sat Room 120"],
      // Unassigned
      ["Grace Kim",      8,  null,       "Hannah Kim",      "hannah.kim@example.com", ""],
      ["Jack Murphy",    22, null,       "Sean Murphy",     "sean.murphy@example.com", "Gluten-free snacks only"],
      ["Chloe Bennett",  31, null,       "Amy Bennett",     "amy.bennett@example.com", ""],
      ["Samuel Ortiz",   44, null,       "Luis Ortiz",      "luis.ortiz@example.com", ""],
      ["Abigail Turner", 55, null,       "Kate Turner",     "",                        "New family — moved from Durham"],
      ["Henry Walsh",    66, null,       "Megan Walsh",     "megan.walsh@example.com", ""]
    ];

    var children = kids.map(function (k, i) {
      return {
        id: "k_" + (i + 1),
        name: k[0],
        birthdate: birthdateForAge(k[1], (i % 9) + 2),
        classroomId: k[2],
        guardianName: k[3] || "",
        guardianEmail: k[4] || "",
        notes: k[5] || ""
      };
    });

    return { classrooms: classrooms, children: children };
  }

  /* ---------- backend: Supabase (optional) ----------
     If config.js defines SUPABASE_URL + SUPABASE_ANON_KEY, all data
     lives in Supabase. Otherwise the app falls back to a local
     demo mode backed by localStorage. */

  var sb = null;
  try {
    if (typeof window !== "undefined" && window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
        window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
  } catch (e) { sb = null; }

  function rowToRoom(r) {
    return { id: r.id, name: r.name, day: r.day, room: r.room, color: r.color,
             minMonths: r.min_months, maxMonths: r.max_months };
  }
  function roomToRow(c) {
    return { id: c.id, name: c.name, day: c.day, room: c.room, color: c.color,
             min_months: c.minMonths, max_months: c.maxMonths };
  }
  function rowToChild(r) {
    return { id: r.id, name: r.name, birthdate: r.birthdate,
             guardianName: r.guardian_name || "", guardianEmail: r.guardian_email || "",
             notes: r.notes || "", classroomId: r.classroom_id || null };
  }
  function childToRow(k) {
    return { id: k.id, name: k.name, birthdate: k.birthdate,
             guardian_name: k.guardianName || "", guardian_email: k.guardianEmail || "",
             notes: k.notes || "", classroom_id: k.classroomId || null };
  }

  // Fire-and-forget remote write with error surfacing.
  function rq(promise) {
    promise.then(function (res) {
      if (res && res.error) {
        console.error("Supabase write failed:", res.error);
        if (Store.onError) Store.onError("Sync failed — change may not be saved. Check console.");
      }
    });
  }

  /* ---------- store ---------- */

  var Store = {
    state: null,
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
      return Promise.all([
        sb.from("classrooms").select("*"),
        sb.from("children").select("*")
      ]).then(function (res) {
        if (res[0].error || res[1].error) throw (res[0].error || res[1].error);
        var rooms = (res[0].data || []).map(rowToRoom);
        var kids = (res[1].data || []).map(rowToChild);
        if (!rooms.length && !kids.length) {
          // First run against an empty database: seed it once.
          var seed = seedData();
          self.state = seed;
          return sb.from("classrooms").insert(seed.classrooms.map(roomToRow)).then(function (r1) {
            if (r1.error) throw r1.error;
            return sb.from("children").insert(seed.children.map(childToRow));
          }).then(function (r2) {
            if (r2.error) throw r2.error;
          });
        }
        self.state = { classrooms: rooms, children: kids };
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
          if (parsed && Array.isArray(parsed.classrooms) && Array.isArray(parsed.children)) {
            // Light migration for data saved before notes/day/room existed
            parsed.children.forEach(function (k) { if (k.notes === undefined) k.notes = ""; });
            parsed.classrooms.forEach(function (c) {
              if (!c.day) c.day = "Sunday";
              if (!c.room) c.room = "TBD";
            });
            this.state = parsed;
            return;
          }
        }
      } catch (e) { /* fall through to reseed */ }
      this.state = seedData();
      this.save();
    },

    save: function () {
      if (this.mode !== "local") return; // Supabase mode writes per-operation
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) { /* storage unavailable: still works in-memory */ }
    },

    reset: function () {
      this.state = seedData();
      this.save();
    },

    classroom: function (id) {
      return this.state.classrooms.find(function (c) { return c.id === id; }) || null;
    },

    child: function (id) {
      return this.state.children.find(function (k) { return k.id === id; }) || null;
    },

    childrenIn: function (classroomId) {
      return this.state.children.filter(function (k) { return k.classroomId === classroomId; });
    },

    unassigned: function () {
      return this.state.children.filter(function (k) { return !k.classroomId; });
    },

    classForAge: function (months) {
      return this.state.classrooms.find(function (c) {
        return months >= c.minMonths && months <= c.maxMonths;
      }) || null;
    },

    moveChild: function (childId, classroomId) {
      var kid = this.child(childId);
      if (!kid) return { ok: false, message: "Child not found." };
      if (classroomId) {
        var room = this.classroom(classroomId);
        if (!room) return { ok: false, message: "Classroom not found." };
        if (kid.classroomId !== classroomId && this.childrenIn(classroomId).length >= CAPACITY) {
          return { ok: false, message: room.name + " is full (" + CAPACITY + "/" + CAPACITY + ")." };
        }
      }
      kid.classroomId = classroomId || null;
      this.save();
      if (sb) rq(sb.from("children").update({ classroom_id: kid.classroomId }).eq("id", kid.id));
      return { ok: true };
    },

    addChild: function (data) {
      var kid = {
        id: uid("k"),
        name: data.name,
        birthdate: data.birthdate,
        guardianName: data.guardianName || "",
        guardianEmail: data.guardianEmail || "",
        notes: data.notes || "",
        classroomId: null
      };
      this.state.children.push(kid);
      this.save();
      if (sb) rq(sb.from("children").insert(childToRow(kid)));
      if (data.classroomId) {
        var res = this.moveChild(kid.id, data.classroomId);
        if (!res.ok) return { ok: true, kid: kid, warning: res.message + " Saved as Unassigned." };
      }
      return { ok: true, kid: kid };
    },

    updateChild: function (id, data) {
      var kid = this.child(id);
      if (!kid) return { ok: false, message: "Child not found." };
      kid.name = data.name;
      kid.birthdate = data.birthdate;
      kid.guardianName = data.guardianName || "";
      kid.guardianEmail = data.guardianEmail || "";
      kid.notes = data.notes || "";
      this.save();
      if (sb) {
        rq(sb.from("children").update({
          name: kid.name, birthdate: kid.birthdate,
          guardian_name: kid.guardianName, guardian_email: kid.guardianEmail,
          notes: kid.notes
        }).eq("id", kid.id));
      }
      if ((data.classroomId || null) !== (kid.classroomId || null)) {
        var res = this.moveChild(id, data.classroomId);
        if (!res.ok) return { ok: true, warning: res.message + " Classroom unchanged." };
      }
      return { ok: true };
    },

    addClassroom: function () {
      var n = this.state.classrooms.length + 1;
      var room = {
        id: uid("c"),
        name: "New Classroom " + n,
        day: "Sunday",
        room: "TBD",
        color: COLOR_CHOICES[(n - 1) % COLOR_CHOICES.length],
        minMonths: 0,
        maxMonths: 12
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
      room.room = data.room;
      room.color = data.color;
      room.minMonths = data.minMonths;
      room.maxMonths = data.maxMonths;
      this.save();
      if (sb) rq(sb.from("classrooms").update(roomToRow(room)).eq("id", room.id));
      return { ok: true };
    },

    removeClassroom: function (id) {
      // Children are kept — moved to Unassigned first.
      this.state.children.forEach(function (k) {
        if (k.classroomId === id) k.classroomId = null;
      });
      this.state.classrooms = this.state.classrooms.filter(function (c) { return c.id !== id; });
      this.save();
      if (sb) {
        sb.from("children").update({ classroom_id: null }).eq("classroom_id", id).then(function (r1) {
          if (r1.error) {
            console.error("Supabase write failed:", r1.error);
            if (Store.onError) Store.onError("Sync failed — change may not be saved.");
            return;
          }
          rq(sb.from("classrooms").delete().eq("id", id));
        });
      }
    }
  };

  /* ============================================================
     PUBLIC PAGE
     ============================================================ */

  function initPublic() {
    var input = document.getElementById("nameInput");
    var btn = document.getElementById("findClassBtn");
    var result = document.getElementById("lookupResult");
    var list = document.getElementById("publicClassList");

    function classLabel(room) {
      return esc(room.name) + " — " + esc(room.day) + " · Room " + esc(room.room);
    }

    function renderClassList() {
      var html = "";
      ["Saturday", "Sunday"].forEach(function (day) {
        var rooms = Store.state.classrooms
          .filter(function (c) { return c.day === day; })
          .sort(function (a, b) { return String(a.room).localeCompare(String(b.room), undefined, { numeric: true }); });
        if (!rooms.length) return;
        html += '<h3 class="day-heading">' + day + "</h3>" +
          '<div class="public-class-grid">' +
          rooms.map(function (c) {
            return '<div class="public-class-card" style="border-top-color:' + esc(c.color) + '">' +
              '<h3 class="public-class-name">' + esc(c.name) + "</h3>" +
              '<p class="public-class-range">Room ' + esc(c.room) + " · " +
                c.minMonths + "–" + c.maxMonths + " months</p>" +
              "</div>";
          }).join("") +
          "</div>";
      });
      list.innerHTML = html;
    }

    function lookup() {
      var term = input.value.trim().toLowerCase();
      if (!term) {
        result.innerHTML =
          '<div class="result-card result-none">' +
          '<p class="result-kicker">One more thing</p>' +
          '<p class="result-class">Enter your child’s name</p>' +
          '<p class="result-detail">For example: John Smith</p>' +
          "</div>";
        return;
      }

      var matches = Store.state.children.filter(function (k) {
        return k.name.toLowerCase().indexOf(term) !== -1;
      });

      if (!matches.length) {
        result.innerHTML =
          '<div class="result-card result-none">' +
          '<p class="result-kicker">No match found</p>' +
          '<p class="result-class">We couldn’t find that name</p>' +
          '<p class="result-detail">Please stop by the check-in desk and our team will help you get registered.</p>' +
          "</div>";
        return;
      }

      result.innerHTML = matches.slice(0, 5).map(function (kid) {
        var room = kid.classroomId ? Store.classroom(kid.classroomId) : null;
        if (room) {
          return '<div class="result-card" style="border-left-color:' + esc(room.color) + '">' +
            '<p class="result-kicker">' + esc(kid.name) + " · " + monthsOld(kid.birthdate) + " months</p>" +
            '<p class="result-class">' + esc(room.name) + "</p>" +
            '<p class="result-detail">' + esc(room.day) + " · Room " + esc(room.room) + "</p>" +
            "</div>";
        }
        return '<div class="result-card result-none">' +
          '<p class="result-kicker">' + esc(kid.name) + " · " + monthsOld(kid.birthdate) + " months</p>" +
          '<p class="result-class">Not assigned to a class yet</p>' +
          '<p class="result-detail">Please stop by the check-in desk and our team will help you.</p>' +
          "</div>";
      }).join("");

      if (matches.length > 5) {
        result.innerHTML += '<p class="result-detail" style="margin-top:8px">Showing 5 of ' +
          matches.length + " matches — try a full name.</p>";
      }
    }

    btn.addEventListener("click", lookup);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") lookup();
    });

    renderClassList();
  }

  /* ============================================================
     ADMIN PAGE
     ============================================================ */

  function initAdmin() {
    var grid = document.getElementById("classroomGrid");
    var tbody = document.getElementById("unassignedTbody");
    var unassignedDrop = document.getElementById("unassignedDrop");
    var unassignedEmpty = document.getElementById("unassignedEmpty");
    var searchInput = document.getElementById("unassignedSearch");
    var summary = document.getElementById("dashboardSummary");
    var toastEl = document.getElementById("toast");
    var toastTimer = null;
    var assignTargetRoomId = null;

    Store.onError = function (msg) { toast(msg, true); };

    // Reset Demo Data only applies to the offline localStorage mode.
    if (Store.mode === "supabase") {
      document.getElementById("resetDemoBtn").style.display = "none";
    } else {
      var note = document.createElement("p");
      note.className = "page-sub";
      note.textContent = "Offline demo mode — add Supabase credentials in config.js to use the live database.";
      document.querySelector(".admin-toolbar div").appendChild(note);
    }

    /* ---------- toast ---------- */

    function toast(msg, isError) {
      toastEl.textContent = msg;
      toastEl.classList.toggle("toast-error", !!isError);
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
    }

    /* ---------- modal plumbing ---------- */

    function openModal(id) {
      document.getElementById(id).hidden = false;
      var firstInput = document.getElementById(id).querySelector("input:not([type=hidden]), select");
      if (firstInput) setTimeout(function () { firstInput.focus(); }, 30);
    }

    function closeModal(id) {
      document.getElementById(id).hidden = true;
    }

    document.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", function () { closeModal(btn.getAttribute("data-close")); });
    });

    document.querySelectorAll(".modal-overlay").forEach(function (ov) {
      ov.addEventListener("mousedown", function (e) {
        if (e.target === ov) ov.hidden = true;
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay").forEach(function (ov) { ov.hidden = true; });
      }
    });

    /* ---------- render: classrooms ---------- */

    function render() {
      renderClassrooms();
      renderUnassigned();
      var total = Store.state.children.length;
      var unassignedCount = Store.unassigned().length;
      summary.textContent = Store.state.classrooms.length + " classrooms · " +
        total + " children · " + unassignedCount + " unassigned";
    }

    function renderClassrooms() {
      grid.innerHTML = "";
      var days = [];
      Store.state.classrooms.forEach(function (c) {
        var d = c.day || "Sunday";
        if (days.indexOf(d) === -1) days.push(d);
      });
      // Saturday before Sunday, any custom days after
      days.sort(function (a, b) {
        var order = { Saturday: 0, Sunday: 1 };
        return (order[a] !== undefined ? order[a] : 9) - (order[b] !== undefined ? order[b] : 9);
      });

      days.forEach(function (day) {
        var rooms = Store.state.classrooms
          .filter(function (c) { return (c.day || "Sunday") === day; })
          .sort(function (a, b) { return String(a.room).localeCompare(String(b.room), undefined, { numeric: true }); });

        var heading = document.createElement("h2");
        heading.className = "day-heading";
        heading.innerHTML = esc(day) + ' <span class="day-count">' + rooms.length +
          (rooms.length === 1 ? " class" : " classes") + "</span>";
        grid.appendChild(heading);

        var dayGrid = document.createElement("div");
        dayGrid.className = "classroom-grid";
        grid.appendChild(dayGrid);
        rooms.forEach(function (room) { renderClassroomCard(room, dayGrid); });
      });
    }

    function renderClassroomCard(room, dayGrid) {
        var kids = Store.childrenIn(room.id);
        var isFull = kids.length >= CAPACITY;

        var card = document.createElement("section");
        card.className = "classroom-card";
        card.style.setProperty("--room-color", room.color);
        card.dataset.roomId = room.id;

        var slotsHtml = "";
        kids.forEach(function (kid) {
          slotsHtml +=
            '<li class="slot slot-occupied" draggable="true" data-child-id="' + esc(kid.id) + '">' +
              '<span class="slot-name" title="' + esc(kid.name) + (kid.notes ? " — " + esc(kid.notes) : "") + '">' +
                esc(kid.name) + (kid.notes ? '<span class="note-dot" title="' + esc(kid.notes) + '"></span>' : "") + "</span>" +
              '<span class="slot-age">' + monthsOld(kid.birthdate) + " months</span>" +
              '<span class="slot-actions">' +
                '<button class="slot-mini-btn" data-action="edit" title="Edit child">✎</button>' +
                '<button class="slot-mini-btn" data-action="unassign" title="Move to Unassigned">✕</button>' +
              "</span>" +
            "</li>";
        });
        for (var i = kids.length; i < CAPACITY; i++) {
          slotsHtml +=
            '<li class="slot">' +
              '<button class="slot-empty" data-action="fill-slot">' +
                '<span class="plus">+</span><span>Add Child</span>' +
              "</button>" +
            "</li>";
        }

        card.innerHTML =
          '<div class="classroom-head">' +
            '<div class="classroom-title">' +
              '<h2 class="classroom-name"><span class="color-dot"></span>' + esc(room.name) + "</h2>" +
              '<p class="classroom-range">Room ' + esc(room.room || "—") + " · " +
                room.minMonths + "–" + room.maxMonths + " months</p>" +
            "</div>" +
            '<div class="classroom-meta">' +
              '<span class="count-pill' + (isFull ? " full" : "") + '">' + kids.length + " / " + CAPACITY + "</span>" +
              '<button class="icon-btn" data-action="settings" title="Classroom settings">⚙</button>' +
            "</div>" +
          "</div>" +
          (isFull ? '<div class="full-banner">Classroom Full (' + CAPACITY + "/" + CAPACITY + ")</div>" : "") +
          '<ul class="slot-list">' + slotsHtml + "</ul>";

        dayGrid.appendChild(card);
    }

    /* ---------- render: unassigned ---------- */

    function renderUnassigned() {
      var term = searchInput.value.trim().toLowerCase();
      var kids = Store.unassigned()
        .filter(function (k) { return !term || k.name.toLowerCase().indexOf(term) !== -1; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });

      tbody.innerHTML = kids.map(function (kid) {
        return '<tr draggable="true" data-child-id="' + esc(kid.id) + '">' +
          '<td class="td-name">' + esc(kid.name) + "</td>" +
          "<td>" + fmtDate(kid.birthdate) + "</td>" +
          "<td>" + monthsOld(kid.birthdate) + "</td>" +
          '<td class="td-notes" title="' + esc(kid.notes || "") + '">' + (esc(kid.notes) || "—") + "</td>" +
          '<td><span class="badge-unassigned">Unassigned</span></td>' +
          '<td class="td-actions"><button class="link-btn" data-action="edit">Edit</button></td>' +
          "</tr>";
      }).join("");

      var noneAtAll = Store.unassigned().length === 0;
      unassignedEmpty.hidden = kids.length > 0;
      unassignedEmpty.textContent = noneAtAll
        ? "No unassigned children. Drag a child here to unassign them."
        : "No children match your search.";
    }

    searchInput.addEventListener("input", renderUnassigned);

    /* ---------- clicks (event delegation) ---------- */

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var card = e.target.closest(".classroom-card");
      var roomId = card ? card.dataset.roomId : null;
      var action = btn.dataset.action;

      if (action === "settings") {
        openClassroomModal(roomId);
      } else if (action === "fill-slot") {
        openAssignModal(roomId);
      } else {
        var slot = e.target.closest("[data-child-id]");
        if (!slot) return;
        var childId = slot.dataset.childId;
        if (action === "edit") openChildModal(childId);
        if (action === "unassign") {
          Store.moveChild(childId, null);
          render();
          toast("Moved to Unassigned");
        }
      }
    });

    tbody.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action=edit]");
      if (!btn) return;
      var row = e.target.closest("[data-child-id]");
      if (row) openChildModal(row.dataset.childId);
    });

    /* ---------- drag and drop (native HTML5) ---------- */

    var draggedChildId = null;

    document.addEventListener("dragstart", function (e) {
      var el = e.target.closest("[data-child-id]");
      if (!el) return;
      draggedChildId = el.dataset.childId;
      el.classList.add("dragging");
      e.dataTransfer.setData("text/plain", draggedChildId);
      e.dataTransfer.effectAllowed = "move";
    });

    document.addEventListener("dragend", function (e) {
      var el = e.target.closest("[data-child-id]");
      if (el) el.classList.remove("dragging");
      clearDropHighlights();
      draggedChildId = null;
    });

    function clearDropHighlights() {
      document.querySelectorAll(".drop-target, .drop-blocked").forEach(function (el) {
        el.classList.remove("drop-target", "drop-blocked");
      });
    }

    function roomCanAccept(roomId) {
      var kid = Store.child(draggedChildId);
      if (!kid) return false;
      if (kid.classroomId === roomId) return false; // no-op move
      return Store.childrenIn(roomId).length < CAPACITY;
    }

    grid.addEventListener("dragover", function (e) {
      var card = e.target.closest(".classroom-card");
      if (!card || !draggedChildId) return;
      e.preventDefault();
      clearDropHighlights();
      var kid = Store.child(draggedChildId);
      if (kid && kid.classroomId === card.dataset.roomId) return;
      if (roomCanAccept(card.dataset.roomId)) {
        card.classList.add("drop-target");
        e.dataTransfer.dropEffect = "move";
      } else {
        card.classList.add("drop-blocked");
        e.dataTransfer.dropEffect = "none";
      }
    });

    grid.addEventListener("dragleave", function (e) {
      var card = e.target.closest(".classroom-card");
      if (card && !card.contains(e.relatedTarget)) {
        card.classList.remove("drop-target", "drop-blocked");
      }
    });

    grid.addEventListener("drop", function (e) {
      var card = e.target.closest(".classroom-card");
      if (!card) return;
      e.preventDefault();
      var childId = e.dataTransfer.getData("text/plain") || draggedChildId;
      clearDropHighlights();
      if (!childId) return;
      var res = Store.moveChild(childId, card.dataset.roomId);
      if (res.ok) {
        render();
        var kid = Store.child(childId);
        var room = Store.classroom(card.dataset.roomId);
        toast(kid.name + " → " + room.name);
      } else {
        toast(res.message, true);
      }
    });

    unassignedDrop.addEventListener("dragover", function (e) {
      if (!draggedChildId) return;
      e.preventDefault();
      unassignedDrop.classList.add("drop-target");
      e.dataTransfer.dropEffect = "move";
    });

    unassignedDrop.addEventListener("dragleave", function (e) {
      if (!unassignedDrop.contains(e.relatedTarget)) {
        unassignedDrop.classList.remove("drop-target");
      }
    });

    unassignedDrop.addEventListener("drop", function (e) {
      e.preventDefault();
      unassignedDrop.classList.remove("drop-target");
      var childId = e.dataTransfer.getData("text/plain") || draggedChildId;
      if (!childId) return;
      var kid = Store.child(childId);
      if (!kid || !kid.classroomId) return; // already unassigned
      Store.moveChild(childId, null);
      render();
      toast(kid.name + " moved to Unassigned");
    });

    /* ---------- child modal (add / edit) ---------- */

    var childForm = document.getElementById("childForm");
    var childFormError = document.getElementById("childFormError");
    var agePreview = document.getElementById("agePreview");

    function fillClassroomSelect(selectedId) {
      var sel = document.getElementById("childClassroom");
      var opts = '<option value="">Unassigned</option>';
      Store.state.classrooms.forEach(function (c) {
        var count = Store.childrenIn(c.id).length;
        var full = count >= CAPACITY && c.id !== selectedId;
        opts += '<option value="' + esc(c.id) + '"' +
          (c.id === selectedId ? " selected" : "") +
          (full ? " disabled" : "") + ">" +
          esc(c.name) + " — " + esc(c.day) + " Rm " + esc(c.room) +
          " (" + count + "/" + CAPACITY + (full ? " · full" : "") + ")</option>";
      });
      sel.innerHTML = opts;
    }

    function updateAgePreview() {
      var bd = document.getElementById("childBirthdate").value;
      agePreview.textContent = bd ? "Age: " + monthsOld(bd) + " months" : "";
    }

    document.getElementById("childBirthdate").addEventListener("input", updateAgePreview);

    function openChildModal(childId, presetRoomId) {
      var kid = childId ? Store.child(childId) : null;
      document.getElementById("childModalTitle").textContent = kid ? "Edit Child" : "Add Child";
      document.getElementById("childSaveBtn").textContent = kid ? "Save Changes" : "Add Child";
      document.getElementById("childId").value = kid ? kid.id : "";
      document.getElementById("childName").value = kid ? kid.name : "";
      document.getElementById("childBirthdate").value = kid ? kid.birthdate : "";
      document.getElementById("childBirthdate").max = todayISO();
      document.getElementById("guardianName").value = kid ? kid.guardianName : "";
      document.getElementById("guardianEmail").value = kid ? kid.guardianEmail : "";
      document.getElementById("childNotes").value = kid ? (kid.notes || "") : "";
      fillClassroomSelect(kid ? kid.classroomId : (presetRoomId || ""));
      childFormError.hidden = true;
      updateAgePreview();
      openModal("childModal");
    }

    childForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = document.getElementById("childId").value;
      var data = {
        name: document.getElementById("childName").value.trim(),
        birthdate: document.getElementById("childBirthdate").value,
        guardianName: document.getElementById("guardianName").value.trim(),
        guardianEmail: document.getElementById("guardianEmail").value.trim(),
        notes: document.getElementById("childNotes").value.trim(),
        classroomId: document.getElementById("childClassroom").value || null
      };

      if (!data.name || !data.birthdate) {
        childFormError.textContent = "Name and birthdate are required.";
        childFormError.hidden = false;
        return;
      }
      if (data.birthdate > todayISO()) {
        childFormError.textContent = "Birthdate cannot be in the future.";
        childFormError.hidden = false;
        return;
      }

      var res = id ? Store.updateChild(id, data) : Store.addChild(data);
      closeModal("childModal");
      render();
      if (res.warning) toast(res.warning, true);
      else toast(id ? "Child updated" : data.name + " added");
    });

    document.getElementById("addChildBtn").addEventListener("click", function () {
      openChildModal(null);
    });

    /* ---------- assign existing child modal ---------- */

    var assignSearch = document.getElementById("assignSearch");
    var assignList = document.getElementById("assignList");
    var assignEmpty = document.getElementById("assignEmpty");

    function openAssignModal(roomId) {
      assignTargetRoomId = roomId;
      var room = Store.classroom(roomId);
      document.getElementById("assignModalTitle").textContent = "Add Child to " + room.name;
      assignSearch.value = "";
      renderAssignList();
      openModal("assignModal");
    }

    function renderAssignList() {
      var term = assignSearch.value.trim().toLowerCase();
      var candidates = Store.state.children
        .filter(function (k) { return k.classroomId !== assignTargetRoomId; })
        .filter(function (k) { return !term || k.name.toLowerCase().indexOf(term) !== -1; })
        .sort(function (a, b) {
          // Unassigned children first, then by name
          var ua = a.classroomId ? 1 : 0, ub = b.classroomId ? 1 : 0;
          return ua - ub || a.name.localeCompare(b.name);
        });

      assignList.innerHTML = candidates.map(function (kid) {
        var current = kid.classroomId ? Store.classroom(kid.classroomId) : null;
        return '<li class="assign-item" data-child-id="' + esc(kid.id) + '">' +
          '<span class="assign-item-info">' +
            '<span class="assign-item-name">' + esc(kid.name) + "</span>" +
            '<span class="assign-item-meta">' + monthsOld(kid.birthdate) + " months · " +
              (current ? "Currently in " + esc(current.name) : "Unassigned") + "</span>" +
          "</span>" +
          '<button class="btn btn-secondary" data-action="pick">Add</button>' +
        "</li>";
      }).join("");
      assignEmpty.hidden = candidates.length > 0;
    }

    assignSearch.addEventListener("input", renderAssignList);

    assignList.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action=pick]");
      if (!btn) return;
      var item = e.target.closest("[data-child-id]");
      var res = Store.moveChild(item.dataset.childId, assignTargetRoomId);
      if (res.ok) {
        closeModal("assignModal");
        render();
        toast(Store.child(item.dataset.childId).name + " added to " +
          Store.classroom(assignTargetRoomId).name);
      } else {
        toast(res.message, true);
      }
    });

    document.getElementById("assignNewChildBtn").addEventListener("click", function () {
      var roomId = assignTargetRoomId;
      closeModal("assignModal");
      openChildModal(null, roomId);
    });

    /* ---------- classroom modal ---------- */

    var classroomForm = document.getElementById("classroomForm");
    var classroomFormError = document.getElementById("classroomFormError");
    var swatches = document.getElementById("colorSwatches");
    var selectedColor = COLOR_CHOICES[0];

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

    function openClassroomModal(roomId) {
      var room = Store.classroom(roomId);
      if (!room) return;
      document.getElementById("classroomId").value = room.id;
      document.getElementById("classroomName").value = room.name;
      document.getElementById("classroomDay").value = room.day || "Sunday";
      document.getElementById("classroomRoom").value = room.room || "";
      document.getElementById("classroomMin").value = room.minMonths;
      document.getElementById("classroomMax").value = room.maxMonths;
      selectedColor = room.color;
      renderSwatches();
      classroomFormError.hidden = true;
      openModal("classroomModal");
    }

    classroomForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = document.getElementById("classroomId").value;
      var name = document.getElementById("classroomName").value.trim();
      var day = document.getElementById("classroomDay").value;
      var roomNo = document.getElementById("classroomRoom").value.trim();
      var min = parseInt(document.getElementById("classroomMin").value, 10);
      var max = parseInt(document.getElementById("classroomMax").value, 10);

      if (!name) {
        classroomFormError.textContent = "Classroom name is required.";
        classroomFormError.hidden = false;
        return;
      }
      if (!roomNo) {
        classroomFormError.textContent = "Room number is required.";
        classroomFormError.hidden = false;
        return;
      }
      if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
        classroomFormError.textContent = "Age range must be valid numbers.";
        classroomFormError.hidden = false;
        return;
      }
      if (min > max) {
        classroomFormError.textContent = "Minimum age cannot be greater than maximum age.";
        classroomFormError.hidden = false;
        return;
      }

      Store.updateClassroom(id, { name: name, day: day, room: roomNo, color: selectedColor, minMonths: min, maxMonths: max });
      closeModal("classroomModal");
      render();
      toast("Classroom updated");
    });

    document.getElementById("deleteClassroomBtn").addEventListener("click", function () {
      var id = document.getElementById("classroomId").value;
      var room = Store.classroom(id);
      if (!room) return;
      var count = Store.childrenIn(id).length;
      var msg = 'Delete "' + room.name + '"?' +
        (count ? "\n\n" + count + " child" + (count === 1 ? "" : "ren") +
          " will be moved to Unassigned (not deleted)." : "");
      if (!confirm(msg)) return;
      Store.removeClassroom(id);
      closeModal("classroomModal");
      render();
      toast(room.name + " deleted" + (count ? " · " + count + " moved to Unassigned" : ""));
    });

    document.getElementById("addClassroomBtn").addEventListener("click", function () {
      var room = Store.addClassroom();
      render();
      toast(room.name + " created — open ⚙ to set its age range");
      openClassroomModal(room.id);
    });

    /* ---------- reset ---------- */

    document.getElementById("resetDemoBtn").addEventListener("click", function () {
      if (!confirm("Reset the demo? All changes will be replaced with the original sample data.")) return;
      Store.reset();
      searchInput.value = "";
      render();
      toast("Demo data restored");
    });

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
