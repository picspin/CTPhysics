'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/Button';

// 从JSON文件导入数据
import questionsData from '@/data/questions.json';

// Utility to shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function QuestionsPage() {
  const [activeQuestions, setActiveQuestions] = useState<typeof questionsData.questions>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  // Initialize random questions on client mount
  useEffect(() => {
    // Pick 10 random questions
    const shuffled = shuffleArray(questionsData.questions);
    setActiveQuestions(shuffled.slice(0, 10));
  }, []);

  const handleOptionSelect = (questionId: number, optionIndex: number) => {
    if (isSubmitted) return;
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmit = () => {
    let correctCount = 0;
    activeQuestions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const finalScore = (correctCount / activeQuestions.length) * 100;
    setScore(finalScore);
    setIsSubmitted(true);

    if (finalScore >= 60) {
      triggerConfetti();
    }

    // Scroll to top to see score
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRestart = () => {
    setUserAnswers({});
    setIsSubmitted(false);
    setScore(0);
    // Re-shuffle for a new test experience
    const shuffled = shuffleArray(questionsData.questions);
    setActiveQuestions(shuffled.slice(0, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const allAnswered = activeQuestions.length > 0 &&
    activeQuestions.every(q => userAnswers[q.id] !== undefined);

  if (activeQuestions.length === 0) {
    return <div className="p-8 text-center text-text-200">正在加载试题...</div>;
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-10">
      <PageHeader
        title={questionsData.title}
        description={isSubmitted ? `测试完成！得分: ${score}。` : "本次随机抽取10道题，每题10分，满分100分。"}
      />

      {isSubmitted && (
        <div className="rounded-xl border border-border-100 bg-bg-200 p-8 text-center shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-text-100 mb-2">测试结果</h2>
            <div className={`text-6xl font-bold mb-4 ${score >= 60 ? 'text-green-500' : 'text-primary-100'}`}>
              {score.toFixed(0)} <span className="text-2xl text-text-300">分</span>
            </div>
            <p className="text-text-200 mb-6">
              {score === 100 ? "完美！你掌握了所有知识点！" :
                score >= 80 ? "优秀！对CT物理原理非常熟悉。" :
                  score >= 60 ? "及格。建议复习一下错题涉及的知识点。" :
                    "请继续加油！建议重新学习相关章节。"}
            </p>
            <Button onClick={handleRestart} variant="primary">
              重新测试 (新试题)
            </Button>
          </div>
          {/* Background decoration */}
          <div className={`absolute inset-0 opacity-10 ${score >= 60 ? 'bg-green-500' : 'bg-primary-100'}`}></div>
        </div>
      )}

      <div className="space-y-6">
        {activeQuestions.map((question, index) => {
          const userAnswer = userAnswers[question.id];
          const isCorrect = isSubmitted && userAnswer === question.correctAnswer;
          const isWrong = isSubmitted && userAnswer !== undefined && userAnswer !== question.correctAnswer;

          return (
            <SectionCard
              key={question.id}
              title={`${index + 1}. ${question.question}`}
              className={isSubmitted ? (isCorrect ? "border-green-500/30" : isWrong ? "border-red-500/30" : "") : ""}
            >
              <div className="space-y-4">
                <div className="grid gap-3">
                  {question.options.map((option, optIndex) => {
                    let optionClass = "p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between ";

                    if (isSubmitted) {
                      if (optIndex === question.correctAnswer) {
                        optionClass += "bg-green-500/10 border-green-500 text-green-400"; // Correct answer always green
                      } else if (optIndex === userAnswer && userAnswer !== question.correctAnswer) {
                        optionClass += "bg-red-500/10 border-red-500 text-red-400"; // Wrong selection red
                      } else {
                        optionClass += "bg-bg-300 border-transparent opacity-50"; // Others dimmed
                      }
                    } else {
                      if (userAnswer === optIndex) {
                        optionClass += "bg-primary-100/20 border-primary-100 text-primary-100";
                      } else {
                        optionClass += "bg-bg-300 border-transparent hover:bg-bg-400 hover:border-border-200";
                      }
                    }

                    return (
                      <div
                        key={optIndex}
                        className={optionClass}
                        onClick={() => handleOptionSelect(question.id, optIndex)}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${isSubmitted
                            ? (optIndex === question.correctAnswer ? "border-green-500 bg-green-500 text-black" : (userAnswer === optIndex ? "border-red-500 bg-red-500 text-white" : "border-gray-500 text-gray-500"))
                            : (userAnswer === optIndex ? "border-primary-100 bg-primary-100 text-white" : "border-gray-500 text-gray-500")
                            }`}>
                            {String.fromCharCode(65 + optIndex)}
                          </span>
                          {option}
                        </span>

                        {isSubmitted && optIndex === question.correctAnswer && (
                          <span className="text-green-500 text-sm font-bold">✓ 正确答案</span>
                        )}
                        {isSubmitted && userAnswer === optIndex && userAnswer !== question.correctAnswer && (
                          <span className="text-red-500 text-sm font-bold">✕ 你的选择</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isSubmitted && (
                  <div className={`mt-4 rounded-lg p-4 text-sm ${isCorrect ? 'bg-green-900/20 border border-green-900/30' : 'bg-red-900/20 border border-red-900/30'}`}>
                    <div className="font-bold mb-1 flex items-center gap-2">
                      {isCorrect ? (
                        <span className="text-green-400">🎉 回答正确</span>
                      ) : (
                        <span className="text-red-400">🤔 回答错误</span>
                      )}
                    </div>
                    <div className="text-text-200">
                      <span className="font-semibold text-text-100">解析：</span>
                      {question.explanation}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          );
        })}
      </div>

      {!isSubmitted && (
        <div className="flex justify-center pt-8">
          <Button
            onClick={handleSubmit}
            variant="primary"
            className="w-full md:w-1/3 py-4 text-lg font-bold shadow-xl shadow-primary-100/20"
            disabled={!allAnswered}
          >
            {allAnswered ? "提交试卷" : `完成剩余 ${10 - Object.keys(userAnswers).length} 道题后提交`}
          </Button>
        </div>
      )}
    </div>
  );
}
