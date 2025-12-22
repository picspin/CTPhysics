const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('temp_questions_raw.json', 'utf8'));

const finalQuestions = raw.map((item, index) => {
    let correctIdx = item.options.findIndex(opt => opt === item.correctAnswer);
    if (correctIdx === -1) {
        // Fallback or exact match failed, try trim
        correctIdx = item.options.findIndex(opt => opt.trim() === item.correctAnswer.trim());
    }
    if (correctIdx === -1) {
        // Still fail, log error or default to 0
        console.error(`Warning: Correct answer not found for Q${index + 1}: ${item.correctAnswer}`);
        correctIdx = 0;
    }

    return {
        id: index + 1,
        question: item.question,
        options: item.options,
        correctAnswer: correctIdx,
        explanation: item.explanation
    };
});

const output = {
    title: "CT Physics Review Questions",
    description: "Comprehensive review of CT physics concepts including Reconstruction, Helical CT, Dose, Cardiac CT, and Dual-Energy Physics.",
    questions: finalQuestions
};

fs.writeFileSync('data/questions.json', JSON.stringify(output, null, 2), 'utf8');
console.log('Successfully wrote data/questions.json with ' + finalQuestions.length + ' questions.');
