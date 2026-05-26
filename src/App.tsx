import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Download,
  Factory,
  FileText,
  LayoutDashboard,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Save,
  Table2,
  Trash2,
} from 'lucide-react';
import { average, calculateEntry, efficiencyClass, formatNumber, formatPercent } from './calculations';
import { downtimeReasons, emptyEntry, machines, sampleEntries, shifts } from './sampleData';
import type { FilterState, ProductionEntry } from './types';

type Screen = 'entry' | 'table' | 'dashboard' | 'reports' | 'guide';
type GroupRow = { label: string; count: number; setup: number | null; runtime: number | null; output: number | null; downtime: number; actual: number };

const storageKey = 'production-efficiency-tracker-v3';
const operatorNamesKey = 'production-efficiency-tracker-operator-names-v2';

const inputFields: Array<keyof ProductionEntry> = [
  'date',
  'shift',
  'machine',
  'operatorName',
  'shiftHours',
  'breakMinutes',
  'setupCount',
  'standardSetupMinutes',
  'actualSetupMinutes',
  'downtimeMinutes',
  'cycleTimeSeconds',
  'actualPipeQuantity',
  'scrapQuantity',
  'downtimeReason',
  'notes',
];

const calculatedHeaders = [
  'Available Minutes',
  'Standard Setup Total',
  'Actual Setup Total',
  'Runtime After Actual Setups',
  'Productive Runtime',
  'Theoretical Quantity',
  'Setup Efficiency %',
  'Runtime Availability %',
  'Output Efficiency %',
];

const makeEntry = (): ProductionEntry => ({
  ...emptyEntry,
  id: crypto.randomUUID(),
});

const numberField = (value: unknown) => (value === '' ? 0 : Number(value));

function useEntries() {
  const [entries, setEntries] = useState<ProductionEntry[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return sampleEntries;
    try {
      const parsed = JSON.parse(saved) as ProductionEntry[];
      return Array.isArray(parsed) && parsed.length ? parsed : sampleEntries;
    } catch {
      return sampleEntries;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries]);

  return { entries, setEntries };
}

