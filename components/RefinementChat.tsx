import React, { useState } from 'react';
import Button from './common/Button';

interface RefinementChatProps {
  onSubmit: (feedback: string) => void;
  isLoading: boolean;
  refinementsLeft: number;
}

const RefinementChat: React.FC<RefinementChatProps> = ({ onSubmit, isLoading, refinementsLeft }) => {
  const [feedbackText, setFeedbackText] = useState('');

  const canSubmit = !isLoading && refinementsLeft > 0 && feedbackText.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(feedbackText);
    setFeedbackText('');
  };

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          rows={3}
          placeholder={
            refinementsLeft > 0 
            ? "e.g., Make it sound more adventurous, add a joke about pineapple on pizza..." 
            : "You have used all your refinements for this session."
          }
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-100 placeholder-slate-400 disabled:bg-slate-800 disabled:cursor-not-allowed"
          disabled={isLoading || refinementsLeft <= 0}
          aria-label="Refine your bio further"
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-400">
            {refinementsLeft > 0 
                ? `${refinementsLeft} refinement${refinementsLeft > 1 ? 's' : ''} left.`
                : 'No refinements left.'
            }
          </p>
          <Button
            type="submit"
            variant="primary"
            size="medium"
            disabled={!canSubmit}
            className="flex items-center gap-2"
          >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refining...
                </>
            ) : (
                'Refine Bio'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RefinementChat;
