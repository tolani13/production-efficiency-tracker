# Nordfab Production Tracker

Browser-based proof-of-concept app for replacing a daily production efficiency spreadsheet with a cloud-demo-ready experience.

This V1 is intentionally frontend-first:

- No login
- No Docker
- No local admin access
- No company-system connection
- No sensitive company, customer, or order data
- Two sample rows load automatically
- Entries are saved only in the browser using `localStorage`

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Build

```bash
npm run build
```

The static production build is created in `dist/`.

## Deploy To Netlify

This app can deploy as a static site.

1. Push this folder to a Git repository.
2. Create a new Netlify site from the repository.
3. Use these build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Netlify can also read the included `netlify.toml`.

No Netlify Functions or database are required for this demo.

## Demo Limitations

This is a proof-of-concept. Data is stored in the user's browser only. Clearing browser storage or using another computer will reset the app unless the data has been exported to CSV.

For a production version, add authentication, role-based permissions, audit history, backups, and a hosted database such as Netlify Database/Postgres. Do not store production company data in this V1 demo.

## Screens

- Daily Entry: add or edit production records and see calculated preview before saving.
- Entries Table: view input fields, helper fields, warnings, edit/delete actions, filters, and CSV export.
- Dashboard: totals and average efficiency cards plus output trend.
- Reports: efficiency by shift, machine, operator, downtime reason, weekly trend, best/worst days, scrap trend, and a generated print-preview report.
- Formula Guide: plain-language formula and validation documentation.

Machines are selected from `FlexMaster` and `FlexiStar`. Operator names are manually typed on the Daily Entry form. When an entry is saved, typed operator names are remembered in that browser as future suggestions.

## Sample Rows

The app starts with two sample rows: one required formula-validation row and one simple current-day example row. The sample set is intentionally small so testers can enter real trial data without cleaning up a large demo dataset first.

## Required Sample Row

The sample data includes this validation row:

- Date: `2026-05-22`
- Shift: `1st`
- Machine: `FlexMaster`
- Operator Name: blank for live testing
- Shift Hours: `8.5`
- Break Minutes: `60`
- Setup Count: `4`
- Standard Setup Minutes: `20`
- Actual Setup Minutes: `26`
- Downtime Minutes: `28`
- Cycle Time Seconds: `32`
- Actual Pipe Quantity: `596`
- Scrap Quantity: `12`
- Downtime Reason: `Sensor Fault`

Expected calculated values:

- Available Minutes: `450`
- Standard Setup Total: `80`
- Actual Setup Total: `104`
- Runtime After Actual Setups: `346`
- Productive Runtime: `318`
- Theoretical Quantity: `694`
- Setup Efficiency: about `76.9%`
- Runtime Availability: about `91.9%`
- Output Efficiency: about `85.9%`

## Formulas

Available Minutes = `(Shift Hours * 60) - Break Minutes`

Standard Setup Total = `Setup Count * Standard Setup Minutes`

Actual Setup Total = `Setup Count * Actual Setup Minutes`

Runtime After Actual Setups = `Available Minutes - Actual Setup Total`

Productive Runtime = `Runtime After Actual Setups - Downtime Minutes`

Theoretical Quantity = `ROUND(((Available Minutes - Standard Setup Total) * 60) / Cycle Time Seconds, 0)`

Setup Efficiency % = `Standard Setup Total / Actual Setup Total`

Runtime Availability % = `Productive Runtime / Runtime After Actual Setups`

Output Efficiency % = `Actual Pipe Quantity / Theoretical Quantity`

## Validation Choices

- Divide-by-zero errors are prevented.
- If cycle time seconds is blank or zero, theoretical quantity is `0`.
- If setup count is `0`, setup efficiency is shown as `100%` because no setup loss occurred for that entry.
- If runtime after actual setups is zero or negative, runtime availability is shown as `N/A` and the row is flagged.
- If productive runtime is negative, summaries treat it as `0` and the row is flagged.
- Suspicious entries are highlighted when efficiencies are below `75%`, output is unusually high, scrap is unusually high, or inputs create impossible runtime.

## Print Preview

On the Reports screen, use **Generate Print Preview** to create a clean report from the current filters. Use **Print Preview** after generation to print only that report view without the sidebar, filters, or app controls.

## Why Not Multiply The Efficiency Metrics?

Overall efficiency should not automatically multiply setup efficiency, runtime availability, and output efficiency unless each metric has been independently isolated. In this tracker, the formulas share parts of the same time base. Multiplying them can double-count the same production loss and make the final number look more precise than it really is.
