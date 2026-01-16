// Ajustado para ler o arquivo único de treinamentos
const PATH_RESUMO = 'resumo_modelos_vencedores.csv';

let metricsData = [];
let radarChartInstance = null;
let barChartInstance = null;
let featureImportanceInstance = null;

// 1. Dicionário de Features para Tooltips (Item 2 solicitado)
const featureDescriptions = {
    "ewm_7": "Média Móvel Exponencial (7 dias): Dá mais peso aos dias mais recentes.",
    "roll_mean_7": "Média Móvel Simples (7 dias): Tendência da última semana.",
    "roll_mean_14": "Média Móvel Simples (14 dias): Tendência da quinzena.",
    "roll_std_7": "Desvio Padrão (7 dias): Indica a volatilidade da carga na semana.",
    "is_holiday": "Feriado: Indica se o dia é um feriado oficial.",
    "pre_holiday": "Véspera de Feriado: Dias que antecedem feriados.",
    "post_holiday": "Pós-Feriado: Primeiro dia útil após o descanso.",
    "periodo_festas": "Festas: Período de Natal, Ano Novo ou Carnaval.",
    "day_of_year_sin": "Sazonalidade Anual (Seno): Ciclo temporal do dia no ano.",
    "day_of_year_cos": "Sazonalidade Anual (Cosseno): Ciclo temporal do dia no ano.",
    "dow": "Dia da Semana: Identifica o comportamento por dia (seg-dom).",
    "month": "Mês: Sazonalidade mensal do consumo.",
    "day": "Dia do Mês: Efeito de sazonalidade interna do mês."
};

const featureImportanceData = {
    labels: ["ewm_7", "roll_mean_7", "roll_mean_14", "roll_std_7", "is_holiday", "pre_holiday", "post_holiday", "periodo_festas", "day_of_year_sin", "day_of_year_cos", "dow", "month", "day"],
    values: [0.18, 0.15, 0.12, 0.08, 0.10, 0.06, 0.05, 0.07, 0.06, 0.05, 0.04, 0.03, 0.01]
};

function toggleSidebar() {
    $('#sidebar').toggleClass('collapsed');
}

