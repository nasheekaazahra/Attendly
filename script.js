/* ===========================================================
   ATTENDLY
   Employee Attendance Dashboard
=========================================================== */

/* ===========================================================
   EMPLOYEE DATA
=========================================================== */

let employees = JSON.parse(localStorage.getItem("employees")) || [];

// migrate old records (name/position/dept only) so they have the
// fields the Employees / Attendance / Reports pages need
let nextId = Number(localStorage.getItem("nextEmployeeId")) || 1;

employees = employees.map(emp => {
    if (!emp.id) emp.id = nextId++;
    if (!emp.status) emp.status = "present";
    if (emp.checkIn === undefined) emp.checkIn = "--";
    if (emp.checkOut === undefined) emp.checkOut = "--";
    if (!emp.avatarClass) emp.avatarClass = randomAvatarClass();
    if (!emp.addedAt) emp.addedAt = Date.now();
    return emp;
});

localStorage.setItem("nextEmployeeId", String(nextId));
persistEmployees();

function persistEmployees(){
    localStorage.setItem("employees", JSON.stringify(employees));
}

// parses strings like "08:15 AM" into minutes-since-midnight
function parseTimeToMinutes(timeStr){
    if(!timeStr || timeStr === "--") return null;

    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if(!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3] ? match[3].toUpperCase() : null;

    if(meridiem === "PM" && hours !== 12) hours += 12;
    if(meridiem === "AM" && hours === 12) hours = 0;

    return hours*60 + minutes;
}

// returns a label like "7h 45m", or "0h" if not clocked in/out yet
function computeHoursLabel(checkIn, checkOut){

    const start = parseTimeToMinutes(checkIn);
    const end = parseTimeToMinutes(checkOut);

    if(start === null || end === null) return "0h";

    let diff = end - start;
    if(diff < 0) diff += 24*60; // handles an overnight shift edge case

    const h = Math.floor(diff/60);
    const m = diff % 60;

    return m === 0 ? `${h}h` : `${h}h ${m}m`;

}

const avatarClasses = ["avatar-green","avatar-blue","avatar-orange","avatar-purple","avatar-red"];

function randomAvatarClass(){
    return avatarClasses[Math.floor(Math.random()*avatarClasses.length)];
}

/* ===========================================================
   DATE HELPERS
=========================================================== */

