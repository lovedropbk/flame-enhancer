import React from 'react';

// This component is deprecated and replaced by QuestionnaireForm.tsx and PhotoUploadForm.tsx
// It's kept here temporarily during transition but should be removed later.

const ProfileInputForm_DEPRECATED: React.FC = () => {
  return (
    <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
      <h2 className="font-bold">Component Deprecated</h2>
      <p>This ProfileInputForm is no longer in use. Please refer to QuestionnaireForm.tsx and PhotoUploadForm.tsx for the new input methods.</p>
    </div>
  );
};

export default ProfileInputForm_DEPRECATED;