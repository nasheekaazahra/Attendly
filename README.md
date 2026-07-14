# Attendly

**Attendly** is a lightweight, client-side employee attendance dashboard — clock in/out, track daily attendance, manage an employee directory, and review attendance trends, all in a single static web app with no backend required.

## ✨ Features

- **Dashboard** — live office clock, today's clock in/out timeline, weekly attendance chart, today's check-in progress, upcoming holiday reminder, and a monthly calendar.
- **Employees** — add, edit, and delete employees; browse the team as searchable, filterable cards grouped by department.
- **Attendance** — view and edit attendance for any date (not just today), with per-employee clock in/out and status (Present / Late / Absent / Leave).
- **Reports** — 7-day attendance trend chart, per-employee attendance rate breakdown, and one-click Excel (.xlsx) export.
- **Notifications** — a bell icon that surfaces upcoming holiday reminders and active leave requests.
- **Persistent storage** — all data is saved to `localStorage`, so it survives page reloads with no server or database.

## 🛠️ Tech Stack

- HTML, CSS, and vanilla JavaScript (no framework)
- [Chart.js](https://www.chartjs.org/) for data visualization
- [SheetJS (xlsx)](https://sheetjs.com/) for Excel export

## 🚀 Getting Started

1. Clone or download this repository.
2. Open `index.html` in your browser — that's it, no build step or server needed.

## 📁 Project Structure

```
attendly/
├── index.html   # App markup & structure
├── style.css    # Styling
└── script.js    # App logic (state, rendering, interactions)
```

---

*Attendly is a front-end demo project and stores data locally in the browser — it is not intended for multi-user or production use as-is.*
