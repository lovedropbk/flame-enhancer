
import React from 'react';

const ChecklistItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start">
    <svg className="flex-shrink-0 w-6 h-6 text-purple-400 mr-2 mt-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
    <span className="text-slate-300">{children}</span>
  </li>
);

const Checklist: React.FC = () => {
  return (
    <div className="bg-slate-700 bg-opacity-70 rounded-xl shadow-xl p-6">
      <h3 className="text-2xl font-semibold text-slate-100 mb-4">Profile Update Checklist</h3>
      <ul className="space-y-3">
        <ChecklistItem>
          <strong>Use High-Quality Photos:</strong> Ensure your photos are well-lit, clear, and showcase you authentically. Avoid blurry or heavily filtered images.
        </ChecklistItem>
        <ChecklistItem>
          <strong>Variety is Key:</strong> Include a mix of photo types (headshot, full body, activity, social) to give a well-rounded impression of your personality and lifestyle.
        </ChecklistItem>
        <ChecklistItem>
          <strong>Show, Don't Just Tell:</strong> Let your photos illustrate your hobbies and interests rather than just listing them in your bio.
        </ChecklistItem>
        <ChecklistItem>
          <strong>Craft an Engaging Bio:</strong> Use the AI-suggested bio as a starting point. Make sure it reflects your personality, is positive, and includes a conversation starter or a hint of your humor.
        </ChecklistItem>
        <ChecklistItem>
          <strong>Be Specific:</strong> Instead of "I like travel," try "Just got back from hiking in Patagonia, ask me about it!"
        </ChecklistItem>
        <ChecklistItem>
          <strong>Proofread Carefully:</strong> Check for typos and grammatical errors in your bio and any text on photos.
        </ChecklistItem>
        <ChecklistItem>
          <strong>Update Regularly:</strong> Keep your profile fresh by updating photos and bio content periodically.
        </ChecklistItem>
         <ChecklistItem>
          <strong>Link Socials (Optional but Recommended):</strong> If comfortable, linking Instagram can provide more insight into your life (ensure it's curated).
        </ChecklistItem>
      </ul>
    </div>
  );
};

export default Checklist;
    