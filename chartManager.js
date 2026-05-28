/**
 * Manages the Chart.js instance for the Doughnut chart
 */

class ChartManager {
    constructor(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) throw new Error("Canvas element not found for chart");
        
        // Tailwind defaults and styling for Chart
        Chart.defaults.color = '#94a3b8'; // slate-400
        Chart.defaults.font.family = "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Sobrante'],
                datasets: [{
                    data: [1], // Default dummy data if empty
                    backgroundColor: ['#f1f5f9'], // slate-100
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Make doughnut thinner for modern look
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b', // slate-800
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            size: 13,
                            weight: 'normal'
                        },
                        bodyFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }

    updateChart(monthlyIncome, expenses, remaining) {
        const chartEmptyState = document.getElementById('chartEmptyState');
        
        // If no income and no expenses, show empty state
        if (monthlyIncome <= 0 && expenses.length === 0) {
            chartEmptyState.style.opacity = '1';
            this.chart.data.labels = ['Sin datos'];
            this.chart.data.datasets[0].data = [1];
            this.chart.data.datasets[0].backgroundColor = ['transparent'];
            this.chart.update();
            return;
        }

        chartEmptyState.style.opacity = '0';

        const labels = expenses.map(e => e.name);
        const dataInfo = expenses.map(e => e.amount);
        const bgColors = expenses.map(e => e.color);

        // Add remaining budget as a segment to complete the pie if positive
        if (remaining > 0) {
            labels.push('Sobrante disponible');
            dataInfo.push(remaining);
            bgColors.push('#34d399'); // brand-mint green
        }

        // Complete empty circle with grey if no expenses but has income
        if (expenses.length === 0 && monthlyIncome > 0) {
            labels.length = 0;
            dataInfo.length = 0;
            bgColors.length = 0;
            labels.push('Sobrante');
            dataInfo.push(monthlyIncome);
            bgColors.push('#34d399');
        }

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = dataInfo;
        this.chart.data.datasets[0].backgroundColor = bgColors;
        
        this.chart.update();
    }
}
