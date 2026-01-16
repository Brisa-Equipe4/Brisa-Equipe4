<h1 align="center">
  🚀 Residência em TIC16 - Equipe 4
</h1>

<h3 align="center">
  Modelo de IA para Previsão de Demanda - EQTLab
</h3>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python&logoColor=white">
  <img alt="VS Code" src="https://img.shields.io/badge/VS_Code-Editor-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white">
  <img alt="Data Science" src="https://img.shields.io/badge/Data%20Science-Analysis-orange?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/Status-Concluído-success?style=for-the-badge">
</p>

<p align="center">
  <a href="#-sobre-o-projeto">Sobre</a> •
  <a href="#-tecnologias-e-modelos">Tecnologias</a> •
  <a href="#-metodologia">Metodologia</a> •
  <a href="#-funcionalidades-do-sistema">Funcionalidades</a> •
  <a href="#-parceiros">Parceiros</a>
</p>

---

## 📄 Sobre o Projeto

Este projeto foi desenvolvido ao longo de seis meses de imersão durante a **Residência em TIC16**, com o objetivo de fomentar a inovação e criar sistemas eficientes para o setor energético.

O foco principal foi o desenvolvimento de um mecanismo de **Inteligência Artificial (IA)** capaz de predizer demandas quantitativas para um conjunto de **69 unidades** filiadas à empresa **EQTLab**. O sistema visa otimizar o planejamento e a alocação de recursos baseando-se em dados históricos e preditivos.

### 📊 Dados Utilizados
O modelo foi treinado com bases de dados fornecidas pela parceira, compreendendo:
* **Fase Inicial:** 3 meses de dados (05/2025 a 07/2025).
* **Fase Final (Produção):** Série histórica completa de **02/01/2023 a 16/10/2025**.

---

## 🛠 Tecnologias e Modelos

O projeto foi desenvolvido utilizando **Python** no ambiente **VS Code**. Abaixo estão os principais modelos e métricas aplicados:

### 🤖 Modelos de Machine Learning
Para garantir a melhor assertividade, testamos e implementamos diversos algoritmos:
* LightGBM
* XGBoost
* Random Forest
* Prophet (Séries Temporais)
* Redes Neurais (Neural Networks)
* Regressão Linear

### 📉 Métricas de Avaliação
A performance dos modelos foi validada utilizando as seguintes métricas:
* **MAE** (Erro Médio Absoluto)
* **MAPE** (Erro Percentual Absoluto Médio)
* **RMSE** (Raiz do Erro Quadrático Médio)
* **R²** (Coeficiente de Determinação)

---

## 🔬 Metodologia

A abordagem científica do projeto seguiu etapas rigorosas de validação de dados:

1.  **Divisão de Dados:** 80% para Treinamento | 20% para Teste.
2.  **Validação Cruzada:** Aplicação de *Time Series Cross-Validation*.
3.  **Janela Deslizante:** Uso de *Rolling Window Validation* para testar a robustez do modelo ao longo do tempo.

> **Cronograma de Execução:**
> * **Meses 1-2:** Imersão, levantamento de requisitos e estudos preliminares.
> * **Mês 3:** Desenvolvimento dos scripts iniciais e treinamento dos modelos.
> * **Meses 4-6:** Refinamento, limpeza avançada de dados e desenvolvimento do Sistema Web.

---

## 💻 Funcionalidades do Sistema Web

Como entrega final, desenvolvemos uma plataforma web integrada para uso dos colaboradores da EQTLab, oferecendo:

* ✅ **Previsões Multi-horizonte:** Predições para 7, 14 e 30 dias.
* ✅ **Modelagem Individual:** Modelos de previsão ajustados especificamente para cada uma das 69 agências.
* ✅ **Comparativo Real vs. Previsto:** Visualização clara da demanda predita em comparação com o realizado.
* ✅ **Retreino Manual:** Funcionalidade que permite inserir novos dados e recalibrar os modelos.
* ✅ **Dashboard de Métricas:** Painel visual para acompanhar o comportamento e a precisão dos modelos.
* ✅ **Análise de Serviços:** Aba dedicada para visualizar os serviços mais solicitados por unidade.

---

## 🤝 Parceiros

A realização deste projeto só foi possível graças à colaboração entre:

| FAPEMA | BRISA | EQTLab |
| :---: | :---: | :---: |
| Fomento à Pesquisa | Inovação Tecnológica | Parceiro Comercial |

---

<p align="center">
  Desenvolvido pela <strong>Equipe 4</strong> - Residência em TIC16 🚀
</p>
