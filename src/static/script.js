class ExamSystem {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 文件上传相关
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('upload-area');
        const startExamBtn = document.getElementById('start-exam-btn');

        // 移除 once: true 選項，允許多次上傳
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));

        startExamBtn.addEventListener('click', () => this.startExam());

        // 考试相关
        const submitAnswerBtn = document.getElementById('submit-answer-btn');
        const nextQuestionBtn = document.getElementById('next-question-btn');

        if (submitAnswerBtn) submitAnswerBtn.addEventListener('click', () => this.submitAnswer());
        if (nextQuestionBtn) nextQuestionBtn.addEventListener('click', () => this.nextQuestion());

        // 结果相关
        const viewDetailsBtn = document.getElementById('view-details-btn');
        const restartBtn = document.getElementById('restart-btn');
        const backToResultBtn = document.getElementById('back-to-result-btn');

        if (viewDetailsBtn) viewDetailsBtn.addEventListener('click', () => this.showDetails());
        if (restartBtn) restartBtn.addEventListener('click', () => this.restart());
        if (backToResultBtn) backToResultBtn.addEventListener('click', () => this.backToResult());
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('upload-area').classList.add('dragover');
    }

    handleFileDrop(e) {
        e.preventDefault();
        document.getElementById('upload-area').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    async processFile(file) {
        // 只支持 .docx 和 .doc 文件
        if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
            alert('請選擇 Word 文檔文件 (.docx 或 .doc)');
            return;
        }

        // 显示文件信息
        const fileInfo = document.getElementById('file-info');
        fileInfo.innerHTML = `
            <strong>已选择文件:</strong> ${file.name}<br>
            <strong>文件大小:</strong> ${(file.size / 1024).toFixed(2)} KB<br>
            <strong>状态:</strong> 正在解析...
        `;
        fileInfo.classList.remove('hidden');

        try {
            // 调用后端API解析文件
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/exam/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.questions = result.questions;
                fileInfo.innerHTML = `
                    <strong>已选择文件:</strong> ${file.name}<br>
                    <strong>文件大小:</strong> ${(file.size / 1024).toFixed(2)} KB<br>
                    <strong>状态:</strong> 解析成功<br>
                    <strong>题目数量:</strong> ${result.total_questions}<br>
                    <strong>总分:</strong> ${result.total_score}
                `;
                document.getElementById('start-exam-btn').classList.remove('hidden');
            } else {
                fileInfo.innerHTML = `
                    <strong>错误:</strong> ${result.error}
                `;
                fileInfo.style.background = '#f8d7da';
                fileInfo.style.borderColor = '#f5c6cb';
                fileInfo.style.color = '#721c24';
            }
        } catch (error) {
            fileInfo.innerHTML = `
                <strong>错误:</strong> 文件上传失败 - ${error.message}
            `;
            fileInfo.style.background = '#f8d7da';
            fileInfo.style.borderColor = '#f5c6cb';
            fileInfo.style.color = '#721c24';
        }
    }

    startExam() {
        console.log('開始考試，題目數量:', this.questions.length);
        console.log('題目數據:', this.questions);
        
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;

        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('exam-section').classList.remove('hidden');

        this.displayQuestion();
    }

    displayQuestion() {
        const question = this.questions[this.currentQuestionIndex];
        console.log('顯示題目:', question);
        
        // 更新进度
        document.getElementById('question-counter').textContent = 
            `第 ${this.currentQuestionIndex + 1} 题 / 共 ${this.questions.length} 题`;
        
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;

        // 更新当前得分
        document.getElementById('current-score').textContent = `当前得分: ${this.score}`;

        // 显示题目
        const questionTypeText = question.type === 'single' ? '单选题' : 
                                question.type === 'multiple' ? '多选题' : '判断题';
        document.getElementById('question-type').textContent = questionTypeText;
        document.getElementById('question-text').textContent = question.question;

        console.log('題目類型:', questionTypeText);
        console.log('題目內容:', question.question);
        console.log('選項數量:', question.options.length);

        // 显示选项
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = '';

        if (question.type === 'judge') {
            // 判断题特殊处理
            const options = ["正確", "錯誤"];
            options.forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option';
                
                optionDiv.innerHTML = `
                    <input type="radio" name="answer" value="${option}" id="option-${index}">
                    <label for="option-${index}">${option}</label>
                `;

                optionDiv.addEventListener('click', (e) => {
                    // 防止點擊 input 元素時重複觸發
                    if (e.target.type === 'radio') {
                        return;
                    }
                    
                    const input = optionDiv.querySelector('input');
                    // 判断题：清除其他选项的选中状态
                    document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
                    document.querySelectorAll('input[name="answer"]').forEach(inp => inp.checked = false);
                    input.checked = true;
                    optionDiv.classList.add('selected');
                    this.updateSubmitButton();
                });

                // 為 input 元素添加直接的事件監聽器
                const input = optionDiv.querySelector('input');
                input.addEventListener('change', () => {
                    // 判断题：清除其他选项的选中状态
                    document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
                    if (input.checked) {
                        optionDiv.classList.add('selected');
                    }
                    this.updateSubmitButton();
                });

                optionsContainer.appendChild(optionDiv);
            });
        } else {
            // 单选题和多选题
            question.options.forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option';
                
                const inputType = question.type === 'single' ? 'radio' : 'checkbox';
                const optionLetter = option.charAt(0);
                
                optionDiv.innerHTML = `
                    <input type="${inputType}" name="answer" value="${optionLetter}" id="option-${index}">
                    <label for="option-${index}">${option}</label>
                `;

                optionDiv.addEventListener('click', (e) => {
                    // 防止點擊 input 元素時重複觸發
                    if (e.target.type === 'radio' || e.target.type === 'checkbox') {
                        return;
                    }
                    
                    const input = optionDiv.querySelector('input');
                    if (question.type === 'single') {
                        // 单选题：清除其他选项的选中状态
                        document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
                        document.querySelectorAll('input[name="answer"]').forEach(inp => inp.checked = false);
                        input.checked = true;
                        optionDiv.classList.add('selected');
                    } else {
                        // 多选题：切换当前选项状态
                        input.checked = !input.checked;
                        optionDiv.classList.toggle('selected');
                    }
                    this.updateSubmitButton();
                });

                // 為 input 元素添加直接的事件監聽器
                const input = optionDiv.querySelector('input');
                input.addEventListener('change', () => {
                    if (question.type === 'single') {
                        // 单选题：清除其他选项的选中状态
                        document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
                        if (input.checked) {
                            optionDiv.classList.add('selected');
                        }
                    } else {
                        // 多选题：根據 checkbox 狀態更新樣式
                        if (input.checked) {
                            optionDiv.classList.add('selected');
                        } else {
                            optionDiv.classList.remove('selected');
                        }
                    }
                    this.updateSubmitButton();
                });

                optionsContainer.appendChild(optionDiv);
            });
        }

        // 重置按钮状态
        document.getElementById('submit-answer-btn').disabled = true;
        document.getElementById('answer-feedback').classList.add('hidden');
    }

    updateSubmitButton() {
        const checkedInputs = document.querySelectorAll('input[name="answer"]:checked');
        document.getElementById('submit-answer-btn').disabled = checkedInputs.length === 0;
    }

    submitAnswer() {
        const question = this.questions[this.currentQuestionIndex];
        const checkedInputs = document.querySelectorAll('input[name="answer"]:checked');
        const userAnswer = Array.from(checkedInputs).map(input => input.value).sort().join('');

        // 记录用户答案
        this.userAnswers.push(userAnswer);

        // 检查答案是否正确
        const isCorrect = userAnswer === question.answer;
        if (isCorrect) {
            this.score += question.score;
        }

        // 显示答案反馈
        this.showAnswerFeedback(isCorrect, question.answer);

        // 禁用提交按钮
        document.getElementById('submit-answer-btn').disabled = true;
    }

    showAnswerFeedback(isCorrect, correctAnswer) {
        const question = this.questions[this.currentQuestionIndex];
        const feedbackDiv = document.getElementById('answer-feedback');
        const feedbackResult = document.getElementById('feedback-result');
        const correctAnswerDiv = document.getElementById('correct-answer');

        feedbackResult.className = `feedback-result ${isCorrect ? 'correct' : 'wrong'}`;
        feedbackResult.textContent = isCorrect ? '✓ 回答正确！' : '✗ 回答错误';

        // 显示正确答案和解析
        let answerText = `正确答案: ${correctAnswer}`;
        if (question.explanation && question.explanation.trim() !== '') {
            answerText += `\n\n解析: ${question.explanation}`;
        }
        correctAnswerDiv.textContent = answerText;

        // 标记选项颜色
        document.querySelectorAll('.option').forEach(option => {
            const input = option.querySelector('input');
            const optionValue = input.value;
            
            if (question.type === 'judge') {
                // 判断题的正确答案处理
                if (optionValue === correctAnswer) {
                    option.classList.add('correct');
                } else if (input.checked) {
                    option.classList.add('wrong');
                }
            } else {
                // 单选题和多选题的处理
                if (correctAnswer.includes(optionValue)) {
                    option.classList.add('correct');
                } else if (input.checked) {
                    option.classList.add('wrong');
                }
            }
        });

        feedbackDiv.classList.remove('hidden');

        // 更新下一题按钮文字
        const nextBtn = document.getElementById('next-question-btn');
        if (this.currentQuestionIndex === this.questions.length - 1) {
            nextBtn.textContent = '查看结果';
        } else {
            nextBtn.textContent = '下一题';
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex === this.questions.length - 1) {
            this.showResults();
        } else {
            this.currentQuestionIndex++;
            this.displayQuestion();
        }
    }

    async showResults() {
        document.getElementById('exam-section').classList.add('hidden');
        document.getElementById('result-section').classList.remove('hidden');

        try {
            // 调用后端API计算结果
            const response = await fetch('/api/exam/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    questions: this.questions,
                    user_answers: this.userAnswers
                })
            });

            const result = await response.json();

            if (result.success) {
                this.examResults = result.results;
                
                document.getElementById('final-score-text').textContent = result.total_score;
                document.getElementById('total-questions').textContent = result.total_questions;
                document.getElementById('correct-count').textContent = result.correct_count;
                document.getElementById('wrong-count').textContent = result.total_questions - result.correct_count;
                document.getElementById('accuracy-rate').textContent = `${result.accuracy_rate.toFixed(1)}%`;
            } else {
                alert('结果计算失败: ' + result.error);
            }
        } catch (error) {
            alert('结果计算失败: ' + error.message);
        }
    }

    showDetails() {
        document.getElementById('result-section').classList.add('hidden');
        document.getElementById('details-section').classList.remove('hidden');

        const detailsContent = document.getElementById('details-content');
        detailsContent.innerHTML = '';

        this.examResults.forEach((result, index) => {
            const question = this.questions[index];
            const detailItem = document.createElement('div');
            detailItem.className = `detail-item ${result.is_correct ? 'correct' : 'wrong'}`;

            let explanationHtml = '';
            if (result.explanation && result.explanation.trim() !== '') {
                explanationHtml = `<div class="detail-explanation">解析: ${result.explanation}</div>`;
            }

            detailItem.innerHTML = `
                <div class="detail-question">第${index + 1}题: ${question.question}</div>
                <div class="detail-answer">您的答案: <span class="${result.is_correct ? 'detail-correct' : 'detail-wrong'}">${result.user_answer || '未作答'}</span></div>
                <div class="detail-answer">正确答案: <span class="detail-correct">${result.correct_answer}</span></div>
                <div class="detail-answer">得分: ${result.score}/${result.max_score}</div>
                ${explanationHtml}
            `;

            detailsContent.appendChild(detailItem);
        });
    }

    backToResult() {
        document.getElementById('details-section').classList.add('hidden');
        document.getElementById('result-section').classList.remove('hidden');
    }

    restart() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;
        this.examResults = [];

        document.getElementById('result-section').classList.add('hidden');
        document.getElementById('details-section').classList.add('hidden');
        document.getElementById('upload-section').classList.remove('hidden');

        // 重置文件输入
        document.getElementById('file-input').value = '';
        const fileInfo = document.getElementById('file-info');
        fileInfo.classList.add('hidden');
        fileInfo.style.background = '';
        fileInfo.style.borderColor = '';
        fileInfo.style.color = '';
        document.getElementById('start-exam-btn').classList.add('hidden');
    }
}

// 初始化考试系统
document.addEventListener('DOMContentLoaded', () => {
    new ExamSystem();
});

