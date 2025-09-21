const BACKEND_URL = "https://legaldocu.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    // Theme toggle functionality
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = themeToggle.querySelector(".theme-icon");

    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    }

    // File upload functionality
    const uploadInput = document.getElementById('uploadInput');
    const documentDisplay = document.getElementById('documentDisplay');
    const documentName = document.getElementById('documentName');
    const documentMeta = document.getElementById('documentMeta');
    const documentRemove = document.getElementById('documentRemove');

    let currentFile = null;

    uploadInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            currentFile = file;
            documentName.textContent = file.name;
            documentMeta.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB • ${file.type || 'Unknown type'}`;
            documentDisplay.classList.add('active');
            
            // Auto-analyze the uploaded file
            analyzeDocument();
        }
    });

    documentRemove.addEventListener('click', function() {
        documentDisplay.classList.remove('active');
        uploadInput.value = '';
        currentFile = null;
        clearResults();
    });

    // Search/Analysis functionality
    const searchInput = document.getElementById("searchInput");
    const loader = document.getElementById("loader");
    const results = document.getElementById("results");

    // Update placeholder text for legal context
    searchInput.placeholder = "Enter legal text to analyze or ask a question about uploaded document";

    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            if (currentFile) {
                analyzeDocument(searchInput.value.trim());
            } else {
                analyzeText();
            }
        }
    });

    function analyzeText() {
        const text = searchInput.value.trim();
        if (!text) return;

        showLoader("Analyzing legal text...");
        
        fetch(`${BACKEND_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        })
        .then(response => response.json())
        .then(data => {
            hideLoader();
            if (data.error) {
                displayError(data.message);
            } else {
                displayAnalysisResults(data);
            }
        })
        .catch(error => {
            hideLoader();
            console.error('Analysis error:', error);
            displayError('Failed to analyze text. Please try again.');
        });
    }

    function analyzeDocument(query = null) {
        if (!currentFile) return;

        showLoader("Processing document...");

        const formData = new FormData();
        formData.append('document', currentFile);
        if (query) {
            formData.append('query', query);
        }

        fetch(`${BACKEND_URL}/upload`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            hideLoader();
            if (data.error) {
                displayError(data.message);
            } else {
                displayAnalysisResults(data);
            }
        })
        .catch(error => {
            hideLoader();
            console.error('Document analysis error:', error);
            displayError('Failed to analyze document. Please try again.');
        });
    }

    function showLoader(message) {
        loader.querySelector('p').textContent = message;
        loader.classList.remove("hidden");
        results.innerHTML = "";
    }

    function hideLoader() {
        loader.classList.add("hidden");
    }

    function clearResults() {
        results.innerHTML = '<p class="no-results">No analysis results yet. Upload a document or enter text to analyze.</p>';
        document.querySelector('.incidents-container').innerHTML = '<p class="no-incidents">Analysis results will appear here.</p>';
    }

    function displayError(message) {
        results.innerHTML = `
            <div class="error-message">
                <h3>Analysis Error</h3>
                <p>${message}</p>
            </div>
        `;
        results.classList.add('active');
    }

    function displayAnalysisResults(data) {
        // Display simplified analysis
        results.innerHTML = `
            <div class="analysis-results">
                <div class="simplified-section">
                    <h3>📋 Simplified Analysis</h3>
                    <div class="simplified-text">${data.simplified}</div>
                </div>
                
                <div class="risk-section">
                    <h3>⚠️ Risk Assessment</h3>
                    <div class="overall-risk risk-${data.riskAssessment.overallRisk}">
                        Overall Risk Level: <strong>${data.riskAssessment.overallRisk.toUpperCase()}</strong>
                    </div>
                    ${data.riskAssessment.riskFactors.map(factor => `
                        <div class="risk-factor">
                            <div class="risk-header">
                                <span class="risk-clause">${factor.clause}</span>
                                <span class="risk-level risk-${factor.risk}">${factor.risk}</span>
                            </div>
                            <p class="risk-explanation">${factor.explanation}</p>
                            <p class="risk-impact"><strong>Impact:</strong> ${factor.impact}</p>
                        </div>
                    `).join('')}
                </div>

                ${data.keyTerms && data.keyTerms.length > 0 ? `
                    <div class="terms-section">
                        <h3>📖 Key Terms</h3>
                        ${data.keyTerms.map(term => `
                            <div class="key-term">
                                <h4>${term.term}</h4>
                                <p>${term.definition}</p>
                                <small><strong>Why it matters:</strong> ${term.importance}</small>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${data.actionItems && data.actionItems.length > 0 ? `
                    <div class="actions-section">
                        <h3>✅ Action Items</h3>
                        ${data.actionItems.map(action => `
                            <div class="action-item priority-${action.priority}">
                                <div class="action-header">
                                    <span class="action-text">${action.action}</span>
                                    <span class="priority-badge">${action.priority}</span>
                                </div>
                                ${action.deadline ? `<p class="deadline">Deadline: ${action.deadline}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${data.warnings && data.warnings.length > 0 ? `
                    <div class="warnings-section">
                        <h3>🚨 Important Warnings</h3>
                        ${data.warnings.map(warning => `
                            <div class="warning-item">${warning}</div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        results.classList.add('active');

        // Update incidents section with analysis metadata
        const incidentsContainer = document.querySelector('.incidents-container');
        incidentsContainer.innerHTML = `
            <div class="analysis-metadata">
                <h3>📊 Analysis Details</h3>
                <div class="metadata-grid">
                    <div class="metadata-item">
                        <strong>Analyzed:</strong> ${new Date(data.metadata.timestamp).toLocaleString()}
                    </div>
                    ${data.metadata.fileName ? `
                        <div class="metadata-item">
                            <strong>File:</strong> ${data.metadata.fileName}
                        </div>
                    ` : ''}
                    <div class="metadata-item">
                        <strong>Text Length:</strong> ${data.metadata.textLength} characters
                    </div>
                    <div class="metadata-item">
                        <strong>Risk Level:</strong> <span class="risk-${data.riskAssessment.overallRisk}">${data.riskAssessment.overallRisk}</span>
                    </div>
                </div>
            </div>
        `;

        // Update charts with risk data
        updateChartsWithRiskData(data);
    }

    function updateChartsWithRiskData(data) {
        // Count risk levels
        const riskCounts = { high: 0, medium: 0, low: 0 };
        data.riskAssessment.riskFactors.forEach(factor => {
            riskCounts[factor.risk]++;
        });

        // Update violations chart with risk factors
        const violationsCtx = document.getElementById("violationsChart");
        if (violationsCtx) {
            new Chart(violationsCtx, {
                type: "bar",
                data: {
                    labels: ["High Risk", "Medium Risk", "Low Risk"],
                    datasets: [{
                        label: "Risk Factors",
                        data: [riskCounts.high, riskCounts.medium, riskCounts.low],
                        backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
                        borderRadius: 4,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true },
                    },
                },
            });
        }

        // Update penalty chart with action items priority
        const actionCounts = { high: 0, medium: 0, low: 0 };
        if (data.actionItems) {
            data.actionItems.forEach(action => {
                actionCounts[action.priority]++;
            });
        }

        const penaltyCtx = document.getElementById("penaltyChart");
        if (penaltyCtx) {
            new Chart(penaltyCtx, {
                type: "doughnut",
                data: {
                    labels: ["High Priority", "Medium Priority", "Low Priority"],
                    datasets: [{
                        data: [actionCounts.high, actionCounts.medium, actionCounts.low],
                        backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
                        borderWidth: 0,
                        cutout: "70%",
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: { usePointStyle: true, padding: 15 }
                        }
                    }
                }
            });
        }
    }

    // Update section titles for legal context
    document.querySelector('.content-section h2').textContent = 'Legal Analysis';
    document.querySelectorAll('.content-section h2')[1].textContent = 'Analysis Summary';
    document.querySelectorAll('.content-section h2')[2].textContent = 'Risk Overview';

    // Update chart titles
    document.querySelector('.chart-header h3').textContent = 'Risk Factors';
    document.querySelectorAll('.chart-header h3')[1].textContent = 'Action Priority';

    // Initialize with empty state
    clearResults();
});