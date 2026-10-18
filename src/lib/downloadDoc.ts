import toast from 'react-hot-toast';
import { auth } from './firebase';

/** Downloads an audience-restricted doc as HTML using the caller's ID token (plain navigation sends no token -> 404). */
export async function downloadDocHtml(docId: string, filename: string, successMsg: string): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/admin/docs/${docId}?format=html&download=1`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      toast.error(res.status === 404 || res.status === 401 || res.status === 403
        ? 'This document is not available for your account. Sign in with the right access and try again.'
        : 'Download failed. Please try again.');
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(successMsg);
  } catch {
    toast.error('Download failed. Check your connection and try again.');
  }
}