function useSavedNames(key: string) {
  const [names, setNames] = useState<string[]>(() => {
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as string[];
      return Array.isArray(parsed) ? parsed.filter(Boolean).sort((a, b) => a.localeCompare(b)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(names));
  }, [key, names]);

  function saveName(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setNames((current) => {
      if (current.some((name) => name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) return current;
      return [...current, trimmed].sort((a, b) => a.localeCompare(b));
    });
  }

  return { names, saveName };
}

function uniqueNames(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function filterEntries(entries: ProductionEntry[], filters: FilterState) {
  return entries.filter((entry) => {
    if (filters.from && entry.date < filters.from) return false;
    if (filters.to && entry.date > filters.to) return false;
    if (filters.shift && entry.shift !== filters.shift) return false;
    if (filters.machine && entry.machine !== filters.machine) return false;
    if (filters.operatorName && entry.operatorName !== filters.operatorName) return false;
    return true;
  });
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv(entries: ProductionEntry[]) {
  const headers = [...inputFields, ...calculatedHeaders, 'Warnings'];
  const rows = entries.map((entry) => {
    const calc = calculateEntry(entry);
    return [
      ...inputFields.map((field) => entry[field]),
      calc.availableMinutes,
      calc.standardSetupTotal,
      calc.actualSetupTotal,
      calc.runtimeAfterActualSetups,
      calc.productiveRuntime,
      calc.theoreticalQuantity,
      formatPercent(calc.setupEfficiency),
      formatPercent(calc.runtimeAvailability),
      formatPercent(calc.outputEfficiency),
      calc.warnings.join(' | '),
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'production-efficiency-entries.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function summarize(entries: ProductionEntry[]) {
  const calcs = entries.map(calculateEntry);
  const totalActual = entries.reduce((sum, entry) => sum + entry.actualPipeQuantity, 0);
  const totalTheoretical = calcs.reduce((sum, calc) => sum + calc.theoreticalQuantity, 0);
  const totalDowntime = entries.reduce((sum, entry) => sum + entry.downtimeMinutes, 0);
  const totalScrap = entries.reduce((sum, entry) => sum + entry.scrapQuantity, 0);
  const totalProductiveHours = calcs.reduce((sum, calc) => sum + calc.productiveRuntimeForSummary / 60, 0);

  return {
    totalActual,
    totalTheoretical,
    avgSetup: average(calcs.map((calc) => calc.setupEfficiency)),
    avgRuntime: average(calcs.map((calc) => calc.runtimeAvailability)),
    avgOutput: average(calcs.map((calc) => calc.outputEfficiency)),
    totalDowntime,
    totalScrap,
    pipesPerHour: totalProductiveHours > 0 ? totalActual / totalProductiveHours : 0,
  };
}

function groupBy(entries: ProductionEntry[], key: keyof ProductionEntry): GroupRow[] {
  const groups = new Map<string, ProductionEntry[]>();
  entries.forEach((entry) => {
    const label = String(entry[key]);
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  });
  return [...groups.entries()]
    .map(([label, group]) => {
      const stats = summarize(group);
      return {
        label,
        count: group.length,
        setup: stats.avgSetup,
        runtime: stats.avgRuntime,
        output: stats.avgOutput,
        downtime: stats.totalDowntime,
        actual: stats.totalActual,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function App() {
  const { entries, setEntries } = useEntries();
  const savedOperators = useSavedNames(operatorNamesKey);
  const [screen, setScreen] = useState<Screen>('entry');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductionEntry>(makeEntry);
  const [filters, setFilters] = useState<FilterState>({ from: '', to: '', shift: '', machine: '', operatorName: '' });

  const filteredEntries = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const operatorFilterOptions = useMemo(
    () => uniqueNames([...entries.map((entry) => entry.operatorName), ...savedOperators.names]),
    [entries, savedOperators.names],
  );
  const sortedEntries = useMemo(() => [...filteredEntries].sort((a, b) => b.date.localeCompare(a.date)), [filteredEntries]);
  const draftCalc = calculateEntry(draft);
  const summary = summarize(filteredEntries);
  const warningCount = entries.reduce((sum, entry) => sum + (calculateEntry(entry).warnings.length ? 1 : 0), 0);

  function saveDraft() {
    savedOperators.saveName(draft.operatorName);
    if (editingId) {
      setEntries((current) => current.map((entry) => (entry.id === editingId ? { ...draft, id: editingId } : entry)));
    } else {
      setEntries((current) => [{ ...draft, id: crypto.randomUUID() }, ...current]);
    }
    setDraft(makeEntry());
    setEditingId(null);
    setScreen('table');
  }

  function editEntry(entry: ProductionEntry) {
    setDraft(entry);
    setEditingId(entry.id);
    setScreen('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (editingId === id) {
      setDraft(makeEntry());
      setEditingId(null);
    }
  }

  function updateDraft(field: keyof ProductionEntry, value: string) {
    const numericFields: Array<keyof ProductionEntry> = [
      'shiftHours',
      'breakMinutes',
      'setupCount',
      'standardSetupMinutes',
      'actualSetupMinutes',
      'downtimeMinutes',
      'cycleTimeSeconds',
      'actualPipeQuantity',
      'scrapQuantity',
    ];
    setDraft((current) => ({
      ...current,
      [field]: numericFields.includes(field) ? numberField(value) : value,
    }));
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Factory aria-hidden="true" />
          <div>
            <strong>Production Efficiency Tracker</strong>
            <span>Cloud demo V1</span>
          </div>
        </div>
        <nav>
          <NavButton icon={<Plus />} label="Daily Entry" active={screen === 'entry'} onClick={() => setScreen('entry')} />
          <NavButton icon={<Table2 />} label="Entries Table" active={screen === 'table'} onClick={() => setScreen('table')} />
          <NavButton icon={<LayoutDashboard />} label="Dashboard" active={screen === 'dashboard'} onClick={() => setScreen('dashboard')} />
          <NavButton icon={<BarChart3 />} label="Reports" active={screen === 'reports'} onClick={() => setScreen('reports')} />
          <NavButton icon={<BookOpen />} label="Formula Guide" active={screen === 'guide'} onClick={() => setScreen('guide')} />
        </nav>
        <div className="demo-note">
          <AlertTriangle aria-hidden="true" />
          <span>Demo data only. Saved in this browser.</span>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Manufacturing demo app</p>
            <h1>{screenTitle(screen)}</h1>
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={() => setEntries(sampleEntries)} title="Reload sample data">
              <RefreshCcw aria-hidden="true" /> Reset Samples
            </button>
            <button className="primary" onClick={() => exportCsv(filteredEntries)} title="Export filtered entries">
              <Download aria-hidden="true" /> Export CSV
            </button>
          </div>
        </header>

        <Filters
          filters={filters}
          setFilters={setFilters}
          machineOptions={machines}
          operatorOptions={operatorFilterOptions}
        />

        {screen === 'entry' && (
          <DailyEntry
            draft={draft}
            calc={draftCalc}
            editingId={editingId}
            updateDraft={updateDraft}
            saveDraft={saveDraft}
            cancelEdit={() => {
              setDraft(makeEntry());
              setEditingId(null);
            }}
            operatorSuggestions={savedOperators.names}
          />
        )}
        {screen === 'table' && (
          <EntriesTable entries={sortedEntries} onEdit={editEntry} onDelete={deleteEntry} />
        )}
        {screen === 'dashboard' && <Dashboard summary={summary} entries={filteredEntries} warningCount={warningCount} />}
        {screen === 'reports' && <Reports entries={filteredEntries} filters={filters} />}
        {screen === 'guide' && <FormulaGuide />}
      </main>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function screenTitle(screen: Screen) {
  return {
    entry: 'Daily Entry',
    table: 'Entries Table',
    dashboard: 'Dashboard',
    reports: 'Reports',
    guide: 'Formula Guide',
  }[screen];
}

function Filters({
  filters,
  setFilters,
  machineOptions,
  operatorOptions,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  machineOptions: string[];
  operatorOptions: string[];
}) {
  return (
    <section className="filters" aria-label="Entry filters">
      <label>
        From
        <input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
      </label>
      <label>
        To
        <input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
      </label>
      <label>
        Shift
        <select value={filters.shift} onChange={(event) => setFilters((current) => ({ ...current, shift: event.target.value }))}>
          <option value="">All shifts</option>
          {shifts.map((shift) => (
            <option key={shift}>{shift}</option>
          ))}
        </select>
      </label>
      <label>
        Machine
        <select value={filters.machine} onChange={(event) => setFilters((current) => ({ ...current, machine: event.target.value }))}>
          <option value="">All machines</option>
          {machineOptions.map((machine) => (
            <option key={machine}>{machine}</option>
          ))}
        </select>
      </label>
      <label>
        Operator
        <select value={filters.operatorName} onChange={(event) => setFilters((current) => ({ ...current, operatorName: event.target.value }))}>
          <option value="">All operators</option>
          {operatorOptions.map((operator) => (
            <option key={operator}>{operator}</option>
          ))}
        </select>
      </label>
    </section>
  );
}

function DailyEntry({
  draft,
  calc,
  editingId,
  updateDraft,
  saveDraft,
  cancelEdit,
  operatorSuggestions,
}: {
  draft: ProductionEntry;
  calc: ReturnType<typeof calculateEntry>;
  editingId: string | null;
  updateDraft: (field: keyof ProductionEntry, value: string) => void;
  saveDraft: () => void;
  cancelEdit: () => void;
  operatorSuggestions: string[];
}) {
  return (
    <section className="entry-layout">
      <div className="form-panel">
        <div className="section-heading">
          <h2>{editingId ? 'Edit Entry' : 'New Daily Entry'}</h2>
          {editingId && <span className="pill">Editing</span>}
        </div>
        <div className="form-grid">
          <label>
            Date
            <input type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} />
          </label>
          <label>
            Shift
            <select value={draft.shift} onChange={(event) => updateDraft('shift', event.target.value)}>
              {shifts.map((shift) => (
                <option key={shift}>{shift}</option>
              ))}
            </select>
          </label>
          <label>
            Machine
            <select value={draft.machine} onChange={(event) => updateDraft('machine', event.target.value)}>
              {machines.map((machine) => (
                <option key={machine}>{machine}</option>
              ))}
            </select>
          </label>
          <label>
            Operator Name
            <input
              list="operator-suggestions"
              value={draft.operatorName}
              onChange={(event) => updateDraft('operatorName', event.target.value)}
              placeholder="Type operator name"
            />
          </label>
          <datalist id="operator-suggestions">
            {operatorSuggestions.map((operator) => (
              <option key={operator} value={operator} />
            ))}
          </datalist>
          <NumberInput label="Shift Hours" value={draft.shiftHours} onChange={(value) => updateDraft('shiftHours', value)} step="0.25" />
          <NumberInput label="Break Minutes" value={draft.breakMinutes} onChange={(value) => updateDraft('breakMinutes', value)} />
          <NumberInput label="Setup Count" value={draft.setupCount} onChange={(value) => updateDraft('setupCount', value)} />
          <NumberInput label="Standard Setup Minutes" value={draft.standardSetupMinutes} onChange={(value) => updateDraft('standardSetupMinutes', value)} />
          <NumberInput label="Actual Setup Minutes" value={draft.actualSetupMinutes} onChange={(value) => updateDraft('actualSetupMinutes', value)} />
          <NumberInput label="Downtime Minutes" value={draft.downtimeMinutes} onChange={(value) => updateDraft('downtimeMinutes', value)} />
          <NumberInput label="Cycle Time Seconds" value={draft.cycleTimeSeconds} onChange={(value) => updateDraft('cycleTimeSeconds', value)} />
          <NumberInput label="Actual Pipe Quantity" value={draft.actualPipeQuantity} onChange={(value) => updateDraft('actualPipeQuantity', value)} />
          <NumberInput label="Scrap Quantity" value={draft.scrapQuantity} onChange={(value) => updateDraft('scrapQuantity', value)} />
          <label>
            Downtime Reason
            <select value={draft.downtimeReason} onChange={(event) => updateDraft('downtimeReason', event.target.value)}>
              {downtimeReasons.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            Notes
            <textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} rows={4} />
          </label>
        </div>
        <div className="button-row">
          <button className="primary" onClick={saveDraft}>
            <Save aria-hidden="true" /> {editingId ? 'Update Entry' : 'Save Entry'}
          </button>
          {editingId && (
            <button className="ghost" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <CalculatedPreview calc={calc} actualPipeQuantity={draft.actualPipeQuantity} />
    </section>
  );
}

function NumberInput({ label, value, onChange, step = '1' }: { label: string; value: number; onChange: (value: string) => void; step?: string }) {
  return (
    <label>
      {label}
      <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CalculatedPreview({ calc, actualPipeQuantity }: { calc: ReturnType<typeof calculateEntry>; actualPipeQuantity: number }) {
  return (
    <aside className="preview-panel">
      <div className="section-heading">
        <h2>Calculated Preview</h2>
      </div>
      <MetricList
        rows={[
          ['Available Minutes', formatNumber(calc.availableMinutes)],
          ['Standard Setup Total', formatNumber(calc.standardSetupTotal)],
          ['Actual Setup Total', formatNumber(calc.actualSetupTotal)],
          ['Runtime After Actual Setups', formatNumber(calc.runtimeAfterActualSetups)],
          ['Productive Runtime', formatNumber(calc.productiveRuntime)],
          ['Theoretical Quantity', formatNumber(calc.theoreticalQuantity)],
          ['Actual Pipe Quantity', formatNumber(actualPipeQuantity)],
        ]}
      />
      <div className="efficiency-row">
        <Badge label="Setup" value={calc.setupEfficiency} />
        <Badge label="Runtime" value={calc.runtimeAvailability} />
        <Badge label="Output" value={calc.outputEfficiency} />
      </div>
      {calc.warnings.length > 0 && (
        <div className="warnings">
          <strong>Review warnings</strong>
          {calc.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}
    </aside>
  );
}

function EntriesTable({ entries, onEdit, onDelete }: { entries: ProductionEntry[]; onEdit: (entry: ProductionEntry) => void; onDelete: (id: string) => void }) {
  return (
    <section className="table-shell">
      <div className="section-heading">
        <h2>{entries.length} Entries</h2>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>Machine</th>
              <th>Operator</th>
              <th>Shift Hrs</th>
              <th>Break</th>
              <th>Setups</th>
              <th>Std Setup</th>
              <th>Actual Setup</th>
              <th>Downtime</th>
              <th>Cycle Sec</th>
              <th>Actual Qty</th>
              <th>Scrap</th>
              <th>Reason</th>
              <th>Available</th>
              <th>Std Setup Total</th>
              <th>Actual Setup Total</th>
              <th>Runtime After Setups</th>
              <th>Productive Runtime</th>
              <th>Theoretical Qty</th>
              <th>Setup Eff.</th>
              <th>Runtime Avail.</th>
              <th>Output Eff.</th>
              <th>Warnings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const calc = calculateEntry(entry);
              return (
                <tr key={entry.id} className={calc.warnings.length ? 'needs-review' : ''}>
                  <td>{entry.date}</td>
                  <td>{entry.shift}</td>
                  <td>{entry.machine}</td>
                  <td>{entry.operatorName}</td>
                  <td>{entry.shiftHours}</td>
                  <td>{entry.breakMinutes}</td>
                  <td>{entry.setupCount}</td>
                  <td>{entry.standardSetupMinutes}</td>
                  <td>{entry.actualSetupMinutes}</td>
                  <td>{entry.downtimeMinutes}</td>
                  <td>{entry.cycleTimeSeconds}</td>
                  <td>{entry.actualPipeQuantity}</td>
                  <td>{entry.scrapQuantity}</td>
                  <td>{entry.downtimeReason}</td>
                  <td>{formatNumber(calc.availableMinutes)}</td>
                  <td>{formatNumber(calc.standardSetupTotal)}</td>
                  <td>{formatNumber(calc.actualSetupTotal)}</td>
                  <td>{formatNumber(calc.runtimeAfterActualSetups)}</td>
                  <td>{formatNumber(calc.productiveRuntime)}</td>
                  <td>{formatNumber(calc.theoreticalQuantity)}</td>
                  <td><span className={`score ${efficiencyClass(calc.setupEfficiency)}`}>{formatPercent(calc.setupEfficiency)}</span></td>
                  <td><span className={`score ${efficiencyClass(calc.runtimeAvailability)}`}>{formatPercent(calc.runtimeAvailability)}</span></td>
                  <td><span className={`score ${efficiencyClass(calc.outputEfficiency)}`}>{formatPercent(calc.outputEfficiency)}</span></td>
                  <td>{calc.warnings.length ? calc.warnings.join(' ') : 'OK'}</td>
                  <td>
                    <div className="icon-actions">
                      <button className="icon" onClick={() => onEdit(entry)} title="Edit entry"><Pencil aria-hidden="true" /></button>
                      <button className="icon danger" onClick={() => onDelete(entry.id)} title="Delete entry"><Trash2 aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Dashboard({ summary, entries, warningCount }: { summary: ReturnType<typeof summarize>; entries: ProductionEntry[]; warningCount: number }) {
  const byDay = groupBy(entries, 'date');
  return (
    <section className="stack">
      <div className="cards">
        <SummaryCard label="Total Actual Quantity" value={formatNumber(summary.totalActual)} />
        <SummaryCard label="Total Theoretical Quantity" value={formatNumber(summary.totalTheoretical)} />
        <SummaryCard label="Average Setup Efficiency %" value={formatPercent(summary.avgSetup)} tone={efficiencyClass(summary.avgSetup)} />
        <SummaryCard label="Average Runtime Availability %" value={formatPercent(summary.avgRuntime)} tone={efficiencyClass(summary.avgRuntime)} />
        <SummaryCard label="Average Output Efficiency %" value={formatPercent(summary.avgOutput)} tone={efficiencyClass(summary.avgOutput)} />
        <SummaryCard label="Total Downtime Minutes" value={formatNumber(summary.totalDowntime)} />
        <SummaryCard label="Total Scrap Quantity" value={formatNumber(summary.totalScrap)} />
        <SummaryCard label="Pipes Per Hour" value={formatNumber(summary.pipesPerHour, 1)} />
      </div>
      {warningCount > 0 && (
        <div className="notice">
          <AlertTriangle aria-hidden="true" />
          <span>{warningCount} entries have warnings. Review highlighted rows in the Entries Table.</span>
        </div>
      )}
      <section className="report-panel">
        <h2>Weekly Output Trend</h2>
        <BarList rows={byDay.map((row) => ({ label: row.label, value: row.actual }))} valueLabel="pipes" />
      </section>
    </section>
  );
}

function Reports({ entries, filters }: { entries: ProductionEntry[]; filters: FilterState }) {
  const [showPreview, setShowPreview] = useState(false);
  const [reportPage, setReportPage] = useState<'overview' | 'detail'>('overview');
  const byShift = groupBy(entries, 'shift');
  const byMachine = groupBy(entries, 'machine');
  const byOperator = groupBy(entries, 'operatorName');
  const byReason = groupBy(entries, 'downtimeReason').sort((a, b) => b.downtime - a.downtime);
  const byDay = groupBy(entries, 'date');
  const bestWorst = [...byDay].sort((a, b) => (b.output ?? 0) - (a.output ?? 0));
  const scrapTrend = entries
    .reduce((map, entry) => {
      map.set(entry.date, (map.get(entry.date) ?? 0) + entry.scrapQuantity);
      return map;
    }, new Map<string, number>());

  return (
    <section className="stack">
      <div className="report-actions">
        <div className="tabs" role="tablist" aria-label="Report pages">
          <button className={reportPage === 'overview' ? 'active' : ''} onClick={() => setReportPage('overview')}>
            Page 1: Efficiency
          </button>
          <button className={reportPage === 'detail' ? 'active' : ''} onClick={() => setReportPage('detail')}>
            Page 2: Trends
          </button>
        </div>
        <button className="primary" onClick={() => setShowPreview(true)}>
          <FileText aria-hidden="true" /> Generate Print Preview
        </button>
        {showPreview && (
          <button className="ghost" onClick={() => window.print()}>
            <Printer aria-hidden="true" /> Print Preview
          </button>
        )}
      </div>

      {showPreview && (
        <PrintPreview
          entries={entries}
          filters={filters}
          byShift={byShift}
          byMachine={byMachine}
          byOperator={byOperator}
          byReason={byReason}
          byDay={byDay}
          bestWorst={bestWorst}
          scrapTrend={[...scrapTrend.entries()].sort().map(([label, value]) => ({ label, value }))}
        />
      )}

      {reportPage === 'overview' && (
        <section className="reports-grid">
          <ReportTable title="Efficiency by Shift" rows={byShift} />
          <ReportTable title="Efficiency by Machine" rows={byMachine} />
          <ReportTable title="Efficiency by Operator" rows={byOperator} />
          <section className="report-panel">
            <h2>Output Efficiency by Machine</h2>
            <ColumnChart rows={byMachine.map((row) => ({ label: row.label, value: (row.output ?? 0) * 100 }))} valueLabel="%" maxValue={100} />
          </section>
        </section>
      )}

      {reportPage === 'detail' && (
        <section className="reports-grid">
          <section className="report-panel">
            <h2>Downtime by Reason</h2>
            <ColumnChart rows={byReason.map((row) => ({ label: row.label, value: row.downtime }))} valueLabel="min" />
          </section>
          <section className="report-panel">
            <h2>Weekly Output Trend</h2>
            <ColumnChart rows={byDay.map((row) => ({ label: row.label, value: row.actual }))} valueLabel="pipes" />
          </section>
          <section className="report-panel">
            <h2>Best/Worst Production Days</h2>
            <MetricList
              rows={[
                ['Best Day', bestWorst[0] ? `${bestWorst[0].label} (${formatPercent(bestWorst[0].output)})` : 'N/A'],
                ['Worst Day', bestWorst.at(-1) ? `${bestWorst.at(-1)!.label} (${formatPercent(bestWorst.at(-1)!.output)})` : 'N/A'],
              ]}
            />
          </section>
          <section className="report-panel">
            <h2>Scrap Trend</h2>
            <ColumnChart rows={[...scrapTrend.entries()].sort().map(([label, value]) => ({ label, value }))} valueLabel="scrap" />
          </section>
        </section>
      )}
    </section>
  );
}

function PrintPreview({
  entries,
  filters,
  byShift,
  byMachine,
  byOperator,
  byReason,
  byDay,
  bestWorst,
  scrapTrend,
}: {
  entries: ProductionEntry[];
  filters: FilterState;
  byShift: GroupRow[];
  byMachine: GroupRow[];
  byOperator: GroupRow[];
  byReason: GroupRow[];
  byDay: GroupRow[];
  bestWorst: GroupRow[];
  scrapTrend: Array<{ label: string; value: number }>;
}) {
  const summary = summarize(entries);
  const filterText = [
    filters.from ? `From ${filters.from}` : '',
    filters.to ? `To ${filters.to}` : '',
    filters.shift ? `Shift ${filters.shift}` : '',
    filters.machine ? `Machine ${filters.machine}` : '',
    filters.operatorName ? `Operator ${filters.operatorName}` : '',
  ].filter(Boolean);

  return (
    <section className="print-preview">
      <div className="print-header">
        <div>
          <p className="eyebrow">Generated report preview</p>
          <h2>Production Efficiency Tracker Report</h2>
          <span>{filterText.length ? filterText.join(' | ') : 'All current entries'} | {entries.length} entries</span>
        </div>
        <strong>{new Date().toLocaleDateString()}</strong>
      </div>

      <div className="print-summary">
        <SummaryCard label="Total Actual Quantity" value={formatNumber(summary.totalActual)} />
        <SummaryCard label="Total Theoretical Quantity" value={formatNumber(summary.totalTheoretical)} />
        <SummaryCard label="Average Setup Efficiency %" value={formatPercent(summary.avgSetup)} tone={efficiencyClass(summary.avgSetup)} />
        <SummaryCard label="Average Runtime Availability %" value={formatPercent(summary.avgRuntime)} tone={efficiencyClass(summary.avgRuntime)} />
        <SummaryCard label="Average Output Efficiency %" value={formatPercent(summary.avgOutput)} tone={efficiencyClass(summary.avgOutput)} />
        <SummaryCard label="Total Downtime Minutes" value={formatNumber(summary.totalDowntime)} />
        <SummaryCard label="Total Scrap Quantity" value={formatNumber(summary.totalScrap)} />
        <SummaryCard label="Pipes Per Hour" value={formatNumber(summary.pipesPerHour, 1)} />
      </div>

      <div className="print-grid">
        <ReportTable title="Efficiency by Shift" rows={byShift} />
        <ReportTable title="Efficiency by Machine" rows={byMachine} />
        <ReportTable title="Efficiency by Operator" rows={byOperator} />
        <ReportTable title="Weekly Trend" rows={byDay} />
      </div>

      <div className="print-grid">
        <section className="report-panel">
          <h2>Downtime by Reason</h2>
          <ColumnChart rows={byReason.map((row) => ({ label: row.label, value: row.downtime }))} valueLabel="min" />
        </section>
        <section className="report-panel">
          <h2>Best/Worst Production Days</h2>
          <MetricList
            rows={[
              ['Best Day', bestWorst[0] ? `${bestWorst[0].label} (${formatPercent(bestWorst[0].output)})` : 'N/A'],
              ['Worst Day', bestWorst.at(-1) ? `${bestWorst.at(-1)!.label} (${formatPercent(bestWorst.at(-1)!.output)})` : 'N/A'],
            ]}
          />
        </section>
      </div>

      <section className="report-panel">
        <h2>Scrap Trend</h2>
        <ColumnChart rows={scrapTrend} valueLabel="scrap" />
      </section>

      <section className="report-panel">
        <h2>Entry Detail</h2>
        <table className="compact-table print-detail-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>Machine</th>
              <th>Operator</th>
              <th>Actual Qty</th>
              <th>Theoretical Qty</th>
              <th>Setup</th>
              <th>Runtime</th>
              <th>Output</th>
              <th>Downtime</th>
              <th>Scrap</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const calc = calculateEntry(entry);
              return (
                <tr key={entry.id}>
                  <td>{entry.date}</td>
                  <td>{entry.shift}</td>
                  <td>{entry.machine}</td>
                  <td>{entry.operatorName}</td>
                  <td>{formatNumber(entry.actualPipeQuantity)}</td>
                  <td>{formatNumber(calc.theoreticalQuantity)}</td>
                  <td>{formatPercent(calc.setupEfficiency)}</td>
                  <td>{formatPercent(calc.runtimeAvailability)}</td>
                  <td>{formatPercent(calc.outputEfficiency)}</td>
                  <td>{formatNumber(entry.downtimeMinutes)}</td>
                  <td>{formatNumber(entry.scrapQuantity)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function ReportTable({ title, rows }: { title: string; rows: GroupRow[] }) {
  return (
    <section className="report-panel">
      <h2>{title}</h2>
      <table className="compact-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Entries</th>
            <th>Setup</th>
            <th>Runtime</th>
            <th>Output</th>
            <th>Downtime</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.count}</td>
              <td><span className={`score ${efficiencyClass(row.setup)}`}>{formatPercent(row.setup)}</span></td>
              <td><span className={`score ${efficiencyClass(row.runtime)}`}>{formatPercent(row.runtime)}</span></td>
              <td><span className={`score ${efficiencyClass(row.output)}`}>{formatPercent(row.output)}</span></td>
              <td>{formatNumber(row.downtime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BarList({ rows, valueLabel }: { rows: Array<{ label: string; value: number }>; valueLabel: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <div className="bar-track">
            <div style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
          </div>
          <strong>{formatNumber(row.value)} {valueLabel}</strong>
        </div>
      ))}
    </div>
  );
}

function ColumnChart({
  rows,
  valueLabel,
  maxValue,
}: {
  rows: Array<{ label: string; value: number }>;
  valueLabel: string;
  maxValue?: number;
}) {
  const max = Math.max(maxValue ?? 0, ...rows.map((row) => row.value), 1);
  return (
    <div className="column-chart">
      <div className="chart-plot">
        {rows.map((row) => (
          <div className="column-item" key={row.label}>
            <strong>{formatNumber(row.value, valueLabel === '%' ? 1 : 0)}{valueLabel === '%' ? '%' : ''}</strong>
            <div className="column-track">
              <div style={{ height: `${Math.max(3, (row.value / max) * 100)}%` }} />
            </div>
            <span>{row.label}</span>
          </div>
        ))}
      </div>
      {valueLabel !== '%' && <p className="chart-note">Values shown in {valueLabel}.</p>}
    </div>
  );
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: string }) {
  return (
    <article className={`summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Badge({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={`badge ${efficiencyClass(value)}`}>
      <span>{label}</span>
      <strong>{formatPercent(value)}</strong>
    </div>
  );
}

function MetricList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="metric-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FormulaGuide() {
  return (
    <section className="guide">
      <article>
        <FileText aria-hidden="true" />
        <div>
          <h2>Helper Columns</h2>
          <p><strong>Available Minutes</strong> = shift hours times 60, minus break minutes. This is the time available for production and setups.</p>
          <p><strong>Standard Setup Total</strong> = setup count times standard setup minutes. This is the expected setup load.</p>
          <p><strong>Actual Setup Total</strong> = setup count times actual setup minutes. This is the observed setup load.</p>
          <p><strong>Runtime After Actual Setups</strong> = available minutes minus actual setup total.</p>
          <p><strong>Productive Runtime</strong> = runtime after actual setups minus downtime minutes. If this goes negative, summaries treat it as 0 and the entry is flagged.</p>
          <p><strong>Theoretical Quantity</strong> = rounded result of ((available minutes - standard setup total) times 60) divided by cycle time seconds. If cycle time is blank or zero, theoretical quantity is 0.</p>
        </div>
      </article>
      <article>
        <BarChart3 aria-hidden="true" />
        <div>
          <h2>Efficiency Metrics</h2>
          <p><strong>Setup Efficiency %</strong> = standard setup total divided by actual setup total. When setup count is 0, this demo shows 100% because no setup loss occurred for that entry.</p>
          <p><strong>Runtime Availability %</strong> = productive runtime divided by runtime after actual setups. It means the percentage of available runtime that was not lost to downtime.</p>
          <p><strong>Output Efficiency %</strong> = actual pipe quantity divided by theoretical quantity.</p>
          <p><strong>Overall Efficiency caution</strong>: setup, runtime, and output should not simply be multiplied together unless the metrics are independently isolated. In this tracker, the formulas share portions of the same time base, so multiplying them can double-count the same loss.</p>
        </div>
      </article>
      <article>
        <AlertTriangle aria-hidden="true" />
        <div>
          <h2>Validation Rules</h2>
          <p>Divide-by-zero results are prevented. Runtime availability is shown as N/A when runtime after actual setups is zero or negative. Rows are flagged when cycle time is zero, productive runtime is negative, an efficiency score is below 75%, output is unusually high, or scrap looks suspicious.</p>
          <p>Conditional colors use green for 90% or higher, yellow for 75% to under 90%, and red below 75%.</p>
        </div>
      </article>
    </section>
  );
}

export { App };