function formatDateISO(date){
    const pad = n => String(n).padStart(2,"0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function todayISO(){
    return formatDateISO(new Date());
}

function shiftDateISO(iso, days){
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
}

function friendlyDate(iso){
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined,{ weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

/* ===========================================================
   ATTENDANCE LOG (per-date, per-employee records)
   Shape: { "2026-07-14": { "3": {checkIn,checkOut,status}, ... } }
=========================================================== */

let attendanceLog = JSON.parse(localStorage.getItem("attendanceLog")) || {};

function persistLog(){
    localStorage.setItem("attendanceLog", JSON.stringify(attendanceLog));
}

// gets (and lazily creates) the record for a date+employee.
// for "today", seed from the employee's live status/checkIn/checkOut
// so the Attendance page starts in sync with the Dashboard.
function ensureLogEntry(dateISO, employeeId){

    if(!attendanceLog[dateISO]) attendanceLog[dateISO] = {};

    if(!attendanceLog[dateISO][employeeId]){

        if(dateISO === todayISO()){
            const emp = employees.find(e => e.id === employeeId);
            attendanceLog[dateISO][employeeId] = {
                checkIn: emp ? emp.checkIn : "--",
                checkOut: emp ? emp.checkOut : "--",
                status: emp ? emp.status : "absent"
            };
        } else {
            attendanceLog[dateISO][employeeId] = { checkIn:"--", checkOut:"--", status:"absent" };
        }

    }

    return attendanceLog[dateISO][employeeId];

}

function updateAttendanceRecord(dateISO, employeeId, patch){

    const entry = ensureLogEntry(dateISO, employeeId);
    Object.assign(entry, patch);
    persistLog();

    // keep today's log mirrored onto the employee record so the
    // Dashboard / Employees pages stay accurate
    if(dateISO === todayISO()){
        const emp = employees.find(e => e.id === employeeId);
        if(emp){
            Object.assign(emp, patch);
            persistEmployees();
        }
    }

}

/* ===========================================================
   PAGE NAVIGATION (Dashboard / Employees / Attendance / Reports)
=========================================================== */

const navItems = document.querySelectorAll(".sidebar li[data-page]");
const pages = document.querySelectorAll(".page");
const pageGreeting = document.getElementById("pageGreeting");
const pageSubtitle = document.getElementById("pageSubtitle");

const pageCopy = {
    dashboard: {
        greeting: `Good Morning, Chika <span class="wave">👋</span>`,
        subtitle: "Employee Attendance Dashboard"
    },
    employees: {
        greeting: `Employee Directory <span class="wave">🗂️</span>`,
        subtitle: "Manage employee records and departments"
    },
    attendance: {
        greeting: `Attendance Log <span class="wave">🕒</span>`,
        subtitle: "Review and edit check-ins for any day"
    },
    reports: {
        greeting: `Reports <span class="wave">📊</span>`,
        subtitle: "Trends and per-employee attendance breakdown"
    }
};

function goToPage(pageName){

    navItems.forEach(li=>{
        li.classList.toggle("active", li.dataset.page === pageName);
    });

    pages.forEach(section=>{
        section.classList.toggle("active", section.id === `page-${pageName}`);
    });

    const copy = pageCopy[pageName];
    if(copy){
        pageGreeting.innerHTML = copy.greeting;
        pageSubtitle.textContent = copy.subtitle;
    }

    if(pageName === "employees") renderEmployeeGrid();
    if(pageName === "attendance") renderAttendancePage();
    if(pageName === "reports") renderReportsPage();

}

navItems.forEach(li=>{
    li.addEventListener("click", () => goToPage(li.dataset.page));
});

// buttons elsewhere that should jump to another page
document.querySelectorAll("[data-goto]").forEach(btn=>{
    btn.addEventListener("click", () => goToPage(btn.dataset.goto));
});

/* ===========================================================
   LIVE CLOCK
=========================================================== */

const liveClockEl = document.getElementById("liveClock");
const clockInTimeEl = document.getElementById("clockInTime");

function updateClock() {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");

    liveClockEl.textContent =
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

updateClock();
setInterval(updateClock, 1000);

const clockInNow = new Date();

clockInTimeEl.textContent =
`${String(clockInNow.getHours()).padStart(2,"0")}:${String(clockInNow.getMinutes()).padStart(2,"0")}`;


/* ===========================================================
   SEARCH & FILTER (Dashboard timesheet table)
=========================================================== */

const searchInput = document.getElementById("searchInput");
const departmentFilter = document.getElementById("departmentFilter");

searchInput.addEventListener("keyup", filterTable);
departmentFilter.addEventListener("change", filterTable);

function filterTable(){

    const keyword = searchInput.value.toLowerCase();
    const dept = departmentFilter.value;

    const rows = document.querySelectorAll("#employeeTable tbody tr");

    rows.forEach(row=>{

        const text = row.innerText.toLowerCase();
        const department = row.children[1].textContent;

        const matchSearch = text.includes(keyword);
        const matchDept = dept==="all" || department===dept;

        row.style.display = matchSearch && matchDept ? "" : "none";

    });

}

/* ===========================================================
   SEARCH & FILTER (Employees page directory)
=========================================================== */

const empSearchInput = document.getElementById("empSearchInput");
const empDeptFilter = document.getElementById("empDeptFilter");

empSearchInput.addEventListener("keyup", filterEmployeeGrid);
empDeptFilter.addEventListener("change", filterEmployeeGrid);

function filterEmployeeGrid(){

    const keyword = empSearchInput.value.toLowerCase();
    const dept = empDeptFilter.value;

    const cards = document.querySelectorAll("#employeeGrid .employee-card");

    cards.forEach(card=>{

        const text = card.innerText.toLowerCase();
        const department = card.dataset.dept;

        const matchSearch = text.includes(keyword);
        const matchDept = dept==="all" || department===dept;

        card.style.display = matchSearch && matchDept ? "" : "none";

    });

}

/* ===========================================================
   WEEKLY ATTENDANCE CHART (Dashboard)
=========================================================== */

const chartCanvas = document.getElementById("attendanceChart");
let attendanceChartInstance = null;

// returns the ISO date of Monday for the week containing todayISO()
function mondayOfThisWeekISO(){
    const d = new Date(todayISO() + "T00:00:00");
    const day = d.getDay(); // 0=Sun,1=Mon,...6=Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    return formatDateISO(d);
}

function renderWeeklyAttendanceChart(){

    if(!chartCanvas) return;

    const monday = mondayOfThisWeekISO();
    const labels = ["Mon","Tue","Wed","Thu","Fri"];
    const data = [];

    for(let i=0;i<5;i++){
        const iso = shiftDateISO(monday, i);
        const dayLog = attendanceLog[iso] || {};
        const presentCount = Object.values(dayLog).filter(r => r.status==="present" || r.status==="late").length;
        data.push(presentCount);
    }

    if(attendanceChartInstance) attendanceChartInstance.destroy();

    attendanceChartInstance = new Chart(chartCanvas,{

        type:"bar",

        data:{

            labels,

            datasets:[{

                label:"Employees",

                data,

                backgroundColor:"#1F7A5C",

                borderRadius:8,
                borderSkipped:false

            }]

        },

        options:{

            responsive:true,

            plugins:{
                legend:{ display:false }
            },

            scales:{

                y:{ beginAtZero:true, grid:{ color:"#ECECEC" }, ticks:{ stepSize:1 } },
                x:{ grid:{ display:false } }

            }

        }

    });

}

renderWeeklyAttendanceChart();

/* ===========================================================
   CALENDAR
=========================================================== */

const calendar = document.getElementById("calendar");

function generateCalendar(){

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];

    let html = '<div class="calendar-header">';
    dayNames.forEach(day=>{ html += `<div>${day}</div>`; });
    html += '</div>';

    html += '<div class="calendar-grid">';

    for(let i=0;i<firstDay;i++){
        html += '<div class="calendar-day empty"></div>';
    }

    for(let day=1;day<=totalDays;day++){
        const active = day===today.getDate() ? "today" : "";
        html += `<div class="calendar-day ${active}">${day}</div>`;
    }

    html += '</div>';

    calendar.innerHTML = html;

}

generateCalendar();

/* ===========================================================
   TOAST
=========================================================== */

const toast=document.getElementById("toast");

function showToast(text){
    toast.innerHTML=text;
    toast.classList.add("show");
    setTimeout(()=>{ toast.classList.remove("show"); },2500);
}

/* ===========================================================
   CLOCK IN / CLOCK OUT (Dashboard's own "Chika" clock)
=========================================================== */

const attendanceTodayDateEl = document.getElementById("attendanceTodayDate");
if(attendanceTodayDateEl){
    attendanceTodayDateEl.textContent = friendlyDate(todayISO());
}

const clockInBtn=document.getElementById("clockInBtn");
const clockOutBtn=document.getElementById("clockOutBtn");

const clockInDisplay=document.getElementById("clockInDisplay");
const clockOutDisplay=document.getElementById("clockOutDisplay");

const savedClockIn=localStorage.getItem("clockIn");
const savedClockOut=localStorage.getItem("clockOut");

if(savedClockIn){ clockInDisplay.textContent=savedClockIn; }
if(savedClockOut){ clockOutDisplay.textContent=savedClockOut; }

clockInBtn.onclick=function(){
    const now=new Date();
    const time=now.toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit" });
    clockInDisplay.textContent=time;
    localStorage.setItem("clockIn",time);
    showToast("✅ Clock In Successful");
}

clockOutBtn.onclick=function(){
    const now=new Date();
    const time=now.toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit" });
    clockOutDisplay.textContent=time;
    localStorage.setItem("clockOut",time);
    showToast("👋 Clock Out Successful");
}

/* ===========================================================
   EMPLOYEE MODAL (shared by Dashboard "+ Add Employee" and
   Employees page add/edit)
=========================================================== */

const addEmployeeBtn = document.getElementById("addEmployeeBtn");
const modal = document.getElementById("employeeModal");
const modalTitle = document.getElementById("modalTitle");
const saveBtn = document.getElementById("saveEmployee");

const empNameInput = document.getElementById("empName");
const empPositionInput = document.getElementById("empPosition");
const empDeptSelect = document.getElementById("empDept");

let editingId = null; // null = adding new

function openAddModal(){
    editingId = null;
    modalTitle.textContent = "Add Employee";
    saveBtn.textContent = "Save Employee";
    empNameInput.value = "";
    empPositionInput.value = "";
    empDeptSelect.selectedIndex = 0;
    modal.classList.add("show");
}

function openEditModal(employee){
    editingId = employee.id;
    modalTitle.textContent = "Edit Employee";
    saveBtn.textContent = "Save Changes";
    empNameInput.value = employee.name;
    empPositionInput.value = employee.position;
    empDeptSelect.value = employee.dept;
    modal.classList.add("show");
}

addEmployeeBtn.onclick = openAddModal;

modal.onclick = e => {
    if(e.target === modal){ modal.classList.remove("show"); }
};

/* ===========================================================
   RENDER: Dashboard timesheet table row
=========================================================== */

function renderTableRow(employee){

    const tbody = document.querySelector("#employeeTable tbody");

    const row = document.createElement("tr");
    row.dataset.id = employee.id;

    row.innerHTML = `
<td class="employee-cell">
    <div class="avatar ${employee.avatarClass}">
        ${employee.name.charAt(0).toUpperCase()}
    </div>
    <div class="employee-info">
        <strong>${employee.name}</strong>
        <span>${employee.position}</span>
    </div>
</td>

<td>${employee.dept}</td>
<td>${employee.checkIn}</td>
<td>${employee.checkOut}</td>
<td>${computeHoursLabel(employee.checkIn, employee.checkOut)}</td>

<td>
    <span class="stamp" data-status="${employee.status}">
        ${employee.status}
    </span>
</td>

<td class="action-cell">
    <button class="delete-btn" title="Delete">🗑</button>
</td>
`;

    tbody.appendChild(row);

    row.querySelector(".delete-btn").onclick = () => {
        if(confirm(`Delete ${employee.name}?`)){
            deleteEmployee(employee.id);
        }
    };

}

function renderAllTableRows(){
    document.querySelector("#employeeTable tbody").innerHTML = "";
    employees.forEach(renderTableRow);
    filterTable();
}

/* ===========================================================
   RENDER: Employees page directory grid
=========================================================== */

const employeeGrid = document.getElementById("employeeGrid");
const employeeEmptyState = document.getElementById("employeeEmptyState");

function renderEmployeeCard(employee){

    const card = document.createElement("div");
    card.className = "employee-card";
    card.dataset.id = employee.id;
    card.dataset.dept = employee.dept;

    card.innerHTML = `
<div class="employee-card-head">
    <div class="avatar ${employee.avatarClass}">
        ${employee.name.charAt(0).toUpperCase()}
    </div>
    <div class="employee-card-name">
        <strong>${employee.name}</strong>
        <span>${employee.position}</span>
    </div>
</div>

<span class="employee-card-dept">${employee.dept}</span>

<div class="employee-card-status">
    <span class="stamp" data-status="${employee.status}">${employee.status}</span>
</div>

<div class="employee-card-actions">
    <button class="edit-btn-card">Edit</button>
    <button class="delete-btn-card">Delete</button>
</div>
`;

    employeeGrid.appendChild(card);

    card.querySelector(".edit-btn-card").onclick = () => openEditModal(employee);

    card.querySelector(".delete-btn-card").onclick = () => {
        if(confirm(`Delete ${employee.name}?`)){
            deleteEmployee(employee.id);
        }
    };

}

function renderEmployeeGrid(){

    employeeGrid.innerHTML = "";
    employees.forEach(renderEmployeeCard);

    employeeEmptyState.classList.toggle("show", employees.length === 0);
    employeeGrid.style.display = employees.length === 0 ? "none" : "grid";

    filterEmployeeGrid();
    updateEmployeeStats();

}

function updateEmployeeStats(){

    const total = employees.length;
    const depts = new Set(employees.map(e => e.dept));

    document.getElementById("empTotalCount").textContent = total;
    document.getElementById("empDeptCount").textContent = depts.size;

    if(total > 0){
        const newest = employees.reduce((a,b) => a.addedAt > b.addedAt ? a : b);
        document.getElementById("empNewest").textContent = newest.name;
    } else {
        document.getElementById("empNewest").textContent = "—";
    }

}

/* ===========================================================
   SUMMARY CARDS (Dashboard: Present / Late / Absent / Leave)
=========================================================== */

function updateSummary(){

    let present = 0, late = 0, absent = 0, leave = 0;

    employees.forEach(employee=>{
        if(employee.status==="present") present++;
        if(employee.status==="late") late++;
        if(employee.status==="absent") absent++;
        if(employee.status==="leave") leave++;
    });

    document.getElementById("presentCount").textContent = present;
    document.getElementById("lateCount").textContent = late;
    document.getElementById("absentCount").textContent = absent;
    document.getElementById("leaveCount").textContent = leave;

}

function updateProgress(){

    const total = employees.length;
    const present = employees.filter(e => e.status === "present").length;
    const percent = total===0 ? 0 : Math.round((present/total)*100);

    document.getElementById("progressTitle").textContent =
        `${present} / ${total} Employees Checked In`;

    document.getElementById("progressText").textContent =
        `${percent}% attendance rate today`;

    document.getElementById("progressFill").style.width = percent + "%";

}

/* ===========================================================
   EMPLOYEE CRUD (create / update / delete)
=========================================================== */

function deleteEmployee(id){

    employees = employees.filter(e => e.id !== id);
    persistEmployees();

    refreshEverything();

    showToast("🗑 Employee removed");

}

function refreshEverything(){
    renderAllTableRows();
    renderEmployeeGrid();
    updateSummary();
    updateProgress();
    renderNotifications();
    renderWeeklyAttendanceChart();

    // keep whichever page the user is on in sync too
    const attPage = document.getElementById("page-attendance");
    if(attPage.classList.contains("active")) renderAttendancePage();

    const repPage = document.getElementById("page-reports");
    if(repPage.classList.contains("active")) renderReportsPage();
}

saveBtn.onclick = function(){

    const name = empNameInput.value.trim();
    const position = empPositionInput.value.trim();
    const dept = empDeptSelect.value;

    if(name === "" || position === ""){
        alert("Please complete all fields.");
        return;
    }

    if(editingId !== null){

        const employee = employees.find(e => e.id === editingId);
        employee.name = name;
        employee.position = position;
        employee.dept = dept;

        persistEmployees();
        refreshEverything();

        showToast("✅ Employee Updated");

    } else {

        const employee = {
            id: nextId++,
            name,
            position,
            dept,
            checkIn: "--",
            checkOut: "--",
            status: "present",
            avatarClass: randomAvatarClass(),
            addedAt: Date.now()
        };

        localStorage.setItem("nextEmployeeId", String(nextId));

        employees.push(employee);
        persistEmployees();
        refreshEverything();

        showToast("✅ Employee Added");

    }

    modal.classList.remove("show");
    editingId = null;

};

/* ===========================================================
   ATTENDANCE PAGE
=========================================================== */

let currentAttendanceDate = todayISO();

const attendanceDateInput = document.getElementById("attendanceDateInput");
const prevDateBtn = document.getElementById("prevDateBtn");
const nextDateBtn = document.getElementById("nextDateBtn");
const todayBtn = document.getElementById("todayBtn");
const attSearchInput = document.getElementById("attSearchInput");
const attDeptFilter = document.getElementById("attDeptFilter");
const attendanceEmptyState = document.getElementById("attendanceEmptyState");

attendanceDateInput.value = currentAttendanceDate;

attendanceDateInput.addEventListener("change", () => {
    currentAttendanceDate = attendanceDateInput.value || todayISO();
    renderAttendancePage();
});

prevDateBtn.addEventListener("click", () => {
    currentAttendanceDate = shiftDateISO(currentAttendanceDate, -1);
    renderAttendancePage();
});

nextDateBtn.addEventListener("click", () => {
    currentAttendanceDate = shiftDateISO(currentAttendanceDate, 1);
    renderAttendancePage();
});

todayBtn.addEventListener("click", () => {
    currentAttendanceDate = todayISO();
    renderAttendancePage();
});

attSearchInput.addEventListener("keyup", filterAttendanceTable);
attDeptFilter.addEventListener("change", filterAttendanceTable);

function filterAttendanceTable(){

    const keyword = attSearchInput.value.toLowerCase();
    const dept = attDeptFilter.value;

    const rows = document.querySelectorAll("#attendanceTable tbody tr");
    let visibleCount = 0;

    rows.forEach(row=>{

        const text = row.innerText.toLowerCase();
        const department = row.dataset.dept;

        const matchSearch = text.includes(keyword);
        const matchDept = dept==="all" || department===dept;
        const visible = matchSearch && matchDept;

        row.style.display = visible ? "" : "none";
        if(visible) visibleCount++;

    });

    attendanceEmptyState.classList.toggle("show", visibleCount === 0);

}

function renderAttendancePage(){

    attendanceDateInput.value = currentAttendanceDate;
    const isToday = currentAttendanceDate === todayISO();

    const tbody = document.querySelector("#attendanceTable tbody");
    tbody.innerHTML = "";

    let present = 0, late = 0, absent = 0, leave = 0;

    employees.forEach(employee=>{

        const record = ensureLogEntry(currentAttendanceDate, employee.id);

        if(record.status==="present") present++;
        if(record.status==="late") late++;
        if(record.status==="absent") absent++;
        if(record.status==="leave") leave++;

        const row = document.createElement("tr");
        row.dataset.dept = employee.dept;

        row.innerHTML = `
<td class="employee-cell">
    <div class="avatar ${employee.avatarClass}">
        ${employee.name.charAt(0).toUpperCase()}
    </div>
    <div class="employee-info">
        <strong>${employee.name}</strong>
        <span>${employee.position}</span>
    </div>
</td>

<td>${employee.dept}</td>
<td class="cell-checkin">${record.checkIn}</td>
<td class="cell-checkout">${record.checkOut}</td>

<td>
    <select class="status-select" data-status="${record.status}">
        <option value="present" ${record.status==="present"?"selected":""}>Present</option>
        <option value="late" ${record.status==="late"?"selected":""}>Late</option>
        <option value="absent" ${record.status==="absent"?"selected":""}>Absent</option>
        <option value="leave" ${record.status==="leave"?"selected":""}>Leave</option>
    </select>
</td>

<td class="action-cell">
    <button class="clock-btn clock-in-btn" ${isToday?"":"disabled"} title="${isToday?"Clock in now":"Only available for today"}">In</button>
    <button class="clock-btn clock-out-btn" ${isToday?"":"disabled"} title="${isToday?"Clock out now":"Only available for today"}">Out</button>
</td>
`;

        tbody.appendChild(row);

        const statusSelect = row.querySelector(".status-select");
        statusSelect.addEventListener("change", () => {
            const newStatus = statusSelect.value;
            statusSelect.dataset.status = newStatus;
            updateAttendanceRecord(currentAttendanceDate, employee.id, { status:newStatus });
            updateSummary();
            updateProgress();
            renderNotifications();
            renderWeeklyAttendanceChart();
            if(currentAttendanceDate===todayISO()) renderAllTableRows();
        });

        row.querySelector(".clock-in-btn").addEventListener("click", () => {
            const time = new Date().toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit" });
            row.querySelector(".cell-checkin").textContent = time;
            updateAttendanceRecord(currentAttendanceDate, employee.id, { checkIn:time });
            if(currentAttendanceDate===todayISO()) renderAllTableRows();
            showToast(`✅ ${employee.name} clocked in`);
        });

        row.querySelector(".clock-out-btn").addEventListener("click", () => {
            const time = new Date().toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit" });
            row.querySelector(".cell-checkout").textContent = time;
            updateAttendanceRecord(currentAttendanceDate, employee.id, { checkOut:time });
            if(currentAttendanceDate===todayISO()) renderAllTableRows();
            showToast(`👋 ${employee.name} clocked out`);
        });

    });

    document.getElementById("attPresentCount").textContent = present;
    document.getElementById("attLateCount").textContent = late;
    document.getElementById("attAbsentCount").textContent = absent;
    document.getElementById("attLeaveCount").textContent = leave;

    filterAttendanceTable();

}

/* ===========================================================
   REPORTS PAGE
=========================================================== */

const reportsEmptyState = document.getElementById("reportsEmptyState");
const exportCsvBtn = document.getElementById("exportCsvBtn");

let reportsChartInstance = null;

function computeEmployeeReport(employeeId){

    let present=0, late=0, absent=0, leave=0, totalDays=0;

    Object.keys(attendanceLog).forEach(dateISO=>{
        const record = attendanceLog[dateISO][employeeId];
        if(!record) return;
        totalDays++;
        if(record.status==="present") present++;
        if(record.status==="late") late++;
        if(record.status==="absent") absent++;
        if(record.status==="leave") leave++;
    });

    const attendedDays = present + late;
    const rate = totalDays===0 ? 0 : Math.round((attendedDays/totalDays)*100);

    return { present, late, absent, leave, totalDays, rate };

}

function renderReportsPage(){

    const tbody = document.querySelector("#reportsTable tbody");
    tbody.innerHTML = "";

    const loggedDates = Object.keys(attendanceLog).filter(d => Object.keys(attendanceLog[d]).length > 0);

    let totalLate = 0, totalAbsent = 0, rateSum = 0, rateCount = 0;

    employees.forEach(employee=>{

        const rep = computeEmployeeReport(employee.id);

        if(rep.totalDays > 0){
            totalLate += rep.late;
            totalAbsent += rep.absent;
            rateSum += rep.rate;
            rateCount++;
        }

        const row = document.createElement("tr");

        row.innerHTML = `
<td class="employee-cell">
    <div class="avatar ${employee.avatarClass}">
        ${employee.name.charAt(0).toUpperCase()}
    </div>
    <div class="employee-info">
        <strong>${employee.name}</strong>
        <span>${employee.position}</span>
    </div>
</td>
<td>${employee.dept}</td>
<td>${rep.present}</td>
<td>${rep.late}</td>
<td>${rep.absent}</td>
<td>${rep.leave}</td>
<td>
    <div class="attendance-rate-bar">
        <div class="attendance-rate-track">
            <div class="attendance-rate-fill" style="width:${rep.rate}%"></div>
        </div>
        <span class="attendance-rate-label">${rep.rate}%</span>
    </div>
</td>
`;

        tbody.appendChild(row);

    });

    document.getElementById("repAvgRate").textContent =
        rateCount === 0 ? "0%" : Math.round(rateSum/rateCount) + "%";

    document.getElementById("repLateTotal").textContent = totalLate;
    document.getElementById("repAbsentTotal").textContent = totalAbsent;
    document.getElementById("repDaysLogged").textContent = loggedDates.length;

    reportsEmptyState.classList.toggle("show", loggedDates.length === 0 || employees.length === 0);

    renderReportsChart();

}

function renderReportsChart(){

    const labels = [];
    const data = [];

    for(let i=6;i>=0;i--){
        const iso = shiftDateISO(todayISO(), -i);
        const d = new Date(iso + "T00:00:00");
        labels.push(d.toLocaleDateString(undefined,{ weekday:"short" }));

        const dayLog = attendanceLog[iso] || {};
        const presentCount = Object.values(dayLog).filter(r => r.status==="present" || r.status==="late").length;
        data.push(presentCount);
    }

    const canvas = document.getElementById("reportsChart");
    if(!canvas) return;

    if(reportsChartInstance) reportsChartInstance.destroy();

    reportsChartInstance = new Chart(canvas, {

        type:"bar",

        data:{
            labels,
            datasets:[{
                label:"Employees present",
                data,
                backgroundColor:"#1F7A5C",
                borderRadius:8,
                borderSkipped:false
            }]
        },

        options:{
            responsive:true,
            plugins:{ legend:{ display:false } },
            scales:{
                y:{ beginAtZero:true, grid:{ color:"#ECECEC" }, ticks:{ stepSize:1 } },
                x:{ grid:{ display:false } }
            }
        }

    });

}

exportCsvBtn.addEventListener("click", () => {

    const rows = [["Date","Employee","Department","Check In","Check Out","Status"]];

    Object.keys(attendanceLog).sort().forEach(dateISO=>{
        Object.keys(attendanceLog[dateISO]).forEach(employeeId=>{

            const employee = employees.find(e => e.id === Number(employeeId));
            if(!employee) return;

            const record = attendanceLog[dateISO][employeeId];
            rows.push([dateISO, employee.name, employee.dept, record.checkIn, record.checkOut, record.status]);

        });
    });

    if(rows.length === 1){
        showToast("⚠️ No attendance data to export yet");
        return;
    }

    if(typeof XLSX === "undefined"){
        showToast("⚠️ Export library failed to load — check your connection");
        return;
    }

    // real .xlsx file: sidesteps the comma-vs-semicolon delimiter
    // problem some regional Excel/Sheets setups have with plain CSV
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [
        { wch:12 }, { wch:20 }, { wch:14 }, { wch:10 }, { wch:10 }, { wch:10 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

    XLSX.writeFile(workbook, `attendly-report-${todayISO()}.xlsx`);

    showToast("⬇ Report exported");

});

/* ===========================================================
   NOTIFICATION BELL
   Two kinds of notifications:
   1) Upcoming holiday reminder
   2) New leave requests (employees marked "leave" today)
=========================================================== */

const notificationBell = document.getElementById("notificationBell");
const notificationPanel = document.getElementById("notificationPanel");
const notificationList = document.getElementById("notificationList");
const notificationCountEl = document.getElementById("notificationCount");
const notificationEmpty = document.getElementById("notificationEmpty");

// keep this in sync with the "Upcoming Holiday" card on the Dashboard
const upcomingHoliday = {
    name: "Independence Day",
    dateISO: "2026-08-17"
};

function daysUntil(dateISO){
    const today = new Date(todayISO() + "T00:00:00");
    const target = new Date(dateISO + "T00:00:00");
    return Math.round((target - today) / (1000*60*60*24));
}

function buildNotifications(){

    const notifications = [];

    // 1) Holiday reminder
    const diff = daysUntil(upcomingHoliday.dateISO);
    if(diff >= 0){
        const when = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `In ${diff} days`;
        notifications.push({
            kind: "holiday",
            icon: "🇮🇩",
            text: `Upcoming holiday: ${upcomingHoliday.name}`,
            meta: `${when} • ${friendlyDate(upcomingHoliday.dateISO)}`
        });
    }

    // 2) Leave requests — employees currently marked "leave" today
    employees
        .filter(e => e.status === "leave")
        .forEach(e=>{
            notifications.push({
                kind: "leave",
                icon: "🏖️",
                text: `${e.name} is on leave today`,
                meta: e.dept
            });
        });

    return notifications;

}

function renderNotifications(){

    const notifications = buildNotifications();

    notificationList.innerHTML = "";

    notifications.forEach(n=>{
        const item = document.createElement("div");
        item.className = "notification-item";
        item.dataset.kind = n.kind;
        item.innerHTML = `
<div class="notification-item-icon">${n.icon}</div>
<div class="notification-item-body">
    <p>${n.text}</p>
    <span>${n.meta}</span>
</div>
`;
        notificationList.appendChild(item);
    });

    notificationEmpty.classList.toggle("show", notifications.length === 0);

    if(notifications.length === 0){
        notificationCountEl.classList.add("hide");
    } else {
        notificationCountEl.classList.remove("hide");
        notificationCountEl.textContent = notifications.length;
    }

}

notificationBell.addEventListener("click", (e) => {
    e.stopPropagation();
    notificationPanel.classList.toggle("show");
});

notificationPanel.addEventListener("click", (e) => {
    e.stopPropagation(); // don't let clicks inside the panel close it
});

document.addEventListener("click", () => {
    notificationPanel.classList.remove("show");
});

/* ===========================================================
   INITIAL RENDER
=========================================================== */

refreshEverything();