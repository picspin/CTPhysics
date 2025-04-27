'use client';

import React, { useState } from 'react';
import PageHeader from '../../PageHeader';
import SectionCard from '../../SectionCard';

// 从JSON文件导入数据
import questionsData from '../../questions.json';

export default function QuestionsPage() {
  const [expandedQuestions, setExpandedQuestions] = useState({});

  const toggleQuestion = (id) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <PageHeader 
        title={questionsData.title} 
        description={questionsData.description} 
      />
      
      <SectionCard 
        title="CT物理复习题"
        description="测试您对CT物理概念的理解"
        className="hover-lift"
      >
        <div className="space-y-6">
          {questionsData.questions && questionsData.questions.map((question, index) => (
            <div 
              key={`q${question.id}`}
              className="border-b border-border/30 pb-4 last:border-b-0 last:pb-0"
            >
              <div 
                className="flex cursor-pointer items-center justify-between py-2"
                onClick={() => toggleQuestion(`q${question.id}`)}
              >
                <h4 className="text-lg font-medium">{question.question}</h4>
                <span className="text-primary-100">
                  {expandedQuestions[`q${question.id}`] ? '−' : '+'}
                </span>
              </div>
              
              {expandedQuestions[`q${question.id}`] && (
                <div className="mt-2 space-y-4 rounded-lg bg-bg-200/50 p-4 text-text-200">
                  <div className="space-y-2">
                    <p className="font-medium">选项：</p>
                    <ul className="list-inside list-disc space-y-1">
                      {question.options.map((option, optIndex) => (
                        <li key={optIndex} className={optIndex === question.correctAnswer ? "text-primary-100 font-medium" : ""}>
                          {option} {optIndex === question.correctAnswer && "(正确答案)"}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">解释：</p>
                    <p>{question.explanation}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}