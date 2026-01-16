// Previsão Futura - gráfico unificado (Previsto + Real + Média/Mediana por dia da semana)
const FORECAST_CSV_PATH = 'dimensionamento_outubro_2025_GERAL.csv'; 
const HIST_REAL_CSV_PATH = 'demandareal.csv';

let forecastData = [];
let histRealData = [];
let realByUnitDate = new Map();
let weekdayStatsByUnit = new Map();
let forecastChart = null;
let currentFilteredRows = [];
let currentViewMode = 'performance'; // 'performance' ou 'dimensionamento'

const SERIES_STORAGE_KEY = 'brisa_previsao_series_v1';

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

// -------------------------
// Datas / Dia da semana
// -------------------------
function parseDMYtoISO(dmy) {
  if (!dmy || typeof dmy !== 'string') return '';
  const p = dmy.split('/');
  if (p.length !== 3) return '';
  const dd = String(p[0]).padStart(2, '0');
  const mm = String(p[1]).padStart(2, '0');
  const yyyy = String(p[2]);
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const p = iso.split('-');
  if (p.length !== 3) return null;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function weekdayIndexFromISO(iso) {
  const dt = parseISODate(iso);
  if (!dt) return null;
  return dt.getDay();
}

function weekdayNamePT(idx) {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return (idx === null || idx === undefined) ? '' : (dias[idx] || '');
}

// -------------------------
// Estatística
// -------------------------
function mean(arr) {
  if (!arr || arr.length === 0) return null;
  const s = arr.reduce((a, b) => a + b, 0);
  return Math.round(s / arr.length);
}

function median(arr) {
  if (!arr || arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const med = (s.length % 2 === 1) ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(med);
}

function safeNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function formatNumberPt(n) {
  if (n === null || n === undefined) return '-';
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString('pt-BR', { 
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }) : '-';
}

function sanitizeFilename(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

// -------------------------
// Controles de Séries (Botões em vez de Checkboxes)
// -------------------------
function loadSeriesPrefs() {
  try {
    const raw = localStorage.getItem(SERIES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { previsto: true, real: true, media: true, mediana: true };
  } catch {
    return { previsto: true, real: true, media: true, mediana: true };
  }
}

function saveSeriesPrefs(prefs) {
  try {
    localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

function createSeriesControls() {
  const container = document.querySelector('.series-toggles');
  if (!container) return;
  
  // Remover checkboxes antigos
  container.innerHTML = '';
  
  const series = [
    { id: 'previsto', label: 'Previsto', color: '#6366f1' },
    { id: 'real', label: 'Real', color: '#10b981' },
    { id: 'media', label: 'Média', color: '#0ea5e9' },
    { id: 'mediana', label: 'Mediana', color: '#f59e0b' }
  ];
  
  const prefs = loadSeriesPrefs();
  
  series.forEach(serie => {
    const button = document.createElement('button');
    button.className = `series-btn ${prefs[serie.id] ? 'active' : ''}`;
    button.dataset.series = serie.id;
    button.innerHTML = `
      <span class="series-dot" style="background-color: ${serie.color}"></span>
      ${serie.label}
    `;
    
    button.addEventListener('click', function() {
      const seriesId = this.dataset.series;
      const isActive = !this.classList.contains('active');
      
      // Atualizar botão
      this.classList.toggle('active');
      
      // Atualizar preferências
      const newPrefs = { ...loadSeriesPrefs(), [seriesId]: isActive };
      saveSeriesPrefs(newPrefs);
      
      // Atualizar gráfico
      if (forecastChart) {
        forecastChart.data.datasets.forEach(ds => {
          if (ds.seriesKey === seriesId) {
            ds.hidden = !isActive;
          }
        });
        forecastChart.update();
      }
    });
    
    container.appendChild(button);
  });
}

// -------------------------
// Controles de Visualização
// -------------------------
function createViewModeControls() {
  const container = document.getElementById('viewModeControls');
  if (!container) return;
  
  container.innerHTML = `
    <div class="view-toggle">
      <button class="view-btn ${currentViewMode === 'performance' ? 'active' : ''}" data-view="performance">
        <i class="fas fa-chart-line"></i> Performance
      </button>
      <button class="view-btn ${currentViewMode === 'dimensionamento' ? 'active' : ''}" data-view="dimensionamento">
        <i class="fas fa-users"></i> Dimensionamento
      </button>
    </div>
  `;
  
  // Adicionar event listeners
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const newView = this.dataset.view;
      if (newView !== currentViewMode) {
        currentViewMode = newView;
        
        // Atualizar botões
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        // Atualizar tabela
        updateTable(currentFilteredRows);
        
        // Atualizar título da tabela
        const tableTitle = document.querySelector('.table-wrapper h3');
        if (tableTitle) {
          tableTitle.innerHTML = currentViewMode === 'performance' 
            ? '<i class="fas fa-table"></i> Detalhamento de Performance'
            : '<i class="fas fa-table"></i> Detalhamento de Dimensionamento';
        }
      }
    });
  });
}

// -------------------------
// Carregamento de dados
// -------------------------
async function fetchCsvText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao carregar ${path} (HTTP ${res.status})`);
  return await res.text();
}

async function carregarDados() {
  try {
    const [forecastCsvText, histCsvText] = await Promise.all([
      fetchCsvText(FORECAST_CSV_PATH),
      fetchCsvText(HIST_REAL_CSV_PATH).catch(() => null)
    ]);

    // Forecast - IMPORTANTE: Lidar com vírgula como separador decimal
    const forecastParsed = Papa.parse(forecastCsvText, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transform: (value, field) => {
        // Converter vírgula para ponto em números
        if (typeof value === 'string' && (field === 'Produtividade_Ref')) {
          return value.replace(',', '.');
        }
        return value;
      }
    });

    forecastData = (forecastParsed.data || [])
      .map(row => {
        const dataDMY = row.Data;
        const dataISO = parseDMYtoISO(dataDMY);
        const w = weekdayIndexFromISO(dataISO);
        
        // Converter produtividade para número
        let produtividade = row.Produtividade_Ref;
        if (typeof produtividade === 'string') {
          produtividade = parseFloat(produtividade.replace(',', '.'));
        }
        
        return {
          dataDMY,
          dataISO,
          weekdayIdx: w,
          weekdayPT: weekdayNamePT(w),
          unidade: row.Unidade,
          demandaPrevista: safeNumber(row.Demanda_Prevista),
          modelo: row.Modelo,
          produtividade: Number.isFinite(produtividade) ? Math.round(produtividade) : null,
          atendentes: safeNumber(row.Atendentes_Necessarios)
        };
      })
      .filter(r => r.unidade && r.dataISO);

    console.log('Primeiras linhas do forecast:', forecastData.slice(0, 3));

    // Histórico real
    histRealData = [];
    realByUnitDate = new Map();
    weekdayStatsByUnit = new Map();

    if (histCsvText) {
      const histParsed = Papa.parse(histCsvText, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        dynamicTyping: true
      });

      histRealData = (histParsed.data || [])
        .map(row => {
          const dataISO = row.data;
          const w = weekdayIndexFromISO(dataISO);
          return {
            dataISO,
            weekdayIdx: w,
            unidade: row.unidade,
            real: safeNumber(row.demanda)
          };
        })
        .filter(r => r.unidade && r.dataISO && r.real !== null);

      // map real (unit|date)
      for (const r of histRealData) {
        realByUnitDate.set(`${r.unidade}|${r.dataISO}`, r.real);
      }

      // buckets por unidade/diaSemana
      const buckets = new Map();
      for (const r of histRealData) {
        if (r.weekdayIdx === null) continue;
        const unit = r.unidade;
        if (!buckets.has(unit)) buckets.set(unit, new Map());
        const byW = buckets.get(unit);
        if (!byW.has(r.weekdayIdx)) byW.set(r.weekdayIdx, []);
        byW.get(r.weekdayIdx).push(r.real);
      }

      // stats (com números inteiros)
      for (const [unit, byW] of buckets.entries()) {
        const statsW = new Map();
        for (const [w, arr] of byW.entries()) {
          statsW.set(w, { 
            media: Math.round(mean(arr)), 
            mediana: Math.round(median(arr)) 
          });
        }
        weekdayStatsByUnit.set(unit, statsW);
      }
    }

    // Popular unidades
    const units = [...new Set(forecastData.map(d => d.unidade))].sort();
    const unitSelect = document.getElementById('forecastUnit');
    if (unitSelect) {
      unitSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
      unitSelect.addEventListener('change', atualizarInterface);
    }
    document.getElementById('forecastHorizon')?.addEventListener('change', atualizarInterface);

    // Criar controles de séries
    createSeriesControls();
    
    // Criar controles de visualização
    createViewModeControls();
    
    // Se houver unidades, selecionar a primeira
    if (units.length > 0) {
      unitSelect.value = units[0];
      atualizarInterface();
    }
    
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    alert('Erro ao carregar dados. Verifique se os arquivos CSV estão na pasta correta.');
  }
}

// -------------------------
// UI
// -------------------------
function atualizarInterface() {
  const unitEl = document.getElementById('forecastUnit');
  const horizonEl = document.getElementById('forecastHorizon');
  if (!unitEl || !horizonEl) return;

  const selectedUnit = unitEl.value;
  const horizonValue = parseInt(horizonEl.value, 10);

  // Filtrar dados - assumindo que CSV já tem só dias úteis
  const filtered = forecastData
    .filter(d => d.unidade === selectedUnit)
    .slice(0, Number.isFinite(horizonValue) ? horizonValue : 30)
    .map(d => {
      const real = realByUnitDate.get(`${selectedUnit}|${d.dataISO}`) ?? null;
      const statsW = weekdayStatsByUnit.get(selectedUnit);
      const stats = statsW ? statsW.get(d.weekdayIdx) : null;
      const prev = safeNumber(d.demandaPrevista);
      const erroAbs = (real !== null && prev !== null) ? Math.abs(prev - real) : null;
      
      return {
        ...d,
        real,
        mediaDiaSemana: stats ? stats.media : null,
        medianaDiaSemana: stats ? stats.mediana : null,
        erroAbs: erroAbs ? Math.round(erroAbs) : null,
        atendentes: d.atendentes ? Math.round(d.atendentes) : null,
        produtividade: d.produtividade
      };
    });

  if (filtered.length === 0) return;

  // Guarda para exportação
  currentFilteredRows = filtered;

  // KPIs (com média de atendentes por dia)
  const totalDemanda = filtered.reduce((acc, curr) => acc + (curr.demandaPrevista || 0), 0);
  const somaAtendentes = filtered.reduce((acc, curr) => acc + (curr.atendentes || 0), 0);
  const mediaAtendentes = Math.round(somaAtendentes / filtered.length);
  const modeloUnidade = filtered[0].modelo;
  const produtividadeMedia = filtered[0]?.produtividade || '-';

  document.getElementById('displayUnit').textContent = selectedUnit;
  document.getElementById('kpiTotalDemanda').textContent = totalDemanda.toLocaleString('pt-BR');
  document.getElementById('kpiMediaStaff').textContent = mediaAtendentes;
  document.getElementById('kpiModelName').textContent = modeloUnidade;
  
  // Adicionar KPI de produtividade se existir
  const produtividadeEl = document.getElementById('kpiProdutividade');
  if (produtividadeEl) {
    produtividadeEl.textContent = produtividadeMedia;
  }

  // Atualizar tabela baseada no modo de visualização
  updateTable(filtered);
  
  // Atualizar gráfico
  renderizarGrafico(filtered);
}

function updateTable(data) {
  const tbody = document.getElementById('forecastTable');
  if (!tbody) return;
  
  if (currentViewMode === 'performance') {
    // Visão de Performance
    tbody.innerHTML = data.map(d => `
      <tr>
        <td>
          <div style="font-weight: 600;">${d.dataDMY}</div>
          <div style="font-size: 0.8rem; color: #64748b;">${d.weekdayPT}</div>
        </td>
        <td class="${d.real === null ? 'text-muted' : ''}">
          ${d.real === null ? '-' : formatNumberPt(d.real)}
        </td>
        <td class="fw-bold-green">${formatNumberPt(d.demandaPrevista)}</td>
        <td>${formatNumberPt(d.mediaDiaSemana)}</td>
        <td>${formatNumberPt(d.medianaDiaSemana)}</td>
        <td class="${d.erroAbs === null ? 'text-muted' : 'fw-bold-dark'}">
          ${d.erroAbs === null ? '-' : formatNumberPt(d.erroAbs)}
        </td>
      </tr>
    `).join('');
  } else {
    // Visão de Dimensionamento
    tbody.innerHTML = data.map(d => `
      <tr>
        <td>
          <div style="font-weight: 600;">${d.dataDMY}</div>
          <div style="font-size: 0.8rem; color: #64748b;">${d.weekdayPT}</div>
        </td>
        <td class="dim-cell atendentes">
          <i class="fas fa-user" style="color: #8b5cf6;"></i>
          ${formatNumberPt(d.atendentes)}
        </td>
        <td class="dim-cell demanda">
          <i class="fas fa-bolt" style="color: #10b981;"></i>
          ${formatNumberPt(d.demandaPrevista)}
        </td>
        <td class="dim-cell modelo">
          <i class="fas fa-cogs" style="color: #f59e0b;"></i>
          ${d.modelo || '-'}
        </td>
        <td class="dim-cell produtividade">
          <i class="fas fa-chart-line" style="color: #6366f1;"></i>
          ${d.produtividade ? d.produtividade + '/h' : '-'}
        </td>
        <td class="dim-cell real">
          <i class="fas fa-check-circle" style="color: #${d.real === null ? '94a3b8' : '10b981'}"></i>
          ${d.real === null ? 'Pendente' : formatNumberPt(d.real)}
        </td>
      </tr>
    `).join('');
  }
}

// -------------------------
// Exportações (CSV / PDF)
// -------------------------
function getCurrentContext() {
  const unitEl = document.getElementById('forecastUnit');
  const horizonEl = document.getElementById('forecastHorizon');
  const selectedUnit = unitEl?.value || 'unidade';
  const horizonValue = parseInt(horizonEl?.value || '30', 10);
  return { selectedUnit, horizonValue };
}

function buildCsvFromRows(rows, mode = currentViewMode) {
  let header, lines;
  
  if (mode === 'performance') {
    header = ['Data', 'Dia Semana', 'Real', 'Previsao', 'Media_dia_semana', 'Mediana_dia_semana', 'Erro_Absoluto'];
    lines = [header.join(';')];
    for (const r of (rows || [])) {
      const line = [
        r.dataDMY,
        r.weekdayPT,
        (r.real ?? ''),
        (r.demandaPrevista ?? ''),
        (r.mediaDiaSemana ?? ''),
        (r.medianaDiaSemana ?? ''),
        (r.erroAbs ?? '')
      ].join(';');
      lines.push(line);
    }
  } else {
    header = ['Data', 'Dia Semana', 'Atendentes_Necessarios', 'Demanda_Prevista', 'Modelo', 'Produtividade_Ref', 'Real'];
    lines = [header.join(';')];
    for (const r of (rows || [])) {
      const line = [
        r.dataDMY,
        r.weekdayPT,
        (r.atendentes ?? ''),
        (r.demandaPrevista ?? ''),
        (r.modelo ?? ''),
        (r.produtividade ?? ''),
        (r.real ?? '')
      ].join(';');
      lines.push(line);
    }
  }
  
  return '\ufeff' + lines.join('\n');
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadCurrentCSV() {
  const { selectedUnit, horizonValue } = getCurrentContext();
  const viewMode = currentViewMode === 'performance' ? 'performance' : 'dimensionamento';
  const fname = `previsao_${sanitizeFilename(selectedUnit)}_${viewMode}_${horizonValue}dias.csv`;
  const csv = buildCsvFromRows(currentFilteredRows);
  downloadBlob(fname, csv, 'text/csv;charset=utf-8;');
}

function downloadCurrentPDF() {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert('Não foi possível gerar o PDF (jsPDF não carregou).');
    return;
  }

  const { selectedUnit, horizonValue } = getCurrentContext();
  const viewMode = currentViewMode === 'performance' ? 'Performance' : 'Dimensionamento';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const marginLeft = 40;
  doc.setFontSize(14);
  doc.text(`BRISA - Detalhamento de ${viewMode}`, marginLeft, 40);
  doc.setFontSize(10);
  doc.text(`Unidade: ${selectedUnit}   |   Horizonte: ${horizonValue} dias`, marginLeft, 60);

  let head, body;
  
  if (currentViewMode === 'performance') {
    head = [['Data', 'Dia Semana', 'Real', 'Previsão', 'Média (dia)', 'Mediana (dia)', 'Erro Absoluto']];
    body = (currentFilteredRows || []).map(r => ([
      r.dataDMY,
      r.weekdayPT,
      formatNumberPt(r.real),
      formatNumberPt(r.demandaPrevista),
      formatNumberPt(r.mediaDiaSemana),
      formatNumberPt(r.medianaDiaSemana),
      formatNumberPt(r.erroAbs)
    ]));
  } else {
    head = [['Data', 'Dia Semana', 'Atendentes', 'Demanda Prevista', 'Modelo', 'Produtividade/h', 'Real']];
    body = (currentFilteredRows || []).map(r => ([
      r.dataDMY,
      r.weekdayPT,
      formatNumberPt(r.atendentes),
      formatNumberPt(r.demandaPrevista),
      r.modelo || '',
      r.produtividade ? r.produtividade + '/h' : '',
      formatNumberPt(r.real)
    ]));
  }

  if (typeof doc.autoTable !== 'function') {
    alert('Não foi possível gerar o PDF (autoTable não carregou).');
    return;
  }

  doc.autoTable({
    head,
    body,
    startY: 80,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const fname = `previsao_${sanitizeFilename(selectedUnit)}_${currentViewMode}_${horizonValue}dias.pdf`;
  doc.save(fname);
}

function initDownloadButtons() {
  const btnCsv = document.getElementById('btnDownloadCSV');
  const btnPdf = document.getElementById('btnDownloadPDF');
  if (btnCsv) btnCsv.addEventListener('click', downloadCurrentCSV);
  if (btnPdf) btnPdf.addEventListener('click', downloadCurrentPDF);
}

// -------------------------
// Gráfico
// -------------------------
function renderizarGrafico(dados) {
  const canvas = document.getElementById('forecastChartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (forecastChart) forecastChart.destroy();

  const labels = dados.map(d => d.dataDMY);

  // Carregar preferências
  const prefs = loadSeriesPrefs();

  const dsPrevisto = {
    seriesKey: 'previsto',
    label: 'Previsto',
    data: dados.map(d => d.demandaPrevista),
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    fill: true,
    tension: 0.35,
    borderWidth: 3,
    pointRadius: 3,
    pointHoverRadius: 6,
    hidden: !prefs.previsto
  };

  const dsReal = {
    seriesKey: 'real',
    label: 'Real',
    data: dados.map(d => d.real),
    borderColor: '#10b981',
    backgroundColor: 'transparent',
    fill: false,
    tension: 0.15,
    borderWidth: 2,
    borderDash: [5, 5],
    pointRadius: 3,
    pointHoverRadius: 6,
    hidden: !prefs.real
  };

  const dsMedia = {
    seriesKey: 'media',
    label: 'Média (dia)',
    data: dados.map(d => d.mediaDiaSemana),
    borderColor: '#0ea5e9',
    backgroundColor: 'transparent',
    fill: false,
    tension: 0,
    borderWidth: 2,
    pointRadius: 0,
    hidden: !prefs.media
  };

  const dsMediana = {
    seriesKey: 'mediana',
    label: 'Mediana (dia)',
    data: dados.map(d => d.medianaDiaSemana),
    borderColor: '#f59e0b',
    backgroundColor: 'transparent',
    fill: false,
    tension: 0,
    borderWidth: 2,
    pointRadius: 0,
    hidden: !prefs.mediana
  };

  forecastChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [dsPrevisto, dsReal, dsMedia, dsMediana]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: '#1e293b',
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 14 },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              label += formatNumberPt(context.parsed.y);
              return label;
            }
          }
        }
      },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: function(value) {
              return value.toLocaleString('pt-BR');
            }
          }
        },
        x: { 
          grid: { display: false },
          ticks: {
            maxRotation: 45
          }
        }
      }
    }
  });
}


// -------------------------
// Inicialização
// -------------------------
document.addEventListener('DOMContentLoaded', () => {
  initDownloadButtons();
  carregarDados();
});