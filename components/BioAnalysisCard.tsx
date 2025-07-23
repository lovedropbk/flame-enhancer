import React, { useState, useCallback } from 'react';
import Button from './common/Button';

interface GeneratedBioCardProps {
  generatedBio: string;
}

const GeneratedBioCard: React.FC<GeneratedBioCardProps> = ({ generatedBio }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedBio).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy text: ", err);
      alert("Failed to copy text. Please try manually.");
    });
  }, [generatedBio]);

  return (
    <div className="bg-slate-700 bg-opacity-70 rounded-xl shadow-xl p-6">
      <h3 className="text-2xl font-semibold text-slate-100 mb-4">Your New Bio ✨</h3>
      <div className="p-4 bg-slate-800 rounded-md min-h-[120px] text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
        {generatedBio || "Bio generation in progress or encountered an issue..."}
      </div>
      {generatedBio && (
        <Button onClick={handleCopy} variant="primary" size="medium" className="mt-4 w-full sm:w-auto">
          {copied ? 'Copied to Clipboard!' : 'Copy Bio'}
        </Button>
      )}
    </div>
  );
};

export default GeneratedBioCard;