function formatValue(val, digits = 2) {
    if (val === undefined || val === null || val === '') return '–';
    let n = parseFloat(String(val).replace(',', '.'));
    return isNaN(n) ? '–' : n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// 2. Lógica de Saúde do Modelo com Justificativa (Item 4 solicitado)
function updateHealthStatus(d) {
    const card = document.getElementById('healthCard');
    const statusText = document.getElementById('healthStatus');
    const reasonText = document.getElementById('healthReason');
    const icon = document.getElementById('healthIcon');
    
    if (!card || !statusText || !reasonText || !icon) return;

    const mape = parseFloat(String(d.mape).replace(',', '.'));
    const r2 = parseFloat(String(d.r2).replace(',', '.'));
    
    let status, color, iconClass, reason;

    if (mape <= 10 && r2 >= 0.90) {
        status = "EXCELENTE";
        color = "#10b981";
        iconClass = "fa-check-circle";
        reason = `O modelo apresenta altíssima precisão (R² de ${(r2*100).toFixed(1)}%) e erro médio muito baixo. Altamente confiável para operação.`;
    } 
    else if (mape <= 15) {
        status = "ESTÁVEL";
        color = "#3b82f6";
        iconClass = "fa-circle-info";
        reason = "A performance está dentro da média histórica. As previsões seguem a tendência da carga com desvios aceitáveis.";
    }
    else if (mape <= 25) {
        status = "OBSERVAÇÃO";
        color = "#f59e0b";
        iconClass = "fa-triangle-exclamation";
        reason = `O erro de ${mape.toFixed(1)}% sugere que fatores externos ou ruídos recentes na carga estão dificultando a precisão do ${d.modelo_vencedor}.`;
    } 
    else {
        status = "REQUER ATENÇÃO";
        color = "#ef4444";
        iconClass = "fa-circle-xmark";
        reason = `Aderência insuficiente (R²: ${(r2*100).toFixed(1)}%). Recomenda-se revisar os dados de entrada ou forçar um retreinamento do modelo.`;
    }

    statusText.textContent = status;
    statusText.style.color = color;
    reasonText.textContent = reason;
    card.style.borderLeftColor = color;
    icon.innerHTML = `<i class="fas ${iconClass}" style="color: ${color};"></i>`;
}

async function loadMetricsData() {
    try {
        const response = await fetch(PATH_RESUMO);
        const csvText = await response.text();
        metricsData = Papa.parse(csvText, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;

        const units = [...new Set(metricsData.map(r => r.unidade))].filter(u => u).sort();
        const select = $('#unitMetrics');
        units.forEach(u => select.append(new Option(u, u)));

        $('.searchable-select').select2({ width: '100%' });
        $('#unitMetrics').on('change', updateView);

        if (units.length > 0) select.val(units[0]).trigger('change');
    } catch (err) {
        console.error("Erro ao carregar CSV:", err);
        document.getElementById('bestModelName').textContent = "Erro ao carregar CSV";
    }
}

function updateView() {
    const unit = $('#unitMetrics').val();
    if (!unit) return;

    const data = metricsData.find(r => r.unidade === unit);
    if (!data) return;

    document.getElementById('bestModelName').textContent = data.modelo_vencedor;
    document.getElementById('kpiMAE').textContent = formatValue(data.mae);
    document.getElementById('kpiMAPE').textContent = formatValue(data.mape) + "%";
    document.getElementById('kpiRMSE').textContent = formatValue(data.rmse);
    document.getElementById('kpiR2').textContent = formatValue(data.r2, 3);

    // Atualiza o Status de Saúde passando o objeto completo para análise de MAPE e R2
    updateHealthStatus(data);
    
    renderCharts(data, unit);
}

function renderCharts(d, label) {
    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    if (radarChartInstance) radarChartInstance.destroy();
    radarChartInstance = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['MAE', 'MAPE (%)', 'RMSE', 'R² (x100)'],
            datasets: [{
                label: label,
                data: [d.mae, d.mape, d.rmse, (d.r2 || 0) * 100],
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: '#6366f1',
                pointBackgroundColor: '#6366f1'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true } } }
    });

    const ctxBar = document.getElementById('barChartMetrics').getContext('2d');
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['MAE', 'MAPE (%)', 'RMSE', 'R² (x100)'],
            datasets: [{
                label: 'Erros (Esquerda)',
                data: [d.mae, d.mape, d.rmse, null],
                backgroundColor: ['#3b82f6', '#10b981', '#ef4444'],
                yAxisID: 'y',
                borderRadius: 4
            }, {
                label: 'R² (Direita)',
                data: [null, null, null, (d.r2 || 0) * 100],
                backgroundColor: '#f59e0b',
                yAxisID: 'y1',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { type: 'linear', position: 'left', title: { display: true, text: 'Valor de Erro' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'R² (%)' }, min: 0, max: 100, grid: { drawOnChartArea: false } }
            }
        }
    });
}

function renderFeatureImportanceChart() {
    const canvas = document.getElementById("featureImportanceChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (featureImportanceInstance) featureImportanceInstance.destroy();

    featureImportanceInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: featureImportanceData.labels,
            datasets: [{
                label: "Importância Relativa",
                data: featureImportanceData.values,
                backgroundColor: featureImportanceData.labels.map(l => 
                    l.includes("ewm") || l.includes("roll") ? "#6366f1" : 
                    l.includes("holiday") || l.includes("festas") ? "#10b981" : "#94a3b8"),
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` Importância: ${(ctx.raw * 100).toFixed(1)}%`,
                        // Injeta a descrição do dicionário no tooltip
                        afterLabel: (ctx) => `\n${featureDescriptions[ctx.label] || ''}`
                    }
                }
            },
            scales: {
                x: { ticks: { callback: v => `${(v * 100).toFixed(0)}%` }, grid: { color: "#f1f5f9" } },
                y: { grid: { display: false } }
            }
        }
    });
}

// Inicialização Unificada (removido duplicidade de DOMContentLoaded e ready)
$(document).ready(function() {
    loadMetricsData();
    renderFeatureImportanceChart();
});