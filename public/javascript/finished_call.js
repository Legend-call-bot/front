(function () {
    const callNumberEl = document.getElementById("callNumberText");
    const summaryEl = document.getElementById("callSummaryText");

    const storedNumber = localStorage.getItem("lastCallNumber");
    const storedSummary = localStorage.getItem("lastCallSummary");

    if (storedNumber && callNumberEl) {
        callNumberEl.textContent = storedNumber;
    }

    if (storedSummary && summaryEl) {
        summaryEl.textContent = storedSummary;
    } else if (summaryEl) {
        summaryEl.textContent = "통화 요약을 불러오는 중입니다...";
    }

    // 버튼 기능
    const callAgainBtn = document.querySelector(".call-again");
    const finishBtn = document.querySelector(".finish");

    if (callAgainBtn) {
        callAgainBtn.addEventListener("click", function () {
            window.location.href = "call_history.html";
        });
    }

    if (finishBtn) {
        finishBtn.addEventListener("click", function () {
            window.location.href = "call.html";
        });
    }
})();
