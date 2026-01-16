// Variável global para armazenar os dados combinados
let globalData = {};
let chartInstance = null;

// --- Funcionalidade da Sidebar ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// --- Carregamento Simultâneo dos CSVs ---
function init() {
    console.log("Iniciando leitura dos arquivos...");

    // Criamos duas promessas de leitura
    const p1 = new Promise((resolve, reject) => {
        Papa.parse('retreino_final.csv', {
            download: true,
            header: true,
            delimiter: ";", // Retreino usa ponto e vírgula
            skipEmptyLines: true,
            complete: (results) => resolve({ type: 'retreino', data: results.data }),
            error: (err) => reject(err)
        });
    });

    const p2 = new Promise((resolve, reject) => {
        Papa.parse('dataset.csv', {
            download: true,
            header: true,
            delimiter: ",", // Dataset usa vírgula
            skipEmptyLines: true,
            complete: (results) => resolve({ type: 'dataset', data: results.data }),
            error: (err) => reject(err)
        });
    });

    // Aguarda ambos carregarem
    Promise.all([p1, p2])
        .then((results) => {
            const retreinoData = results.find(r => r.type === 'retreino').data;
            const datasetData = results.find(r => r.type === 'dataset').data;
            
            processarDados(retreinoData, datasetData);
        })
        .catch(err => {
            console.error("Erro ao carregar CSVs:", err);
            const select = document.getElementById('unit-select');
            select.innerHTML = '<option>Erro ao carregar dados.</option>';
        });
}

function processarDados(retreinoRaw, datasetRaw) {
    globalData = {};

    // 1. Processa Retreino (Gráficos e Tabela Comparativa)
    retreinoRaw.forEach(row => {
        let unidade = row['unidade'];
        let modelo = row['modelo'];

        if (unidade) {
            unidade = unidade.trim();
            
            if (!globalData[unidade]) {
                globalData[unidade] = {
                    algorithm: modelo ? modelo.trim() : 'Desconhecido',
                    data: [],       // Dados do gráfico
                    lastDate: null  // Será preenchido pelo dataset
                };
            }

            const real = parseFloat(String(row['real']).replace(',', '.'));
            const estatico = parseFloat(String(row['estatico']).replace(',', '.'));
            const retreino = parseFloat(String(row['retreino']).replace(',', '.'));
            
            globalData[unidade].data.push({
                dia: row['data'],
                real: isNaN(real) ? 0 : real,
                estatico: isNaN(estatico) ? 0 : estatico,
                retreino: isNaN(retreino) ? 0 : retreino
            });
        }
    });

    // 2. Processa Dataset (Para achar a última data histórica)
    datasetRaw.forEach(row => {
        // dataset.csv: unidade,data,atendimento
        let unidade = row['unidade'];
        let dataStr = row['data'];

        if (unidade && dataStr) {
            unidade = unidade.trim();
            
            // Se a unidade existe no nosso objeto global
            if (globalData[unidade]) {
                // Compara para achar a data mais recente
                if (!globalData[unidade].lastDate || dataStr > globalData[unidade].lastDate) {
                    globalData[unidade].lastDate = dataStr;
                }
            }
        }
    });

    // Ordenação dos dados do gráfico
    for (const unit in globalData) {
        globalData[unit].data.sort((a, b) => new Date(a.dia) - new Date(b.dia));
    }

    popularSelect();
}

// --- Preencher Select ---
function popularSelect() {
    const select = document.getElementById('unit-select');
    select.innerHTML = ''; 

    const unidades = Object.keys(globalData).sort();
    
    if (unidades.length === 0) {
        select.innerHTML = '<option>Sem dados para exibir</option>';
        return;
    }

    unidades.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit.replace(/_/g, " "); 
        select.appendChild(option);
    });

    select.selectedIndex = 0;
    atualizarDados();
}

