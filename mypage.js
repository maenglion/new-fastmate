// mypage.js

// Global Variables and state
let userData = {
    nickname: localStorage.getItem("userNickname") || "게스트",
    totalFastingTime: parseFloat(localStorage.getItem("totalFastingTime")) || 0,
    successRecords: JSON.parse(localStorage.getItem("successRecords")) || []
};
let weightLog = JSON.parse(localStorage.getItem("weightLog")) || [];
let fastingTargetHours = parseInt(localStorage.getItem("fastingTargetHours")) || 16;

// Helper functions
function showAlert(message) {
    const modal = document.getElementById('alertModal');
    const messageEl = document.getElementById('alertMessage');
    if (modal && messageEl) {
        messageEl.innerText = message;
        modal.style.display = 'flex';
    }
}

function notify(message) {
    if (Notification.permission === "granted") {
        new Notification("간헐적 단식 앱", { body: message });
    }
}
if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.toggle("open");
    }
}

// Main functionality functions
function saveWeight() {
    const weightDateInput = document.getElementById("weightDate");
    const weightInput = document.getElementById("weight");

    const date = weightDateInput.value;
    let weight = parseFloat(weightInput.value);

    if (!date || !weight) {
        showAlert("날짜와 체중을 모두 입력해 주세요.");
        return;
    }
    
    // Check if the date already exists and replace it
    const existingIndex = weightLog.findIndex(item => item.date === date);
    if (existingIndex > -1) {
        weightLog[existingIndex] = { date: date, weight: weight };
    } else {
        weightLog.push({ date: date, weight: weight });
    }
    
    // Sort log by date to ensure proper chart display
    weightLog.sort((a, b) => new Date(a.date) - new Date(b.date));

    localStorage.setItem("weightLog", JSON.stringify(weightLog));
    updateCharts();
    weightInput.value = "";
    weightDateInput.value = "";

    const weightHistoryEl = document.getElementById("weightHistory");
    if (weightHistoryEl) {
        weightHistoryEl.innerText = weightLog.map(e => `${e.date}: ${e.weight}kg`).join(", ");
    }
    notify("체중이 저장되었어요!");
}

function updateUserRecords() {
    const userNicknameEl = document.getElementById("userNickname");
    const totalFastingTimeEl = document.getElementById("totalFastingTime");
    const fastingSuccessListEl = document.getElementById("fastingSuccessList");

    if (userNicknameEl) userNicknameEl.innerText = userData.nickname;
    if (totalFastingTimeEl) totalFastingTimeEl.innerText = `${userData.totalFastingTime.toFixed(2)}시간`;
    
    if (fastingSuccessListEl) {
        fastingSuccessListEl.innerHTML = "";
        if (userData.successRecords.length === 0) {
            const li = document.createElement("li");
            li.innerText = "아직 기록이 없어요!";
            fastingSuccessListEl.appendChild(li);
        } else {
            userData.successRecords.forEach(record => {
                const li = document.createElement("li");
                let recordText = `${record.date}: ${record.duration}시간 단식 (${record.message})`;
                if (!record.success && record.duration > 0) {
                     const percent = Math.min(100, (record.duration / fastingTargetHours * 100)).toFixed(0);
                     recordText += ` (달성률 ${percent}%)`;
                }
                li.innerText = recordText;
                fastingSuccessListEl.appendChild(li);
            });
        }
    }
}

function updateCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    let calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        events: userData.successRecords.map(e => {
            const percent = Math.min(100, (e.duration / fastingTargetHours * 100)).toFixed(0);
            return {
                title: e.success ? '✅ 성공' : `❌ ${percent}%`,
                start: e.date,
                color: e.success ? '#1c8e3e' : '#d32f2f'
            };
        }),
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: '' // 'today' 버튼 제거
        }
    });
    calendar.render();
}

// 그래프 업데이트 함수
function updateCharts() {
    const fastingCtx = document.getElementById('fastingChart');
    if (fastingCtx) {
        if (window.fastingChartInstance) {
            window.fastingChartInstance.destroy();
        }
        window.fastingChartInstance = new Chart(fastingCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: userData.successRecords.map(e => e.date),
                datasets: [{
                    label: '단식 시간(시간)',
                    data: userData.successRecords.map(e => e.duration),
                    borderColor: '#1c8e3e',
                    backgroundColor: '#1c8e3e',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true
                        }
                    },
                    x: {
                         grid: {
                            display: true
                        }
                    }
                }
            }
        });
    }

    const weightCtx = document.getElementById('weightChart');
    if (weightCtx) {
        if (window.weightChartInstance) {
            window.weightChartInstance.destroy();
        }
        window.weightChartInstance = new Chart(weightCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: weightLog.map(e => e.date),
                datasets: [{
                    label: '체중(kg)',
                    data: weightLog.map(e => e.weight),
                    borderColor: '#f44336',
                    backgroundColor: '#f44336',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            display: true
                        }
                    },
                    x: {
                        grid: {
                            display: true
                        }
                    }
                }
            }
        });
    }
}

// Initialization on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    const weightHistoryEl = document.getElementById("weightHistory");
    if (weightHistoryEl) {
        weightHistoryEl.innerText = weightLog.map(e => `${e.date}: ${e.weight}kg`).join(", ");
    }
    
    updateUserRecords();
    updateCalendar();
    updateCharts();
    
    const menuButton = document.getElementById("menu-button");
    if (menuButton) {
        menuButton.addEventListener("click", toggleSidebar);
    }
    
    // Expose functions to the global scope for HTML onclick attributes
    window.toggleSidebar = toggleSidebar;
    window.saveWeight = saveWeight;
});
