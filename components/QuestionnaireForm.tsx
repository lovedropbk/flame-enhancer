import React, { useState, useEffect } from 'react';
import { Question, QuestionnaireAnswers } from '../types';
import Button from './common/Button';
import ProgressBar from './common/ProgressBar'; // Import ProgressBar

interface QuestionnaireFormProps {
  questions: Question[];
  onSubmit: (answers: QuestionnaireAnswers) => void;
  onReset: () => void;
  initialAnswers?: QuestionnaireAnswers;
  title?: string;
  submitButtonText?: string;
  // baseQuestionIndex and totalQuestions are kept for potential future use if overall flow context is needed textually,
  // but they no longer drive the main progress bar's X of Y display.
  baseQuestionIndex?: number; 
  totalQuestions?: number; 
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
  questions,
  onSubmit,
  onReset,
  initialAnswers = {},
  title = "Tell Us About Yourself",
  submitButtonText = "Submit Answers",
  // baseQuestionIndex and totalQuestions are not directly used for stage progress bar anymore
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(() => {
    const initial: QuestionnaireAnswers = { ...initialAnswers };
    questions.forEach(q => {
      if (initial[q.id] === undefined) { 
        if (q.type === 'multiple-choice') {
          initial[q.id] = [];
        } else {
          initial[q.id] = '';
        }
      }
    });
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUnderageError, setIsUnderageError] = useState(false);
  
  useEffect(() => {
    setAnswers(prevAnswers => {
      const newAnswersState: QuestionnaireAnswers = { ...prevAnswers }; 
      questions.forEach(q => {
        if (newAnswersState[q.id] === undefined) {
           if (initialAnswers[q.id] !== undefined) { 
            newAnswersState[q.id] = initialAnswers[q.id];
          } else { 
            newAnswersState[q.id] = q.type === 'multiple-choice' ? [] : '';
          }
        }
      });
      return newAnswersState;
    });
    setCurrentQuestionIndex(0); 
    setErrors({});
    setIsUnderageError(false);
  }, [questions, initialAnswers]);


  const currentQuestion = questions[currentQuestionIndex];

  const handleChange = (id: string, value: string | string[], type: Question['type']) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors(prev => ({ ...prev, [id]: '' }));
    }
  };

  const validateCurrentQuestion = (): boolean => {
    if (!currentQuestion) return false;
    const newErrors: Record<string, string> = { ...errors };
    let isValid = true;
    const answer = answers[currentQuestion.id];

    // Reset underage error flag before validation
    if (currentQuestion.id === 'q0_age') {
        setIsUnderageError(false);
    }

    if (currentQuestion.id === 'q18_free_text') {
      delete newErrors[currentQuestion.id]; 
      setErrors(newErrors);
      return true;
    }
    
    if (currentQuestion.id === 'q0_age') {
        const ageNum = parseInt(answer as string, 10);
        if (isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
            newErrors[currentQuestion.id] = 'Please enter a valid age.';
            isValid = false;
        } else if (ageNum < 18) {
            newErrors[currentQuestion.id] = 'Sorry, you must be 18 or older to use this service.';
            isValid = false;
            setIsUnderageError(true);
        } else {
            delete newErrors[currentQuestion.id];
        }
    } else if (currentQuestion.type === 'multiple-choice') {
      if (!answer || (answer as string[]).length === 0) {
        newErrors[currentQuestion.id] = 'Please select at least one option.';
        isValid = false;
      } else {
        delete newErrors[currentQuestion.id];
      }
    } else {
      if (answer === undefined || (typeof answer === 'string' && (answer as string).trim() === '')) {
        newErrors[currentQuestion.id] = 'This field is required.';
        isValid = false;
      } else {
        delete newErrors[currentQuestion.id];
      }
    }
    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    if (validateCurrentQuestion()) {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        const currentSetAnswers: QuestionnaireAnswers = {};
        questions.forEach(q => {
            currentSetAnswers[q.id] = answers[q.id];
        });
        onSubmit(currentSetAnswers);
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const renderQuestionInput = (q: Question) => {
    if (!q) return null; 
    const error = errors[q.id];
    const commonInputClass = `w-full p-3 bg-slate-700 border ${error ? 'border-red-500' : 'border-slate-600'} rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-150 ease-in-out placeholder-slate-400 text-slate-100`;

    switch (q.type) {
      case 'text':
        return (
          <input
            type={q.id === 'q0_age' ? 'number' : 'text'}
            id={q.id}
            value={(answers[q.id] as string) || ''}
            onChange={(e) => handleChange(q.id, e.target.value, q.type)}
            placeholder={q.placeholder}
            className={commonInputClass}
            aria-describedby={error ? `${q.id}-error` : undefined}
            min={q.id === 'q0_age' ? 1 : undefined}
          />
        );
      case 'longtext':
        return (
          <textarea
            id={q.id}
            value={(answers[q.id] as string) || ''}
            onChange={(e) => handleChange(q.id, e.target.value, q.type)}
            rows={5}
            placeholder={q.placeholder}
            className={commonInputClass}
            aria-describedby={error ? `${q.id}-error` : undefined}
          />
        );
      case 'single-choice':
        return (
          <div className="space-y-3">
            {q.options?.map(option => (
              <label key={option} className={`flex items-center p-3.5 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-colors border border-slate-600 has-[:checked]:bg-purple-600 has-[:checked]:border-purple-500 ${error ? 'border-red-500' : ''}`}>
                <input
                  type="radio"
                  name={q.id}
                  value={option}
                  checked={(answers[q.id] as string) === option}
                  onChange={(e) => handleChange(q.id, e.target.value, q.type)}
                  className="form-radio h-5 w-5 text-purple-500 focus:ring-purple-400 bg-slate-800 border-slate-500"
                />
                <span className="ml-3 text-slate-200">{option}</span>
              </label>
            ))}
          </div>
        );
      case 'multiple-choice':
        return (
          <div className="space-y-3">
            {q.options?.map(option => (
              <label key={option} className={`flex items-center p-3.5 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-colors border border-slate-600 has-[:checked]:bg-purple-600 has-[:checked]:border-purple-500 ${error ? 'border-red-500' : ''}`}>
                <input
                  type="checkbox"
                  value={option}
                  checked={((answers[q.id] as string[]) || []).includes(option)}
                  onChange={(e) => {
                    const currentSelection = (answers[q.id] as string[]) || [];
                    const newSelection = e.target.checked
                      ? [...currentSelection, option]
                      : currentSelection.filter(item => item !== option);
                    handleChange(q.id, newSelection, q.type);
                  }}
                  className="form-checkbox h-5 w-5 text-purple-500 focus:ring-purple-400 rounded bg-slate-800 border-slate-500"
                />
                <span className="ml-3 text-slate-200">{option}</span>
              </label>
            ))}
          </div>
        );
      default:
        return null;
    }
  };
  
  // Progress calculation for the current stage
  const currentStageStep = currentQuestionIndex + 1;
  const totalStageSteps = questions.length;
  const progressPercentage = (totalStageSteps > 0) ? (currentStageStep / totalStageSteps) * 100 : 0;


  if (!currentQuestion) {
    return <div className="text-center text-slate-400">Loading questions or no questions available for this step.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">{title}</h2>
        <p className="text-slate-300 mb-4">Your answers will help craft a unique and engaging profile bio. Be thoughtful and honest!</p>
        {/* ProgressBar now uses stage-specific progress */}
        <ProgressBar percentage={progressPercentage} currentStep={currentStageStep} totalSteps={totalStageSteps} />
      </div>

      <div className="bg-slate-700/50 p-6 rounded-lg shadow-xl min-h-[300px] flex flex-col justify-between">
        <div>
          <label htmlFor={currentQuestion.id} className="block text-xl font-semibold text-slate-100 mb-3">
            {currentQuestion.text}
            {currentQuestion.id !== 'q18_free_text' && <span className="text-red-400 ml-1">*</span>}
          </label>
          {renderQuestionInput(currentQuestion)}
          {errors[currentQuestion.id] && <p id={`${currentQuestion.id}-error`} className="text-red-400 text-sm mt-2">{errors[currentQuestion.id]}</p>}
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-4">
        <div className="flex gap-2">
            <Button
              type="button"
              onClick={handlePrevious}
              variant="secondary"
              size="medium"
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            {isUnderageError && (
                <Button
                    type="button"
                    onClick={onReset}
                    variant="danger"
                    size="medium"
                >
                    Start Over
                </Button>
            )}
        </div>
        <Button
          type="button"
          onClick={handleNext}
          variant="primary"
          size="medium"
        >
          {currentQuestionIndex === questions.length - 1 ? submitButtonText : 'Next Question'}
        </Button>
      </div>
    </div>
  );
};

export default QuestionnaireForm;