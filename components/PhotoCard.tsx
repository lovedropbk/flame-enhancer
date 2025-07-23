import React from 'react';
import { SelectedPhoto } from '../types'; // Assuming SelectedPhoto type is defined in types.ts

interface PhotoCardProps {
  photo: SelectedPhoto;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo }) => {
  return (
    <div className="bg-slate-700 bg-opacity-70 rounded-xl shadow-xl overflow-hidden flex flex-col h-full transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
      <img 
        src={photo.objectURL} 
        alt={photo.originalFileName || 'Selected user photo'} 
        className="w-full h-72 object-cover" // Increased height for better display
        onError={(e) => {
            const target = e.target as HTMLImageElement;
            // A more fitting placeholder for user uploads
            target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20600%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_17ba85278db%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3AHelvetica%2C%20monospace%3Bfont-size%3A20pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_17ba85278db%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%23374151%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22134.7109375%22%20y%3D%22309.3%22%3EImage%20Error%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';
            target.alt = 'Placeholder image due to error loading user content';
        }}
      />
      <div className="p-5 flex flex-col flex-grow">
        <h4 className="text-sm font-medium text-slate-400 mb-1 truncate" title={photo.originalFileName}>
          {photo.originalFileName}
        </h4>
        <p className="text-base text-slate-200 leading-relaxed flex-grow">
          <span className="font-semibold text-purple-300">Feedback: </span>{photo.reason || "No specific feedback provided."}
        </p>
      </div>
    </div>
  );
};

export default PhotoCard;