// --- Atualizar Interface ---
function atualizarDados() {
    const select = document.getElementById('unit-select');
    if (!select || !select.value) return;

    const unidade = select.value;
    const unitInfo = globalData[unidade];
    
    if (!unitInfo) return;

    const dados = unitInfo.data;
    const algoritmo = unitInfo.algorithm;

    // Atualiza Badges e Tabela Comparativa
    const tbody = document.getElementById('tabela-corpo');
    const badgeAlgo = document.getElementById('algo-display');
    
    badgeAlgo.innerHTML = `<i class="fas fa-microchip"></i> Algoritmo: ${algoritmo}`;

    tbody.innerHTML = '';
    let htmlRows = '';

    dados.forEach(row => {
        const partes = row.dia.split('-'); 
        const dataFormatada = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : row.dia;

        const errStat = Math.abs(row.real - row.estatico);
        const errRetr = Math.abs(row.real - row.retreino);
        const retrainWins = errRetr < errStat;
        const equal = (errStat == errRetr);
        const diff = Math.abs(row.retreino - row.estatico);

        const styleStat = !retrainWins && !equal ? 'color: #ef4444; font-weight:700;' : 'color: #64748b;'; 
        const styleRetr = retrainWins && !equal ? 'color: #10b981; font-weight:700;' : 'color: #64748b;';
        
        htmlRows += `
            <tr>
                <td>${dataFormatada}</td>
                <td style="font-weight:bold">${row.real}</td>
                <td style="${styleStat}">${row.estatico}</td>
                <td style="${styleRetr}">${row.retreino}</td>
                <td class="diff-text">${diff.toFixed(1)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = htmlRows;

    renderizarGrafico(dados);
    
    // AQUI: Chama a nova função com a última data do dataset
    gerarInputsFuturos(unitInfo.lastDate);
}

// --- Renderizar Gráfico ---
function renderizarGrafico(dados) {
    const ctxElement = document.getElementById('myChart');
    if (!ctxElement) return;
    
    const ctx = ctxElement.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = dados.map(d => {
        const p = d.dia.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}` : d.dia;
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Demanda Real', 
                    data: dados.map(d => d.real), 
                    borderColor: '#1e293b', 
                    backgroundColor: '#1e293b',
                    borderWidth: 3, 
                    tension: 0.3,
                    pointRadius: 3
                },
                { 
                    label: 'Modelo Estático', 
                    data: dados.map(d => d.estatico), 
                    borderColor: '#ef4444', 
                    borderDash: [5, 5], 
                    borderWidth: 2,
                    pointRadius: 0
                },
                { 
                    label: 'Modelo Retreinado', 
                    data: dados.map(d => d.retreino), 
                    borderColor: '#10b981', 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                    fill: true, 
                    borderWidth: 2,
                    pointRadius: 3
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { position: 'top' },
                tooltip: { callbacks: { title: (ctx) => `Data: ${ctx[0].label}` } }
            },
            scales: {
                y: { beginAtZero: false, grid: { color: '#e2e8f0' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- LÓGICA DE DATAS: Próximos 7 dias úteis após o dataset ---
function gerarInputsFuturos(lastDateStr) {
    const tbody = document.getElementById('inputs-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!lastDateStr) {
        tbody.innerHTML = '<tr><td colspan="2">Data do dataset não encontrada.</td></tr>';
        return;
    }

    // Calcular dias úteis
    const datasFuturas = getNextBusinessDays(lastDateStr, 7);
    
    let html = '';
    datasFuturas.forEach(dataIso => {
        html += `
            <tr>
                <td><input type="date" value="${dataIso}" tabindex="-1"></td>
                <td><input type="number" placeholder="Previsão..." min="0"></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// Função auxiliar para calcular dias úteis (pula Sábado e Domingo)
function getNextBusinessDays(startDateStr, count) {
    // Cria data segura evitando problemas de fuso horário (YYYY-MM-DD)
    const parts = startDateStr.split('-');
    // Nota: Mês em JS começa em 0
    let current = new Date(parts[0], parts[1] - 1, parts[2]);
    
    const dates = [];
    
    while (dates.length < count) {
        // Avança 1 dia
        current.setDate(current.getDate() + 1);
        
        const dayOfWeek = current.getDay();
        
        // 0 = Domingo, 6 = Sábado
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            // Formata YYYY-MM-DD
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
        }
    }
    return dates;
}



// Função para a Notificação Visual
function mostrarNotificacao(mensagem, tipo) {
    const toast = document.createElement('div');
    toast.className = `toast-notificacao ${tipo}`;
    toast.innerHTML = mensagem;
    
    document.body.appendChild(toast);

    // Remove após 3 segundos
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function showNotification() {
    let formularioValido = true;
    // Validação: Verifica se todos os campos de número estão preenchidos
    rows.forEach(row => {
        const dataInput = row.querySelector('input[type="date"]').value;
        const valorInput = row.querySelector('input[type="number"]').value;

        if (!valorInput || valorInput.trim() === "") {
            formularioValido = false;
        } else {
            novosDados.push({
                unidade: unidade,
                data: dataInput,
                atendimento: valorInput
            });
        }
    });

    //if (!formularioValido) {
        //mostrarNotificacao("Por favor, preencha todas as previsões antes de salvar.", "erro");
        //return; // Interrompe a execução aqui
    //}
    // Se chegou aqui, o formulário está devidamente preenchido
    mostrarNotificacao("Dados salvos e dataset atualizado com sucesso!", "sucesso");
}