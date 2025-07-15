from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import tempfile
import json

app = Flask(__name__, static_folder='src/static')
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

# 启用CORS支持
CORS(app)

def parse_text_document(content):
    """解析文本内容，提取题目信息"""
    questions = []
    lines = content.split('\n')
    current_question = None
    question_type_marker = None
    options_start = False

    for line in lines:
        text = line.strip()
        if not text:
            continue

        # 检查题目类型标记 (兼容繁体和简体)
        if "单选题" in text or "单选题" in text:
            question_type_marker = "single"
            continue
        elif "多选题" in text or "多选题" in text:
            question_type_marker = "multiple"
            continue
        elif "判断题" in text or "判断题" in text:
            question_type_marker = "judge"
            continue

        # 检查是否是新题目
        # 题目开头是数字加点，且不是答案行
        if text.split(".")[0].isdigit() and "答案:" not in text and "答案：" not in text:
            if current_question:
                questions.append(current_question)
            
            current_question = {
                "id": len(questions) + 1,
                "type": question_type_marker if question_type_marker else "single",
                "question": text,
                "options": [],
                "answer": "",
                "score": 0,
                "explanation": ""
            }
            
            # 判断题不需要选项，直接设置为正确/错误
            if current_question["type"] == "judge":
                current_question["options"] = ["正确", "错误"]
                options_start = False
            else:
                options_start = True
                
        # 检查是否是选项
        elif options_start and (text.startswith(("A、", "B、", "C、", "D、", "E、", "F、")) or \
                               text.startswith(("A.", "B.", "C.", "D.", "E.", "F."))):
            if current_question:
                current_question["options"].append(text)
        # 检查是否是答案
        elif text.startswith("答案:") or text.startswith("答案："):
            if current_question:
                answer_text = text.replace("答案:", "").replace("答案：", "").strip()
                
                # 对判断题的答案进行标准化处理
                if current_question["type"] == "judge":
                    if answer_text.lower() in ["正确", "正确", "true", "t", "对", "对"]:
                        current_question["answer"] = "正确"
                    elif answer_text.lower() in ["错误", "错误", "false", "f", "错", "错"]:
                        current_question["answer"] = "错误"
                    else:
                        current_question["answer"] = answer_text
                else:
                    current_question["answer"] = answer_text
                    
                options_start = False 
                if current_question["type"] == "single":
                    current_question["score"] = 10
                elif current_question["type"] == "multiple":
                    current_question["score"] = 20
                elif current_question["type"] == "judge":
                    current_question["score"] = 5
        # 检查是否是解析
        elif text.startswith("解析:"):
            if current_question:
                current_question["explanation"] = text.replace("解析:", "").strip()

    if current_question:
        questions.append(current_question)

    return questions

@app.route("/api/exam/upload", methods=["POST"])
def upload_file():
    """处理文件上传和解析"""
    try:
        if "file" not in request.files:
            return jsonify({"error": "没有文件被上传"}), 400
        
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "没有选择文件"}), 400
        
        # 读取文件内容
        content = file.read().decode('utf-8', errors='ignore')
        
        # 解析文档
        questions = parse_text_document(content)
        
        return jsonify({
            "success": True,
            "questions": questions,
            "total_questions": len(questions),
            "total_score": sum(q["score"] for q in questions)
        })
    
    except Exception as e:
        return jsonify({"error": f"文件处理失败: {str(e)}"}), 500

@app.route("/api/exam/submit", methods=["POST"])
def submit_exam():
    """处理考试提交和计分"""
    try:
        data = request.get_json()
        questions = data.get("questions", [])
        user_answers = data.get("user_answers", [])
        
        results = []
        total_score = 0
        correct_count = 0
        
        for i, question in enumerate(questions):
            user_answer = user_answers[i] if i < len(user_answers) else ""
            
            # 处理判断题的答案比较
            if question["type"] == "judge":
                # 判断题答案可能是"正确"/"错误"或"T"/"F"
                correct_answer = question["answer"]
                if correct_answer.lower() in ["正确", "正确", "true", "t", "对", "对"]:
                    correct_answer = "正确"
                else:
                    correct_answer = "错误"
                    
                if user_answer.lower() in ["正确", "正确", "true", "t", "对", "对"]:
                    user_answer = "正确"
                elif user_answer.lower() in ["错误", "错误", "false", "f", "错", "错"]:
                    user_answer = "错误"
                    
                is_correct = user_answer == correct_answer
            else:
                # 对多选题的答案进行排序，以便比较
                if question["type"] == "multiple":
                    user_answer = "".join(sorted(user_answer))
                    question["answer"] = "".join(sorted(question["answer"]))
                
                is_correct = user_answer == question["answer"]

            score = question["score"] if is_correct else 0
            
            results.append({
                "question_id": question["id"],
                "user_answer": user_answer,
                "correct_answer": question["answer"] if question["type"] != "judge" else correct_answer,
                "is_correct": is_correct,
                "score": score,
                "max_score": question["score"],
                "explanation": question.get("explanation", "")
            })
            
            total_score += score
            if is_correct:
                correct_count += 1
        
        return jsonify({
            "success": True,
            "results": results,
            "total_score": total_score,
            "max_score": sum(q["score"] for q in questions),
            "correct_count": correct_count,
            "total_questions": len(questions),
            "accuracy_rate": (correct_count / len(questions)) * 100 if questions else 0
        })
    
    except Exception as e:
        return jsonify({"error": f"提交处理失败: {str(e)}"}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

