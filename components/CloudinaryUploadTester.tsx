

import React, { useState } from 'react';
import { uploadAndEnhanceImage } from '../services/cloudinaryService';
import Button from './common/Button';
import Alert from './common/Alert';

const CloudinaryUploadTester: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setStatus('idle');
            setResultUrl(null);
            setErrorMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setErrorMessage('Please select a file first.');
            setStatus('error');
            return;
        }

        setStatus('uploading');
        setErrorMessage(null);
        setResultUrl(null);

        try {
            const { enhanced } = await uploadAndEnhanceImage(selectedFile);
            setResultUrl(enhanced);
            setStatus('success');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setErrorMessage(message);
            setStatus('error');
            console.error("Upload test failed:", err);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 bg-slate-800 p-6 rounded-lg shadow-2xl border border-purple-500 max-w-sm w-11/12 z-50">
            <h3 className="text-xl font-bold mb-4 text-white">Cloudinary Upload Tester</h3>
            <div className="space-y-4">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                />

                <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || status === 'uploading'}
                    className="w-full"
                >
                    {status === 'uploading' ? 'Uploading...' : 'Test Upload & Enhance'}
                </Button>

                {status === 'error' && errorMessage && (
                    <Alert type="error" message={errorMessage} onClose={() => setStatus('idle')} />
                )}

                {status === 'success' && resultUrl && (
                    <div>
                        <Alert type="success" message="Upload successful!" onClose={() => setStatus('idle')} />
                        <div className="mt-4">
                            <p className="text-xs text-slate-400 break-words">Enhanced URL: <a href={resultUrl} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">{resultUrl}</a></p>
                            <img src={resultUrl} alt="Enhanced preview" className="mt-2 rounded-lg border-2 border-green-500" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CloudinaryUploadTester;